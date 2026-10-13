import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Dimensions,
  StatusBar,
  Animated,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAssistant } from '../../store/AssistantStore';
import { PermissionService } from '../../services/PermissionService';
import { MediaService } from '../../services/MediaService';
import { DeviceAlbum, DevicePhoto } from '../../native/MediaNative';
import { Icon } from '../common/Icon';
import { spacing, radius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { MediaAttachment } from '../../ai/AgentTypes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 3;
const NUM_COLUMNS = 3;
const ITEM_SIZE = (SCREEN_WIDTH - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const PAGE_SIZE = 24;

// Professional Shimmer Skeleton Cell
const ShimmerGridItem: React.FC<{ shimmerAnim: Animated.Value; surfaceColor: string; borderColor: string }> = React.memo(
  ({ shimmerAnim, surfaceColor, borderColor }) => (
    <Animated.View
      style={[
        styles.gridItem,
        styles.shimmerCell,
        {
          backgroundColor: surfaceColor,
          borderColor,
          opacity: shimmerAnim,
        },
      ]}
    >
      <View style={styles.shimmerIconPlaceholder}>
        <Icon name="image" size={18} color="#71717A" />
      </View>
    </Animated.View>
  )
);

export const MultiImagePickerModal: React.FC = () => {
  const { activeModal, closeModal, addAttachments, theme, themeMode } = useAssistant();
  const insets = useSafeAreaInsets();
  const isVisible = activeModal === 'image_picker_modal';

  const [albums, setAlbums] = useState<DeviceAlbum[]>([]);
  const [activeAlbumId, setActiveAlbumId] = useState<string>('all');
  const [photos, setPhotos] = useState<DevicePhoto[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<DevicePhoto[]>([]);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState<boolean>(false);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  // Smooth UI-thread Shimmer Animation
  const shimmerAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 0.75,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [shimmerAnim]);

  // Load albums when modal opens and media permission is confirmed
  const loadDeviceMedia = useCallback(async () => {
    setIsLoadingAlbums(true);
    try {
      const hasPerm = await PermissionService.requestMediaLibrary();
      if (!hasPerm) {
        Alert.alert(
          'Media Permission Required',
          'Sara AI needs access to your media library to display and attach photos.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => closeModal() },
            { text: 'Settings', onPress: () => PermissionService.openAppSettings() },
          ]
        );
        setIsLoadingAlbums(false);
        return;
      }

      const fetchedAlbums = await MediaService.getAlbums(true);
      setAlbums(fetchedAlbums);
      const initialAlbumId = fetchedAlbums.length > 0 ? fetchedAlbums[0].id : 'all';
      setActiveAlbumId(initialAlbumId);

      // Load first page of photos
      setIsLoadingPhotos(true);
      const { photos: initialPhotos, hasMore: more } = await MediaService.getPhotos(
        initialAlbumId === 'all' ? null : initialAlbumId,
        1,
        PAGE_SIZE
      );
      setPhotos(initialPhotos);
      setHasMore(more);
      setPage(1);
    } catch (e) {
      console.warn('[MultiImagePickerModal] loadDeviceMedia error:', e);
    } finally {
      setIsLoadingAlbums(false);
      setIsLoadingPhotos(false);
    }
  }, [closeModal]);

  useEffect(() => {
    if (isVisible) {
      setSelectedPhotos([]);
      loadDeviceMedia();
    }
  }, [isVisible, loadDeviceMedia]);

  // Switch album handler
  const handleSelectAlbum = async (albumId: string) => {
    if (albumId === activeAlbumId) return;
    setActiveAlbumId(albumId);
    setPhotos([]);
    setPage(1);
    setIsLoadingPhotos(true);

    try {
      const { photos: albumPhotos, hasMore: more } = await MediaService.getPhotos(
        albumId === 'all' ? null : albumId,
        1,
        PAGE_SIZE
      );
      setPhotos(albumPhotos);
      setHasMore(more);
    } catch (e) {
      console.warn('[MultiImagePickerModal] album switch error:', e);
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  // Pagination handler
  const handleLoadMore = async () => {
    if (!hasMore || isLoadingMore || isLoadingPhotos) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;

    try {
      const { photos: morePhotos, hasMore: more } = await MediaService.getPhotos(
        activeAlbumId === 'all' ? null : activeAlbumId,
        nextPage,
        PAGE_SIZE
      );
      setPhotos(prev => [...prev, ...morePhotos]);
      setHasMore(more);
      setPage(nextPage);
    } catch (e) {
      console.warn('[MultiImagePickerModal] loadMore error:', e);
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (!isVisible) return null;

  const toggleSelectPhoto = (photo: DevicePhoto) => {
    setSelectedPhotos(prev => {
      const exists = prev.some(p => p.id === photo.id);
      if (exists) {
        return prev.filter(p => p.id !== photo.id);
      }
      return [...prev, photo];
    });
  };

  const handleSelectAllInAlbum = () => {
    if (selectedPhotos.length === photos.length && photos.length > 0) {
      setSelectedPhotos([]);
    } else {
      setSelectedPhotos(photos);
    }
  };

  const handleConfirm = () => {
    if (selectedPhotos.length === 0) {
      closeModal();
      return;
    }

    const attachments: MediaAttachment[] = selectedPhotos.map(photo => ({
      id: `img-${Date.now()}-${photo.id}`,
      type: 'image',
      uri: photo.uri,
      name: photo.name || 'Device Photo',
      timestamp: photo.timestamp || Date.now(),
    }));

    addAttachments(attachments);
    setSelectedPhotos([]);
    closeModal();
  };

  const handleClose = () => {
    setSelectedPhotos([]);
    closeModal();
  };

  const renderPhotoItem = ({ item }: { item: DevicePhoto }) => {
    const isSelected = selectedPhotos.some(p => p.id === item.id);
    const selectionIndex = selectedPhotos.findIndex(p => p.id === item.id) + 1;

    return (
      <TouchableOpacity
        activeOpacity={0.78}
        onPress={() => toggleSelectPhoto(item)}
        style={[
          styles.gridItem,
          isSelected && { borderColor: theme.accent, borderWidth: 2 },
        ]}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.thumbnail}
          resizeMode="cover"
        />

        {/* Selection Check Badge */}
        <View
          style={[
            styles.selectionBadge,
            isSelected
              ? { backgroundColor: theme.accent, borderColor: theme.accent }
              : { backgroundColor: 'rgba(0,0,0,0.38)', borderColor: 'rgba(255,255,255,0.7)' },
          ]}
        >
          {isSelected ? (
            <Text style={styles.badgeIndexText}>{selectionIndex}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={[styles.root, { backgroundColor: theme.background, paddingTop: Math.max(insets.top, 20) }]}>
        <StatusBar
          barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor={theme.background}
          translucent
        />

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.borderSubtle }]}>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
            onPress={handleClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="close" size={14} color={theme.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerTitleCol}>
            <Text style={[typography.h3, { color: theme.textPrimary }]}>Device Gallery</Text>
            <Text style={[typography.caption, { color: theme.textMuted }]}>
              {selectedPhotos.length === 0
                ? 'Select photos to attach'
                : `${selectedPhotos.length} ${selectedPhotos.length === 1 ? 'photo' : 'photos'} selected`}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.selectAllBtn, { borderColor: theme.border }]}
            onPress={handleSelectAllInAlbum}
          >
            <Text style={[styles.selectAllText, { color: theme.textPrimary }]}>
              {selectedPhotos.length === photos.length && photos.length > 0 ? 'Clear' : 'All'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Albums Horizontal Carousel */}
        <View style={styles.albumSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.albumScroll}
          >
            {isLoadingAlbums ? (
              <View style={styles.albumsLoadingRow}>
                <ActivityIndicator size="small" color={theme.textMuted} />
                <Text style={[typography.caption, { color: theme.textMuted, marginLeft: 8 }]}>
                  Loading albums...
                </Text>
              </View>
            ) : albums.length === 0 ? (
              <View style={styles.albumPillActive}>
                <Text style={styles.albumTitleActive}>All Photos</Text>
              </View>
            ) : (
              albums.map(album => {
                const isSelected = activeAlbumId === album.id;
                return (
                  <TouchableOpacity
                    key={album.id}
                    activeOpacity={0.7}
                    onPress={() => handleSelectAlbum(album.id)}
                    style={[
                      styles.albumPill,
                      isSelected
                        ? [styles.albumPillActive, { backgroundColor: theme.surfaceElevated, borderColor: theme.accent }]
                        : [styles.albumPillInactive, { backgroundColor: theme.surfaceSubtle, borderColor: theme.borderSubtle }],
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.albumTitle,
                        { color: isSelected ? theme.textPrimary : theme.textSecondary },
                      ]}
                    >
                      {album.title}
                    </Text>
                    <Text
                      style={[
                        styles.albumCount,
                        { color: isSelected ? theme.textPrimary : theme.textMuted },
                      ]}
                    >
                      {album.count}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>

        {/* Photos Grid Area */}
        <View style={styles.gridContainer}>
          {isLoadingPhotos ? (
            <View style={styles.shimmerGrid}>
              {Array.from({ length: 15 }).map((_, idx) => (
                <ShimmerGridItem
                  key={`shimmer-${idx}`}
                  shimmerAnim={shimmerAnim}
                  surfaceColor={theme.surfaceSubtle}
                  borderColor={theme.borderSubtle}
                />
              ))}
            </View>
          ) : photos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="image" size={36} color={theme.textMuted} />
              <Text style={[typography.body, { color: theme.textSecondary, marginTop: 12 }]}>
                No photos found in this album
              </Text>
            </View>
          ) : (
            <FlatList
              data={photos}
              keyExtractor={item => item.id}
              renderItem={renderPhotoItem}
              numColumns={NUM_COLUMNS}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.4}
              initialNumToRender={18}
              maxToRenderPerBatch={18}
              windowSize={5}
              ListFooterComponent={
                isLoadingMore ? (
                  <View style={styles.paginationShimmerRow}>
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <ShimmerGridItem
                        key={`more-shimmer-${idx}`}
                        shimmerAnim={shimmerAnim}
                        surfaceColor={theme.surfaceSubtle}
                        borderColor={theme.borderSubtle}
                      />
                    ))}
                  </View>
                ) : null
              }
            />
          )}
        </View>

        {/* Bottom Attachment Confirmation Bar */}
        {selectedPhotos.length > 0 && (
          <View
            style={[
              styles.bottomConfirmBar,
              {
                backgroundColor: theme.surface,
                borderTopColor: theme.borderSubtle,
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: theme.textPrimary }]}
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <Icon
                name="check"
                size={16}
                color={themeMode === 'dark' ? '#000000' : '#FFFFFF'}
              />
              <Text
                style={[
                  styles.confirmBtnText,
                  { color: themeMode === 'dark' ? '#000000' : '#FFFFFF' },
                ]}
              >
                Attach {selectedPhotos.length} {selectedPhotos.length === 1 ? 'Photo' : 'Photos'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCol: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  selectAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  selectAllText: {
    fontSize: 12,
    fontWeight: '600',
  },
  albumSection: {
    paddingVertical: spacing.xs,
  },
  albumScroll: {
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  albumsLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  albumPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  albumPillActive: {
    borderWidth: 1.5,
  },
  albumPillInactive: {
    borderWidth: 1,
  },
  albumTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  albumTitleActive: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  albumCount: {
    fontSize: 11,
    fontWeight: '400',
  },
  gridContainer: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 40,
  },
  gridItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    marginRight: GRID_GAP,
    marginBottom: GRID_GAP,
    backgroundColor: '#18181B',
    position: 'relative',
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  shimmerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  shimmerCell: {
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shimmerIconPlaceholder: {
    opacity: 0.35,
  },
  paginationShimmerRow: {
    flexDirection: 'row',
    marginTop: GRID_GAP,
  },
  selectionBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIndexText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  bottomConfirmBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: radius.lg,
    gap: 8,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

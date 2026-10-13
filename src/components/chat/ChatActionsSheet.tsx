import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  PanResponder,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAssistant } from '../../store/AssistantStore';
import { PermissionService } from '../../services/PermissionService';
import { Icon } from '../common/Icon';
import { SmoothSwitch } from '../common/SmoothSwitch';
import { spacing, radius } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Precise snap points for the bottom sheet
const SHEET_HEIGHT = Math.min(Math.round(SCREEN_HEIGHT * 0.74), 600);
const SNAP_EXPANDED = 0;
const SNAP_CLOSED = SHEET_HEIGHT + 40;

export const ChatActionsSheet: React.FC = () => {
  const {
    activeModal,
    closeModal,
    openModal,
    theme,
    isDeepSearchActive,
    toggleDeepSearch,
    isCreateImageActive,
    toggleCreateImage,
    isCreateAudioActive,
    toggleCreateAudio,
    isCreateVideoActive,
    toggleCreateVideo,
  } = useAssistant();

  const insets = useSafeAreaInsets();
  const isVisible = activeModal === 'actions_sheet';

  // Hardware-accelerated vertical translation
  const translateY = useRef(new Animated.Value(SNAP_CLOSED)).current;
  const currentTranslateY = useRef<number>(SNAP_CLOSED);
  const startTranslateY = useRef<number>(SNAP_CLOSED);
  const isDragging = useRef<boolean>(false);
  const isAnimating = useRef<boolean>(false);

  // Physics-based spring snapping with velocity preservation
  const snapTo = useCallback(
    (toValue: number, velocity: number = 0, onComplete?: () => void) => {
      isAnimating.current = true;
      currentTranslateY.current = toValue;
      const clampedV = Math.max(-2.2, Math.min(2.2, velocity));

      Animated.spring(translateY, {
        toValue,
        velocity: clampedV,
        damping: 26,
        mass: 0.8,
        stiffness: 260,
        overshootClamping: true,
        restDisplacementThreshold: 0.1,
        restSpeedThreshold: 0.1,
        useNativeDriver: true,
      }).start(({ finished }) => {
        isAnimating.current = false;
        if (finished) {
          onComplete?.();
        }
      });
    },
    [translateY]
  );

  // Animate sheet opening when modal becomes visible
  useEffect(() => {
    if (isVisible) {
      translateY.setValue(SNAP_CLOSED);
      currentTranslateY.current = SNAP_CLOSED;
      snapTo(SNAP_EXPANDED, 0);
    } else {
      translateY.setValue(SNAP_CLOSED);
      currentTranslateY.current = SNAP_CLOSED;
    }
  }, [isVisible, translateY, snapTo]);

  const handleClose = (velocity: number = 0) => {
    snapTo(SNAP_CLOSED, velocity, () => {
      closeModal();
    });
  };

  // Permission-gated camera launcher
  const handleOpenCustomCamera = async () => {
    const hasPermission = await PermissionService.requestCamera();
    if (!hasPermission) {
      Alert.alert(
        'Camera Permission Required',
        'Sara AI requires camera access to capture photos and documents for chat analysis.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: () => PermissionService.openAppSettings() },
        ]
      );
      return;
    }

    snapTo(SNAP_CLOSED, 0, () => {
      closeModal();
      setTimeout(() => openModal('camera_modal'), 60);
    });
  };

  // Permission-gated media gallery launcher
  const handleOpenMultiImagePicker = async () => {
    const hasPermission = await PermissionService.requestMediaLibrary();
    if (!hasPermission) {
      Alert.alert(
        'Photo Access Required',
        'Sara AI requires access to your photo library to attach images to conversations.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: () => PermissionService.openAppSettings() },
        ]
      );
      return;
    }

    snapTo(SNAP_CLOSED, 0, () => {
      closeModal();
      setTimeout(() => openModal('image_picker_modal'), 60);
    });
  };

  // 1:1 Thumb-controlled pan responder across the entire sheet
  const panResponder = useRef(
    PanResponder.create({
      // Interrupt running animation immediately if user touches screen mid-flight
      onStartShouldSetPanResponderCapture: () => isAnimating.current,

      // Capture vertical gesture when movement exceeds threshold and is primarily vertical
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dy) > 5 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
      },
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        return Math.abs(gesture.dy) > 7 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
      },

      onPanResponderGrant: () => {
        isDragging.current = true;
        isAnimating.current = false;
        translateY.stopAnimation((val) => {
          currentTranslateY.current = val;
          startTranslateY.current = val;
        });
        startTranslateY.current = currentTranslateY.current;
      },

      onPanResponderMove: (_, gesture) => {
        if (!isDragging.current) return;

        // Strict 1:1 finger tracking
        let nextPos = startTranslateY.current + gesture.dy;

        // Subtle elastic resistance if dragged above top boundary
        if (nextPos < SNAP_EXPANDED) {
          nextPos = SNAP_EXPANDED + (nextPos - SNAP_EXPANDED) * 0.18;
        }

        currentTranslateY.current = nextPos;
        translateY.setValue(nextPos);
      },

      onPanResponderRelease: (_, gesture) => {
        isDragging.current = false;
        const currentPos = currentTranslateY.current;
        const vy = gesture.vy;

        // Downward flick or dragged past 35% of sheet height -> dismiss
        if (vy > 0.45 || (currentPos > SHEET_HEIGHT * 0.35 && vy > -0.2)) {
          handleClose(vy);
          return;
        }

        // Upward flick or release near top -> snap open
        snapTo(SNAP_EXPANDED, vy);
      },

      onPanResponderTerminate: (_evt, gesture) => {
        isDragging.current = false;
        const currentPos = currentTranslateY.current;
        if (currentPos > SHEET_HEIGHT * 0.35) {
          handleClose(gesture.vy || 0);
        } else {
          snapTo(SNAP_EXPANDED, gesture.vy || 0);
        }
      },
    })
  ).current;

  if (!isVisible) return null;

  // Backdrop opacity smoothly interpolates with sheet translation
  const backdropOpacity = translateY.interpolate({
    inputRange: [SNAP_EXPANDED, SNAP_CLOSED],
    outputRange: [0.55, 0],
    extrapolate: 'clamp',
  });

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="none"
      onRequestClose={() => handleClose(0)}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop Scrim with Tap to Dismiss */}
        <TouchableWithoutFeedback onPress={() => handleClose(0)}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: backdropOpacity,
              },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Gesture-Driven Interactive Bottom Sheet */}
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.sheetContainer,
            {
              maxHeight: SHEET_HEIGHT,
              backgroundColor: theme.surface,
              borderColor: theme.border,
              paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.xs,
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Thumb Drag Zone: Header and Handle */}
          <View style={styles.dragZone}>
            {/* Centered Drag Handle */}
            <View style={styles.dragHandleWrapper}>
              <View
                style={[
                  styles.dragHandle,
                  {
                    backgroundColor: theme.border,
                  },
                ]}
              />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitles}>
                <Text style={[typography.h2, { color: theme.textPrimary }]}>
                  Actions & Tools
                </Text>
                <Text style={[typography.caption, { color: theme.textMuted, marginTop: 2 }]}>
                  Capture photos or select creative AI engines
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                onPress={() => handleClose(0)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Close actions sheet"
              >
                <Icon name="close" size={14} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Top Media Row: Symmetrical, Flex-Contained Camera & Gallery Tiles */}
            <View style={styles.topMediaRow}>
              {/* Camera Tile */}
              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.mediaTile,
                  {
                    backgroundColor: theme.surfaceSubtle,
                    borderColor: theme.border,
                  },
                ]}
                onPress={handleOpenCustomCamera}
              >
                <View style={[styles.mediaIconBox, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                  <Icon name="camera" size={17} color={theme.textPrimary} />
                </View>
                <View style={styles.mediaTileText}>
                  <Text numberOfLines={1} style={[typography.bodyBold, styles.tileTitle, { color: theme.textPrimary }]}>
                    Camera
                  </Text>
                  <Text numberOfLines={1} style={[typography.caption, { color: theme.textMuted }]}>
                    Take photos
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Gallery Tile */}
              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.mediaTile,
                  {
                    backgroundColor: theme.surfaceSubtle,
                    borderColor: theme.border,
                  },
                ]}
                onPress={handleOpenMultiImagePicker}
              >
                <View style={[styles.mediaIconBox, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                  <Icon name="image" size={17} color={theme.textPrimary} />
                </View>
                <View style={styles.mediaTileText}>
                  <Text numberOfLines={1} style={[typography.bodyBold, styles.tileTitle, { color: theme.textPrimary }]}>
                    Gallery
                  </Text>
                  <Text numberOfLines={1} style={[typography.caption, { color: theme.textMuted }]}>
                    Choose photos
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Section Divider */}
            <View style={styles.sectionDividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: theme.borderSubtle }]} />
              <Text style={[styles.sectionHeading, { color: theme.textMuted }]}>
                CREATIVE ENGINES
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.borderSubtle }]} />
            </View>

            {/* Clean, Minimalist Studio Switches */}
            <View style={styles.switchesList}>
              {/* Deep Search */}
              <View style={[styles.switchRow, { borderBottomColor: theme.borderSubtle }]}>
                <View style={[styles.switchIconBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                  <Icon name="search" size={16} color={theme.textPrimary} />
                </View>
                <View style={styles.switchInfo}>
                  <Text style={[typography.bodyBold, { color: theme.textPrimary }]}>Deep Search</Text>
                  <Text numberOfLines={1} style={[typography.caption, { color: theme.textMuted, marginTop: 2 }]}>
                    Multi-source web and system search
                  </Text>
                </View>
                <SmoothSwitch
                  value={isDeepSearchActive}
                  onValueChange={toggleDeepSearch}
                />
              </View>

              {/* Create Image */}
              <View style={[styles.switchRow, { borderBottomColor: theme.borderSubtle }]}>
                <View style={[styles.switchIconBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                  <Icon name="image" size={16} color={theme.textPrimary} />
                </View>
                <View style={styles.switchInfo}>
                  <Text style={[typography.bodyBold, { color: theme.textPrimary }]}>Create Image</Text>
                  <Text numberOfLines={1} style={[typography.caption, { color: theme.textMuted, marginTop: 2 }]}>
                    Generate artwork and visual assets
                  </Text>
                </View>
                <SmoothSwitch
                  value={isCreateImageActive}
                  onValueChange={toggleCreateImage}
                />
              </View>

              {/* Create Audio */}
              <View style={[styles.switchRow, { borderBottomColor: theme.borderSubtle }]}>
                <View style={[styles.switchIconBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                  <Icon name="volume" size={16} color={theme.textPrimary} />
                </View>
                <View style={styles.switchInfo}>
                  <Text style={[typography.bodyBold, { color: theme.textPrimary }]}>Create Audio</Text>
                  <Text numberOfLines={1} style={[typography.caption, { color: theme.textMuted, marginTop: 2 }]}>
                    Synthesize speech, music, and sound
                  </Text>
                </View>
                <SmoothSwitch
                  value={isCreateAudioActive}
                  onValueChange={toggleCreateAudio}
                />
              </View>

              {/* Create Video */}
              <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
                <View style={[styles.switchIconBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                  <Icon name="video" size={16} color={theme.textPrimary} />
                </View>
                <View style={styles.switchInfo}>
                  <Text style={[typography.bodyBold, { color: theme.textPrimary }]}>Create Video</Text>
                  <Text numberOfLines={1} style={[typography.caption, { color: theme.textMuted, marginTop: 2 }]}>
                    Render motion scenes and video clips
                  </Text>
                </View>
                <SmoothSwitch
                  value={isCreateVideoActive}
                  onValueChange={toggleCreateVideo}
                />
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000',
  },
  sheetContainer: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 20,
  },
  dragZone: {
    paddingBottom: spacing.xs,
  },
  dragHandleWrapper: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginBottom: spacing.xs,
  },
  headerTitles: {
    flex: 1,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  topMediaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    width: '100%',
  },
  mediaTile: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mediaIconBox: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
    flexShrink: 0,
  },
  mediaTileText: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  tileTitle: {
    fontSize: 13,
    marginBottom: 1,
  },
  sectionDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  switchesList: {
    marginBottom: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  switchIconBox: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  switchInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
});

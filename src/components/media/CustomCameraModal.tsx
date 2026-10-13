import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  StatusBar,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAssistant } from '../../store/AssistantStore';
import { Icon } from '../common/Icon';
import { spacing, radius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { MediaAttachment } from '../../ai/AgentTypes';
import { ImageCropperModal } from './ImageCropperModal';
import { CameraPreviewComponent } from './CameraPreviewComponent';
import { CameraNative } from '../../native/CameraNative';
import { Image } from 'react-native';

export const CustomCameraModal: React.FC = () => {
  const { activeModal, closeModal, addAttachments, theme } = useAssistant();
  const insets = useSafeAreaInsets();
  const isVisible = activeModal === 'camera_modal';

  const [capturedPhotos, setCapturedPhotos] = useState<MediaAttachment[]>([]);
  const [cropTargetPhoto, setCropTargetPhoto] = useState<MediaAttachment | null>(null);
  const [flashMode, setFlashMode] = useState<'auto' | 'on' | 'off'>('auto');
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  const flashAnim = useRef(new Animated.Value(0)).current;
  const shutterScale = useRef(new Animated.Value(1)).current;
  const flipAnim = useRef(new Animated.Value(0)).current;

  if (!isVisible) return null;

  const handleCapture = async () => {
    if (isCapturing) return;
    setIsCapturing(true);

    Animated.sequence([
      Animated.timing(shutterScale, {
        toValue: 0.9,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.spring(shutterScale, {
        toValue: 1,
        damping: 14,
        stiffness: 300,
        useNativeDriver: true,
      }),
    ]).start();

    flashAnim.setValue(0.8);
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start();

    try {
      const photoResult = await CameraNative.capturePhoto();
      const newAttachment: MediaAttachment = {
        id: `cam-${Date.now()}-${capturedPhotos.length}`,
        type: 'camera',
        uri: photoResult.uri,
        name: photoResult.name || `Photo #${capturedPhotos.length + 1}`,
        timestamp: photoResult.timestamp || Date.now(),
      };

      // Immediately open the professional image cropping interface with real photo!
      setCropTargetPhoto(newAttachment);
    } catch (e) {
      console.warn('[CustomCameraModal] Capture error:', e);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCropConfirm = (croppedPhoto: MediaAttachment) => {
    setCapturedPhotos(prev => [...prev, croppedPhoto]);
    setCropTargetPhoto(null);
  };

  const handleCropCancel = () => {
    setCropTargetPhoto(null);
  };

  const handleFlipCamera = () => {
    Animated.timing(flipAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      flipAnim.setValue(0);
      setCameraFacing(prev => (prev === 'back' ? 'front' : 'back'));
    });
  };

  const toggleFlash = () => {
    setFlashMode(prev => (prev === 'auto' ? 'on' : prev === 'on' ? 'off' : 'auto'));
  };

  const handleRemovePhoto = (id: string) => {
    setCapturedPhotos(prev => prev.filter(p => p.id !== id));
  };

  const handleConfirmAttach = () => {
    if (capturedPhotos.length > 0) {
      addAttachments(capturedPhotos);
      setCapturedPhotos([]);
    }
    closeModal();
  };

  const handleClose = () => {
    setCapturedPhotos([]);
    closeModal();
  };

  const flipInterpolation = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" translucent />

      <View style={[styles.container, { paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/* Flash Screen Overlay */}
        <Animated.View
          pointerEvents="none"
          style={[styles.flashOverlay, { opacity: flashAnim }]}
        />

        {/* Minimal Top Controls Bar */}
        <View style={styles.topControlBar}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleClose}
            accessibilityLabel="Close Camera"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Icon name="close" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={[typography.captionMedium, styles.topTitle]}>
            {cameraFacing === 'back' ? 'Rear Camera' : 'Front Camera'}
          </Text>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={toggleFlash}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="sun" size={16} color="#FFFFFF" />
            <Text style={styles.flashLabel}>
              {flashMode === 'auto' ? 'A' : flashMode === 'on' ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Live Native Camera Viewfinder Surface */}
        <View style={styles.viewfinderArea}>
          <CameraPreviewComponent
            style={StyleSheet.absoluteFill}
            facing={cameraFacing}
            flash={flashMode}
          />

          {capturedPhotos.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>
                {capturedPhotos.length} {capturedPhotos.length === 1 ? 'photo' : 'photos'} ready
              </Text>
            </View>
          )}
        </View>

        {/* Filmstrip of Captured Photos */}
        {capturedPhotos.length > 0 && (
          <View style={styles.filmstripContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filmstripScroll}>
              {capturedPhotos.map((photo, index) => (
                <View key={photo.id} style={styles.filmstripItem}>
                  <Image
                    source={{ uri: photo.uri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                  <View style={styles.filmstripIndexBadge}>
                    <Text style={styles.filmstripIndex}>#{index + 1}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.filmstripRemoveBtn}
                    onPress={() => handleRemovePhoto(photo.id)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Icon name="close" size={10} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Bottom Shutter & Controls Row */}
        <View style={styles.bottomControls}>
          <View style={styles.sideSlot}>
            {capturedPhotos.length > 0 && (
              <View style={styles.stackBadge}>
                <Text style={styles.stackCountText}>{capturedPhotos.length}</Text>
              </View>
            )}
          </View>

          {/* Minimal Tactile Shutter Button */}
          <View style={styles.shutterContainer}>
            <TouchableOpacity
              onPress={handleCapture}
              activeOpacity={0.8}
              style={styles.shutterRing}
            >
              <Animated.View style={[styles.shutterInner, { transform: [{ scale: shutterScale }] }]} />
            </TouchableOpacity>
          </View>

          {/* Flip Camera Button */}
          <View style={styles.sideSlot}>
            <TouchableOpacity
              onPress={handleFlipCamera}
              style={styles.flipBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Animated.View style={{ transform: [{ rotate: flipInterpolation }] }}>
                <Icon name="copy" size={18} color="#FFFFFF" />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Confirm & Attach Bar */}
        {capturedPhotos.length > 0 && (
          <View style={styles.confirmBar}>
            <TouchableOpacity
              style={styles.confirmAttachBtn}
              onPress={handleConfirmAttach}
              activeOpacity={0.8}
            >
              <Icon name="check" size={15} color="#000000" />
              <Text style={styles.confirmAttachText}>
                Attach {capturedPhotos.length} {capturedPhotos.length === 1 ? 'Photo' : 'Photos'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Professional Image Cropper Modal */}
        <ImageCropperModal
          visible={!!cropTargetPhoto}
          photo={cropTargetPhoto}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  flashOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 999,
  },
  topControlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  topTitle: {
    color: '#E2E8F0',
    letterSpacing: 0.3,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashLabel: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
  },
  viewfinderArea: {
    flex: 1,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  viewfinderSurface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    position: 'absolute',
    bottom: spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  filmstripContainer: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  filmstripScroll: {
    gap: spacing.xs,
  },
  filmstripItem: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: '#27272A',
    borderWidth: 1,
    borderColor: '#3F3F46',
    position: 'relative',
    overflow: 'hidden',
  },
  filmstripIndexBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
  },
  filmstripIndex: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filmstripRemoveBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  sideSlot: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#27272A',
    borderWidth: 1,
    borderColor: '#52525B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  shutterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
  },
  flipBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  confirmAttachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF',
    gap: spacing.xs,
  },
  confirmAttachText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
});

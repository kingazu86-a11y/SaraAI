import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  PanResponder,
  Animated,
  Dimensions,
  StatusBar,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAssistant } from '../../store/AssistantStore';
import { Icon } from '../common/Icon';
import { spacing, radius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { MediaAttachment } from '../../ai/AgentTypes';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type AspectRatioType = 'free' | '1:1' | '4:3' | '16:9';

interface ImageCropperModalProps {
  visible: boolean;
  photo: MediaAttachment | null;
  onConfirm: (croppedPhoto: MediaAttachment) => void;
  onCancel: () => void;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  visible,
  photo,
  onConfirm,
  onCancel,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useAssistant();

  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>('free');
  const [rotationDegrees, setRotationDegrees] = useState<number>(0);
  const [zoomDisplay, setZoomDisplay] = useState<number>(1.0);

  // Animated coordinates for pan translation and two-finger scale
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const currentPanX = useRef<number>(0);
  const currentPanY = useRef<number>(0);
  const currentScale = useRef<number>(1.0);

  const startPanX = useRef<number>(0);
  const startPanY = useRef<number>(0);

  // Pinch-to-zoom multi-touch tracking
  const isPinching = useRef<boolean>(false);
  const initialPinchDistance = useRef<number>(0);
  const initialPinchScale = useRef<number>(1.0);

  // Sync listener refs
  useEffect(() => {
    const idX = panX.addListener(({ value }) => {
      currentPanX.current = value;
    });
    const idY = panY.addListener(({ value }) => {
      currentPanY.current = value;
    });
    const idScale = scale.addListener(({ value }) => {
      currentScale.current = value;
    });

    return () => {
      panX.removeListener(idX);
      panY.removeListener(idY);
      scale.removeListener(idScale);
    };
  }, [panX, panY, scale]);

  // Reset coordinates whenever a new photo opens
  useEffect(() => {
    if (visible && photo) {
      panX.setValue(0);
      panY.setValue(0);
      scale.setValue(1);
      currentPanX.current = 0;
      currentPanY.current = 0;
      currentScale.current = 1.0;
      setZoomDisplay(1.0);
      setRotationDegrees(0);
      setAspectRatio('free');
    }
  }, [visible, photo, panX, panY, scale]);

  // Calculate crop window dimensions based on aspect ratio
  const cropWindowWidth = SCREEN_WIDTH - spacing.xl * 2;
  const cropWindowHeight =
    aspectRatio === '1:1'
      ? cropWindowWidth
      : aspectRatio === '4:3'
      ? (cropWindowWidth * 3) / 4
      : aspectRatio === '16:9'
      ? (cropWindowWidth * 9) / 16
      : cropWindowWidth * 1.18; // Freeform portrait

  // Multi-Touch Gesture Responder: Two-finger pinch-to-zoom + 1-finger pan
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches && touches.length >= 2) {
          isPinching.current = true;
          const t0 = touches[0];
          const t1 = touches[1];
          const dist = Math.hypot(t0.pageX - t1.pageX, t0.pageY - t1.pageY);
          initialPinchDistance.current = Math.max(dist, 10);
          initialPinchScale.current = currentScale.current;
        } else {
          isPinching.current = false;
        }

        startPanX.current = currentPanX.current;
        startPanY.current = currentPanY.current;
      },

      onPanResponderMove: (evt, gesture) => {
        const touches = evt.nativeEvent.touches;

        if (touches && touches.length >= 2) {
          // --- TWO-FINGER PINCH-TO-ZOOM ---
          const t0 = touches[0];
          const t1 = touches[1];
          const dist = Math.hypot(t0.pageX - t1.pageX, t0.pageY - t1.pageY);

          if (!isPinching.current) {
            isPinching.current = true;
            initialPinchDistance.current = Math.max(dist, 10);
            initialPinchScale.current = currentScale.current;
            startPanX.current = currentPanX.current;
            startPanY.current = currentPanY.current;
            return;
          }

          // Natural scaling: moving outward zooms in, moving inward zooms out
          const scaleFactor = dist / initialPinchDistance.current;
          let nextScale = initialPinchScale.current * scaleFactor;

          // Clamped within 1.0x to 4.0x zoom boundaries
          nextScale = Math.max(1.0, Math.min(4.0, nextScale));

          currentScale.current = nextScale;
          scale.setValue(nextScale);
          setZoomDisplay(parseFloat(nextScale.toFixed(1)));
        } else if (touches && touches.length === 1) {
          // --- ONE-FINGER PAN TRANSLATION ---
          if (isPinching.current) {
            isPinching.current = false;
            startPanX.current = currentPanX.current;
            startPanY.current = currentPanY.current;
            return;
          }

          const activeZoom = currentScale.current;
          const maxPanX = Math.max(0, (cropWindowWidth * (activeZoom - 1)) / 2 + 30);
          const maxPanY = Math.max(0, (cropWindowHeight * (activeZoom - 1)) / 2 + 30);

          let nextX = startPanX.current + gesture.dx;
          let nextY = startPanY.current + gesture.dy;

          nextX = Math.max(-maxPanX, Math.min(maxPanX, nextX));
          nextY = Math.max(-maxPanY, Math.min(maxPanY, nextY));

          currentPanX.current = nextX;
          currentPanY.current = nextY;
          panX.setValue(nextX);
          panY.setValue(nextY);
        }
      },

      onPanResponderRelease: () => {
        isPinching.current = false;
        if (currentScale.current < 1.0) {
          currentScale.current = 1.0;
          Animated.spring(scale, {
            toValue: 1.0,
            damping: 16,
            stiffness: 260,
            useNativeDriver: true,
          }).start();
          setZoomDisplay(1.0);
        }
      },

      onPanResponderTerminate: () => {
        isPinching.current = false;
      },
    })
  ).current;

  if (!visible || !photo) return null;

  const handleRotate = () => {
    setRotationDegrees(prev => (prev + 90) % 360);
  };

  const handleReset = () => {
    setRotationDegrees(0);
    setZoomDisplay(1.0);
    currentScale.current = 1.0;
    currentPanX.current = 0;
    currentPanY.current = 0;

    Animated.parallel([
      Animated.spring(scale, { toValue: 1.0, damping: 16, stiffness: 260, useNativeDriver: true }),
      Animated.spring(panX, { toValue: 0, damping: 16, stiffness: 260, useNativeDriver: true }),
      Animated.spring(panY, { toValue: 0, damping: 16, stiffness: 260, useNativeDriver: true }),
    ]).start();
  };

  const handleZoomIn = () => {
    const nextVal = Math.min(4.0, +(currentScale.current + 0.3).toFixed(1));
    currentScale.current = nextVal;
    scale.setValue(nextVal);
    setZoomDisplay(nextVal);
  };

  const handleZoomOut = () => {
    const nextVal = Math.max(1.0, +(currentScale.current - 0.3).toFixed(1));
    currentScale.current = nextVal;
    scale.setValue(nextVal);
    setZoomDisplay(nextVal);
  };

  const handleSaveCrop = () => {
    const croppedAttachment: MediaAttachment = {
      ...photo,
      id: `crop-${Date.now()}`,
      name: `${photo.name || 'Photo'} (Cropped ${aspectRatio})`,
      timestamp: Date.now(),
    };
    onConfirm(croppedAttachment);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" translucent />

      <View style={[styles.root, { paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={onCancel}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <Text style={[typography.bodyBold, styles.headerTitle]}>Crop & Adjust</Text>

          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleReset}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>

        {/* Center Workspace & Crop Window */}
        <View style={styles.workspace}>
          <View
            style={[
              styles.cropFrame,
              {
                width: cropWindowWidth,
                height: cropWindowHeight,
              },
            ]}
            {...panResponder.panHandlers}
          >
            {/* Real photo canvas with 2-finger pinch scale and pan translations */}
            <Animated.View
              style={[
                styles.photoCanvas,
                {
                  transform: [
                    { translateX: panX },
                    { translateY: panY },
                    { scale },
                    { rotate: `${rotationDegrees}deg` },
                  ],
                },
              ]}
            >
              <Image
                source={{ uri: photo.uri }}
                style={styles.cropperImage}
                resizeMode="contain"
              />
            </Animated.View>

            {/* Rule of Thirds Minimal Grid Lines */}
            <View style={styles.gridOverlay} pointerEvents="none">
              <View style={[styles.gridLineH, { top: '33.3%' }]} />
              <View style={[styles.gridLineH, { top: '66.6%' }]} />
              <View style={[styles.gridLineV, { left: '33.3%' }]} />
              <View style={[styles.gridLineV, { left: '66.6%' }]} />
            </View>

            {/* Corner Framing Brackets */}
            <View style={[styles.cornerBracket, styles.tl]} pointerEvents="none" />
            <View style={[styles.cornerBracket, styles.tr]} pointerEvents="none" />
            <View style={[styles.cornerBracket, styles.bl]} pointerEvents="none" />
            <View style={[styles.cornerBracket, styles.br]} pointerEvents="none" />
          </View>

          <Text style={styles.dragHintText}>Pinch with 2 fingers to zoom • Drag with 1 finger to reposition</Text>
        </View>

        {/* Controls Section: Rotate & Zoom Display */}
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={styles.controlIconBtn}
            onPress={handleRotate}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="copy" size={17} color="#FFFFFF" />
            <Text style={styles.controlIconLabel}>Rotate</Text>
          </TouchableOpacity>

          {/* Tactile Zoom Buttons */}
          <View style={styles.zoomControl}>
            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={handleZoomOut}
              disabled={zoomDisplay <= 1.0}
            >
              <Icon name="close" size={12} color={zoomDisplay <= 1.0 ? '#52525B' : '#FFFFFF'} />
            </TouchableOpacity>

            <Text style={styles.zoomValueText}>{zoomDisplay.toFixed(1)}x</Text>

            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={handleZoomIn}
              disabled={zoomDisplay >= 4.0}
            >
              <Icon name="plus" size={12} color={zoomDisplay >= 4.0 ? '#52525B' : '#FFFFFF'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Aspect Ratio Selector Pills */}
        <View style={styles.aspectRatioBar}>
          {(['free', '1:1', '4:3', '16:9'] as const).map(ratio => {
            const isSelected = aspectRatio === ratio;
            return (
              <TouchableOpacity
                key={ratio}
                style={[
                  styles.ratioChip,
                  isSelected && styles.ratioChipActive,
                ]}
                onPress={() => setAspectRatio(ratio)}
              >
                <Text style={[styles.ratioChipText, isSelected && styles.ratioChipTextActive]}>
                  {ratio === 'free' ? 'Free' : ratio}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Bottom Confirm Bar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={handleSaveCrop}
            activeOpacity={0.8}
          >
            <Icon name="check" size={16} color="#000000" />
            <Text style={styles.confirmBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  cancelText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '500',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  resetText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '500',
  },
  workspace: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xs,
  },
  cropFrame: {
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: '#18181B',
  },
  photoCanvas: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropperImage: {
    width: '100%',
    height: '100%',
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  cornerBracket: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: '#FFFFFF',
  },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  dragHintText: {
    color: '#71717A',
    fontSize: 11,
    marginTop: spacing.sm,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
  },
  controlIconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  controlIconLabel: {
    color: '#A1A1AA',
    fontSize: 11,
    marginTop: 3,
  },
  zoomControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272A',
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 8,
  },
  zoomBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomValueText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    minWidth: 34,
    textAlign: 'center',
  },
  aspectRatioBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  ratioChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#3F3F46',
    backgroundColor: '#18181B',
  },
  ratioChipActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#27272A',
  },
  ratioChipText: {
    fontSize: 11,
    color: '#A1A1AA',
    fontWeight: '500',
  },
  ratioChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    height: 44,
    borderRadius: radius.lg,
    gap: 8,
  },
  confirmBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
});

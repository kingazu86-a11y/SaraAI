import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  Animated,
  LayoutChangeEvent,
  ViewStyle,
} from 'react-native';
import { useAssistant } from '../../store/AssistantStore';

export interface SmoothSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange: (val: number) => void;
  style?: ViewStyle;
  disabled?: boolean;
}

const THUMB_RADIUS = 12;

export const SmoothSlider: React.FC<SmoothSliderProps> = ({
  value,
  min = 0,
  max = 1,
  step = 0.05,
  onValueChange,
  style,
  disabled = false,
}) => {
  const { theme } = useAssistant();
  const [trackWidth, setTrackWidth] = useState(200);
  const thumbScale = useRef(new Animated.Value(1)).current;

  // Normalized value [0, 1]
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const normalized = clamp((value - min) / (max - min), 0, 1);

  const calculateValueFromPosition = (posX: number) => {
    const usableWidth = Math.max(trackWidth - THUMB_RADIUS * 2, 1);
    const rawRatio = clamp((posX - THUMB_RADIUS) / usableWidth, 0, 1);
    let rawVal = min + rawRatio * (max - min);
    if (step > 0) {
      rawVal = Math.round(rawVal / step) * step;
    }
    return clamp(rawVal, min, max);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (evt) => {
        Animated.spring(thumbScale, {
          toValue: 1.25,
          speed: 40,
          bounciness: 0,
          useNativeDriver: true,
        }).start();
        const newVal = calculateValueFromPosition(evt.nativeEvent.locationX);
        onValueChange(newVal);
      },
      onPanResponderMove: (evt) => {
        const newVal = calculateValueFromPosition(evt.nativeEvent.locationX);
        onValueChange(newVal);
      },
      onPanResponderRelease: () => {
        Animated.spring(thumbScale, {
          toValue: 1,
          speed: 25,
          bounciness: 4,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(thumbScale, {
          toValue: 1,
          speed: 25,
          bounciness: 4,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const usableWidth = Math.max(trackWidth - THUMB_RADIUS * 2, 1);
  const thumbX = normalized * usableWidth;

  return (
    <View
      style={[styles.container, style, disabled && { opacity: 0.45 }]}
      onLayout={onLayout}
      {...panResponder.panHandlers}
    >
      {/* Background Track */}
      <View style={[styles.trackBg, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        {/* Filled Active Track */}
        <View
          style={[
            styles.trackFill,
            {
              backgroundColor: theme.accent,
              width: thumbX + THUMB_RADIUS,
            },
          ]}
        />
      </View>

      {/* Draggable Thumb */}
      <Animated.View
        style={[
          styles.thumb,
          {
            backgroundColor: theme.textInverse,
            borderColor: theme.accent,
            transform: [{ translateX: thumbX }, { scale: thumbScale }],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 40,
    justifyContent: 'center',
    width: '100%',
  },
  trackBg: {
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },
  trackFill: {
    height: '100%',
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB_RADIUS * 2,
    height: THUMB_RADIUS * 2,
    borderRadius: THUMB_RADIUS,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
});

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  ViewStyle,
} from 'react-native';
import { useAssistant } from '../../store/AssistantStore';

export interface SmoothSwitchProps {
  value: boolean;
  onValueChange: (newValue: boolean) => void;
  disabled?: boolean;
  style?: ViewStyle;
}

const SWITCH_WIDTH = 48;
const SWITCH_HEIGHT = 28;
const THUMB_SIZE = 22;
const PADDING = 3;
const TRAVEL_DISTANCE = SWITCH_WIDTH - THUMB_SIZE - PADDING * 2; // 48 - 22 - 6 = 20

/**
 * Premium native spring-driven switch component.
 * Replaces clunky Android platform switches with smooth, tactile 60fps spring transitions.
 */
export const SmoothSwitch: React.FC<SmoothSwitchProps> = ({
  value,
  onValueChange,
  disabled = false,
  style,
}) => {
  const { theme } = useAssistant();

  // Animated values for translation, thumb scale, and track color
  const animValue = useRef(new Animated.Value(value ? 1 : 0)).current;
  const thumbScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(animValue, {
      toValue: value ? 1 : 0,
      damping: 18,
      stiffness: 320,
      mass: 0.8,
      useNativeDriver: false, // needed for backgroundColor interpolation
    }).start();
  }, [value, animValue]);

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(thumbScale, {
      toValue: 1.12,
      speed: 40,
      bounciness: 0,
      useNativeDriver: false,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.spring(thumbScale, {
      toValue: 1,
      speed: 25,
      bounciness: 4,
      useNativeDriver: false,
    }).start();
  };

  const handlePress = () => {
    if (disabled) return;
    onValueChange(!value);
  };

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRAVEL_DISTANCE],
  });

  const trackBgColor = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.surfaceElevated, theme.accent],
  });

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[{ opacity: disabled ? 0.45 : 1 }, style]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Animated.View
        style={[
          styles.track,
          {
            backgroundColor: trackBgColor,
            borderColor: value ? theme.accent : theme.border,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: theme.textInverse,
              transform: [{ translateX }, { scale: thumbScale }],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  track: {
    width: SWITCH_WIDTH,
    height: SWITCH_HEIGHT,
    borderRadius: SWITCH_HEIGHT / 2,
    borderWidth: 1,
    padding: PADDING,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
});

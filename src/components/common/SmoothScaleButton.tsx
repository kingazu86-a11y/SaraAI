import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
  StyleSheet,
} from 'react-native';

export interface SmoothScaleButtonProps extends PressableProps {
  style?: StyleProp<ViewStyle>;
  pressScale?: number;
  activeOpacity?: number;
  children: React.ReactNode;
}

/**
 * High-performance tactile pressable with native spring physics.
 * Gives buttons, pills, and cards a rich, fluid, satisfying physical feedback.
 */
export const SmoothScaleButton: React.FC<SmoothScaleButtonProps> = ({
  style,
  pressScale = 0.96,
  activeOpacity = 0.88,
  disabled = false,
  children,
  onPressIn,
  onPressOut,
  ...rest
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = (event: any) => {
    if (disabled) return;
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: pressScale,
        speed: 35,
        bounciness: 0,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: activeOpacity,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();
    onPressIn?.(event);
  };

  const handlePressOut = (event: any) => {
    if (disabled) return;
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        speed: 25,
        bounciness: 5,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
    onPressOut?.(event);
  };

  return (
    <Pressable
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...rest}
    >
      <Animated.View
        style={[
          style,
          {
            transform: [{ scale: scaleAnim }],
            opacity: disabled ? 0.45 : opacityAnim,
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
};

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useAssistant } from '../../store/AssistantStore';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

export interface ThinkingIndicatorProps {
  dotsOnly?: boolean;
  text?: string;
  inline?: boolean;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  dotsOnly = false,
  text,
  inline = false,
}) => {
  const { theme, loadingModelText } = useAssistant();
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const createPulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.25,
            duration: 350,
            useNativeDriver: true,
          }),
        ])
      );

    const anim1 = createPulse(dot1, 0);
    const anim2 = createPulse(dot2, 180);
    const anim3 = createPulse(dot3, 360);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  const displayText = text || loadingModelText || 'Thinking';

  return (
    <View style={[styles.container, inline && styles.inlineContainer, dotsOnly && styles.dotsOnlyContainer]}>
      {!dotsOnly && (
        <Text style={[typography.body, { color: theme.textSecondary }]}>
          {displayText}
        </Text>
      )}
      <View style={[styles.dotsRow, dotsOnly && styles.dotsOnlyRow]}>
        <Animated.View style={[styles.dot, { backgroundColor: theme.accent, opacity: dot1 }]} />
        <Animated.View style={[styles.dot, { backgroundColor: theme.accent, opacity: dot2 }]} />
        <Animated.View style={[styles.dot, { backgroundColor: theme.accent, opacity: dot3 }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  inlineContainer: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  dotsOnlyContainer: {
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
    gap: 4,
  },
  dotsOnlyRow: {
    marginLeft: 4,
    gap: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});

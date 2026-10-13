import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAssistant } from '../../../store/AssistantStore';
import { spacing, radius } from '../../../theme/spacing';

interface HeadingViewProps {
  level: 1 | 2 | 3;
  text: string;
}

export const HeadingView: React.FC<HeadingViewProps> = ({ level, text }) => {
  const { theme } = useAssistant();

  // Clean any residual markdown artifacts
  const cleanText = text.replace(/[*_#]/g, '').trim();

  if (level === 1) {
    return (
      <View style={styles.h1Container}>
        <Text selectable={true} style={[styles.h1Text, { color: theme.textPrimary }]}>
          {cleanText}
        </Text>
        <View style={[styles.h1Divider, { backgroundColor: theme.border }]} />
      </View>
    );
  }

  if (level === 2) {
    return (
      <View style={styles.h2Container}>
        <View style={[styles.h2AccentBar, { backgroundColor: theme.accent }]} />
        <Text selectable={true} style={[styles.h2Text, { color: theme.textPrimary }]}>
          {cleanText}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.h3Container}>
      <Text selectable={true} style={[styles.h3Text, { color: theme.textPrimary }]}>
        {cleanText}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  h1Container: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  h1Text: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
    lineHeight: 24,
  },
  h1Divider: {
    height: 2,
    marginTop: 4,
    borderRadius: radius.full,
    width: '100%',
  },
  h2Container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  h2AccentBar: {
    width: 3.5,
    height: 16,
    borderRadius: 2,
    marginRight: 8,
  },
  h2Text: {
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.15,
    lineHeight: 22,
    flex: 1,
  },
  h3Container: {
    marginTop: spacing.xs,
    marginBottom: 2,
  },
  h3Text: {
    fontSize: 14.5,
    fontWeight: '700',
    lineHeight: 20,
  },
});

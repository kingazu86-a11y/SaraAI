import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useAssistant } from '../../../store/AssistantStore';
import { ClipboardService } from '../../../services/ClipboardService';
import { ShareService } from '../../../services/ShareService';
import { Icon } from '../../common/Icon';
import { radius, spacing } from '../../../theme/spacing';

interface MathBlockViewProps {
  raw: string;
  formatted: string;
}

export const MathBlockView: React.FC<MathBlockViewProps> = ({ raw, formatted }) => {
  const { theme } = useAssistant();
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = async () => {
    const textToCopy = formatted || raw;
    const success = await ClipboardService.setString(textToCopy);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surfaceSubtle,
          borderColor: theme.border,
        },
      ]}
    >
      {/* Header bar */}
      <View style={[styles.header, { borderBottomColor: theme.borderSubtle, backgroundColor: theme.surface }]}>
        <View style={styles.badge}>
          <Text style={[styles.badgeIcon, { color: theme.accent }]}>∑</Text>
          <Text style={[styles.badgeText, { color: theme.textSecondary }]}>MATH FORMULA</Text>
        </View>

        <View style={styles.actionsGroup}>
          <TouchableOpacity
            style={[
              styles.iconBtn,
              {
                backgroundColor: copied ? theme.accent : theme.surfaceElevated,
                borderColor: copied ? theme.accent : theme.border,
              },
            ]}
            onPress={handleCopy}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon
              name={copied ? 'check' : 'copy'}
              size={13}
              color={copied ? theme.textInverse : theme.textPrimary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.iconBtn,
              {
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.border,
                marginLeft: 6,
              },
            ]}
            onPress={() => ShareService.shareText(formatted || raw, 'Math Formula')}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon
              name="share"
              size={13}
              color={theme.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Math expression display */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.mathContent}
      >
        <Text selectable={true} style={[styles.mathText, { color: theme.textPrimary }]}>
          {formatted || raw}
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    borderWidth: 1,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeIcon: {
    fontSize: 13,
    fontWeight: '900',
    marginRight: 6,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mathContent: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '100%',
  },
  mathText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.8,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});

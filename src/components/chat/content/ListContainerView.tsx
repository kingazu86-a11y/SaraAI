import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAssistant } from '../../../store/AssistantStore';
import { radius, spacing } from '../../../theme/spacing';

export interface ListItemData {
  number?: string;
  text: string;
}

interface ListContainerViewProps {
  listType: 'bullet' | 'number';
  items: Array<string | ListItemData>;
}

export const ListContainerView: React.FC<ListContainerViewProps> = ({ listType, items }) => {
  const { theme } = useAssistant();

  if (!items || items.length === 0) return null;

  // Render text supporting inline bold (**text**)
  const renderFormattedText = (rawText: string) => {
    const parts = rawText.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <Text
            key={index}
            selectable={true}
            style={[styles.itemText, { color: theme.textPrimary, fontWeight: '700' }]}
          >
            {part.slice(2, -2)}
          </Text>
        );
      }
      return (
        <Text key={index} selectable={true} style={[styles.itemText, { color: theme.textPrimary }]}>
          {part}
        </Text>
      );
    });
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
      {items.map((item, index) => {
        const itemText = typeof item === 'string' ? item : item.text;
        const itemNumber = typeof item === 'string' ? String(index + 1) : (item.number || String(index + 1));

        return (
          <View key={index} style={[styles.row, index < items.length - 1 && styles.rowBorder]}>
            {/* Bullet or Number Indicator */}
            {listType === 'bullet' ? (
              <View style={styles.bulletWrapper}>
                <View style={[styles.bulletDot, { backgroundColor: theme.accent }]} />
              </View>
            ) : (
              <View
                style={[
                  styles.numberBadge,
                  { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.numberText, { color: theme.textPrimary }]}>
                  {itemNumber}
                </Text>
              </View>
            )}

            {/* Item Content */}
            <View style={styles.contentCol}>
              <Text selectable={true} style={styles.itemWrapper}>
                {renderFormattedText(itemText)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 5,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.15)',
  },
  bulletWrapper: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  numberBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    paddingHorizontal: 4,
  },
  numberText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  contentCol: {
    flex: 1,
    paddingTop: 1,
  },
  itemWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  itemText: {
    fontSize: 14,
    lineHeight: 21,
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAssistant } from '../../../store/AssistantStore';
import { MathFormatter } from '../../../utils/MathFormatter';
import { typography } from '../../../theme/typography';
import { radius, spacing } from '../../../theme/spacing';

interface ParagraphViewProps {
  text: string;
}

export const ParagraphView: React.FC<ParagraphViewProps> = ({ text }) => {
  const { theme } = useAssistant();

  if (!text) return null;

  // Split on inline code (`...`), inline math ($...$), and bold (**...**)
  const parts = text.split(/(`[^`]+`|\$[^$\n]+\$|\*\*[^*]+\*\*)/g);

  return (
    <View style={styles.container}>
      <Text selectable={true} style={[typography.body, styles.baseText, { color: theme.textPrimary }]}>
        {parts.map((part, index) => {
          if (!part) return null;

          // Inline Code: `code`
          if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            const code = part.slice(1, -1);
            return (
              <Text
                key={index}
                selectable={true}
                style={[
                  typography.code,
                  styles.inlineCode,
                  {
                    backgroundColor: theme.surfaceSubtle,
                    color: theme.accent,
                  },
                ]}
              >
                {` ${code} `}
              </Text>
            );
          }

          // Inline Math: $math$
          if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
            const formattedMath = MathFormatter.format(part);
            return (
              <Text
                key={index}
                selectable={true}
                style={[
                  styles.inlineMath,
                  {
                    color: theme.accent,
                  },
                ]}
              >
                {` ${formattedMath} `}
              </Text>
            );
          }

          // Bold: **bold**
          if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return (
              <Text
                key={index}
                selectable={true}
                style={[styles.boldText, { color: theme.textPrimary }]}
              >
                {part.slice(2, -2)}
              </Text>
            );
          }

          // Plain text
          return (
            <Text key={index} selectable={true} style={{ color: theme.textPrimary }}>
              {part}
            </Text>
          );
        })}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 3,
  },
  baseText: {
    fontSize: 14.5,
    lineHeight: 22,
  },
  inlineCode: {
    fontSize: 12.5,
    borderRadius: radius.xs,
    paddingHorizontal: 3,
    fontWeight: '600',
  },
  inlineMath: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  boldText: {
    fontWeight: '700',
  },
});

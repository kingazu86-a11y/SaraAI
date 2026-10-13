import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useAssistant } from '../../../store/AssistantStore';
import { ClipboardService } from '../../../services/ClipboardService';
import { ShareService } from '../../../services/ShareService';
import { Icon } from '../../common/Icon';
import { typography } from '../../../theme/typography';
import { radius, spacing } from '../../../theme/spacing';

interface CodeBlockViewProps {
  language: string;
  code: string;
}

// Token types for syntax highlighting
type TokenType = 'keyword' | 'string' | 'comment' | 'number' | 'function' | 'type' | 'plain';

interface Token {
  text: string;
  type: TokenType;
}

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'class', 'extends',
  'import', 'export', 'default', 'from', 'if', 'else', 'switch', 'case',
  'for', 'while', 'do', 'try', 'catch', 'finally', 'throw', 'new',
  'async', 'await', 'yield', 'typeof', 'instanceof', 'void', 'this',
  'super', 'null', 'undefined', 'true', 'false',
  // Python / Kotlin / Java
  'def', 'self', 'elif', 'None', 'True', 'False', 'val', 'fun', 'override',
  'package', 'public', 'private', 'protected', 'interface', 'struct',
]);

const TYPES = new Set([
  'string', 'number', 'boolean', 'any', 'void', 'Promise', 'Array',
  'Record', 'Set', 'Map', 'ReactNode', 'React', 'String', 'Int', 'Boolean',
  'Float', 'Double', 'List', 'Object',
]);

function tokenizeCode(code: string): Token[] {
  const tokens: Token[] = [];
  // Tokenizer regex matching strings, comments, numbers, words, and symbols
  const regex = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/.*$|\/\*[\s\S]*?\*\/|#.*$|\b\d+(?:\.\d+)?\b|\b[a-zA-Z_$][a-zA-Z0-9_$]*\b|[^\s\w]+|\s+)/gm;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(code)) !== null) {
    const text = match[0];
    if (!text) continue;

    if (text.startsWith('//') || text.startsWith('/*') || text.startsWith('#')) {
      tokens.push({ text, type: 'comment' });
    } else if (
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'")) ||
      (text.startsWith('`') && text.endsWith('`'))
    ) {
      tokens.push({ text, type: 'string' });
    } else if (/^\d+(?:\.\d+)?$/.test(text)) {
      tokens.push({ text, type: 'number' });
    } else if (KEYWORDS.has(text)) {
      tokens.push({ text, type: 'keyword' });
    } else if (TYPES.has(text)) {
      tokens.push({ text, type: 'type' });
    } else {
      tokens.push({ text, type: 'plain' });
    }
  }

  return tokens;
}

export const CodeBlockView: React.FC<CodeBlockViewProps> = ({ language, code }) => {
  const { theme } = useAssistant();
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = async () => {
    const success = await ClipboardService.setString(code);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const tokens = tokenizeCode(code);

  const getTokenColor = (type: TokenType): string => {
    switch (type) {
      case 'keyword':
        return '#E06C75'; // Coral Pink
      case 'string':
        return '#98C379'; // Soft Green
      case 'comment':
        return '#7F848E'; // Muted Slate (Comments)
      case 'number':
        return '#D19A66'; // Warm Amber
      case 'type':
        return '#E5C07B'; // Gold Yellow
      case 'function':
        return '#61AFEF'; // Soft Cyan
      case 'plain':
      default:
        return theme.textPrimary;
    }
  };

  const displayLang = (language || 'code').toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
      {/* Header bar */}
      <View style={[styles.header, { borderBottomColor: theme.borderSubtle, backgroundColor: theme.surface }]}>
        <View style={styles.langBadge}>
          <Icon name="code" size={12} color={theme.textSecondary} style={{ marginRight: 5 }} />
          <Text style={[styles.langText, { color: theme.textSecondary }]}>{displayLang}</Text>
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
            onPress={() => ShareService.shareText(code, `${displayLang} Code Snippet`)}
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

      {/* Code body with horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        contentContainerStyle={styles.scrollContent}
      >
        <Text selectable={true} style={[typography.code, styles.codeText]}>
          {tokens.map((token, i) => (
            <Text
              key={i}
              style={{
                color: getTokenColor(token.type),
                fontStyle: token.type === 'comment' ? 'italic' : 'normal',
              }}
            >
              {token.text}
            </Text>
          ))}
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
  langBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  langText: {
    fontSize: 11,
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
  scrollContent: {
    padding: spacing.md,
  },
  codeText: {
    fontSize: 13,
    lineHeight: 20,
  },
});

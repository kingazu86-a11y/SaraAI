import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { ToolCallData, ToolResultData } from '../../ai/AgentTypes';
import { useAssistant } from '../../store/AssistantStore';
import { Icon } from '../common/Icon';
import { typography } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';

interface ToolExecutionIndicatorProps {
  toolCall: ToolCallData;
  toolResult?: ToolResultData;
  isExecuting?: boolean;
}

export const ToolExecutionIndicator: React.FC<ToolExecutionIndicatorProps> = ({
  toolCall,
  toolResult,
  isExecuting = false,
}) => {
  const { theme } = useAssistant();

  const getToolDisplayName = (name: string) => {
    switch (name) {
      case 'open_app':
        return `Opening ${toolCall.arguments.packageName || 'app'}`;
      case 'get_installed_apps':
        return 'Inspecting installed apps';
      case 'open_settings':
        return 'Opening settings';
      case 'get_current_screen':
        return 'Reading screen elements';
      case 'find_text':
        return `Searching text "${toolCall.arguments.text || ''}"`;
      case 'click':
        return 'Simulating tap';
      case 'type_text':
        return `Typing "${toolCall.arguments.text || ''}"`;
      case 'search_files':
        return `Searching files: ${toolCall.arguments.query || ''}`;
      default:
        return `Executing ${name}`;
    }
  };

  const isCompleted = !!toolResult && toolResult.success;
  const isFailed = !!toolResult && !toolResult.success;

  return (
    <View style={[styles.container, { backgroundColor: theme.toolPillBg, borderColor: theme.toolPillBorder }]}>
      <View style={styles.leftRow}>
        {isExecuting ? (
          <ActivityIndicator size="small" color={theme.textSecondary} style={styles.statusIcon} />
        ) : isCompleted ? (
          <Icon name="check" size={12} color={theme.success} style={styles.statusIcon} />
        ) : isFailed ? (
          <Icon name="close" size={12} color={theme.error} style={styles.statusIcon} />
        ) : (
          <Icon name="terminal" size={12} color={theme.textMuted} style={styles.statusIcon} />
        )}

        <Text style={[typography.captionMedium, { color: theme.textPrimary }]}>
          {getToolDisplayName(toolCall.tool)}
        </Text>
      </View>

      {toolResult && toolResult.result ? (
        <Text numberOfLines={1} style={[typography.small, styles.resultPreview, { color: theme.textMuted }]}>
          {typeof toolResult.result === 'string' ? toolResult.result : JSON.stringify(toolResult.result)}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginVertical: spacing.xs,
    alignSelf: 'flex-start',
    maxWidth: '90%',
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    marginRight: spacing.sm,
  },
  resultPreview: {
    marginTop: 2,
    paddingLeft: 18,
  },
});

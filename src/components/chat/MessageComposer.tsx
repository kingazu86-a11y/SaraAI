import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAssistant } from '../../store/AssistantStore';
import { Icon } from '../common/Icon';
import { SmoothScaleButton } from '../common/SmoothScaleButton';
import { spacing, radius } from '../../theme/spacing';

export const MessageComposer: React.FC = () => {
  const {
    state,
    sendCommand,
    startVoiceListening,
    theme,
    isGenerating,
    stopGeneration,
    createNewConversation,
    openModal,
    isDeepSearchActive,
    toggleDeepSearch,
    isCreateImageActive,
    toggleCreateImage,
    isCreateAudioActive,
    toggleCreateAudio,
    isCreateVideoActive,
    toggleCreateVideo,
    activeAttachments,
    removeAttachment,
    clearAttachments,
  } = useAssistant();
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState('');
  const [inputHeight, setInputHeight] = useState(44);

  const isListening = state === 'listening';
  const isBusy = isGenerating || state === 'thinking' || state === 'executing';
  const hasText = inputText.trim().length > 0;
  const canSend = (hasText || activeAttachments.length > 0) && !isBusy;

  const micPulseAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (isListening) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(micPulseAnim, {
            toValue: 1.25,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(micPulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    } else {
      micPulseAnim.setValue(1);
    }
  }, [isListening, micPulseAnim]);

  const handleSend = () => {
    if (canSend) {
      const commandToSend =
        inputText.trim() ||
        (activeAttachments.length > 0
          ? `Analyze these ${activeAttachments.length} attached images and extract key details`
          : '');
      sendCommand(commandToSend);
      setInputText('');
      setInputHeight(44);
    }
  };

  const placeholderText = isCreateImageActive
    ? 'Describe image to create (e.g. 4K Cyberpunk city)...'
    : isCreateAudioActive
    ? 'Describe audio to compose (e.g. Ambient lofi beat)...'
    : isCreateVideoActive
    ? 'Describe video scene to render (e.g. Drone flight)...'
    : isDeepSearchActive
    ? 'Ask a deep research question...'
    : 'Message Sara AI...';

  return (
    <View
      style={[
        styles.outerContainer,
        {
          backgroundColor: theme.background,
          borderTopColor: theme.borderSubtle,
          paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.xs,
        },
      ]}
    >
      {/* Quick Mini Commands & Active Studio Chips */}
      <View style={styles.topControlRow}>
        <View style={styles.miniCmdRow}>
          {/* Active Mode Pills */}
          {isDeepSearchActive && (
            <SmoothScaleButton
              style={[styles.studioChip, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
              onPress={toggleDeepSearch}
            >
              <Icon name="search" size={11} color={theme.textPrimary} />
              <Text style={[styles.studioChipText, { color: theme.textPrimary }]}>Deep Search</Text>
              <Icon name="close" size={10} color={theme.textMuted} style={{ marginLeft: 2 }} />
            </SmoothScaleButton>
          )}

          {isCreateImageActive && (
            <SmoothScaleButton
              style={[styles.studioChip, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
              onPress={toggleCreateImage}
            >
              <Icon name="image" size={11} color={theme.textPrimary} />
              <Text style={[styles.studioChipText, { color: theme.textPrimary }]}>Image Studio</Text>
              <Icon name="close" size={10} color={theme.textMuted} style={{ marginLeft: 2 }} />
            </SmoothScaleButton>
          )}

          {isCreateAudioActive && (
            <SmoothScaleButton
              style={[styles.studioChip, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
              onPress={toggleCreateAudio}
            >
              <Icon name="volume" size={11} color={theme.textPrimary} />
              <Text style={[styles.studioChipText, { color: theme.textPrimary }]}>Audio Studio</Text>
              <Icon name="close" size={10} color={theme.textMuted} style={{ marginLeft: 2 }} />
            </SmoothScaleButton>
          )}

          {isCreateVideoActive && (
            <SmoothScaleButton
              style={[styles.studioChip, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
              onPress={toggleCreateVideo}
            >
              <Icon name="video" size={11} color={theme.textPrimary} />
              <Text style={[styles.studioChipText, { color: theme.textPrimary }]}>Video Studio</Text>
              <Icon name="close" size={10} color={theme.textMuted} style={{ marginLeft: 2 }} />
            </SmoothScaleButton>
          )}

          <SmoothScaleButton
            style={[styles.cmdPill, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
            onPress={() => setInputText('/save ')}
          >
            <Text style={[styles.cmdPillText, { color: theme.textSecondary }]}>/save</Text>
          </SmoothScaleButton>

          <SmoothScaleButton
            style={[styles.cmdPill, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
            onPress={() => createNewConversation()}
          >
            <Text style={[styles.cmdPillText, { color: theme.textSecondary }]}>/clear</Text>
          </SmoothScaleButton>
        </View>
      </View>

      {/* Multi-Attachment Preview Tray */}
      {activeAttachments.length > 0 && (
        <View style={styles.multiAttachmentTray}>
          <View style={styles.multiAttachmentHeader}>
            <View style={[styles.multiAttachmentBadge, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
              <Icon name="image" size={11} color={theme.textPrimary} />
              <Text style={[styles.multiAttachmentCountText, { color: theme.textPrimary }]}>
                {activeAttachments.length} {activeAttachments.length === 1 ? 'ATTACHED' : 'ATTACHED'}
              </Text>
            </View>
            <TouchableOpacity onPress={clearAttachments} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.clearAllText, { color: theme.textMuted }]}>Clear all</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachmentScroll}>
            {activeAttachments.map((att, idx) => (
              <View key={att.id || idx} style={[styles.attachmentPillItem, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                <View style={[styles.attachmentIconBadge, { backgroundColor: theme.surfaceElevated }]}>
                  <Icon name={att.type === 'camera' ? 'camera' : 'image'} size={13} color={theme.accent} />
                </View>
                <Text style={[styles.attachmentLabel, { color: theme.textPrimary }]} numberOfLines={1}>
                  {att.name || `Image #${idx + 1}`}
                </Text>
                <TouchableOpacity
                  onPress={() => removeAttachment(att.id)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  style={styles.attachmentCloseBtn}
                >
                  <Icon name="close" size={11} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View
        style={[
          styles.composerCard,
          {
            backgroundColor: theme.composerBg,
            borderColor: theme.composerBorder,
          },
        ]}
      >
        {/* Plus Button to trigger Action Bottom Sheet */}
        <SmoothScaleButton
          style={[styles.plusButton, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
          onPress={() => openModal('actions_sheet')}
          accessibilityRole="button"
          accessibilityLabel="Open Actions and Creation Studios"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Icon name="plus" size={16} color={theme.textPrimary} />
        </SmoothScaleButton>

        {/* Multiline text field */}
        <TextInput
          style={[
            styles.input,
            {
              color: theme.textPrimary,
              height: Math.min(Math.max(44, inputHeight), 120),
            },
          ]}
          placeholder={placeholderText}
          placeholderTextColor={theme.textMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          onContentSizeChange={e => {
            setInputHeight(e.nativeEvent.contentSize.height + 10);
          }}
          editable={!isBusy}
        />

        {/* Action Controls Row with 44dp touch targets */}
        <View style={styles.actionRow}>
          {/* Microphone Button */}
          <SmoothScaleButton
            style={styles.micButton}
            onPress={startVoiceListening}
            accessibilityRole="button"
            accessibilityLabel="Open Voice Mode"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon
              name="mic"
              size={20}
              color={theme.textMuted}
            />
          </SmoothScaleButton>

          {/* Send / Stop Button */}
          {isBusy ? (
            <SmoothScaleButton
              style={[
                styles.sendButton,
                {
                  backgroundColor: theme.accent,
                },
              ]}
              onPress={stopGeneration}
              accessibilityRole="button"
              accessibilityLabel="Stop generating"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon
                name="square"
                size={14}
                color={theme.textInverse}
              />
            </SmoothScaleButton>
          ) : (
            <SmoothScaleButton
              style={[
                styles.sendButton,
                {
                  backgroundColor: canSend ? theme.accent : theme.surfaceElevated,
                },
              ]}
              onPress={handleSend}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon
                name="arrowUp"
                size={16}
                color={canSend ? theme.textInverse : theme.textMuted}
              />
            </SmoothScaleButton>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
  },
  topControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  miniCmdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cmdPill: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  cmdPillText: {
    fontSize: 11,
    fontWeight: '500',
  },
  composerCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 52,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
    paddingHorizontal: spacing.xs,
    textAlignVertical: 'center',
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  micButton: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    marginRight: 6,
  },
  studioChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    gap: 4,
  },
  studioChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  multiAttachmentTray: {
    marginBottom: 6,
  },
  multiAttachmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 6,
  },
  multiAttachmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  multiAttachmentCountText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  clearAllText: {
    fontSize: 11,
    fontWeight: '600',
  },
  attachmentScroll: {
    gap: 8,
    alignItems: 'center',
  },
  attachmentPillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    gap: 6,
    maxWidth: 220,
  },
  attachmentIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentLabel: {
    fontSize: 11.5,
    fontWeight: '500',
    flexShrink: 1,
  },
  attachmentCloseBtn: {
    padding: 2,
  },
});

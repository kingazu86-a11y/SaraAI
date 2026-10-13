import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Message } from '../../ai/AgentTypes';
import { useAssistant } from '../../store/AssistantStore';
import { ToolExecutionIndicator } from './ToolExecutionIndicator';
import { ThinkingIndicator } from './ThinkingIndicator';
import { RichMessageContent } from './content/RichMessageContent';
import { ClipboardService } from '../../services/ClipboardService';
import { ShareService } from '../../services/ShareService';
import { Icon } from '../common/Icon';
import { typography } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';

interface MessageItemProps {
  message: Message;
  isLast?: boolean;
}

const MessageItemComponent: React.FC<MessageItemProps> = ({ message, isLast = false }) => {
  const { theme, isGenerating, state, loadingModelText } = useAssistant();
  const [copied, setCopied] = useState<boolean>(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);

  const isUser = message.role === 'user';
  const isAssistant = !isUser;
  const isThisMessageActive = isAssistant && isLast && (isGenerating || state === 'thinking');
  const hasContent = !!message.content && message.content.trim().length > 0;

  const handleCopyMessage = async () => {
    if (!message.content) return;
    const success = await ClipboardService.setString(message.content);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isUser) {
    return (
      <View style={styles.userContainer}>
        {/* Active Studio Mode Pill for User */}
        {message.mode && message.mode !== 'chat' && (
          <View style={[styles.userModePill, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
            {message.mode === 'deep_search' && (
              <>
                <Icon name="search" size={11} color="#38BDF8" />
                <Text style={[styles.userModeText, { color: '#38BDF8' }]}>Deep Search</Text>
              </>
            )}
            {message.mode === 'create_image' && (
              <>
                <Icon name="sparkles" size={11} color="#A855F7" />
                <Text style={[styles.userModeText, { color: '#A855F7' }]}>Image Studio</Text>
              </>
            )}
            {message.mode === 'create_audio' && (
              <>
                <Icon name="volume" size={11} color="#F59E0B" />
                <Text style={[styles.userModeText, { color: '#F59E0B' }]}>Audio Studio</Text>
              </>
            )}
            {message.mode === 'create_video' && (
              <>
                <Icon name="video" size={11} color="#F43F5E" />
                <Text style={[styles.userModeText, { color: '#F43F5E' }]}>Video Studio</Text>
              </>
            )}
          </View>
        )}

        {/* Attachment Card if user attached camera snapshot or image */}
        {(() => {
          const list = message.attachments && message.attachments.length > 0
            ? message.attachments
            : message.attachment
            ? [message.attachment]
            : [];

          if (list.length === 0) return null;

          if (list.length === 1) {
            const single = list[0];
            return (
              <View style={[styles.userAttachmentCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <View style={[styles.userAttachmentIcon, { backgroundColor: theme.surfaceSubtle }]}>
                  <Icon name={single.type === 'camera' ? 'camera' : 'image'} size={16} color={theme.accent} />
                </View>
                <View style={styles.userAttachmentInfo}>
                  <Text style={[typography.captionMedium, { color: theme.textPrimary }]}>
                    {single.name || (single.type === 'camera' ? 'Camera Snapshot' : 'Attached Image')}
                  </Text>
                  <Text style={[typography.caption, { color: theme.textMuted }]}>
                    Attached media for vision analysis
                  </Text>
                </View>
              </View>
            );
          }

          return (
            <View style={[styles.userMultiAttachmentsCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <View style={styles.multiAttachmentBadgeRow}>
                <View style={[styles.userAttachmentIcon, { backgroundColor: theme.surfaceSubtle }]}>
                  <Icon name="image" size={14} color={theme.accent} />
                </View>
                <Text style={[typography.captionMedium, { color: theme.textPrimary, flex: 1 }]}>
                  {list.length} Images Attached
                </Text>
              </View>

              <View style={styles.attachmentGridRow}>
                {list.map((att, i) => (
                  <View key={att.id || i} style={[styles.attachmentGridCell, { backgroundColor: theme.surfaceSubtle, borderColor: theme.borderSubtle }]}>
                    <Icon name={att.type === 'camera' ? 'camera' : 'image'} size={18} color={theme.accent} />
                    <Text style={[styles.cellText, { color: theme.textSecondary }]} numberOfLines={1}>
                      {att.name || `#${i + 1}`}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })()}

        {/* Main User Text Bubble */}
        <View style={[styles.userBubble, { backgroundColor: theme.userMessageBg }]}>
          <Text selectable={true} style={[typography.body, { color: theme.textPrimary }]}>
            {message.content}
          </Text>
        </View>
      </View>
    );
  }

  const studioData = message.studioData;

  return (
    <View style={styles.assistantContainer}>
      <View style={styles.assistantRow}>
        <View style={[styles.avatarBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
          <Icon name="sparkles" size={13} color={theme.textPrimary} />
        </View>
        <View style={styles.assistantBody}>
          {message.toolCall && (
            <ToolExecutionIndicator
              toolCall={message.toolCall}
              toolResult={message.toolResult}
            />
          )}

          {/* Specialized Studio Artifact Renderers */}
          {studioData?.mode === 'deep_search' && (
            <View style={[styles.studioResultCard, { backgroundColor: theme.surfaceSubtle, borderColor: 'rgba(56, 189, 248, 0.3)' }]}>
              <View style={styles.studioCardHeader}>
                <View style={[styles.studioIconBadge, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                  <Icon name="search" size={14} color="#38BDF8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyBold, { color: theme.textPrimary }]}>Deep Search Analysis</Text>
                  <Text style={[typography.caption, { color: '#38BDF8' }]}>
                    {studioData.searchDepth || 'Level 3 • Multi-Hop Verified'}
                  </Text>
                </View>
              </View>

              {studioData.sources && studioData.sources.length > 0 && (
                <View style={styles.sourcesContainer}>
                  <Text style={[styles.sourcesHeading, { color: theme.textMuted }]}>
                    VERIFIED SOURCES CONSULTED
                  </Text>
                  {studioData.sources.map((src, idx) => (
                    <View key={idx} style={[styles.sourceItem, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }]}>
                      <Text style={[typography.captionMedium, { color: theme.textPrimary }]} numberOfLines={1}>
                        • {src.title}
                      </Text>
                      <Text style={[typography.caption, { color: theme.textSecondary, marginTop: 1 }]} numberOfLines={2}>
                        {src.snippet}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {studioData?.mode === 'create_image' && (
            <View style={[styles.studioResultCard, { backgroundColor: theme.surfaceSubtle, borderColor: 'rgba(168, 85, 247, 0.3)' }]}>
              <View style={styles.studioCardHeader}>
                <View style={[styles.studioIconBadge, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                  <Icon name="sparkles" size={14} color="#A855F7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyBold, { color: theme.textPrimary }]}>AI Image Studio</Text>
                  <Text style={[typography.caption, { color: '#A855F7' }]}>
                    Rendered at {studioData.resolution || '1024x1024'} • Aspect {studioData.aspectRatio || '1:1'}
                  </Text>
                </View>
              </View>

              {/* Generative Visual Art Canvas Simulation */}
              <View style={[styles.imageCanvasBox, { backgroundColor: '#111827', borderColor: theme.border }]}>
                <View style={styles.imageArtBackdrop}>
                  <View style={[styles.artCircle1, { backgroundColor: '#8B5CF6' }]} />
                  <View style={[styles.artCircle2, { backgroundColor: '#EC4899' }]} />
                  <View style={[styles.artCircle3, { backgroundColor: '#3B82F6' }]} />
                </View>
                <View style={styles.imageOverlayContent}>
                  <Icon name="image" size={36} color="#FFFFFF" style={{ opacity: 0.9 }} />
                  <Text style={styles.imagePromptOverlay} numberOfLines={2}>
                    "{studioData.prompt || 'High resolution visual render'}"
                  </Text>
                  <View style={styles.imageBadgePill}>
                    <Text style={styles.imageBadgeText}>SARA DIFFUSION XL</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {studioData?.mode === 'create_audio' && (
            <View style={[styles.studioResultCard, { backgroundColor: theme.surfaceSubtle, borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
              <View style={styles.studioCardHeader}>
                <View style={[styles.studioIconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                  <Icon name="volume" size={14} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyBold, { color: theme.textPrimary }]}>AI Audio Studio</Text>
                  <Text style={[typography.caption, { color: '#F59E0B' }]}>
                    Synthesized 48kHz WAV • Stereo Audio
                  </Text>
                </View>
              </View>

              {/* Interactive Audio Player Card */}
              <View style={[styles.audioPlayerBox, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <TouchableOpacity
                  style={[styles.audioPlayBtn, { backgroundColor: theme.accent }]}
                  onPress={() => setIsPlayingAudio(prev => !prev)}
                  activeOpacity={0.8}
                >
                  <Icon name={isPlayingAudio ? 'stop' : 'play'} size={14} color={theme.textInverse} />
                </TouchableOpacity>

                {/* Animated Waveform Equalizer simulation */}
                <View style={styles.waveformContainer}>
                  {[12, 24, 16, 28, 20, 32, 18, 26, 14, 28, 22, 30, 16, 24, 12].map((height, i) => (
                    <View
                      key={i}
                      style={[
                        styles.waveBar,
                        {
                          height: isPlayingAudio ? Math.max(6, (height * ((i % 3) + 1)) % 32) : height,
                          backgroundColor: isPlayingAudio ? '#F59E0B' : theme.textMuted,
                        },
                      ]}
                    />
                  ))}
                </View>

                <Text style={[styles.audioDurationText, { color: theme.textSecondary }]}>
                  {studioData.duration || '0:48'}
                </Text>
              </View>
            </View>
          )}

          {studioData?.mode === 'create_video' && (
            <View style={[styles.studioResultCard, { backgroundColor: theme.surfaceSubtle, borderColor: 'rgba(244, 63, 94, 0.3)' }]}>
              <View style={styles.studioCardHeader}>
                <View style={[styles.studioIconBadge, { backgroundColor: 'rgba(244, 63, 94, 0.15)' }]}>
                  <Icon name="video" size={14} color="#F43F5E" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyBold, { color: theme.textPrimary }]}>AI Video Studio</Text>
                  <Text style={[typography.caption, { color: '#F43F5E' }]}>
                    Cinematic 1080p • {studioData.fps || 60}fps • {studioData.durationSec || 8}s Duration
                  </Text>
                </View>
              </View>

              {/* 16:9 Video Player Box */}
              <View style={[styles.videoPlayerBox, { backgroundColor: '#090D16', borderColor: theme.border }]}>
                <View style={styles.videoGradientBackdrop} />
                <View style={styles.videoPlayOverlay}>
                  <View style={[styles.videoPlayCircle, { backgroundColor: 'rgba(244, 63, 94, 0.85)' }]}>
                    <Icon name="play" size={18} color="#FFFFFF" />
                  </View>
                  <Text style={styles.videoPromptText} numberOfLines={1}>
                    "{studioData.prompt || 'Cinematic video sequence'}"
                  </Text>
                </View>
                <View style={styles.videoTimeBadge}>
                  <Text style={styles.videoTimeText}>0:08 / 1080p</Text>
                </View>
              </View>
            </View>
          )}

          {/* Main message text / thinking indicator */}
          {isThisMessageActive && !hasContent ? (
            <View style={styles.thinkingContainer}>
              <ThinkingIndicator text={loadingModelText || 'Thinking'} />
            </View>
          ) : (
            <View style={styles.contentWrapper}>
              {hasContent ? (
                <RichMessageContent content={message.content} />
              ) : !studioData ? (
                <Text selectable={true} style={[typography.body, { color: theme.textSecondary, fontStyle: 'italic' }]}>
                  No response content available.
                </Text>
              ) : null}
              {isThisMessageActive && hasContent && (
                <View style={styles.streamingDotsWrapper}>
                  <ThinkingIndicator dotsOnly inline />
                </View>
              )}
            </View>
          )}

          {/* Quick Action Bar for assistant message */}
          {hasContent && !isThisMessageActive && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.quickActionBtn,
                  {
                    backgroundColor: copied ? theme.accent : theme.surfaceSubtle,
                    borderColor: copied ? theme.accent : theme.border,
                  },
                ]}
                onPress={handleCopyMessage}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon
                  name={copied ? 'check' : 'copy'}
                  size={12}
                  color={copied ? theme.textInverse : theme.textSecondary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.quickActionBtn,
                  {
                    backgroundColor: theme.surfaceSubtle,
                    borderColor: theme.border,
                    marginLeft: 6,
                  },
                ]}
                onPress={() => ShareService.shareText(message.content, 'Sara AI Response')}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon
                  name="share"
                  size={12}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Memory Status Pill */}
          {(message.msgType === 'memory' || message.memoryState || message.memorySaved) && (
            message.memoryState === 'saving' ? (
              <View
                style={[
                  styles.memoryBadge,
                  {
                    backgroundColor: theme.surfaceSubtle,
                    borderColor: theme.border,
                  },
                ]}
              >
                <ActivityIndicator
                  size="small"
                  color={theme.textPrimary}
                  style={{ marginRight: 6, transform: [{ scale: 0.65 }] }}
                />
                <Text style={[styles.memoryBadgeLabel, { color: theme.textSecondary }]}>
                  Saving to memory...
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.memoryBadge,
                  {
                    backgroundColor: theme.surfaceSubtle,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Icon name="check" size={11} color={theme.textPrimary} style={{ marginRight: 6 }} />
                <Text style={[styles.memoryBadgeLabel, { color: theme.textMuted }]}>
                  Saved to memory:{' '}
                </Text>
                <Text style={[styles.memoryBadgeText, { color: theme.textPrimary }]} numberOfLines={1}>
                  "{message.memorySaved?.title || 'Saved to phone storage'}"
                </Text>
              </View>
            )
          )}
        </View>
      </View>
    </View>
  );
};

export const MessageItem = React.memo<MessageItemProps>(
  MessageItemComponent,
  (prev, next) => {
    return (
      prev.isLast === next.isLast &&
      prev.message.id === next.message.id &&
      prev.message.content === next.message.content &&
      prev.message.msgType === next.message.msgType &&
      prev.message.mode === next.message.mode &&
      prev.message.attachment === next.message.attachment &&
      prev.message.studioData === next.message.studioData &&
      prev.message.memoryState === next.message.memoryState &&
      prev.message.toolCall === next.message.toolCall &&
      prev.message.toolResult === next.message.toolResult
    );
  }
);

const styles = StyleSheet.create({
  userContainer: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  userModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    marginBottom: 4,
  },
  userModeText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  userAttachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 6,
    maxWidth: '85%',
    gap: 8,
  },
  userAttachmentIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAttachmentInfo: {
    flex: 1,
  },
  userMultiAttachmentsCard: {
    padding: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 6,
    maxWidth: '85%',
  },
  multiAttachmentBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  attachmentGridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  attachmentGridCell: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 64,
  },
  cellText: {
    fontSize: 9.5,
    fontWeight: '600',
    maxWidth: 70,
  },
  userBubble: {
    maxWidth: '85%',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },
  assistantContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  assistantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarBox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    marginTop: 2,
    borderWidth: 1,
  },
  assistantBody: {
    flex: 1,
  },
  contentWrapper: {
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 2,
  },
  quickActionBtn: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thinkingContainer: {
    minHeight: 26,
    justifyContent: 'center',
  },
  streamingDotsWrapper: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  memoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    maxWidth: '96%',
  },
  memoryBadgeLabel: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  memoryBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
    flexShrink: 1,
  },
  studioResultCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  studioCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.sm,
  },
  studioIconBadge: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourcesContainer: {
    marginTop: spacing.xs,
    gap: 6,
  },
  sourcesHeading: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  sourceItem: {
    padding: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  imageCanvasBox: {
    height: 180,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageArtBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.35,
  },
  artCircle1: {
    position: 'absolute',
    top: -20,
    left: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  artCircle2: {
    position: 'absolute',
    bottom: -30,
    right: -20,
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  artCircle3: {
    position: 'absolute',
    top: 40,
    right: 40,
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  imageOverlayContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  imagePromptOverlay: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  imageBadgePill: {
    marginTop: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  imageBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  audioPlayerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  audioPlayBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 32,
    paddingHorizontal: 4,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
  },
  audioDurationText: {
    fontSize: 12,
    fontWeight: '600',
  },
  videoPlayerBox: {
    height: 170,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoGradientBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F172A',
  },
  videoPlayOverlay: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  videoPlayCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  videoPromptText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  videoTimeBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  videoTimeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
});

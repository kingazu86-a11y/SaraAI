import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useAssistant } from '../../store/AssistantStore';
import { MessageItem } from './MessageItem';
import { ThinkingIndicator } from './ThinkingIndicator';
import { Icon } from '../common/Icon';
import { SaraLogo } from '../common/SaraLogo';
import { SmoothScaleButton } from '../common/SmoothScaleButton';
import { typography } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';

const DEFAULT_PROMPT_SUGGESTIONS = [
  { label: 'Search documents', command: 'Search PDF files in storage' },
  { label: 'Inspect screen', command: 'Read current screen elements' },
  { label: 'Open Settings', command: 'Open Android Settings' },
  { label: 'Installed apps', command: 'List installed applications' },
];

const DEEP_SEARCH_SUGGESTIONS = [
  { label: 'Quantum Computing 2026', command: 'Perform deep research on quantum computing advancements in 2026' },
  { label: 'On-Device AI vs Cloud', command: 'Synthesize comprehensive benchmark comparison between edge AI and cloud models' },
  { label: 'Inspect System Files', command: 'Deep inspect all storage directories and summarize system configuration files' },
  { label: 'Clean Tech Market Report', command: 'Comprehensive market analysis on green energy and clean technology trends' },
];

const IMAGE_STUDIO_SUGGESTIONS = [
  { label: 'Cyberpunk Tokyo 8K', command: 'Futuristic cyberpunk Tokyo street bathed in purple neon rain, 8k resolution' },
  { label: 'Astronaut on Mars', command: 'Cinematic portrait of a golden astronaut discovering glowing alien flora on Mars' },
  { label: '3D Isometric Room', command: 'Minimalist 3D isometric workspace with holographic plants and soft lighting' },
  { label: 'Surreal Crystal Trees', command: 'Surreal oil painting of glowing digital crystal trees at dusk with melting clocks' },
];

const AUDIO_STUDIO_SUGGESTIONS = [
  { label: 'Lofi Chillhop Rain', command: 'Generate relaxing ambient lofi hip-hop beat with gentle rain sounds' },
  { label: 'Podcast Opening Theme', command: 'Compose professional podcast opening theme with warm acoustic chords' },
  { label: 'Sci-Fi Synth Soundtrack', command: 'Create energetic retro synthwave electronic track for deep coding focus' },
  { label: 'Ocean Waves & Chimes', command: 'Soothing meditative soundscape of ocean waves with gentle singing bowls' },
];

const VIDEO_STUDIO_SUGGESTIONS = [
  { label: 'Misty Mountains Drone', command: 'Cinematic 4K drone shot flying over misty pine mountain peaks at sunrise' },
  { label: 'Galaxy Time-Lapse', command: 'Dynamic time-lapse of neon spiral galaxy rotating above a futuristic metropolis' },
  { label: 'Liquid Gold Slow-Mo', command: 'Ultra slow-motion macro shot of a liquid gold droplet splashing on obsidian' },
  { label: 'Cyber Hypercar Drive', command: 'Sleek electric hypercar cruising through illuminated foggy cyber tunnels' },
];

export const ChatList: React.FC = () => {
  const {
    activeConversation,
    state,
    sendCommand,
    activeTextModel,
    isAssistantEnabled,
    openModal,
    theme,
    isDeepSearchActive,
    isCreateImageActive,
    isCreateAudioActive,
    isCreateVideoActive,
    hasMoreOlderMessages,
    isLoadingOlderMessages,
    loadOlderMessages,
  } = useAssistant();
  const flatListRef = useRef<FlatList>(null);
  const isAtBottomRef = useRef<boolean>(true);
  const isUserTouchingRef = useRef<boolean>(false);

  const messages = activeConversation?.messages || [];
  const prevMessagesLengthRef = useRef<number>(messages.length);
  const isThinking = state === 'thinking';
  const lastMessage = messages[messages.length - 1];
  const hasActiveAssistantMessage = lastMessage?.role === 'assistant';

  // Determine active suggestion set
  const activeSuggestions = isCreateImageActive
    ? IMAGE_STUDIO_SUGGESTIONS
    : isCreateAudioActive
    ? AUDIO_STUDIO_SUGGESTIONS
    : isCreateVideoActive
    ? VIDEO_STUDIO_SUGGESTIONS
    : isDeepSearchActive
    ? DEEP_SEARCH_SUGGESTIONS
    : DEFAULT_PROMPT_SUGGESTIONS;

  // Determine hero heading and subtitle for empty state
  const heroHeading = isCreateImageActive
    ? 'AI Image Studio'
    : isCreateAudioActive
    ? 'AI Audio Studio'
    : isCreateVideoActive
    ? 'AI Video Studio'
    : isDeepSearchActive
    ? 'Deep Search Engine'
    : activeTextModel
    ? `${activeTextModel.name} Ready`
    : 'No AI Model Active';

  const heroSubtitle = isCreateImageActive
    ? 'Describe any character, scene, product, or abstract visual concept to render.'
    : isCreateAudioActive
    ? 'Synthesize acoustic tracks, atmospheric background music, and voiceover.'
    : isCreateVideoActive
    ? 'Direct and render cinematic scenes, motion clips, and 60fps sequences.'
    : isDeepSearchActive
    ? 'Exhaustive multi-source retrieval, structured findings, and verified citations.'
    : activeTextModel
    ? '100% offline on-device AI. How can I help you operate your phone today?'
    : 'Sara AI runs completely on your device. Download or activate an offline model in the Model Center to begin.';

  // 1. When a new message is added, always auto-scroll to bottom
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      isAtBottomRef.current = true;
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length]);

  // 2. During response generation streaming, only scroll if user is currently at the bottom
  useEffect(() => {
    if (messages.length > 0 && isAtBottomRef.current && !isUserTouchingRef.current) {
      flatListRef.current?.scrollToEnd({ animated: false });
    }
  }, [lastMessage?.content, isThinking]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 60;
    const atBottom =
      contentSize.height <= layoutMeasurement.height ||
      layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

    isAtBottomRef.current = atBottom;

    // Upward scroll detection to progressively load older messages
    if (contentOffset.y <= 60 && hasMoreOlderMessages && !isLoadingOlderMessages) {
      loadOlderMessages();
    }
  };

  // Empty state when messages are empty
  if (messages.length === 0) {
    const isCreativeStudioActive = isCreateImageActive || isCreateAudioActive || isCreateVideoActive;

    if (!activeTextModel && !isCreativeStudioActive && !isDeepSearchActive) {
      return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          <ScrollView
            style={styles.flex1}
            contentContainerStyle={styles.emptyScrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <SaraLogo size={64} style={styles.emptyLogoSpacing} />
            <Text style={[typography.h1, styles.emptyHeading, { color: theme.textPrimary }]}>
              {heroHeading}
            </Text>
            <Text style={[typography.body, styles.emptySub, { color: theme.textMuted }]}>
              {heroSubtitle}
            </Text>

            <SmoothScaleButton
              style={[styles.primaryActionBtn, { backgroundColor: theme.accent }]}
              onPress={() => openModal('model_manager')}
            >
              <Icon name="cpu" size={16} color={theme.textInverse} />
              <Text style={[typography.bodyBold, { color: theme.textInverse, marginLeft: spacing.sm }]}>
                Open Model Center
              </Text>
            </SmoothScaleButton>
          </ScrollView>
        </View>
      );
    }

    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.emptyScrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Custom Logo / Studio Icon in Empty State */}
          {isCreateImageActive ? (
            <View style={[styles.studioHeroIconBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
              <Icon name="image" size={28} color={theme.textPrimary} />
            </View>
          ) : isCreateAudioActive ? (
            <View style={[styles.studioHeroIconBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
              <Icon name="volume" size={28} color={theme.textPrimary} />
            </View>
          ) : isCreateVideoActive ? (
            <View style={[styles.studioHeroIconBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
              <Icon name="video" size={28} color={theme.textPrimary} />
            </View>
          ) : isDeepSearchActive ? (
            <View style={[styles.studioHeroIconBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
              <Icon name="search" size={28} color={theme.textPrimary} />
            </View>
          ) : (
            <SaraLogo size={64} style={styles.emptyLogoSpacing} />
          )}

          <Text style={[typography.h1, styles.emptyHeading, { color: theme.textPrimary }]}>
            {heroHeading}
          </Text>
          <Text style={[typography.body, styles.emptySub, { color: theme.textMuted }]}>
            {heroSubtitle}
          </Text>

          {/* Dynamic Suggestion Pills */}
          <View style={styles.suggestionsGrid}>
            {activeSuggestions.map((item, index) => (
              <SmoothScaleButton
                key={index}
                style={[styles.suggestionPill, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => sendCommand(item.command)}
              >
                <Text style={[typography.captionMedium, { color: theme.textSecondary, flex: 1 }]}>
                  {item.label}
                </Text>
                <Icon name="chevronRight" size={12} color={theme.textMuted} />
              </SmoothScaleButton>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <MessageItem message={item} isLast={index === messages.length - 1} />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        maintainVisibleContentPosition={{
          minIndexForVisible: 1,
        }}
        ListHeaderComponent={
          isLoadingOlderMessages ? (
            <View style={styles.headerLoader}>
              <ActivityIndicator size="small" color={theme.accent} />
            </View>
          ) : null
        }
        onScroll={handleScroll}
        onScrollBeginDrag={() => {
          isUserTouchingRef.current = true;
        }}
        onScrollEndDrag={() => {
          isUserTouchingRef.current = false;
        }}
        onMomentumScrollEnd={() => {
          isUserTouchingRef.current = false;
        }}
        scrollEventThrottle={16}
        ListFooterComponent={
          isThinking && !hasActiveAssistantMessage ? (
            <View style={styles.footerThinkingRow}>
              <View style={[styles.avatarBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                <Icon name="sparkles" size={13} color={theme.textPrimary} />
              </View>
              <ThinkingIndicator />
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerLoader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex1: {
    flex: 1,
  },
  studioHeroIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  listContent: {
    paddingVertical: spacing.md,
  },
  emptyScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 24,
    paddingBottom: 40,
  },
  emptyLogoSpacing: {
    marginBottom: spacing.md,
  },
  emptyHeading: {
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptySub: {
    textAlign: 'center',
    marginBottom: spacing.xl,
    maxWidth: 320,
    lineHeight: 22,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  suggestionsGrid: {
    width: '100%',
    gap: spacing.sm,
  },
  suggestionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  footerThinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  avatarBox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderWidth: 1,
  },
});

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Animated,
  Easing,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAssistant } from '../../store/AssistantStore';
import { Icon } from '../common/Icon';
import { spacing, radius } from '../../theme/spacing';
import { SystemBarNative } from '../../native/SystemBarNative';

type VoicePanelState = 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'idle';

export const VoiceAssistantModal: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    activeModal,
    closeModal,
    openModal,
    activeVoiceModel,
    activeTextModel,
    models,
    setActiveModel,
    sendCommand,
    customization,
    theme,
    themeMode,
  } = useAssistant();

  const isVisible = activeModal === 'voice_panel';
  const [isVoiceConfigOpen, setIsVoiceConfigOpen] = useState(false);

  const [voiceState, setVoiceState] = useState<VoicePanelState>('listening');
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [spokenResponse, setSpokenResponse] = useState<string>('');

  // Synchronize system bars with active theme
  useEffect(() => {
    if (isVisible) {
      SystemBarNative.setSystemBars(theme.background, theme.background, themeMode === 'light');
    }
  }, [isVisible, theme.background, themeMode]);

  // Pulsing animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;

  // Downloaded Combined Voice Packs
  const readyVoicePacks = models.filter(
    m => (m.kind === 'voice_pack' || m.kind === 'voice_ai' || m.kind === 'stt') && m.status === 'READY'
  );

  // Pulse animation loop
  useEffect(() => {
    if (isVisible) {
      setVoiceState('listening');
      setLiveTranscript('Listening... Speak now');
      setSpokenResponse('');

      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.18,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

      const ripple = Animated.loop(
        Animated.timing(rippleAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        })
      );

      pulse.start();
      ripple.start();

      return () => {
        pulse.stop();
        ripple.stop();
      };
    }
  }, [isVisible, pulseAnim, rippleAnim]);

  const handleSimulatedVoiceCommand = (command: string) => {
    setVoiceState('transcribing');
    setLiveTranscript(`"${command}"`);

    setTimeout(() => {
      setVoiceState('thinking');

      setTimeout(() => {
        setVoiceState('speaking');
        const voicePackName = activeVoiceModel?.name || 'Sara Voice Pack';
        const llmName = activeTextModel?.name || 'Local TTT LLM';
        const responseText = `Understood. Processing "${command}" with ${llmName} reasoning via ${voicePackName}.`;
        setSpokenResponse(responseText);

        sendCommand(command);

        setTimeout(() => {
          setVoiceState('idle');
        }, 2200);
      }, 900);
    }, 800);
  };

  const handleToggleListening = () => {
    if (voiceState === 'listening') {
      handleSimulatedVoiceCommand('Open Android Settings');
    } else {
      setVoiceState('listening');
      setLiveTranscript('Listening... Speak your command');
      setSpokenResponse('');
    }
  };

  const getStateLabel = () => {
    switch (voiceState) {
      case 'listening':
        return 'LISTENING (STT)';
      case 'transcribing':
        return 'TRANSCRIBING';
      case 'thinking':
        return 'THINKING (TTT LLM)';
      case 'speaking':
        return 'SPEAKING (TTS)';
      case 'idle':
        return 'TAP TO SPEAK';
    }
  };

  const handleSelectVoicePack = (id: string) => {
    setActiveModel(id);
    setIsVoiceConfigOpen(false);
  };

  const handleOpenModelCenter = () => {
    setIsVoiceConfigOpen(false);
    closeModal();
    openModal('model_manager');
  };

  const rippleScale = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.1],
  });

  const rippleOpacity = rippleAnim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.35, 0.1, 0],
  });

  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0
  );

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'fullScreen' : 'overFullScreen'}
      onRequestClose={closeModal}
      statusBarTranslucent={true}
    >
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: topInset }]}>
        <StatusBar
          barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor={theme.background}
          translucent={true}
        />

        {/* Top Header */}
        <View style={[styles.topHeader, { backgroundColor: theme.background, borderBottomColor: theme.borderSubtle }]}>
          {/* Interactive Voice Pack Selector Badge */}
          <TouchableOpacity
            style={[styles.modelBadgeBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
            onPress={() => setIsVoiceConfigOpen(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Configure voice model pack"
          >
            <View style={[styles.statusDot, { backgroundColor: theme.success }]} />
            <View style={styles.badgeTextCol}>
              <Text style={[styles.modelBadgeTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                {activeVoiceModel?.name || 'Select Voice Pack'}
              </Text>
              <Text style={[styles.modelBadgeSub, { color: theme.textMuted }]} numberOfLines={1}>
                STT & TTS • Brain: {activeTextModel?.name ? activeTextModel.name.split(' ')[0] + ' LLM' : 'TTT LLM'}
              </Text>
            </View>
            <Icon name="chevronDown" size={11} color={theme.textMuted} style={styles.chevron} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
            onPress={closeModal}
            accessibilityRole="button"
            accessibilityLabel="Close Voice Mode"
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="close" size={16} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Central Orb Area */}
        <View style={styles.centerSection}>
          {/* Animated Visualizer Rings */}
          <View style={styles.orbWrapper}>
            <Animated.View
              style={[
                styles.rippleRing,
                {
                  borderColor: theme.accent,
                  transform: [{ scale: rippleScale }],
                  opacity: rippleOpacity,
                },
              ]}
            />
            <Animated.View
              style={[
                styles.centralOrb,
                {
                  backgroundColor: theme.accent,
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <Icon
                name={voiceState === 'speaking' ? 'sparkles' : 'mic'}
                size={34}
                color={theme.textInverse}
              />
            </Animated.View>
          </View>

          {/* Status Pill */}
          <View style={[styles.statePill, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
            <Text style={[styles.statePillText, { color: theme.textPrimary }]}>
              {getStateLabel()}
            </Text>
          </View>

          {/* Live Transcript / Response Box */}
          <View style={styles.transcriptBox}>
            <Text style={[styles.transcriptText, { color: theme.textPrimary }]}>
              {voiceState === 'speaking' ? spokenResponse : liveTranscript}
            </Text>
          </View>
        </View>

        {/* Quick Voice Suggestions */}
        <View style={styles.suggestionsContainer}>
          <Text style={[styles.suggestionTitle, { color: theme.textMuted }]}>
            Tap to test voice command:
          </Text>
          <View style={styles.suggestionsRow}>
            {['Open Settings', 'Check Battery', 'Turn on Wi-Fi', 'Who are you?'].map((cmd, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.suggestionBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                onPress={() => handleSimulatedVoiceCommand(cmd)}
                activeOpacity={0.7}
              >
                <Text style={[styles.suggestionBtnText, { color: theme.textSecondary }]}>
                  {cmd}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bottom Control Bar */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20), borderTopColor: theme.borderSubtle }]}>
          <TouchableOpacity
            style={[
              styles.micActionBtn,
              {
                backgroundColor: voiceState === 'listening' ? theme.accent : theme.surfaceSubtle,
                borderColor: theme.border,
              },
            ]}
            onPress={handleToggleListening}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={voiceState === 'listening' ? 'Stop Listening' : 'Start Listening'}
          >
            <Icon
              name={voiceState === 'listening' ? 'close' : 'mic'}
              size={24}
              color={voiceState === 'listening' ? theme.textInverse : theme.textPrimary}
            />
          </TouchableOpacity>
        </View>

        {/* Voice Model Pack Configuration Dropdown Sheet */}
        <Modal
          visible={isVoiceConfigOpen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsVoiceConfigOpen(false)}
        >
          <TouchableWithoutFeedback onPress={() => setIsVoiceConfigOpen(false)}>
            <View style={styles.backdrop}>
              <TouchableWithoutFeedback>
                <View
                  style={[
                    styles.configCard,
                    {
                      top: topInset + 58,
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  {/* Config Header */}
                  <View style={[styles.configHeader, { borderBottomColor: theme.borderSubtle }]}>
                    <View style={styles.configHeaderCol}>
                      <Text style={[styles.configTitle, { color: theme.textPrimary }]}>
                        Combined Voice Packs
                      </Text>
                      <Text style={[styles.configSubtitle, { color: theme.textMuted }]}>
                        STT (Speech Input) + TTS (Speech Output) voice engines
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setIsVoiceConfigOpen(false)}
                      style={[styles.miniCloseBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                    >
                      <Icon name="close" size={13} color={theme.textPrimary} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={styles.configScroll} showsVerticalScrollIndicator={false} bounces={false}>
                    {/* Voice Packs List */}
                    <View style={styles.modelSection}>
                      <View style={styles.sectionLabelRow}>
                        <Icon name="mic" size={13} color={theme.accent} style={{ marginRight: 6 }} />
                        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                          DOWNLOADED VOICE PACKS (STT + TTS)
                        </Text>
                      </View>

                      {readyVoicePacks.length > 0 ? (
                        readyVoicePacks.map(m => {
                          const isSelected = activeVoiceModel?.id === m.id;
                          return (
                            <TouchableOpacity
                              key={m.id}
                              style={[
                                styles.modelOptionRow,
                                {
                                  backgroundColor: isSelected ? theme.surfaceSubtle : 'transparent',
                                  borderColor: isSelected ? theme.accent : theme.borderSubtle,
                                },
                              ]}
                              onPress={() => handleSelectVoicePack(m.id)}
                              activeOpacity={0.7}
                            >
                              <View
                                style={[
                                  styles.radioCircle,
                                  {
                                    borderColor: isSelected ? theme.accent : theme.textMuted,
                                    backgroundColor: isSelected ? theme.accent : 'transparent',
                                  },
                                ]}
                              >
                                {isSelected && (
                                  <View style={[styles.radioDot, { backgroundColor: theme.textInverse }]} />
                                )}
                              </View>
                              <View style={styles.optionInfoCol}>
                                <View style={styles.optionNameRow}>
                                  <Text
                                    style={[
                                      styles.optionName,
                                      {
                                        color: isSelected ? theme.textPrimary : theme.textSecondary,
                                        fontWeight: isSelected ? '700' : '600',
                                      },
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {m.name}
                                  </Text>
                                  {isSelected && (
                                    <View style={[styles.activeMiniBadge, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                                      <Text style={[styles.activeMiniBadgeText, { color: theme.success }]}>
                                        ACTIVE
                                      </Text>
                                    </View>
                                  )}
                                </View>
                                <Text style={[styles.optionSpecs, { color: theme.textMuted }]} numberOfLines={1}>
                                  {m.sizeFormatted} • {m.runtime}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })
                      ) : (
                        <View style={[styles.inlineEmpty, { borderColor: theme.borderSubtle }]}>
                          <Text style={[styles.inlineEmptyText, { color: theme.textMuted }]}>
                            No voice packs downloaded yet.
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* LLM Brain Connection Note */}
                    <View style={[styles.llmBrainCard, { backgroundColor: theme.surfaceSubtle, borderColor: theme.borderSubtle }]}>
                      <View style={styles.llmBrainHeaderRow}>
                        <Icon name="cpu" size={14} color={theme.accent} style={{ marginRight: 6 }} />
                        <Text style={[styles.llmBrainTitle, { color: theme.textPrimary }]}>
                          AI Brain: {activeTextModel?.name || 'No TTT LLM Active'}
                        </Text>
                      </View>
                      <Text style={[styles.llmBrainDesc, { color: theme.textMuted }]}>
                        All intelligent responses, reasoning, and automation commands are powered by your active Chatbot TTT LLM.
                      </Text>
                    </View>
                  </ScrollView>

                  {/* Config Footer: Model Center link */}
                  <View style={[styles.configFooter, { borderTopColor: theme.borderSubtle }]}>
                    <TouchableOpacity
                      style={styles.moreVoiceRow}
                      onPress={handleOpenModelCenter}
                      activeOpacity={0.7}
                    >
                      <View style={styles.moreVoiceLeft}>
                        <Icon name="cpu" size={14} color={theme.accent} style={{ marginRight: 8 }} />
                        <Text style={[styles.moreVoiceText, { color: theme.textPrimary }]}>
                          Download More Voice Packs
                        </Text>
                      </View>
                      <Icon name="chevronRight" size={12} color={theme.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  topHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
  },
  modelBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    maxWidth: '75%',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
    flexShrink: 0,
  },
  badgeTextCol: {
    flexShrink: 1,
    minWidth: 0,
  },
  modelBadgeTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  modelBadgeSub: {
    fontSize: 10,
    fontWeight: '500',
  },
  chevron: {
    marginLeft: 6,
    flexShrink: 0,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  orbWrapper: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  rippleRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
  },
  centralOrb: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  statePill: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  statePillText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  transcriptBox: {
    paddingHorizontal: spacing.xl,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcriptText: {
    fontSize: 14.5,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  suggestionsContainer: {
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  suggestionTitle: {
    fontSize: 10.5,
    marginBottom: spacing.xs,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  suggestionBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  suggestionBtnText: {
    fontSize: 11,
    fontWeight: '500',
  },
  bottomBar: {
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  micActionBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  configCard: {
    position: 'absolute',
    width: '92%',
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  configHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  configHeaderCol: {
    flex: 1,
    marginRight: 10,
  },
  configTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  configSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 15,
  },
  miniCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  configScroll: {
    maxHeight: 340,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modelSection: {
    marginBottom: 14,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modelOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  radioDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  optionInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  optionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionName: {
    fontSize: 13,
    flex: 1,
    marginRight: 4,
  },
  activeMiniBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    flexShrink: 0,
  },
  activeMiniBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  optionSpecs: {
    fontSize: 10.5,
    marginTop: 2,
  },
  inlineEmpty: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  inlineEmptyText: {
    fontSize: 11.5,
  },
  llmBrainCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginVertical: 6,
  },
  llmBrainHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  llmBrainTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  llmBrainDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  configFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  moreVoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moreVoiceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moreVoiceText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
});

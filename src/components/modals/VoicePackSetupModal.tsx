import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAssistant } from '../../store/AssistantStore';
import { Icon } from '../common/Icon';
import { spacing, radius } from '../../theme/spacing';
import { SystemBarNative } from '../../native/SystemBarNative';
import { DownloadableModel } from '../../ai/ModelCatalog';

export const VoicePackSetupModal: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    activeModal,
    closeModal,
    openModal,
    models,
    activeTextModel,
    startDownloadModel,
    pauseDownloadModel,
    setActiveModel,
    theme,
    themeMode,
  } = useAssistant();

  const isVisible = activeModal === 'voice_pack_setup';

  // Synchronize system bars with active theme
  useEffect(() => {
    if (isVisible) {
      SystemBarNative.setSystemBars(theme.background, theme.background, themeMode === 'light');
    }
  }, [isVisible, theme.background, themeMode]);

  // Combined Voice Packs (STT + TTS)
  const voicePacks = models.filter(
    m => m.kind === 'voice_pack' || m.kind === 'voice_ai'
  );

  // Check if at least one combined voice pack is downloaded and ready
  const hasReadyVoice = models.some(
    m => (m.kind === 'voice_pack' || m.kind === 'voice_ai') && m.status === 'READY'
  );

  const handleLaunchVoice = () => {
    // Ensure active voice pack is selected
    const readyVoice = models.find(
      m => (m.kind === 'voice_pack' || m.kind === 'voice_ai') && m.status === 'READY'
    );
    if (readyVoice) {
      setActiveModel(readyVoice.id);
    }
    closeModal();
    openModal('voice_panel');
  };

  const handleOpenModelCenter = () => {
    closeModal();
    openModal('model_manager');
  };

  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0
  );

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'overFullScreen'}
      onRequestClose={closeModal}
      statusBarTranslucent={true}
    >
      <View style={[styles.root, { backgroundColor: theme.background, paddingTop: topInset }]}>
        <StatusBar
          barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor={theme.background}
          translucent={true}
        />

        {/* Toolbar Header */}
        <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.borderSubtle }]}>
          <View style={styles.headerTitleCol}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]} numberOfLines={1}>
              Voice Pack Setup
            </Text>
          </View>
          <TouchableOpacity
            onPress={closeModal}
            style={[styles.closeBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
            accessibilityRole="button"
            accessibilityLabel="Close voice setup"
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="close" size={16} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 24) + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {/* Informational Banner */}
          <View style={[styles.bannerCard, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
            <View style={[styles.bannerIconBox, { backgroundColor: 'rgba(34, 197, 94, 0.12)' }]}>
              <Icon name="mic" size={24} color={theme.success} />
            </View>
            <View style={styles.bannerTextCol}>
              <Text style={[styles.bannerTitle, { color: theme.textPrimary }]}>
                Combined Voice Packs (STT + TTS)
              </Text>
              <Text style={[styles.bannerSubtitle, { color: theme.textMuted }]}>
                Voice packs provide on-device Speech-to-Text (Input) and Text-to-Speech (Output). Your responses are powered by the active chatbot LLM ({activeTextModel?.name || 'Local TTT LLM'}).
              </Text>
            </View>
          </View>

          {/* Model Packs Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>
              Available Voice Packages
            </Text>

            {voicePacks.map(pack => {
              const isReady = pack.status === 'READY';
              const isDownloading = pack.status === 'DOWNLOADING';
              const isVerifying = pack.status === 'VERIFYING';

              return (
                <View
                  key={pack.id}
                  style={[
                    styles.packCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: isReady ? theme.success : theme.border,
                    },
                  ]}
                >
                  <View style={styles.packHeaderRow}>
                    <View style={styles.packTitleCol}>
                      <View style={styles.badgeRow}>
                        <View style={[styles.kindBadge, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                          <Text style={[styles.kindBadgeText, { color: theme.success }]}>
                            COMBINED STT + TTS PACK
                          </Text>
                        </View>
                        <Text style={[styles.sizeText, { color: theme.textMuted }]}>
                          {pack.sizeFormatted}
                        </Text>
                      </View>
                      <Text style={[styles.packName, { color: theme.textPrimary }]} numberOfLines={1}>
                        {pack.name}
                      </Text>
                      <Text style={[styles.packTagline, { color: theme.textMuted }]}>
                        {pack.tagline}
                      </Text>
                    </View>
                  </View>

                  {/* Capabilities */}
                  <View style={styles.capabilitiesRow}>
                    {pack.capabilities.map((cap, i) => (
                      <View key={i} style={[styles.capPill, { backgroundColor: theme.surfaceSubtle }]}>
                        <Text style={[styles.capText, { color: theme.textSecondary }]}>
                          {cap}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Progress Bar if Downloading */}
                  {(isDownloading || isVerifying) && (
                    <View style={styles.progressSection}>
                      <View style={styles.progressLabelRow}>
                        <Text style={[styles.progressStatusText, { color: theme.textMuted }]}>
                          {isVerifying ? 'Verifying integrity...' : `Downloading • ${pack.downloadSpeed || ''}`}
                        </Text>
                        <Text style={[styles.progressPercentText, { color: theme.textPrimary }]}>
                          {pack.progress}%
                        </Text>
                      </View>
                      <View style={[styles.progressTrack, { backgroundColor: theme.surfaceElevated }]}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              backgroundColor: theme.accent,
                              width: `${pack.progress}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  )}

                  {/* Action Button */}
                  <View style={styles.packActionRow}>
                    {isReady ? (
                      <View style={[styles.readyPill, { backgroundColor: 'rgba(34, 197, 94, 0.12)' }]}>
                        <Icon name="check" size={14} color={theme.success} style={{ marginRight: 6 }} />
                        <Text style={[styles.readyText, { color: theme.success }]}>
                          Installed & Ready
                        </Text>
                      </View>
                    ) : isDownloading ? (
                      <TouchableOpacity
                        style={[styles.pauseBtn, { borderColor: theme.border }]}
                        onPress={() => pauseDownloadModel(pack.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.pauseBtnText, { color: theme.textSecondary }]}>
                          Pause Download
                        </Text>
                      </TouchableOpacity>
                    ) : isVerifying ? (
                      <View style={styles.verifyingRow}>
                        <ActivityIndicator size="small" color={theme.accent} style={{ marginRight: 8 }} />
                        <Text style={[styles.verifyingText, { color: theme.textMuted }]}>
                          Verifying integrity...
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.downloadBtn, { backgroundColor: theme.accent }]}
                        onPress={() => startDownloadModel(pack.id)}
                        activeOpacity={0.8}
                      >
                        <Icon name="plus" size={14} color={theme.textInverse} style={{ marginRight: 6 }} />
                        <Text style={[styles.downloadBtnText, { color: theme.textInverse }]}>
                          Download Voice Pack
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Launch Action if Any Voice Model Ready */}
          {hasReadyVoice && (
            <View style={styles.launchSection}>
              <TouchableOpacity
                style={[styles.launchBtn, { backgroundColor: theme.success }]}
                onPress={handleLaunchVoice}
                activeOpacity={0.8}
              >
                <Icon name="mic" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.launchBtnText}>
                  Start Voice Assistant Now
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Model Center Full Catalog Link */}
          <TouchableOpacity
            style={[styles.moreModelsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={handleOpenModelCenter}
            activeOpacity={0.7}
          >
            <View style={styles.moreModelsLeft}>
              <Icon name="cpu" size={18} color={theme.accent} style={{ marginRight: 12 }} />
              <View>
                <Text style={[styles.moreModelsTitle, { color: theme.textPrimary }]}>
                  Explore Full Model Center
                </Text>
                <Text style={[styles.moreModelsSubtitle, { color: theme.textMuted }]}>
                  Browse all voice packs and text reasoning LLMs
                </Text>
              </View>
            </View>
            <Icon name="chevronRight" size={14} color={theme.textMuted} />
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  header: {
    width: '100%',
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  headerTitleCol: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
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
  scrollView: {
    flex: 1,
    width: '100%',
  },
  content: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  bannerIconBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  bannerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  bannerTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  bannerSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  section: {
    marginBottom: 16,
    width: '100%',
  },
  sectionHeader: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    paddingHorizontal: 4,
    fontSize: 11,
    fontWeight: '600',
  },
  packCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  packHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  packTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  kindBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  kindBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  sizeText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  packName: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  packTagline: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  capabilitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    marginBottom: 10,
  },
  capPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  capText: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  progressSection: {
    marginVertical: 10,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressStatusText: {
    fontSize: 11,
  },
  progressPercentText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  packActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  downloadBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pauseBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  pauseBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  readyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  readyText: {
    fontSize: 12,
    fontWeight: '700',
  },
  verifyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  verifyingText: {
    fontSize: 11.5,
  },
  launchSection: {
    marginVertical: 10,
  },
  launchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 4,
  },
  launchBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  moreModelsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
    marginBottom: 10,
  },
  moreModelsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  moreModelsTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  moreModelsSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
});

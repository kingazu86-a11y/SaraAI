import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Switch,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAssistant } from '../../store/AssistantStore';
import { Icon } from '../common/Icon';
import { SmoothSwitch } from '../common/SmoothSwitch';
import { SmoothScaleButton } from '../common/SmoothScaleButton';
import { spacing, radius } from '../../theme/spacing';
import { SystemBarNative } from '../../native/SystemBarNative';

export const SettingsModal: React.FC = () => {
  const {
    activeModal,
    closeModal,
    themeMode,
    setThemeMode,
    toggleThemeMode,
    isAssistantEnabled,
    toggleAssistantMasterSwitch,
    isAccessibilityAutomationEnabled,
    toggleAccessibilityAutomation,
    isMemoryEnabled,
    toggleMemoryMasterSwitch,
    openModal,
    conversations,
    deleteConversation,
    createNewConversation,
    models,
    activeTextModel,
    activeVoiceModel,
    setActiveModel,
    permissions,
    storageInfo,
    theme,
  } = useAssistant();

  const insets = useSafeAreaInsets();
  const isVisible = activeModal === 'settings';

  // Sub-picker modals for choosing Voice Pack and TTT LLM inside Settings
  const [isVoicePickerOpen, setIsVoicePickerOpen] = useState(false);
  const [isLLMPickerOpen, setIsLLMPickerOpen] = useState(false);

  // Synchronize system bars (status bar + bottom bar) when settings is opened or theme switches
  useEffect(() => {
    if (isVisible) {
      SystemBarNative.setSystemBars(theme.background, theme.background, themeMode === 'light');
    }
  }, [isVisible, theme.background, themeMode]);

  // Filter available downloaded models
  const readyVoicePacks = models.filter(
    m => (m.kind === 'voice_pack' || m.kind === 'voice_ai' || m.kind === 'stt') && m.status === 'READY'
  );

  const readyTextLLMs = models.filter(
    m => m.kind === 'text' && m.status === 'READY'
  );

  // Both a Voice Pack and an LLM are strictly required before Assistant can be enabled
  const isSetupComplete = Boolean(activeVoiceModel && activeTextModel);

  const handleAssistantToggle = () => {
    if (!isAssistantEnabled && !isSetupComplete) {
      Alert.alert(
        'Setup Incomplete',
        'To activate Sara AI Assistant, you must select both a Voice Pack (STT + TTS) and a Text-to-Text (TTT) LLM below.',
        [
          { text: 'Got it', style: 'cancel' },
          {
            text: 'Open Model Center',
            onPress: () => {
              closeModal();
              openModal('model_manager');
            },
          },
        ]
      );
      return;
    }
    toggleAssistantMasterSwitch();
  };

  const handleSelectVoicePack = (id: string) => {
    setActiveModel(id);
    setIsVoicePickerOpen(false);
  };

  const handleSelectLLM = (id: string) => {
    setActiveModel(id);
    setIsLLMPickerOpen(false);
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'Are you sure you want to delete all conversation history? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: () => {
            conversations.forEach(c => deleteConversation(c.id));
            createNewConversation();
            closeModal();
          },
        },
      ]
    );
  };

  const handleAccessibilityToggle = async () => {
    await toggleAccessibilityAutomation();
  };

  const formatGb = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(1);

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

        {/* Crisp Toolbar - Perfectly bounded inside screen */}
        <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.borderSubtle }]}>
          <View style={styles.headerTitleCol}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]} numberOfLines={1}>
              Settings
            </Text>
          </View>
          <TouchableOpacity
            onPress={closeModal}
            style={[styles.closeBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
            accessibilityRole="button"
            accessibilityLabel="Close settings"
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
          {/* ==================================================== */}
          {/* AI ASSISTANT SETUP & MASTER ENGINE CONTROL           */}
          {/* ==================================================== */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>
              AI Assistant Setup
            </Text>

            {/* Master Activation Card */}
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: isAssistantEnabled ? theme.success : theme.border }]}>
              <View style={styles.row}>
                <View style={[styles.iconBox, { backgroundColor: isAssistantEnabled ? 'rgba(34, 197, 94, 0.15)' : theme.surfaceSubtle }]}>
                  <Icon
                    name="sparkles"
                    size={17}
                    color={isAssistantEnabled ? theme.success : isSetupComplete ? theme.warning : theme.textMuted}
                  />
                </View>
                <View style={styles.rowText}>
                  <View style={styles.titleWithDot}>
                    <View
                      style={[
                        styles.pulseDot,
                        {
                          backgroundColor: isAssistantEnabled
                            ? theme.success
                            : isSetupComplete
                            ? theme.warning
                            : theme.textMuted,
                        },
                      ]}
                    />
                    <Text style={[styles.rowTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                      Sara AI Assistant
                    </Text>
                  </View>
                  <Text style={[styles.rowDesc, { color: theme.textMuted }]} numberOfLines={2} ellipsizeMode="tail">
                    {isAssistantEnabled
                      ? `Active • ${activeTextModel?.name || ''} & ${activeVoiceModel?.name || ''}`
                      : isSetupComplete
                      ? 'Configured • Ready to activate'
                      : 'Setup Incomplete • Choose Voice Pack & LLM'}
                  </Text>
                </View>
                <View style={styles.switchCol}>
                  <SmoothSwitch
                    value={isAssistantEnabled}
                    onValueChange={handleAssistantToggle}
                  />
                </View>
              </View>

              {/* Status Banner */}
              {!isSetupComplete ? (
                <View style={[styles.statusBanner, { backgroundColor: 'rgba(234, 179, 8, 0.1)', borderColor: 'rgba(234, 179, 8, 0.25)' }]}>
                  <Icon name="sliders" size={13} color="#EAB308" style={{ marginRight: 8, marginTop: 1 }} />
                  <Text style={[styles.statusBannerText, { color: theme.textSecondary }]}>
                    Select both a <Text style={{ fontWeight: '700' }}>Voice Pack</Text> and a <Text style={{ fontWeight: '700' }}>TTT LLM</Text> below to enable the AI Assistant.
                  </Text>
                </View>
              ) : !isAssistantEnabled ? (
                <View style={[styles.statusBanner, { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.25)' }]}>
                  <Icon name="check" size={13} color="#3B82F6" style={{ marginRight: 8, marginTop: 1 }} />
                  <Text style={[styles.statusBannerText, { color: theme.textSecondary }]}>
                    Both models are configured. Toggle the switch above to enable Sara AI Assistant.
                  </Text>
                </View>
              ) : (
                <View style={[styles.statusBanner, { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.25)' }]}>
                  <Icon name="check" size={13} color={theme.success} style={{ marginRight: 8, marginTop: 1 }} />
                  <Text style={[styles.statusBannerText, { color: theme.textSecondary }]}>
                    AI Assistant is live: Processing voice (STT/TTS) and text chat 100% offline.
                  </Text>
                </View>
              )}
            </View>

            {/* Model Selection Cards (Spacious, Zero-Overflow Layout) */}
            <View style={styles.modelCardsContainer}>
              {/* Card 1: Voice Pack (STT + TTS) */}
              <TouchableOpacity
                style={[
                  styles.modelSelectCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: activeVoiceModel ? 'rgba(34, 197, 94, 0.4)' : theme.border,
                  },
                ]}
                onPress={() => setIsVoicePickerOpen(true)}
                activeOpacity={0.7}
              >
                {/* Top Label & Badge */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.miniIconBox, { backgroundColor: theme.surfaceSubtle }]}>
                      <Icon name="mic" size={13} color={activeVoiceModel ? theme.success : theme.textMuted} />
                    </View>
                    <Text style={[styles.cardHeaderTitle, { color: theme.textMuted }]} numberOfLines={1}>
                      Voice Pack (STT + TTS)
                    </Text>
                  </View>
                  <View style={styles.cardHeaderRight}>
                    <View
                      style={[
                        styles.setupBadge,
                        {
                          backgroundColor: activeVoiceModel
                            ? 'rgba(34, 197, 94, 0.12)'
                            : 'rgba(234, 179, 8, 0.12)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.setupBadgeText,
                          { color: activeVoiceModel ? theme.success : '#EAB308' },
                        ]}
                      >
                        {activeVoiceModel ? 'SELECTED' : 'CHOOSE'}
                      </Text>
                    </View>
                    <Icon name="chevronRight" size={12} color={theme.textMuted} style={{ marginLeft: 6 }} />
                  </View>
                </View>

                {/* Model Name on its own dedicated full-width line */}
                <Text
                  style={[
                    styles.chosenModelName,
                    { color: activeVoiceModel ? theme.textPrimary : theme.textSecondary },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {activeVoiceModel ? activeVoiceModel.name : 'Tap to select Voice Pack'}
                </Text>

                {/* Specs Subtext on its own dedicated full-width line */}
                <Text style={[styles.chosenModelSpecs, { color: theme.textMuted }]} numberOfLines={1} ellipsizeMode="tail">
                  {activeVoiceModel
                    ? `${activeVoiceModel.sizeFormatted} • ${activeVoiceModel.runtime}`
                    : 'Speech recognition (input) & natural speech output'}
                </Text>
              </TouchableOpacity>

              {/* Card 2: Reasoning Engine (TTT LLM) */}
              <TouchableOpacity
                style={[
                  styles.modelSelectCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: activeTextModel ? 'rgba(59, 130, 246, 0.4)' : theme.border,
                  },
                ]}
                onPress={() => setIsLLMPickerOpen(true)}
                activeOpacity={0.7}
              >
                {/* Top Label & Badge */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.miniIconBox, { backgroundColor: theme.surfaceSubtle }]}>
                      <Icon name="cpu" size={13} color={activeTextModel ? theme.accent : theme.textMuted} />
                    </View>
                    <Text style={[styles.cardHeaderTitle, { color: theme.textMuted }]} numberOfLines={1}>
                      Reasoning Engine (TTT LLM)
                    </Text>
                  </View>
                  <View style={styles.cardHeaderRight}>
                    <View
                      style={[
                        styles.setupBadge,
                        {
                          backgroundColor: activeTextModel
                            ? 'rgba(34, 197, 94, 0.12)'
                            : 'rgba(234, 179, 8, 0.12)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.setupBadgeText,
                          { color: activeTextModel ? theme.success : '#EAB308' },
                        ]}
                      >
                        {activeTextModel ? 'SELECTED' : 'CHOOSE'}
                      </Text>
                    </View>
                    <Icon name="chevronRight" size={12} color={theme.textMuted} style={{ marginLeft: 6 }} />
                  </View>
                </View>

                {/* Model Name on its own dedicated full-width line */}
                <Text
                  style={[
                    styles.chosenModelName,
                    { color: activeTextModel ? theme.textPrimary : theme.textSecondary },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {activeTextModel ? activeTextModel.name : 'Tap to select TTT LLM'}
                </Text>

                {/* Specs Subtext on its own dedicated full-width line */}
                <Text style={[styles.chosenModelSpecs, { color: theme.textMuted }]} numberOfLines={1} ellipsizeMode="tail">
                  {activeTextModel
                    ? `${activeTextModel.sizeFormatted} • ${activeTextModel.runtime}`
                    : 'Powers chatbot reasoning & device automation'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ==================================================== */}
          {/* DEVICE CAPABILITIES                                  */}
          {/* ==================================================== */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>
              Device Capabilities
            </Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {/* Accessibility UI Automation Switch */}
              <View style={styles.row}>
                <View style={[styles.iconBox, { backgroundColor: theme.surfaceSubtle }]}>
                  <Icon
                    name="sliders"
                    size={16}
                    color={isAccessibilityAutomationEnabled ? theme.success : theme.textMuted}
                  />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                    UI Automation
                  </Text>
                  <Text style={[styles.rowDesc, { color: theme.textMuted }]}>
                    {isAccessibilityAutomationEnabled
                      ? 'Enabled — Assistant operates on-screen UI'
                      : permissions.accessibility
                      ? 'Disabled in App — Tap to enable'
                      : 'Disabled — Accessibility permission needed'}
                  </Text>
                </View>
                <View style={styles.switchCol}>
                  <SmoothSwitch
                    value={isAccessibilityAutomationEnabled}
                    onValueChange={handleAccessibilityToggle}
                  />
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

              {/* User Memory Switch */}
              <View style={styles.row}>
                <View style={[styles.iconBox, { backgroundColor: theme.surfaceSubtle }]}>
                  <Icon
                    name="shield"
                    size={16}
                    color={isMemoryEnabled ? theme.success : theme.textMuted}
                  />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                    Personal Memory
                  </Text>
                  <Text style={[styles.rowDesc, { color: theme.textMuted }]}>
                    {isMemoryEnabled
                      ? 'Enabled — Injects your custom rules & habits'
                      : 'Disabled — No personal context injected'}
                  </Text>
                </View>
                <View style={styles.switchCol}>
                  <SmoothSwitch
                    value={isMemoryEnabled}
                    onValueChange={toggleMemoryMasterSwitch}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* ==================================================== */}
          {/* MANAGEMENT & CUSTOMIZATION                           */}
          {/* ==================================================== */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>
              Engines & Customization
            </Text>

            {/* Model Center */}
            <TouchableOpacity
              style={[styles.card, styles.navRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => {
                closeModal();
                openModal('model_manager');
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: theme.surfaceSubtle }]}>
                <Icon name="cpu" size={16} color={theme.textPrimary} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                  Model Center
                </Text>
                <Text style={[styles.rowDesc, { color: theme.textMuted }]}>
                  Download or delete offline voice packs and TTT LLMs
                </Text>
              </View>
              <View style={styles.chevronCol}>
                <Icon name="chevronRight" size={14} color={theme.textMuted} />
              </View>
            </TouchableOpacity>

            {/* Customization */}
            <TouchableOpacity
              style={[
                styles.card,
                styles.navRow,
                { backgroundColor: theme.surface, borderColor: theme.border, marginTop: spacing.sm },
              ]}
              onPress={() => {
                closeModal();
                openModal('customization');
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: theme.surfaceSubtle }]}>
                <Icon name="edit" size={16} color={theme.textPrimary} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                  Persona & Response Style
                </Text>
                <Text style={[styles.rowDesc, { color: theme.textMuted }]}>
                  Customize assistant name, tone, depth, and confirmations
                </Text>
              </View>
              <View style={styles.chevronCol}>
                <Icon name="chevronRight" size={14} color={theme.textMuted} />
              </View>
            </TouchableOpacity>

            {/* User Memory */}
            <TouchableOpacity
              style={[
                styles.card,
                styles.navRow,
                { backgroundColor: theme.surface, borderColor: theme.border, marginTop: spacing.sm },
              ]}
              onPress={() => {
                closeModal();
                openModal('memory_manager');
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: theme.surfaceSubtle }]}>
                <Icon name="shield" size={16} color={theme.textPrimary} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                  User Memory Manager
                </Text>
                <Text style={[styles.rowDesc, { color: theme.textMuted }]}>
                  Manage saved preferences and custom instructions
                </Text>
              </View>
              <View style={styles.chevronCol}>
                <Icon name="chevronRight" size={14} color={theme.textMuted} />
              </View>
            </TouchableOpacity>

            {/* System Permissions */}
            <TouchableOpacity
              style={[
                styles.card,
                styles.navRow,
                { backgroundColor: theme.surface, borderColor: theme.border, marginTop: spacing.sm },
              ]}
              onPress={() => {
                closeModal();
                openModal('permission_setup');
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: theme.surfaceSubtle }]}>
                <Icon name="sliders" size={16} color={theme.textPrimary} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                  System Permissions
                </Text>
                <Text style={[styles.rowDesc, { color: theme.textMuted }]}>
                  Microphone, accessibility, notifications, and battery status
                </Text>
              </View>
              <View style={styles.chevronCol}>
                <Icon name="chevronRight" size={14} color={theme.textMuted} />
              </View>
            </TouchableOpacity>
          </View>

          {/* ==================================================== */}
          {/* APPEARANCE SECTION                                   */}
          {/* ==================================================== */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>
              Appearance & Theme
            </Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.row}>
                <View style={[styles.iconBox, { backgroundColor: theme.surfaceSubtle }]}>
                  <Icon
                    name={themeMode === 'dark' ? 'moon' : 'sun'}
                    size={16}
                    color={theme.textPrimary}
                  />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                    Dark Theme
                  </Text>
                  <Text style={[styles.rowDesc, { color: theme.textMuted }]}>
                    {themeMode === 'dark' ? 'Dark theme active' : 'Light theme active'}
                  </Text>
                </View>
                <View style={styles.switchCol}>
                  <SmoothSwitch
                    value={themeMode === 'dark'}
                    onValueChange={toggleThemeMode}
                  />
                </View>
              </View>

              {/* Theme Mode Selector Cards */}
              <View style={styles.themeChipsRow}>
                <TouchableOpacity
                  style={[
                    styles.themeCard,
                    {
                      borderColor: themeMode === 'dark' ? theme.accent : theme.border,
                      backgroundColor: themeMode === 'dark' ? theme.surfaceSubtle : theme.surface,
                    },
                  ]}
                  onPress={() => setThemeMode('dark')}
                  activeOpacity={0.7}
                >
                  <View style={styles.themeCardHeader}>
                    <Icon name="moon" size={15} color={themeMode === 'dark' ? theme.accent : theme.textMuted} />
                    {themeMode === 'dark' && (
                      <View style={[styles.activeDot, { backgroundColor: theme.accent }]} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.themeCardTitle,
                      { color: themeMode === 'dark' ? theme.textPrimary : theme.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    Dark Mode
                  </Text>
                  <Text style={[styles.themeCardSubtitle, { color: theme.textMuted }]} numberOfLines={1}>
                    #171717 Dark UI
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.themeCard,
                    {
                      borderColor: themeMode === 'light' ? theme.accent : theme.border,
                      backgroundColor: themeMode === 'light' ? theme.surfaceSubtle : theme.surface,
                    },
                  ]}
                  onPress={() => setThemeMode('light')}
                  activeOpacity={0.7}
                >
                  <View style={styles.themeCardHeader}>
                    <Icon name="sun" size={15} color={themeMode === 'light' ? theme.accent : theme.textMuted} />
                    {themeMode === 'light' && (
                      <View style={[styles.activeDot, { backgroundColor: theme.accent }]} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.themeCardTitle,
                      { color: themeMode === 'light' ? theme.textPrimary : theme.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    Light Mode
                  </Text>
                  <Text style={[styles.themeCardSubtitle, { color: theme.textMuted }]} numberOfLines={1}>
                    #FFFFFF Clean UI
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ==================================================== */}
          {/* DATA & STORAGE                                       */}
          {/* ==================================================== */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>
              Data & Storage
            </Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {/* Storage breakdown */}
              <View style={styles.storageSummaryRow}>
                <View style={styles.storageSummaryCol}>
                  <Text style={[styles.storageLabel, { color: theme.textMuted }]} numberOfLines={1}>
                    Model Storage
                  </Text>
                  <Text style={[styles.storageValue, { color: theme.textPrimary }]} numberOfLines={1}>
                    {formatGb(storageInfo.modelsUsedBytes)} GB
                  </Text>
                </View>
                <View style={[styles.storageDivider, { backgroundColor: theme.borderSubtle }]} />
                <View style={styles.storageSummaryCol}>
                  <Text style={[styles.storageLabel, { color: theme.textMuted }]} numberOfLines={1}>
                    Conversations
                  </Text>
                  <Text style={[styles.storageValue, { color: theme.textPrimary }]} numberOfLines={1}>
                    {conversations.length}
                  </Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

              <TouchableOpacity
                style={styles.dangerRow}
                onPress={handleClearData}
                activeOpacity={0.7}
              >
                <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                  <Icon name="trash" size={16} color={theme.error} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.dangerTitle, { color: theme.error }]} numberOfLines={1}>
                    Clear conversation history
                  </Text>
                  <Text style={[styles.rowDesc, { color: theme.textMuted }]}>
                    Permanently delete all chat sessions and messages
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* About / Info */}
          <View style={styles.aboutSection}>
            <Text style={[styles.aboutTitle, { color: theme.textMuted }]}>
              Sara AI • v0.0.1
            </Text>
            <Text style={[styles.aboutSubtitle, { color: theme.textMuted }]}>
              100% On-Device Offline AI & Automation
            </Text>
          </View>
        </ScrollView>

        {/* ==================================================== */}
        {/* VOICE PACK PICKER MODAL (INSIDE SETTINGS)            */}
        {/* ==================================================== */}
        <Modal
          visible={isVoicePickerOpen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsVoicePickerOpen(false)}
        >
          <TouchableWithoutFeedback onPress={() => setIsVoicePickerOpen(false)}>
            <View style={styles.pickerBackdrop}>
              <TouchableWithoutFeedback>
                <View
                  style={[
                    styles.pickerCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View style={[styles.pickerHeader, { borderBottomColor: theme.borderSubtle }]}>
                    <View style={styles.pickerHeaderCol}>
                      <Text style={[styles.pickerTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                        Choose Voice Pack (STT + TTS)
                      </Text>
                      <Text style={[styles.pickerSubtitle, { color: theme.textMuted }]} numberOfLines={1}>
                        Combined speech recognition & natural voice output
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setIsVoicePickerOpen(false)}
                      style={[styles.miniCloseBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Icon name="close" size={13} color={theme.textPrimary} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false} bounces={false}>
                    {readyVoicePacks.length > 0 ? (
                      readyVoicePacks.map(pack => {
                        const isSelected = activeVoiceModel?.id === pack.id;
                        return (
                          <TouchableOpacity
                            key={pack.id}
                            style={[
                              styles.pickerOptionRow,
                              {
                                backgroundColor: isSelected ? theme.surfaceSubtle : 'transparent',
                                borderColor: isSelected ? theme.accent : theme.borderSubtle,
                              },
                            ]}
                            onPress={() => handleSelectVoicePack(pack.id)}
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
                            <View style={styles.pickerOptionInfo}>
                              <View style={styles.pickerOptionNameRow}>
                                <Text
                                  style={[
                                    styles.pickerOptionName,
                                    {
                                      color: isSelected ? theme.textPrimary : theme.textSecondary,
                                      fontWeight: isSelected ? '700' : '600',
                                    },
                                  ]}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  {pack.name}
                                </Text>
                                {isSelected && (
                                  <View style={[styles.activeMiniBadge, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                                    <Text style={[styles.activeMiniBadgeText, { color: theme.success }]}>
                                      ACTIVE
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <Text style={[styles.pickerOptionSpecs, { color: theme.textMuted }]} numberOfLines={1} ellipsizeMode="tail">
                                {pack.sizeFormatted} • {pack.runtime}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <View style={[styles.pickerEmptyBox, { borderColor: theme.borderSubtle, backgroundColor: theme.surfaceSubtle }]}>
                        <Icon name="mic" size={24} color={theme.warning} style={{ marginBottom: 8 }} />
                        <Text style={[styles.pickerEmptyTitle, { color: theme.textPrimary }]}>
                          No Voice Packs Downloaded
                        </Text>
                        <Text style={[styles.pickerEmptyDesc, { color: theme.textMuted }]}>
                          Download a combined STT + TTS pack to speak with Sara AI.
                        </Text>
                        <TouchableOpacity
                          style={[styles.pickerDownloadBtn, { backgroundColor: theme.accent }]}
                          onPress={() => {
                            setIsVoicePickerOpen(false);
                            closeModal();
                            openModal('voice_pack_setup');
                          }}
                        >
                          <Text style={[styles.pickerDownloadBtnText, { color: theme.textInverse }]}>
                            Download Voice Pack
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </ScrollView>

                  <View style={[styles.pickerFooter, { borderTopColor: theme.borderSubtle }]}>
                    <TouchableOpacity
                      style={styles.pickerFooterBtn}
                      onPress={() => {
                        setIsVoicePickerOpen(false);
                        closeModal();
                        openModal('model_manager');
                      }}
                    >
                      <Icon name="cpu" size={14} color={theme.accent} style={{ marginRight: 8 }} />
                      <Text style={[styles.pickerFooterText, { color: theme.textPrimary }]}>
                        Browse all models in Model Center
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* ==================================================== */}
        {/* TTT LLM PICKER MODAL (INSIDE SETTINGS)               */}
        {/* ==================================================== */}
        <Modal
          visible={isLLMPickerOpen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsLLMPickerOpen(false)}
        >
          <TouchableWithoutFeedback onPress={() => setIsLLMPickerOpen(false)}>
            <View style={styles.pickerBackdrop}>
              <TouchableWithoutFeedback>
                <View
                  style={[
                    styles.pickerCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View style={[styles.pickerHeader, { borderBottomColor: theme.borderSubtle }]}>
                    <View style={styles.pickerHeaderCol}>
                      <Text style={[styles.pickerTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                        Choose Reasoning Engine (TTT LLM)
                      </Text>
                      <Text style={[styles.pickerSubtitle, { color: theme.textMuted }]} numberOfLines={1}>
                        Powers conversation thinking & device automation
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setIsLLMPickerOpen(false)}
                      style={[styles.miniCloseBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Icon name="close" size={13} color={theme.textPrimary} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false} bounces={false}>
                    {readyTextLLMs.length > 0 ? (
                      readyTextLLMs.map(llm => {
                        const isSelected = activeTextModel?.id === llm.id;
                        return (
                          <TouchableOpacity
                            key={llm.id}
                            style={[
                              styles.pickerOptionRow,
                              {
                                backgroundColor: isSelected ? theme.surfaceSubtle : 'transparent',
                                borderColor: isSelected ? theme.accent : theme.borderSubtle,
                              },
                            ]}
                            onPress={() => handleSelectLLM(llm.id)}
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
                            <View style={styles.pickerOptionInfo}>
                              <View style={styles.pickerOptionNameRow}>
                                <Text
                                  style={[
                                    styles.pickerOptionName,
                                    {
                                      color: isSelected ? theme.textPrimary : theme.textSecondary,
                                      fontWeight: isSelected ? '700' : '600',
                                    },
                                  ]}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  {llm.name}
                                </Text>
                                {isSelected && (
                                  <View style={[styles.activeMiniBadge, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                                    <Text style={[styles.activeMiniBadgeText, { color: theme.success }]}>
                                      ACTIVE
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <Text style={[styles.pickerOptionSpecs, { color: theme.textMuted }]} numberOfLines={1} ellipsizeMode="tail">
                                {llm.sizeFormatted} • {llm.runtime}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <View style={[styles.pickerEmptyBox, { borderColor: theme.borderSubtle, backgroundColor: theme.surfaceSubtle }]}>
                        <Icon name="cpu" size={24} color={theme.warning} style={{ marginBottom: 8 }} />
                        <Text style={[styles.pickerEmptyTitle, { color: theme.textPrimary }]}>
                          No TTT LLMs Downloaded
                        </Text>
                        <Text style={[styles.pickerEmptyDesc, { color: theme.textMuted }]}>
                          Download an offline text reasoning model (Gemma 3, Qwen, or Llama).
                        </Text>
                        <TouchableOpacity
                          style={[styles.pickerDownloadBtn, { backgroundColor: theme.accent }]}
                          onPress={() => {
                            setIsLLMPickerOpen(false);
                            closeModal();
                            openModal('model_manager');
                          }}
                        >
                          <Text style={[styles.pickerDownloadBtnText, { color: theme.textInverse }]}>
                            Download TTT LLM
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </ScrollView>

                  <View style={[styles.pickerFooter, { borderTopColor: theme.borderSubtle }]}>
                    <TouchableOpacity
                      style={styles.pickerFooterBtn}
                      onPress={() => {
                        setIsLLMPickerOpen(false);
                        closeModal();
                        openModal('model_manager');
                      }}
                    >
                      <Icon name="cpu" size={14} color={theme.accent} style={{ marginRight: 8 }} />
                      <Text style={[styles.pickerFooterText, { color: theme.textPrimary }]}>
                        Browse all models in Model Center
                      </Text>
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
  section: {
    marginBottom: 20,
    width: '100%',
  },
  sectionHeader: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
    fontSize: 11,
    fontWeight: '600',
  },
  card: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWithDot: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
    flexShrink: 0,
  },
  rowText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    marginRight: 10,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  switchCol: {
    flexShrink: 0,
    width: 50,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
  },
  statusBannerText: {
    fontSize: 11.5,
    lineHeight: 16,
    flex: 1,
    minWidth: 0,
  },
  // Distinct Model Selection Cards (Zero-Overflow Layout)
  modelCardsContainer: {
    width: '100%',
    marginTop: 10,
    gap: 8,
  },
  modelSelectCard: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    overflow: 'hidden',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 6,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  miniIconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
    flexShrink: 0,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    flex: 1,
    minWidth: 0,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  setupBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    flexShrink: 0,
  },
  setupBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  chosenModelName: {
    fontSize: 13.5,
    fontWeight: '600',
    width: '100%',
    marginBottom: 2,
  },
  chosenModelSpecs: {
    fontSize: 11,
    width: '100%',
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  divider: {
    height: 1,
    marginVertical: 10,
    width: '100%',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevronCol: {
    flexShrink: 0,
    width: 20,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  themeChipsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  themeCard: {
    flex: 1,
    minWidth: 0,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  themeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  themeCardTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  themeCardSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  storageSummaryRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    alignItems: 'center',
  },
  storageSummaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  storageDivider: {
    width: 1,
    height: 28,
  },
  storageLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  storageValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  aboutSection: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  aboutTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  aboutSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  // Centered, Responsive Modal Dialogs
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '82%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  pickerHeaderCol: {
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  pickerSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
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
  pickerScroll: {
    maxHeight: 320,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pickerOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
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
  pickerOptionInfo: {
    flex: 1,
    minWidth: 0,
  },
  pickerOptionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  pickerOptionName: {
    fontSize: 13,
    flex: 1,
    minWidth: 0,
    marginRight: 6,
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
  pickerOptionSpecs: {
    fontSize: 10.5,
    marginTop: 2,
  },
  pickerEmptyBox: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginVertical: 8,
  },
  pickerEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  pickerEmptyDesc: {
    fontSize: 11.5,
    textAlign: 'center',
    marginBottom: 12,
  },
  pickerDownloadBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  pickerDownloadBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pickerFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  pickerFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerFooterText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAssistant } from '../../store/AssistantStore';
import { PersonalityType, ResponseStyleType, AutonomyLevel } from '../../ai/AgentTypes';
import { Icon } from '../common/Icon';
import { SmoothScaleButton } from '../common/SmoothScaleButton';
import { typography } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';

const PERSONALITIES: PersonalityType[] = ['Professional', 'Friendly', 'Concise', 'Direct'];
const STYLES: ResponseStyleType[] = ['Concise', 'Balanced', 'Detailed'];
const AUTONOMY_LEVELS: AutonomyLevel[] = [
  'Ask Before Sensitive',
  'Ask Before Every Action',
  'Always Autonomous',
];

export const CustomizationModal: React.FC = () => {
  const { activeModal, closeModal, customization, updateCustomization, theme, themeMode } = useAssistant();
  const insets = useSafeAreaInsets();
  const isVisible = activeModal === 'customization';

  const [name, setName] = useState(customization.assistantName);
  const [personality, setPersonality] = useState<PersonalityType>(customization.personality);
  const [style, setStyle] = useState<ResponseStyleType>(customization.responseStyle);
  const [autonomy, setAutonomy] = useState<AutonomyLevel>(customization.autonomyLevel);

  const handleSave = () => {
    updateCustomization({
      assistantName: name.trim() || 'Assistant',
      personality,
      responseStyle: style,
      autonomyLevel: autonomy,
    });
    closeModal();
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

        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.borderSubtle }]}>
          <View style={styles.headerTitleCol}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]} numberOfLines={1}>
              Customization
            </Text>
          </View>
          <TouchableOpacity
            onPress={closeModal}
            style={[styles.closeBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
            accessibilityRole="button"
            accessibilityLabel="Close"
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="close" size={16} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 36) }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Assistant Name */}
          <View style={styles.section}>
            <Text style={[typography.small, styles.sectionHeader, { color: theme.textMuted }]}>
              Assistant Name
            </Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <TextInput
                style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderSubtle }]}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Sara AI"
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </View>

          {/* Personality */}
          <View style={styles.section}>
            <Text style={[typography.small, styles.sectionHeader, { color: theme.textMuted }]}>
              Personality
            </Text>
            <View style={styles.optionsGrid}>
              {PERSONALITIES.map(p => (
                <SmoothScaleButton
                  key={p}
                  style={[
                    styles.optionPill,
                    { borderColor: theme.border, backgroundColor: theme.surface },
                    personality === p && { backgroundColor: theme.accent, borderColor: theme.accent },
                  ]}
                  onPress={() => setPersonality(p)}
                >
                  <Text
                    style={[
                      typography.bodyMedium,
                      { color: personality === p ? theme.textInverse : theme.textPrimary },
                    ]}
                  >
                    {p}
                  </Text>
                </SmoothScaleButton>
              ))}
            </View>
          </View>

          {/* Response Style */}
          <View style={styles.section}>
            <Text style={[typography.small, styles.sectionHeader, { color: theme.textMuted }]}>
              Response Length & Depth
            </Text>
            <View style={styles.optionsGrid}>
              {STYLES.map(s => (
                <SmoothScaleButton
                  key={s}
                  style={[
                    styles.optionPill,
                    { borderColor: theme.border, backgroundColor: theme.surface },
                    style === s && { backgroundColor: theme.accent, borderColor: theme.accent },
                  ]}
                  onPress={() => setStyle(s)}
                >
                  <Text
                    style={[
                      typography.bodyMedium,
                      { color: style === s ? theme.textInverse : theme.textPrimary },
                    ]}
                  >
                    {s}
                  </Text>
                </SmoothScaleButton>
              ))}
            </View>
          </View>

          {/* Autonomy Level */}
          <View style={styles.section}>
            <Text style={[typography.small, styles.sectionHeader, { color: theme.textMuted }]}>
              Safety Confirmation Policy
            </Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {AUTONOMY_LEVELS.map((level, idx) => (
                <SmoothScaleButton
                  key={level}
                  style={[
                    styles.levelRow,
                    idx > 0 && [styles.levelBorderTop, { borderTopColor: theme.borderSubtle }],
                  ]}
                  onPress={() => setAutonomy(level)}
                >
                  <View style={styles.levelTextCol}>
                    <Text style={[typography.bodyMedium, { color: theme.textPrimary }]}>{level}</Text>
                    <Text style={[typography.caption, { color: theme.textMuted, marginTop: 2 }]}>
                      {level === 'Ask Before Sensitive'
                        ? 'Confirms before messages, calls, or storage changes'
                        : level === 'Ask Before Every Action'
                        ? 'Requires confirmation for every tool execution'
                        : 'Executes approved local actions automatically'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radioCircle,
                      { borderColor: autonomy === level ? theme.accent : theme.textMuted },
                    ]}
                  >
                    {autonomy === level && (
                      <View style={[styles.radioDot, { backgroundColor: theme.accent }]} />
                    )}
                  </View>
                </SmoothScaleButton>
              ))}
            </View>
          </View>

          {/* Save Button */}
          <SmoothScaleButton
            style={[styles.saveButton, { backgroundColor: theme.accent }]}
            onPress={handleSave}
          >
            <Text style={[typography.bodyBold, { color: theme.textInverse }]}>Save Preferences</Text>
          </SmoothScaleButton>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
    fontSize: 11,
    fontWeight: '600',
  },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  input: {
    fontSize: 15,
    paddingVertical: 8,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionPill: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  levelBorderTop: {
    borderTopWidth: 1,
  },
  levelTextCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  saveButton: {
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
});

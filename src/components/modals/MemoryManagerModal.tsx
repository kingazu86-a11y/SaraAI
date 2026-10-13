import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAssistant } from '../../store/AssistantStore';
import { MemoryCategory } from '../../ai/MemoryTypes';
import { Icon } from '../common/Icon';
import { SmoothSwitch } from '../common/SmoothSwitch';
import { spacing, radius } from '../../theme/spacing';

const CATEGORIES: { label: string; value: MemoryCategory }[] = [
  { label: 'Profile', value: 'profile' },
  { label: 'Custom Instruction', value: 'custom_instruction' },
  { label: 'Preference', value: 'preference' },
  { label: 'App Rule', value: 'app_rule' },
];

export const MemoryManagerModal: React.FC = () => {
  const {
    activeModal,
    closeModal,
    memories,
    addMemory,
    toggleMemory,
    deleteMemory,
    clearAllMemories,
    isMemoryEnabled,
    toggleMemoryMasterSwitch,
    theme,
    themeMode,
  } = useAssistant();

  const insets = useSafeAreaInsets();
  const isVisible = activeModal === 'memory_manager';

  // Add memory state
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryCategory>('custom_instruction');

  const handleSaveNew = () => {
    if (!newTitle.trim() || !newContent.trim()) {
      Alert.alert('Required Fields', 'Please enter both a title and details.');
      return;
    }
    addMemory(newCategory, newTitle.trim(), newContent.trim());
    setNewTitle('');
    setNewContent('');
    setIsAdding(false);
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Memories',
      'Are you sure you want to delete all stored user memory facts? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear all', style: 'destructive', onPress: clearAllMemories },
      ]
    );
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

        {/* Crisp Toolbar - Perfectly bounded inside screen */}
        <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.borderSubtle }]}>
          <View style={styles.headerTitleCol}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]} numberOfLines={1}>
              User Memory
            </Text>
          </View>
          <TouchableOpacity
            onPress={closeModal}
            style={[styles.closeBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
            accessibilityRole="button"
            accessibilityLabel="Close user memory"
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
          {/* Master Memory Switch Card */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 16 }]}>
            <View style={styles.row}>
              <View style={[styles.iconBox, { backgroundColor: theme.surfaceSubtle }]}>
                <Icon name="shield" size={16} color={isMemoryEnabled ? theme.success : theme.textMuted} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                  Personalized Memory
                </Text>
                <Text style={[styles.rowDesc, { color: theme.textMuted }]}>
                  Inject saved instructions and rules into offline AI prompts
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

          {/* Add New Memory Action Bar */}
          {!isAdding ? (
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
              onPress={() => setIsAdding(true)}
              activeOpacity={0.7}
            >
              <Icon name="plus" size={16} color={theme.textPrimary} />
              <Text style={[styles.addBtnText, { color: theme.textPrimary, marginLeft: 8 }]}>
                Add Memory Item
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.addCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.addCardTitle, { color: theme.textPrimary, marginBottom: 10 }]}>
                New Memory Item
              </Text>

              {/* Category picker */}
              <View style={styles.categoryRow}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      styles.categoryPill,
                      { borderColor: theme.border, backgroundColor: theme.surfaceSubtle },
                      newCategory === cat.value && { backgroundColor: theme.accent, borderColor: theme.accent },
                    ]}
                    onPress={() => setNewCategory(cat.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        { color: newCategory === cat.value ? theme.textInverse : theme.textSecondary },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[
                  styles.input,
                  { color: theme.textPrimary, borderColor: theme.borderSubtle, backgroundColor: theme.surfaceSubtle },
                ]}
                placeholder="Title (e.g. My Nickname, Preferred Apps)"
                placeholderTextColor={theme.textMuted}
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <TextInput
                style={[
                  styles.input,
                  styles.multilineInput,
                  { color: theme.textPrimary, borderColor: theme.borderSubtle, backgroundColor: theme.surfaceSubtle },
                ]}
                placeholder="Details or instruction..."
                placeholderTextColor={theme.textMuted}
                value={newContent}
                onChangeText={setNewContent}
                multiline
              />

              <View style={styles.addActionsRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: theme.border }]}
                  onPress={() => setIsAdding(false)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.btnText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: theme.accent }]}
                  onPress={handleSaveNew}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.btnTextBold, { color: theme.textInverse }]}>Save Memory</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Stored Memories List */}
          <View style={styles.memoriesList}>
            <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>
              Saved Items ({memories.length})
            </Text>

            {memories.length === 0 ? (
              <View style={[styles.emptyBox, { borderColor: theme.borderSubtle }]}>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  No memory items stored yet. Tap "Add Memory Item" to teach Sara AI about your preferences.
                </Text>
              </View>
            ) : (
              memories.map(item => (
                <View
                  key={item.id}
                  style={[
                    styles.memoryCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: item.isEnabled ? theme.border : theme.borderSubtle,
                      opacity: item.isEnabled ? 1 : 0.65,
                    },
                  ]}
                >
                  {/* Top Header Row: Category Badge (left) + Switch (right) */}
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.catBadge, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                      <Text style={[styles.catBadgeText, { color: theme.textSecondary }]}>
                        {item.category.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.switchCol}>
                      <SmoothSwitch
                        value={item.isEnabled}
                        onValueChange={() => toggleMemory(item.id)}
                      />
                    </View>
                  </View>

                  {/* Memory Title (Strictly bounded, wraps naturally) */}
                  <Text style={[styles.memoryTitle, { color: theme.textPrimary }]}>
                    {item.title}
                  </Text>

                  {/* Memory Content (Strictly bounded, wraps naturally) */}
                  <Text style={[styles.memoryBody, { color: theme.textSecondary }]}>
                    {item.content}
                  </Text>

                  {/* Card Bottom Row: Delete Action */}
                  <View style={[styles.cardBottomRow, { borderTopColor: theme.borderSubtle }]}>
                    <Text style={[styles.createdText, { color: theme.textMuted }]}>
                      {item.isEnabled ? 'Active in prompts' : 'Inactive'}
                    </Text>
                    <TouchableOpacity
                      style={[styles.deleteBtn, { borderColor: theme.border }]}
                      onPress={() => deleteMemory(item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <Icon name="trash" size={12} color={theme.error} />
                      <Text style={[styles.deleteBtnText, { color: theme.error, marginLeft: 5 }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Clear All action */}
          {memories.length > 0 && (
            <TouchableOpacity style={styles.clearAllBtn} onPress={handleClearAll} activeOpacity={0.7}>
              <Icon name="trash" size={14} color={theme.error} />
              <Text style={[styles.clearAllText, { color: theme.error, marginLeft: 6 }]}>
                Clear All Memories
              </Text>
            </TouchableOpacity>
          )}
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
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    letterSpacing: -0.1,
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
  addBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    minHeight: 46,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addCard: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
    overflow: 'hidden',
  },
  addCardTitle: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  categoryRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  categoryPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  input: {
    width: '100%',
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    marginBottom: 10,
    fontSize: 13.5,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  addActionsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 38,
  },
  saveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 38,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  btnTextBold: {
    fontSize: 13,
    fontWeight: '600',
  },
  memoriesList: {
    width: '100%',
    marginBottom: 16,
  },
  sectionHeader: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyBox: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  memoryCard: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    flexShrink: 0,
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  memoryTitle: {
    width: '100%',
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: 4,
    lineHeight: 20,
    flexWrap: 'wrap',
  },
  memoryBody: {
    width: '100%',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  cardBottomRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    marginTop: 2,
  },
  createdText: {
    fontSize: 11,
    flexShrink: 1,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 32,
    flexShrink: 0,
  },
  deleteBtnText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  clearAllBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginBottom: 16,
    minHeight: 44,
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

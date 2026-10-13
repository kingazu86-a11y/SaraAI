import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAssistant } from '../../store/AssistantStore';
import { Conversation } from '../../ai/AgentTypes';
import { Icon } from '../common/Icon';
import { SaraLogo } from '../common/SaraLogo';
import { SmoothScaleButton } from '../common/SmoothScaleButton';
import { typography } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';

export const Sidebar: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    closeSidebar,
    conversations,
    activeConversationId,
    selectConversation,
    createNewConversation,
    renameConversation,
    deleteConversation,
    openModal,
    theme,
  } = useAssistant();

  // Rename modal state
  const [renameTarget, setRenameTarget] = useState<Conversation | null>(null);
  const [renameText, setRenameText] = useState('');

  // Selected menu item for long-press
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  const groupConversationsByDate = () => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const today: Conversation[] = [];
    const yesterday: Conversation[] = [];
    const last7Days: Conversation[] = [];
    const older: Conversation[] = [];

    conversations.forEach(c => {
      const diff = now - c.updatedAt;
      if (diff < oneDay) {
        today.push(c);
      } else if (diff < 2 * oneDay) {
        yesterday.push(c);
      } else if (diff < 7 * oneDay) {
        last7Days.push(c);
      } else {
        older.push(c);
      }
    });

    return [
      { title: 'Today', data: today },
      { title: 'Yesterday', data: yesterday },
      { title: 'Previous 7 days', data: last7Days },
      { title: 'Older', data: older },
    ].filter(group => group.data.length > 0);
  };

  const handleOpenRename = (conv: Conversation) => {
    setRenameTarget(conv);
    setRenameText(conv.title);
    setActiveActionId(null);
  };

  const handleSaveRename = () => {
    if (renameTarget && renameText.trim()) {
      renameConversation(renameTarget.id, renameText.trim());
    }
    setRenameTarget(null);
  };

  const handleDeleteConfirm = (id: string) => {
    setActiveActionId(null);
    Alert.alert(
      'Delete conversation',
      'Are you sure you want to delete this conversation? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteConversation(id) },
      ]
    );
  };

  const grouped = groupConversationsByDate();

  return (
    <View
      style={[
        styles.drawerContainer,
        {
          backgroundColor: theme.sidebarBg,
          borderRightColor: theme.border,
        },
      ]}
    >
      {/* Header with App Title & New Chat */}
      <View
        style={[
          styles.header,
          {
            borderBottomColor: theme.sidebarHeaderBorder,
            paddingTop: Math.max(insets.top, 20) + spacing.xs,
          },
        ]}
      >
        <View style={styles.appBrandRow}>
          <SaraLogo size={24} style={{ marginRight: spacing.sm }} />
          <Text style={[typography.title, { color: theme.textPrimary }]}>Sara AI</Text>
        </View>

        {/* Prominent New Chat Button */}
        <SmoothScaleButton
          style={[
            styles.newChatButton,
            { borderColor: theme.border, backgroundColor: theme.surfaceSubtle },
          ]}
          onPress={createNewConversation}
          accessibilityRole="button"
          accessibilityLabel="Start a new chat"
        >
          <Icon name="plus" size={16} color={theme.textPrimary} />
          <Text style={[typography.bodyMedium, styles.newChatText, { color: theme.textPrimary }]}>
            New chat
          </Text>
        </SmoothScaleButton>
      </View>

      {/* Sessions List */}
      <FlatList
        data={grouped}
        keyExtractor={item => item.title}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: group }) => (
          <View style={styles.groupContainer}>
            <Text style={[typography.small, styles.groupHeader, { color: theme.textMuted }]}>
              {group.title}
            </Text>
            {group.data.map(conv => {
              const isActive = conv.id === activeConversationId;
              const isActionActive = activeActionId === conv.id;

              return (
                <View key={conv.id} style={styles.sessionItemWrapper}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[
                      styles.sessionItem,
                      isActive && [styles.sessionItemActive, { backgroundColor: theme.surfaceHover }],
                    ]}
                    onPress={() => selectConversation(conv.id)}
                    onLongPress={() => setActiveActionId(isActionActive ? null : conv.id)}
                  >
                    <Icon
                      name="message"
                      size={15}
                      color={isActive ? theme.textPrimary : theme.textMuted}
                      style={styles.messageIcon}
                    />
                    <Text
                      numberOfLines={1}
                      style={[
                        typography.captionMedium,
                        styles.sessionTitle,
                        { color: isActive ? theme.textPrimary : theme.textSecondary },
                      ]}
                    >
                      {conv.title}
                    </Text>

                    {/* Options Button */}
                    <TouchableOpacity
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={() => setActiveActionId(isActionActive ? null : conv.id)}
                    >
                      <Icon name="moreVertical" size={14} color={theme.textMuted} />
                    </TouchableOpacity>
                  </TouchableOpacity>

                  {/* Popover Actions for Session */}
                  {isActionActive && (
                    <View
                      style={[
                        styles.actionsPopover,
                        {
                          backgroundColor: theme.surfaceElevated,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleOpenRename(conv)}
                      >
                        <Icon name="edit" size={14} color={theme.textPrimary} />
                        <Text
                          style={[
                            typography.caption,
                            { color: theme.textPrimary, marginLeft: spacing.sm },
                          ]}
                        >
                          Rename
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleDeleteConfirm(conv.id)}
                      >
                        <Icon name="trash" size={14} color={theme.error} />
                        <Text
                          style={[
                            typography.caption,
                            { color: theme.error, marginLeft: spacing.sm },
                          ]}
                        >
                          Delete
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      />

      {/* Footer Navigation */}
      <View
        style={[
          styles.footer,
          {
            borderTopColor: theme.sidebarHeaderBorder,
            paddingBottom: Math.max(insets.bottom, 16) + spacing.xs,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.footerItem}
          activeOpacity={0.7}
          onPress={() => {
            closeSidebar();
            openModal('customization');
          }}
        >
          <Icon name="sliders" size={16} color={theme.textSecondary} />
          <Text style={[typography.body, styles.footerText, { color: theme.textPrimary }]}>
            Customize
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerItem}
          activeOpacity={0.7}
          onPress={() => {
            closeSidebar();
            openModal('memory_manager');
          }}
        >
          <Icon name="shield" size={16} color={theme.textSecondary} />
          <Text style={[typography.body, styles.footerText, { color: theme.textPrimary }]}>
            User Memory
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerItem}
          activeOpacity={0.7}
          onPress={() => {
            closeSidebar();
            openModal('model_manager');
          }}
        >
          <Icon name="cpu" size={16} color={theme.textSecondary} />
          <Text style={[typography.body, styles.footerText, { color: theme.textPrimary }]}>
            Model Center
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerItem}
          activeOpacity={0.7}
          onPress={() => {
            closeSidebar();
            openModal('settings');
          }}
        >
          <Icon name="settings" size={16} color={theme.textSecondary} />
          <Text style={[typography.body, styles.footerText, { color: theme.textPrimary }]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>

      {/* Rename Dialog Modal */}
      <Modal visible={!!renameTarget} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.renameBox,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text
              style={[
                typography.h3,
                { color: theme.textPrimary, marginBottom: spacing.md },
              ]}
            >
              Rename chat
            </Text>
            <TextInput
              style={[
                styles.renameInput,
                {
                  backgroundColor: theme.surfaceSubtle,
                  color: theme.textPrimary,
                  borderColor: theme.border,
                },
              ]}
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.renameBtnsRow}>
              <TouchableOpacity
                style={styles.dialogBtn}
                onPress={() => setRenameTarget(null)}
              >
                <Text style={[typography.bodyMedium, { color: theme.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogBtn, styles.dialogBtnSave, { backgroundColor: theme.accent }]}
                onPress={handleSaveRename}
              >
                <Text style={[typography.bodyMedium, { color: theme.textInverse }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
    borderRightWidth: 1,
  },
  header: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  appBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  newChatText: {
    marginLeft: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  groupContainer: {
    marginBottom: spacing.lg,
  },
  groupHeader: {
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sessionItemWrapper: {
    position: 'relative',
    marginBottom: 2,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  sessionItemActive: {},
  messageIcon: {
    marginRight: spacing.sm,
  },
  sessionTitle: {
    flex: 1,
  },
  actionsPopover: {
    marginTop: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  footerText: {
    marginLeft: spacing.md,
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  renameBox: {
    width: '100%',
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
  },
  renameInput: {
    height: 44,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  renameBtnsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  dialogBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  dialogBtnSave: {
    borderRadius: radius.md,
  },
});

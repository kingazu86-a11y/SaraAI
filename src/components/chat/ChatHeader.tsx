import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAssistant } from '../../store/AssistantStore';
import { Icon } from '../common/Icon';
import { SmoothScaleButton } from '../common/SmoothScaleButton';
import { spacing, radius } from '../../theme/spacing';

export const ChatHeader: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    openSidebar,
    createNewConversation,
    openModal,
    theme,
    models,
    activeTextModel,
    setActiveModel,
    isModelSwitching,
    switchingModelId,
  } = useAssistant();

  const [isDropdownMounted, setIsDropdownMounted] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownAnim = useRef(new Animated.Value(0)).current;

  // Filter downloaded Text-to-Text (TTT) LLMs
  const readyTextModels = models.filter(
    m => m.kind === 'text' && m.status === 'READY'
  );

  const switchingModel = models.find(m => m.id === switchingModelId);

  const openDropdown = () => {
    setIsDropdownMounted(true);
    setIsDropdownOpen(true);
    dropdownAnim.setValue(0);
    Animated.spring(dropdownAnim, {
      toValue: 1,
      damping: 18,
      stiffness: 280,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  };

  const closeDropdown = (callback?: () => void) => {
    Animated.timing(dropdownAnim, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(() => {
      setIsDropdownOpen(false);
      setIsDropdownMounted(false);
      if (callback) callback();
    });
  };

  const toggleDropdown = () => {
    if (isDropdownOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  };

  const handleSelectModel = (modelId: string) => {
    if (activeTextModel?.id === modelId) {
      closeDropdown();
      return;
    }
    setActiveModel(modelId);
    setTimeout(() => {
      closeDropdown();
    }, 200);
  };

  const handleOpenModelCenter = () => {
    closeDropdown(() => {
      openModal('model_manager');
    });
  };

  const topDropdownOffset = Math.max(insets.top, Platform.OS === 'android' ? 24 : 0) + 54;

  const animatedDropdownStyle = {
    opacity: dropdownAnim,
    transform: [
      {
        translateY: dropdownAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-10, 0],
        }),
      },
      {
        scale: dropdownAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.95, 1],
        }),
      },
    ],
  };

  return (
    <>
      <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.borderSubtle }]}>
        {/* Menu Button */}
        <SmoothScaleButton
          style={styles.iconButton}
          onPress={openSidebar}
          accessibilityRole="button"
          accessibilityLabel="Open sidebar menu"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="menu" size={20} color={theme.textPrimary} />
        </SmoothScaleButton>

        {/* Model Selection Pill */}
        <SmoothScaleButton
          style={[
            styles.statusPill,
            {
              backgroundColor: isDropdownOpen ? theme.surfaceElevated : theme.surfaceSubtle,
              borderColor: isModelSwitching ? theme.accent : isDropdownOpen ? theme.accent : theme.border,
            },
          ]}
          onPress={toggleDropdown}
          accessibilityRole="button"
          accessibilityLabel="Select text LLM model"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          {isModelSwitching ? (
            <ActivityIndicator size="small" color={theme.accent} style={{ marginRight: 6 }} />
          ) : (
            <View
              style={[
                styles.statusDot,
                { backgroundColor: activeTextModel ? theme.offline : theme.warning },
              ]}
            />
          )}
          <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.statusTitle, { color: theme.textPrimary }]}>
            {isModelSwitching
              ? (switchingModel ? switchingModel.name : 'Switching...')
              : activeTextModel
              ? activeTextModel.name
              : 'Select LLM'}
          </Text>
          <Text style={[styles.statusSub, { color: isModelSwitching ? theme.accent : theme.textMuted }]}>
            {isModelSwitching ? 'Activating' : activeTextModel ? 'Offline' : 'Setup'}
          </Text>
          <Icon
            name={isDropdownOpen ? 'chevronUp' : 'chevronDown'}
            size={12}
            color={theme.textMuted}
          />
        </SmoothScaleButton>

        {/* New Chat Action Button */}
        <SmoothScaleButton
          style={styles.iconButton}
          onPress={createNewConversation}
          accessibilityRole="button"
          accessibilityLabel="Start a new chat"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="plus" size={20} color={theme.textPrimary} />
        </SmoothScaleButton>
      </View>

      {/* Smooth Floating Dropdown Menu */}
      <Modal
        visible={isDropdownMounted}
        transparent={true}
        animationType="none"
        onRequestClose={() => closeDropdown()}
      >
        <TouchableWithoutFeedback onPress={() => closeDropdown()}>
          <View style={styles.backdrop}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.dropdownCard,
                  {
                    top: topDropdownOffset,
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.border,
                  },
                  animatedDropdownStyle,
                ]}
              >
                {/* Clean Model List (Names Only) */}
                <ScrollView
                  style={styles.modelListScroll}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  {readyTextModels.length > 0 ? (
                    readyTextModels.map(m => {
                      const isSelected = activeTextModel?.id === m.id;
                      const isThisSwitching = isModelSwitching && switchingModelId === m.id;
                      return (
                        <TouchableOpacity
                          key={m.id}
                          style={[
                            styles.modelItemRow,
                            isSelected && { backgroundColor: theme.surfaceSubtle },
                          ]}
                          onPress={() => handleSelectModel(m.id)}
                          disabled={isModelSwitching}
                          activeOpacity={0.65}
                        >
                          <Text
                            style={[
                              styles.modelNameText,
                              {
                                color: isSelected ? theme.textPrimary : theme.textSecondary,
                                fontWeight: isSelected ? '700' : '500',
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {m.name}
                          </Text>

                          {isThisSwitching ? (
                            <ActivityIndicator size="small" color={theme.accent} style={styles.statusIcon} />
                          ) : isSelected ? (
                            <Icon name="check" size={15} color={theme.success} style={styles.statusIcon} />
                          ) : null}
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <View style={styles.emptyContainer}>
                      <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                        No text models installed
                      </Text>
                    </View>
                  )}
                </ScrollView>

                {/* Subtle Divider */}
                <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

                {/* Manage Models Link */}
                <TouchableOpacity
                  style={styles.manageRow}
                  onPress={handleOpenModelCenter}
                  activeOpacity={0.7}
                >
                  <Icon name="cpu" size={14} color={theme.accent} style={{ marginRight: 8 }} />
                  <Text style={[styles.manageText, { color: theme.accent }]}>
                    Manage Models
                  </Text>
                  <Icon name="chevronRight" size={12} color={theme.textMuted} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    flexShrink: 1,
    maxWidth: '68%',
    minHeight: 38,
    marginHorizontal: spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
    flexShrink: 0,
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
    flexShrink: 1,
    minWidth: 0,
  },
  statusSub: {
    fontSize: 11,
    fontWeight: '500',
    marginRight: 2,
    flexShrink: 0,
  },
  chevron: {
    marginLeft: 3,
    flexShrink: 0,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    alignItems: 'center',
  },
  dropdownCard: {
    position: 'absolute',
    width: 250,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
  },
  modelListScroll: {
    maxHeight: 260,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  modelItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginVertical: 1,
  },
  modelNameText: {
    fontSize: 13.5,
    flex: 1,
    marginRight: 8,
  },
  statusIcon: {
    marginLeft: 4,
    flexShrink: 0,
  },
  divider: {
    height: 1,
    marginHorizontal: 8,
  },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  manageText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12.5,
  },
});

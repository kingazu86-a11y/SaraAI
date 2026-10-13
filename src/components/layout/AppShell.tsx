import React from 'react';
import {
  StatusBar,
  StyleSheet,
  View,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAssistant } from '../../store/AssistantStore';
import { PushDrawerLayout } from './PushDrawerLayout';
import { Sidebar } from '../sidebar/Sidebar';
import { ChatHeader } from '../chat/ChatHeader';
import { ChatList } from '../chat/ChatList';
import { MessageComposer } from '../chat/MessageComposer';
import { ChatActionsSheet } from '../chat/ChatActionsSheet';
import { CustomCameraModal } from '../media/CustomCameraModal';
import { MultiImagePickerModal } from '../media/MultiImagePickerModal';
import { SettingsModal } from '../modals/SettingsModal';
import { CustomizationModal } from '../modals/CustomizationModal';
import { ModelCenterModal } from '../modals/ModelCenterModal';
import { MemoryManagerModal } from '../modals/MemoryManagerModal';
import { VoiceAssistantModal } from '../modals/VoiceAssistantModal';
import { VoicePackSetupModal } from '../modals/VoicePackSetupModal';
import { PermissionSetupScreen } from '../onboarding/PermissionSetupScreen';

export const AppShell: React.FC = () => {
  const {
    themeMode,
    theme,
    hasCompletedOnboarding,
    activeModal,
    closeModal,
    isSidebarOpen,
    openSidebar,
    closeSidebar,
  } = useAssistant();

  // First-launch experience
  if (!hasCompletedOnboarding) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <StatusBar
          barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor={theme.background}
        />
        <PermissionSetupScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      <PushDrawerLayout
        drawer={<Sidebar />}
        isOpen={isSidebarOpen}
        onOpen={openSidebar}
        onClose={closeSidebar}
        isGestureDisabled={activeModal !== 'none'}
      >
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Top Header */}
          <ChatHeader />

          {/* Primary Chat Conversation View */}
          <View style={styles.chatContainer}>
            <ChatList />
          </View>

          {/* ChatGPT-Style Bottom Composer */}
          <MessageComposer />
        </KeyboardAvoidingView>
      </PushDrawerLayout>

      {/* Modals */}
      <ChatActionsSheet />
      <CustomCameraModal />
      <MultiImagePickerModal />
      <SettingsModal />
      <CustomizationModal />
      <ModelCenterModal />
      <MemoryManagerModal />
      <VoiceAssistantModal />
      <VoicePackSetupModal />

      {/* Permission Re-configuration Modal */}
      <Modal
        visible={activeModal === 'permission_setup'}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'overFullScreen'}
        onRequestClose={closeModal}
        statusBarTranslucent={true}
      >
        <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
          <StatusBar
            barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'}
            backgroundColor={theme.background}
            translucent={true}
          />
          <PermissionSetupScreen onComplete={closeModal} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
  },
});

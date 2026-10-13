import { NativeModules, Platform } from 'react-native';
import {
  InstalledAppInfo,
  AndroidDeviceInfo,
  NativePermissionsMap,
  AssistantServiceStatus,
  ScreenObservationResult,
} from './AndroidNativeTypes';
import { logger } from '../utils/logger';

const { AssistantModule } = NativeModules;

/**
 * Type-safe interface to Android Native Assistant Module.
 * Provides graceful fallback when native module is pending implementation or running in mock mode.
 */
class AssistantNativeBridge {
  private isModuleAvailable(): boolean {
    return Platform.OS === 'android' && !!AssistantModule;
  }

  public async openApp(packageName: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isModuleAvailable()) {
      logger.warn(`AssistantModule.openApp unavailable on current platform. Package: ${packageName}`);
      return { success: false, error: 'Native AssistantModule not linked.' };
    }
    try {
      return await AssistantModule.openApp(packageName);
    } catch (e: any) {
      logger.error(`Error opening app ${packageName}`, e);
      return { success: false, error: e?.message || 'Failed to open app' };
    }
  }

  public async getInstalledApps(): Promise<InstalledAppInfo[]> {
    if (!this.isModuleAvailable()) {
      logger.debug('Returning placeholder installed apps (native bridge not ready)');
      return [
        { packageName: 'com.android.settings', appName: 'Settings', isSystemApp: true },
        { packageName: 'com.whatsapp', appName: 'WhatsApp', isSystemApp: false },
        { packageName: 'com.google.android.youtube', appName: 'YouTube', isSystemApp: false },
        { packageName: 'com.google.android.apps.photos', appName: 'Photos', isSystemApp: false },
      ];
    }
    try {
      return await AssistantModule.getInstalledApps();
    } catch (e) {
      logger.error('Error fetching installed apps', e);
      return [];
    }
  }

  public async getDeviceInfo(): Promise<AndroidDeviceInfo> {
    if (!this.isModuleAvailable()) {
      return {
        manufacturer: 'Android',
        model: 'Device',
        androidVersion: '15.0',
        sdkInt: 35,
        totalRamMb: 8192,
        availableRamMb: 4096,
        isGpuSupported: true,
      };
    }
    try {
      return await AssistantModule.getDeviceInfo();
    } catch (e) {
      logger.error('Error fetching device info', e);
      return {
        manufacturer: 'Unknown',
        model: 'Unknown',
        androidVersion: 'Unknown',
        sdkInt: 0,
        totalRamMb: 0,
        availableRamMb: 0,
        isGpuSupported: false,
      };
    }
  }

  public async checkAccessibilityPermission(): Promise<boolean> {
    if (!this.isModuleAvailable()) return false;
    try {
      return await AssistantModule.checkAccessibilityPermission();
    } catch {
      return false;
    }
  }

  public async openAccessibilitySettings(): Promise<void> {
    if (!this.isModuleAvailable()) {
      logger.info('Opening accessibility settings (mock)');
      return;
    }
    try {
      await AssistantModule.openAccessibilitySettings();
    } catch (e) {
      logger.error('Error opening accessibility settings', e);
    }
  }

  public async startAssistantService(): Promise<boolean> {
    if (!this.isModuleAvailable()) return false;
    try {
      return await AssistantModule.startAssistantService();
    } catch (e) {
      logger.error('Error starting foreground service', e);
      return false;
    }
  }

  public async stopAssistantService(): Promise<boolean> {
    if (!this.isModuleAvailable()) return false;
    try {
      return await AssistantModule.stopAssistantService();
    } catch (e) {
      logger.error('Error stopping foreground service', e);
      return false;
    }
  }

  public async getAssistantServiceStatus(): Promise<AssistantServiceStatus> {
    if (!this.isModuleAvailable()) {
      return { isRunning: false, uptimeSeconds: 0 };
    }
    try {
      return await AssistantModule.getAssistantServiceStatus();
    } catch {
      return { isRunning: false, uptimeSeconds: 0 };
    }
  }
}

export const AssistantNative = new AssistantNativeBridge();

import { NativeModules, Platform } from 'react-native';
import { NativePermissionsMap } from './AndroidNativeTypes';
import { logger } from '../utils/logger';

const { PermissionModule } = NativeModules;

class PermissionNativeBridge {
  private isModuleAvailable(): boolean {
    return Platform.OS === 'android' && !!PermissionModule;
  }

  public async checkAllPermissions(): Promise<NativePermissionsMap> {
    if (!this.isModuleAvailable()) {
      return {
        microphone: false,
        notifications: false,
        accessibility: false,
        batteryOptimization: false,
        storage: true,
      };
    }
    try {
      return await PermissionModule.checkAllPermissions();
    } catch (e) {
      logger.error('Error checking native permissions', e);
      return {
        microphone: false,
        notifications: false,
        accessibility: false,
        batteryOptimization: false,
        storage: false,
      };
    }
  }

  public async openAccessibilitySettings(): Promise<void> {
    if (!this.isModuleAvailable()) return;
    try {
      await PermissionModule.openAccessibilitySettings();
    } catch (e) {
      logger.error('Error opening accessibility settings', e);
    }
  }

  public async openNotificationSettings(): Promise<void> {
    if (!this.isModuleAvailable()) return;
    try {
      await PermissionModule.openNotificationSettings();
    } catch (e) {
      logger.error('Error opening notification settings', e);
    }
  }

  public async openBatteryOptimizationSettings(): Promise<void> {
    if (!this.isModuleAvailable()) return;
    try {
      await PermissionModule.openBatteryOptimizationSettings();
    } catch (e) {
      logger.error('Error opening battery optimization settings', e);
    }
  }

  public async openAppSettings(): Promise<void> {
    if (!this.isModuleAvailable()) return;
    try {
      await PermissionModule.openAppSettings();
    } catch (e) {
      logger.error('Error opening app settings', e);
    }
  }
}

export const PermissionNative = new PermissionNativeBridge();

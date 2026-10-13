import { PermissionsAndroid, Platform } from 'react-native';
import { PermissionNative } from '../native/PermissionNative';
import { PermissionItem, NativePermissionsMap } from '../native/AndroidNativeTypes';
import { logger } from '../utils/logger';

export class PermissionService {
  public static async getPermissionItems(): Promise<PermissionItem[]> {
    const rawStatus = await this.checkAllStatus();

    return [
      {
        kind: 'MICROPHONE',
        title: 'Microphone Access',
        category: 'RECOMMENDED',
        description: 'Required for real-time offline speech recognition and voice commands.',
        isGranted: rawStatus.microphone,
        actionLabel: 'Allow',
        icon: 'mic',
      },
      {
        kind: 'NOTIFICATIONS',
        title: 'Foreground Notifications',
        category: 'RECOMMENDED',
        description: 'Displays persistent background assistant status and active task indicators.',
        isGranted: rawStatus.notifications,
        actionLabel: 'Allow',
        icon: 'shield',
      },
      {
        kind: 'ACCESSIBILITY',
        title: 'Accessibility Control',
        category: 'OPTIONAL',
        description: 'Enables autonomous UI automation, inspecting active screen elements, and tapping buttons.',
        isGranted: rawStatus.accessibility,
        actionLabel: 'Enable',
        icon: 'terminal',
      },
      {
        kind: 'BATTERY_OPTIMIZATION',
        title: 'Background Operation',
        category: 'OPTIONAL',
        description: 'Prevents aggressive Android battery saver from killing the offline assistant worker.',
        isGranted: rawStatus.batteryOptimization,
        actionLabel: 'Configure',
        icon: 'sliders',
      },
      {
        kind: 'STORAGE',
        title: 'Local File Access',
        category: 'RECOMMENDED',
        description: 'Allows safe local file searching (e.g. PDFs, documents) via scoped storage.',
        isGranted: rawStatus.storage,
        actionLabel: 'Grant',
        icon: 'cpu',
      },
    ];
  }

  public static async checkAllStatus(): Promise<NativePermissionsMap> {
    if (Platform.OS !== 'android') {
      return {
        microphone: true,
        notifications: true,
        accessibility: false,
        batteryOptimization: true,
        storage: true,
      };
    }

    try {
      const nativeStatus = await PermissionNative.checkAllPermissions();

      const micGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );

      let notifGranted = true;
      if (Platform.Version >= 33) {
        notifGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
      }

      let storageGranted = true;
      if (Platform.Version < 33) {
        storageGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
        );
      }

      return {
        microphone: micGranted,
        notifications: notifGranted,
        accessibility: nativeStatus.accessibility,
        batteryOptimization: nativeStatus.batteryOptimization,
        storage: storageGranted,
      };
    } catch (e) {
      logger.error('Error querying all permissions', e);
      return {
        microphone: false,
        notifications: false,
        accessibility: false,
        batteryOptimization: false,
        storage: false,
      };
    }
  }

  public static async requestMicrophone(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'Sara AI requires microphone access for offline voice commands.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      logger.error('Error requesting microphone', e);
      return false;
    }
  }

  public static async requestNotifications(): Promise<boolean> {
    if (Platform.OS !== 'android' || Platform.Version < 33) return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: 'Notification Permission',
          message: 'Required for displaying active foreground assistant background status.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      logger.error('Error requesting notifications', e);
      return false;
    }
  }

  public static async requestCamera(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      const alreadyGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.CAMERA
      );
      if (alreadyGranted) return true;

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Access',
          message: 'Sara AI needs camera access to capture photos and documents for chat analysis.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      logger.error('Error requesting camera permission', e);
      return false;
    }
  }

  public static async requestMediaLibrary(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      const permissionToRequest =
        (Platform.Version as number) >= 33
          ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
          : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

      const alreadyGranted = await PermissionsAndroid.check(permissionToRequest);
      if (alreadyGranted) return true;

      const granted = await PermissionsAndroid.request(permissionToRequest, {
        title: 'Photos & Media Access',
        message: 'Sara AI needs access to your media library to attach photos and albums to conversations.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      });
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      logger.error('Error requesting media library permission', e);
      return false;
    }
  }

  public static async openAccessibilitySettings(): Promise<void> {
    await PermissionNative.openAccessibilitySettings();
  }

  public static async openBatteryOptimizationSettings(): Promise<void> {
    await PermissionNative.openBatteryOptimizationSettings();
  }

  public static async openAppSettings(): Promise<void> {
    await PermissionNative.openAppSettings();
  }
}

export interface InstalledAppInfo {
  packageName: string;
  appName: string;
  versionName?: string;
  isSystemApp?: boolean;
}

export interface AndroidDeviceInfo {
  manufacturer: string;
  model: string;
  androidVersion: string;
  sdkInt: number;
  totalRamMb: number;
  availableRamMb: number;
  isGpuSupported: boolean;
}

export interface AccessibilityNodeInfo {
  id: string;
  text?: string;
  contentDescription?: string;
  className: string;
  packageName: string;
  isClickable: boolean;
  isEditable: boolean;
  isScrollable: boolean;
  bounds?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
}

export interface ScreenObservationResult {
  packageName: string;
  activityName?: string;
  visibleTexts: string[];
  clickableElements: {
    id: string;
    text?: string;
    description?: string;
  }[];
  editableElements: {
    id: string;
    hint?: string;
  }[];
}

export type PermissionKind =
  | 'MICROPHONE'
  | 'NOTIFICATIONS'
  | 'ACCESSIBILITY'
  | 'BATTERY_OPTIMIZATION'
  | 'STORAGE';

export type PermissionCategory = 'REQUIRED' | 'RECOMMENDED' | 'OPTIONAL';

export interface PermissionItem {
  kind: PermissionKind;
  title: string;
  description: string;
  category: PermissionCategory;
  isGranted: boolean;
  actionLabel: string;
  icon: 'mic' | 'shield' | 'sliders' | 'cpu' | 'terminal';
}

export interface NativePermissionsMap {
  microphone: boolean;
  notifications: boolean;
  accessibility: boolean;
  batteryOptimization: boolean;
  storage: boolean;
}

export interface AssistantServiceStatus {
  isRunning: boolean;
  activeTaskId?: string;
  uptimeSeconds: number;
}

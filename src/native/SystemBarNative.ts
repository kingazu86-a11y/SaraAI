import { NativeModules, Platform } from 'react-native';
import { logger } from '../utils/logger';

const { SystemBarModule } = NativeModules;

class SystemBarNativeBridge {
  private isAvailable(): boolean {
    return Platform.OS === 'android' && !!SystemBarModule;
  }

  /**
   * Set Android navigation bar (bottom bar) color and icon contrast.
   */
  public setNavigationBarColor(colorHex: string, isLight: boolean): void {
    if (!this.isAvailable()) return;
    try {
      SystemBarModule.setNavigationBarColor(colorHex, isLight);
    } catch (e) {
      logger.error('Error setting navigation bar color', e);
    }
  }

  /**
   * Synchronize both status bar (top) and navigation bar (bottom) colors.
   */
  public setSystemBars(statusBarHex: string, navigationBarHex: string, isLight: boolean): void {
    if (!this.isAvailable()) return;
    try {
      SystemBarModule.setSystemBars(statusBarHex, navigationBarHex, isLight);
    } catch (e) {
      logger.error('Error setting system bars', e);
    }
  }
}

export const SystemBarNative = new SystemBarNativeBridge();

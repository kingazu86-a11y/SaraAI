import { NativeModules } from 'react-native';

const { SystemBarModule } = NativeModules;

export class ClipboardService {
  public static async setString(text: string): Promise<boolean> {
    try {
      if (SystemBarModule && typeof SystemBarModule.copyToClipboard === 'function') {
        return await SystemBarModule.copyToClipboard(text);
      }
      return false;
    } catch (e) {
      console.warn('[ClipboardService] Failed to copy text to clipboard', e);
      return false;
    }
  }
}

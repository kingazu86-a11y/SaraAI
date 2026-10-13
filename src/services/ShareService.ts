import { Share } from 'react-native';

export class ShareService {
  public static async shareText(text: string, title?: string): Promise<boolean> {
    try {
      if (!text || text.trim().length === 0) return false;
      const result = await Share.share({
        message: text,
        title: title || 'Sara AI',
      });
      return result.action === Share.sharedAction;
    } catch (e) {
      console.warn('[ShareService] Failed to share content', e);
      return false;
    }
  }
}

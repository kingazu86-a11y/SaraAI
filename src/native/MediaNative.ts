import { NativeModules, Platform } from 'react-native';

export interface DeviceAlbum {
  id: string;
  title: string;
  count: number;
  coverUri: string;
}

export interface DevicePhoto {
  id: string;
  uri: string;
  name: string;
  timestamp: number;
  width: number;
  height: number;
  size?: number;
}

const { MediaModule } = NativeModules;

export class MediaNative {
  public static async getAlbums(): Promise<DeviceAlbum[]> {
    if (Platform.OS !== 'android' || !MediaModule) {
      return [];
    }
    try {
      const albums = await MediaModule.getAlbums();
      return albums || [];
    } catch (e) {
      console.warn('[MediaNative] getAlbums error:', e);
      return [];
    }
  }

  public static async getPhotos(
    bucketId: string | null,
    offset: number,
    limit: number
  ): Promise<DevicePhoto[]> {
    if (Platform.OS !== 'android' || !MediaModule) {
      return [];
    }
    try {
      const photos = await MediaModule.getPhotos(bucketId, offset, limit);
      return photos || [];
    } catch (e) {
      console.warn('[MediaNative] getPhotos error:', e);
      return [];
    }
  }
}

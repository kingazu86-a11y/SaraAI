import { MediaNative, DeviceAlbum, DevicePhoto } from '../native/MediaNative';

export class MediaService {
  private static cachedAlbums: DeviceAlbum[] | null = null;

  public static async getAlbums(refresh = false): Promise<DeviceAlbum[]> {
    if (this.cachedAlbums && !refresh) {
      return this.cachedAlbums;
    }
    const albums = await MediaNative.getAlbums();
    this.cachedAlbums = albums;
    return albums;
  }

  public static async getPhotos(
    bucketId: string | null,
    page: number = 1,
    pageSize: number = 24
  ): Promise<{ photos: DevicePhoto[]; hasMore: boolean }> {
    const offset = (page - 1) * pageSize;
    const photos = await MediaNative.getPhotos(bucketId, offset, pageSize);
    return {
      photos,
      hasMore: photos.length === pageSize,
    };
  }
}

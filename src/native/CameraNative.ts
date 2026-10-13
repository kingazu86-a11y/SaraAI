import { NativeModules, Platform } from 'react-native';

export interface CapturedPhotoResult {
  uri: string;
  name: string;
  width: number;
  height: number;
  timestamp: number;
}

const { CameraModule } = NativeModules;

export class CameraNative {
  public static async capturePhoto(): Promise<CapturedPhotoResult> {
    if (Platform.OS !== 'android' || !CameraModule) {
      throw new Error('CameraModule is only supported on Android native.');
    }
    return await CameraModule.capturePhoto();
  }
}

import { NativeModules, Platform, NativeEventEmitter } from 'react-native';
import { logger } from '../utils/logger';

const { ModelModule } = NativeModules;
const modelEmitter = ModelModule ? new NativeEventEmitter(ModelModule) : null;

export interface NativeStorageInfo {
  availableBytes: number;
  totalBytes: number;
  modelsUsedBytes: number;
  baseObbPath?: string;
  llmPath?: string;
  voicePacksPath?: string;
}

export interface NativeInstalledModel {
  id: string;
  name: string;
  tagline: string;
  kind: 'text' | 'voice_pack' | 'voice_ai' | 'stt' | 'tts';
  status: 'READY' | 'NOT_INSTALLED';
  progress: number;
  sizeBytes: number;
  sizeFormatted: string;
  ramRequirementMb: number;
  ramFormatted: string;
  filePath: string;
  format: string;
  isActive: boolean;
}

export interface ModelDownloadProgressEvent {
  modelId: string;
  name?: string;
  kind?: string;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  speed?: string;
  status: 'DOWNLOADING' | 'PAUSED' | 'VERIFYING' | 'READY' | 'FAILED' | 'NOT_INSTALLED';
  filePath?: string;
  error?: string;
}

class ModelNativeBridge {
  private isModuleAvailable(): boolean {
    return Platform.OS === 'android' && !!ModelModule;
  }

  /**
   * Subscribe to real-time download progress events emitted by the native Kotlin downloader
   */
  public onDownloadProgress(listener: (event: ModelDownloadProgressEvent) => void) {
    if (!modelEmitter) return { remove: () => {} };
    const subscription = modelEmitter.addListener('onModelDownloadProgress', listener);
    return subscription;
  }

  public async getStorageInfo(): Promise<NativeStorageInfo> {
    if (!this.isModuleAvailable()) {
      return {
        availableBytes: 1024 * 1024 * 1024 * 12, // 12 GB
        totalBytes: 1024 * 1024 * 1024 * 64, // 64 GB
        modelsUsedBytes: 0,
        baseObbPath: '/storage/emulated/0/Android/obb/com.saraai.offline.assistant',
        llmPath: '/storage/emulated/0/Android/obb/com.saraai.offline.assistant/Models/LLM',
        voicePacksPath: '/storage/emulated/0/Android/obb/com.saraai.offline.assistant/Models/VoicePacks',
      };
    }
    try {
      return await ModelModule.getStorageInfo();
    } catch (e) {
      logger.error('Error getting storage info', e);
      return {
        availableBytes: 0,
        totalBytes: 0,
        modelsUsedBytes: 0,
      };
    }
  }

  public async getInstalledModels(): Promise<NativeInstalledModel[]> {
    if (!this.isModuleAvailable()) return [];
    try {
      return await ModelModule.getInstalledModels();
    } catch (e) {
      logger.error('Error getting installed models from OBB', e);
      return [];
    }
  }

  public async setActiveModel(modelId: string, kind: string = 'text'): Promise<boolean> {
    if (!this.isModuleAvailable()) return true;
    try {
      return await ModelModule.setActiveModel(modelId, kind);
    } catch (e) {
      logger.error(`Error saving active model ${modelId} to native preferences`, e);
      return false;
    }
  }

  public async isModelInstalled(modelId: string, kind: string = ''): Promise<boolean> {
    if (!this.isModuleAvailable()) return false;
    try {
      return await ModelModule.isModelInstalled(modelId, kind);
    } catch {
      return false;
    }
  }

  public async deleteModel(modelId: string, kind: string = ''): Promise<boolean> {
    if (!this.isModuleAvailable()) return true;
    try {
      return await ModelModule.deleteModel(modelId, kind);
    } catch (e) {
      logger.error(`Error deleting model ${modelId}`, e);
      return false;
    }
  }

  public async verifyModelSha256(
    modelId: string,
    expectedSha256: string,
    kind: string = ''
  ): Promise<boolean> {
    if (!this.isModuleAvailable()) return true;
    try {
      return await ModelModule.verifyModelSha256(modelId, expectedSha256, kind);
    } catch (e) {
      logger.error(`Error verifying model ${modelId}`, e);
      return false;
    }
  }

  /**
   * Starts an asynchronous streaming download via the native Android Foreground Service.
   * Downloads directly from Backblaze B2 into Android OBB storage with live notification bar updates.
   */
  public async startDownload(
    modelId: string,
    downloadUrl: string,
    kind: string,
    expectedSha256: string = '',
    modelName: string = '',
    metadataJson: string = ''
  ): Promise<{ filePath?: string; sizeBytes?: number; success?: boolean }> {
    if (!this.isModuleAvailable()) {
      logger.warn('ModelModule not available on this platform.');
      return { success: true };
    }
    try {
      return await ModelModule.startDownload(
        modelId,
        downloadUrl,
        kind,
        expectedSha256,
        modelName,
        metadataJson
      );
    } catch (e) {
      logger.error(`Error downloading model ${modelId} from ${downloadUrl}`, e);
      throw e;
    }
  }

  public async pauseDownload(modelId: string): Promise<boolean> {
    if (!this.isModuleAvailable()) return true;
    try {
      return await ModelModule.pauseDownload(modelId);
    } catch (e) {
      logger.error(`Error pausing download ${modelId}`, e);
      return false;
    }
  }

  public async getActiveDownloads(): Promise<ModelDownloadProgressEvent[]> {
    if (!this.isModuleAvailable()) return [];
    try {
      return await ModelModule.getActiveDownloads();
    } catch (e) {
      logger.error('Error getting active downloads from native service', e);
      return [];
    }
  }

  public async cancelDownload(modelId: string): Promise<boolean> {
    if (!this.isModuleAvailable()) return true;
    try {
      return await ModelModule.cancelDownload(modelId);
    } catch (e) {
      logger.error(`Error cancelling download ${modelId}`, e);
      return false;
    }
  }

  public async setAuthItem(key: string, value: string): Promise<boolean> {
    if (!this.isModuleAvailable()) return false;
    try {
      return await ModelModule.setAuthItem(key, value);
    } catch {
      return false;
    }
  }

  public async getAuthItem(key: string): Promise<string | null> {
    if (!this.isModuleAvailable()) return null;
    try {
      return await ModelModule.getAuthItem(key);
    } catch {
      return null;
    }
  }

  public async clearAuthItem(key: string): Promise<boolean> {
    if (!this.isModuleAvailable()) return false;
    try {
      return await ModelModule.clearAuthItem(key);
    } catch {
      return false;
    }
  }
}

export const ModelNative = new ModelNativeBridge();

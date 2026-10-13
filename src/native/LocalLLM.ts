import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { logger } from '../utils/logger';

const { LocalLLM: NativeLocalLLM } = NativeModules;

const llmEmitter =
  Platform.OS === 'android' && NativeLocalLLM
    ? new NativeEventEmitter(NativeLocalLLM)
    : null;

export interface GenerationOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface ModelLoadResult {
  success: boolean;
  modelId: string;
  path: string;
}

export interface GenerationResult {
  text: string;
  completed: boolean;
  stopped: boolean;
}

export interface LoadedModelInfo {
  isLoaded: boolean;
  modelId?: string;
}

class LocalLLMBridge {
  private isAvailable(): boolean {
    return Platform.OS === 'android' && !!NativeLocalLLM;
  }

  // Event Listeners
  public onToken(listener: (data: { text: string }) => void) {
    if (!llmEmitter) return { remove: () => {} };
    return llmEmitter.addListener('llm_token', listener);
  }

  public onGenerationStarted(listener: () => void) {
    if (!llmEmitter) return { remove: () => {} };
    return llmEmitter.addListener('llm_generation_started', listener);
  }

  public onGenerationCompleted(listener: (data: { fullText: string }) => void) {
    if (!llmEmitter) return { remove: () => {} };
    return llmEmitter.addListener('llm_generation_completed', listener);
  }

  public onGenerationStopped(listener: (data: { partialText: string }) => void) {
    if (!llmEmitter) return { remove: () => {} };
    return llmEmitter.addListener('llm_generation_stopped', listener);
  }

  public onError(listener: (data: { code: string; message: string }) => void) {
    if (!llmEmitter) return { remove: () => {} };
    return llmEmitter.addListener('llm_error', listener);
  }

  public onModelLoading(listener: (data: { modelId: string }) => void) {
    if (!llmEmitter) return { remove: () => {} };
    return llmEmitter.addListener('llm_model_loading', listener);
  }

  public onModelLoaded(listener: (data: { modelId: string; path: string }) => void) {
    if (!llmEmitter) return { remove: () => {} };
    return llmEmitter.addListener('llm_model_loaded', listener);
  }

  public onModelUnloaded(listener: () => void) {
    if (!llmEmitter) return { remove: () => {} };
    return llmEmitter.addListener('llm_model_unloaded', listener);
  }

  // Bridge Methods
  public async isModelLoaded(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      return await NativeLocalLLM.isModelLoaded();
    } catch {
      return false;
    }
  }

  public async getLoadedModel(): Promise<LoadedModelInfo> {
    if (!this.isAvailable()) return { isLoaded: false };
    try {
      return await NativeLocalLLM.getLoadedModel();
    } catch {
      return { isLoaded: false };
    }
  }

  public async loadModel(modelId: string, kind: string = 'text'): Promise<ModelLoadResult> {
    if (!this.isAvailable()) {
      throw new Error('LocalLLM native module is only available on Android');
    }
    logger.info(`[LocalLLM] Loading model: ${modelId} (${kind})`);
    return await NativeLocalLLM.loadModel(modelId, kind);
  }

  public async generate(prompt: string, options: GenerationOptions = {}): Promise<GenerationResult> {
    if (!this.isAvailable()) {
      throw new Error('LocalLLM native module is only available on Android');
    }
    logger.info(`[LocalLLM] Generating with maxTokens=${options.maxTokens || 2048}`);
    return await NativeLocalLLM.generate(prompt, {
      maxTokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.5,
      topP: options.topP ?? 0.9,
    });
  }

  public async stopGeneration(): Promise<boolean> {
    if (!this.isAvailable()) return true;
    try {
      return await NativeLocalLLM.stopGeneration();
    } catch (e) {
      logger.error('[LocalLLM] Failed to stop generation', e);
      return false;
    }
  }

  public async resetChat(systemPrompt?: string): Promise<boolean> {
    if (!this.isAvailable()) return true;
    try {
      return await NativeLocalLLM.resetChat(systemPrompt ?? null);
    } catch (e) {
      logger.error('[LocalLLM] Failed to reset chat', e);
      return false;
    }
  }

  public async unloadModel(): Promise<boolean> {
    if (!this.isAvailable()) return true;
    try {
      return await NativeLocalLLM.unloadModel();
    } catch (e) {
      logger.error('[LocalLLM] Failed to unload model', e);
      return false;
    }
  }

  public async saveMemoriesToStorage(jsonString: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      return await NativeLocalLLM.saveMemoriesToStorage(jsonString);
    } catch (e) {
      logger.error('[LocalLLM] Failed to save memories to storage', e);
      return false;
    }
  }

  public async loadMemoriesFromStorage(): Promise<string> {
    if (!this.isAvailable()) return '';
    try {
      return await NativeLocalLLM.loadMemoriesFromStorage();
    } catch (e) {
      logger.error('[LocalLLM] Failed to load memories from storage', e);
      return '';
    }
  }
}

export const LocalLLM = new LocalLLMBridge();

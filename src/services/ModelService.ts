import { Platform } from 'react-native';
import {
  DownloadableModel,
  ModelDownloadStatus,
} from '../ai/ModelCatalog';
import { ModelNative, NativeStorageInfo, ModelDownloadProgressEvent } from '../native/ModelNative';
import { InferenceBackend } from '../ai/AgentTypes';
import { logger } from '../utils/logger';
import { ENV } from '../config/env';
import { DownloadAuthService } from './DownloadAuthService';
import { PermissionService } from './PermissionService';

export interface PaginatedResult<T> {
  success: boolean;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  data: T[];
}

class ModelServiceImpl {
  // Start with empty models list; populated directly from Firebase RTDB and offline storage
  private models: DownloadableModel[] = [];
  private activeBackend: InferenceBackend = 'AUTO';
  private progressCallbacks: Map<string, (model: DownloadableModel) => void> = new Map();

  // Instant In-Memory Cache (Prevents continuous loading spinners)
  private cachedModelsList: DownloadableModel[] | null = null;
  private cachedVoicePacksList: DownloadableModel[] | null = null;
  private lastModelsFetchTime = 0;
  private lastVoicePacksFetchTime = 0;
  private readonly CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes fresh cache

  constructor() {
    this.setupDownloadListener();
    this.syncInstalledModels();
  }

  /**
   * Listen to real progress events emitted by the native Kotlin Foreground Service downloader
   */
  private setupDownloadListener(): void {
    ModelNative.onDownloadProgress((event: ModelDownloadProgressEvent) => {
      const { modelId, progress, downloadedBytes, speed, status } = event;

      this.models = this.models.map(m => {
        if (m.id === modelId) {
          const isCancelled = status === 'NOT_INSTALLED';
          const isFinished = status === 'READY';
          const isPaused = status === 'PAUSED';
          return {
            ...m,
            status,
            progress: isCancelled ? 0 : isFinished ? 100 : progress,
            downloadedBytes: isCancelled ? 0 : downloadedBytes,
            downloadSpeed: isCancelled ? undefined : (isPaused ? 'Paused' : speed),
            isActive: isFinished && !this.models.some(other => other.kind === m.kind && other.isActive && other.status === 'READY')
              ? true
              : (isCancelled ? false : m.isActive),
          };
        }
        return m;
      });

      if (status === 'NOT_INSTALLED') {
        this.progressCallbacks.delete(modelId);
      }

      const updated = this.models.find(m => m.id === modelId);
      if (updated) {
        const callback = this.progressCallbacks.get(modelId);
        if (callback) {
          callback(updated);
        }
        if (status === 'READY' || status === 'FAILED' || status === 'NOT_INSTALLED') {
          this.progressCallbacks.delete(modelId);
        }
      }

      // Notify all subscribers (AssistantStore, ModelCenterModal, etc.) of live catalog update
      this.notifyCatalogUpdated();
    });
  }

  /**
   * Pure offline sync: Fetches models directly from Android OBB storage.
   * Scans Models/LLM and Models/VoicePacks with strict validation and permanent metadata.
   * Zero internet requests required.
   */
  public async syncInstalledModels(): Promise<void> {
    try {
      const installedNative = await ModelNative.getInstalledModels();
      logger.info(`[ModelService] Found ${installedNative.length} validated installed models in local storage.`);

      if (installedNative.length > 0) {
        const existingMap = new Map(this.models.map(m => [m.id, m]));

        for (const native of installedNative) {
          const existing = existingMap.get(native.id);
          const merged: DownloadableModel = {
            id: native.id,
            name: existing?.name || native.name,
            tagline: existing?.tagline || native.tagline,
            kind: native.kind as any,
            format: native.format || 'GGUF',
            runtime: existing?.runtime || (native.kind === 'text' ? 'llama.cpp / LiteRT' : 'sherpa-onnx / piper'),
            sha256: existing?.sha256 || '',
            sizeBytes: native.sizeBytes,
            sizeFormatted: native.sizeFormatted,
            ramRequirementMb: native.ramRequirementMb,
            ramFormatted: native.ramFormatted,
            status: 'READY',
            progress: 100,
            isActive: native.isActive,
            version: existing?.version || '1.0',
            capabilities: existing?.capabilities || ['offline_inference', 'fast_response'],
            languages: existing?.languages || ['English', 'Urdu', 'Hindi'],
          };
          existingMap.set(native.id, merged);
        }

        this.models = Array.from(existingMap.values());
      } else {
        const checks = await Promise.all(
          this.models.map(async m => {
            const installed = await ModelNative.isModelInstalled(m.id, m.kind);
            return { id: m.id, installed };
          })
        );

        this.models = this.models.map(m => {
          const match = checks.find(c => c.id === m.id);
          if (match?.installed) {
            return { ...m, status: 'READY', progress: 100 };
          }
          return m;
        });
      }

      // Sync active or paused background downloads from native service
      try {
        const activeDownloads = await ModelNative.getActiveDownloads();
        if (activeDownloads && activeDownloads.length > 0) {
          logger.info(`[ModelService] Synchronized ${activeDownloads.length} active/paused background downloads from native service.`);
          this.models = this.models.map(m => {
            if (m.status === 'READY') return m;
            const activeTask = activeDownloads.find(d => d.modelId === m.id);
            if (activeTask) {
              return {
                ...m,
                status: activeTask.status as any,
                progress: activeTask.progress,
                downloadedBytes: activeTask.downloadedBytes,
                downloadSpeed: activeTask.speed,
              };
            }
            return {
              ...m,
              status: 'NOT_INSTALLED',
              progress: 0,
              downloadedBytes: 0,
              downloadSpeed: undefined,
            };
          });
          this.notifyCatalogUpdated();
        } else {
          // No background downloads active; ensure non-ready models are reset to NOT_INSTALLED
          this.models = this.models.map(m => {
            if (m.status !== 'READY') {
              return {
                ...m,
                status: 'NOT_INSTALLED',
                progress: 0,
                downloadedBytes: 0,
                downloadSpeed: undefined,
              };
            }
            return m;
          });
          this.notifyCatalogUpdated();
        }
      } catch (activeErr) {
        logger.warn('[ModelService] Error querying active background downloads', activeErr);
      }
    } catch (e) {
      logger.error('Error syncing installed models from offline storage', e);
    }
  }

  /**
   * Internal HTTP fetch with strict timeout (prevents hanging indefinitely on mobile network)
   */
  private async fetchWithTimeout(url: string, timeoutMs = 4500): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Fetches LLM models directly from remote catalog with instant 0ms caching and timeout protection
   */
  public async fetchServerModels(params: {
    page?: number;
    limit?: number;
    search?: string;
    kind?: string;
    forceRefresh?: boolean;
  } = {}): Promise<PaginatedResult<DownloadableModel>> {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const search = (params.search || '').toLowerCase().trim();
    const kind = (params.kind || 'all').toLowerCase().trim();
    const forceRefresh = params.forceRefresh || false;

    const now = Date.now();
    const isCacheFresh =
      !forceRefresh &&
      this.cachedModelsList &&
      this.cachedModelsList.length > 0 &&
      now - this.lastModelsFetchTime < this.CACHE_TTL_MS;

    // Instant 0ms response when cache is warm
    if (isCacheFresh && this.cachedModelsList) {
      let filtered = this.cachedModelsList;
      if (kind !== 'all') {
        filtered = filtered.filter(m => (m.kind || 'text').toLowerCase() === kind);
      }
      if (search) {
        filtered = filtered.filter(m => this.matchesSearch(m, search));
      }
      return this.paginateList(filtered, page, limit);
    }

    try {
      const rtdbUrl = `${ENV.FIREBASE_RTDB_URL}/models.json`;
      const res = await this.fetchWithTimeout(rtdbUrl, 4500);

      let serverModels: DownloadableModel[] = [];

      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) {
          serverModels = json.filter(Boolean);
        } else if (json && typeof json === 'object') {
          serverModels = Object.entries(json).map(([key, val]: [string, any]) => ({
            id: val.id || key,
            ...val,
          }));
        }
      }

      // Directly enrich Firebase models with local installation state (no hardcoded seeds)
      const enriched = await Promise.all(
        serverModels.map(async sm => {
          const isInstalled = await ModelNative.isModelInstalled(sm.id, sm.kind);
          const local = this.models.find(m => m.id === sm.id);

          return {
            ...sm,
            status: isInstalled ? 'READY' : (local?.status || 'NOT_INSTALLED'),
            progress: isInstalled ? 100 : (local?.progress || 0),
            isActive: local?.isActive || false,
          };
        })
      );

      this.cachedModelsList = enriched;
      this.lastModelsFetchTime = Date.now();
      this.mergeServerModels(enriched, 'models');

      let filtered = enriched;
      if (kind !== 'all') {
        filtered = filtered.filter(m => (m.kind || 'text').toLowerCase() === kind);
      }
      if (search) {
        filtered = filtered.filter(m => this.matchesSearch(m, search));
      }

      return this.paginateList(filtered, page, limit);
    } catch (error) {
      logger.warn(`Failed to fetch models from cloud catalog, serving instant cache:`, error);
      // Seamless Fallback: Return in-memory catalog immediately
      let fallbackList = (this.cachedModelsList || this.models).filter(m =>
        kind === 'all'
          ? m.kind === 'text' || m.kind === 'vision' || m.kind === 'multimodal'
          : (m.kind || 'text').toLowerCase() === kind
      );
      if (search) {
        fallbackList = fallbackList.filter(m => this.matchesSearch(m, search));
      }
      return this.paginateList(fallbackList, page, limit);
    }
  }

  /**
   * Fetches Voice Packs directly from remote catalog with instant 0ms caching and timeout protection
   */
  public async fetchServerVoicePacks(params: {
    page?: number;
    limit?: number;
    search?: string;
    forceRefresh?: boolean;
  } = {}): Promise<PaginatedResult<DownloadableModel>> {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const search = (params.search || '').toLowerCase().trim();
    const forceRefresh = params.forceRefresh || false;

    const now = Date.now();
    const isCacheFresh =
      !forceRefresh &&
      this.cachedVoicePacksList &&
      this.cachedVoicePacksList.length > 0 &&
      now - this.lastVoicePacksFetchTime < this.CACHE_TTL_MS;

    // Instant 0ms response when cache is warm
    if (isCacheFresh && this.cachedVoicePacksList) {
      let filtered = this.cachedVoicePacksList;
      if (search) {
        filtered = filtered.filter(m => this.matchesSearch(m, search));
      }
      return this.paginateList(filtered, page, limit);
    }

    try {
      const rtdbUrl = `${ENV.FIREBASE_RTDB_URL}/voicepacks.json`;
      const res = await this.fetchWithTimeout(rtdbUrl, 4500);

      let serverPacks: DownloadableModel[] = [];

      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) {
          serverPacks = json.filter(Boolean);
        } else if (json && typeof json === 'object') {
          serverPacks = Object.entries(json).map(([key, val]: [string, any]) => ({
            id: val.id || key,
            ...val,
          }));
        }
      }

      // Directly enrich Firebase voice packs with local installation state (no hardcoded seeds)
      const enriched = await Promise.all(
        serverPacks.map(async sp => {
          const isInstalled = await ModelNative.isModelInstalled(sp.id, sp.kind || 'voice_pack');
          const local = this.models.find(m => m.id === sp.id);

          return {
            ...sp,
            status: isInstalled ? 'READY' : (local?.status || 'NOT_INSTALLED'),
            progress: isInstalled ? 100 : (local?.progress || 0),
            isActive: local?.isActive || false,
          };
        })
      );

      this.cachedVoicePacksList = enriched;
      this.lastVoicePacksFetchTime = Date.now();
      this.mergeServerModels(enriched, 'voicepacks');

      let filtered = enriched;
      if (search) {
        filtered = filtered.filter(m => this.matchesSearch(m, search));
      }

      return this.paginateList(filtered, page, limit);
    } catch (error) {
      logger.warn(`Failed to fetch voice packs from cloud catalog, serving instant cache:`, error);
      let fallbackList = (this.cachedVoicePacksList || this.models).filter(
        m => m.kind === 'voice_pack' || m.kind === 'voice_ai' || m.kind === 'stt' || m.kind === 'tts'
      );
      if (search) {
        fallbackList = fallbackList.filter(m => this.matchesSearch(m, search));
      }
      return this.paginateList(fallbackList, page, limit);
    }
  }

  private catalogSubscribers: Set<(models: DownloadableModel[]) => void> = new Set();

  public subscribeCatalog(listener: (models: DownloadableModel[]) => void): () => void {
    this.catalogSubscribers.add(listener);
    return () => {
      this.catalogSubscribers.delete(listener);
    };
  }

  public notifyCatalogUpdated(): void {
    const current = this.getModels();
    this.catalogSubscribers.forEach(cb => {
      try {
        cb(current);
      } catch (err) {
        logger.error('[ModelService] Subscriber error', err);
      }
    });
  }

  /**
   * Universal fuzzy search helper across all relevant model fields
   */
  public matchesSearch(m: DownloadableModel, query: string): boolean {
    if (!query) return true;
    const q = query.toLowerCase().trim();
    if (m.id.toLowerCase().includes(q)) return true;
    if (m.name.toLowerCase().includes(q)) return true;
    if (m.tagline && m.tagline.toLowerCase().includes(q)) return true;
    if (m.description && m.description.toLowerCase().includes(q)) return true;
    if (m.format && m.format.toLowerCase().includes(q)) return true;
    if (m.architecture && m.architecture.toLowerCase().includes(q)) return true;
    if (m.kind && m.kind.toLowerCase().includes(q)) return true;
    if (m.runtime && m.runtime.toLowerCase().includes(q)) return true;
    if (m.capabilities && m.capabilities.some(c => c.toLowerCase().includes(q))) return true;
    if (m.modalities && m.modalities.some(mod => mod.toLowerCase().includes(q))) return true;
    if (m.languages && m.languages.some(lang => lang.toLowerCase().includes(q))) return true;
    return false;
  }

  /**
   * Universal pagination helper
   */
  public paginateList<T>(items: T[], page: number = 1, limit: number = 10): PaginatedResult<T> {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const startIndex = (currentPage - 1) * limit;
    const data = items.slice(startIndex, startIndex + limit);
    return {
      success: true,
      page: currentPage,
      limit,
      total,
      totalPages,
      hasMore: currentPage < totalPages,
      data,
    };
  }

  /**
   * Applies real-time updates pushed from Firebase Realtime Database SSE
   */
  public async applyRealtimeUpdate(
    rawData: Record<string, any> | any[] | null,
    category: 'models' | 'voicepacks'
  ): Promise<void> {
    if (!rawData || typeof rawData !== 'object') return;
    try {
      let parsedList: DownloadableModel[] = [];
      if (Array.isArray(rawData)) {
        parsedList = rawData.filter(item => item && typeof item === 'object' && item.id);
      } else {
        parsedList = Object.entries(rawData)
          .filter(([_, val]) => val && typeof val === 'object')
          .map(([key, val]: [string, any]) => ({
            id: val.id || key,
            ...val,
          }))
          .filter(item => item && item.id && item.name);
      }

      if (parsedList.length === 0) return;

      // Directly enrich Firebase realtime items with local installation state (no hardcoded seeds)
      const enriched = await Promise.all(
        parsedList.map(async item => {
          let isInstalled = false;
          try {
            const kind = item.kind || (category === 'voicepacks' ? 'voice_pack' : 'text');
            isInstalled = await ModelNative.isModelInstalled(item.id, kind);
          } catch {
            isInstalled = false;
          }
          const local = this.models.find(m => m.id === item.id);
          return {
            ...item,
            status: isInstalled ? 'READY' : (local?.status || item.status || 'NOT_INSTALLED'),
            progress: isInstalled ? 100 : (local?.progress || 0),
            isActive: local?.isActive || false,
          } as DownloadableModel;
        })
      );

      if (category === 'voicepacks') {
        this.cachedVoicePacksList = enriched;
        this.lastVoicePacksFetchTime = Date.now();
      } else {
        this.cachedModelsList = enriched;
        this.lastModelsFetchTime = Date.now();
      }

      this.mergeServerModels(enriched, category);
      this.notifyCatalogUpdated();
      logger.info(`[ModelService] Realtime sync applied ${enriched.length} items for ${category}.`);
    } catch (err) {
      logger.error(`[ModelService] Error applying realtime update for ${category}:`, err);
    }
  }

  private mergeServerModels(newModels: DownloadableModel[], category?: 'models' | 'voicepacks'): void {
    const incomingIds = new Set(newModels.map(m => m.id));
    const map = new Map<string, DownloadableModel>();

    for (const m of this.models) {
      const isTargetCategory = category
        ? (category === 'voicepacks'
            ? (m.kind === 'voice_pack' || m.kind === 'voice_ai' || m.kind === 'stt' || m.kind === 'tts')
            : (m.kind === 'text' || m.kind === 'vision' || m.kind === 'multimodal' || !m.kind))
        : false;

      // Retain offline ready models on device
      if (m.status === 'READY') {
        map.set(m.id, m);
      } else if (category && isTargetCategory) {
        // Drop uninstalled remote models that were removed from Firebase RTDB
        if (incomingIds.has(m.id)) {
          map.set(m.id, m);
        }
      } else {
        map.set(m.id, m);
      }
    }

    for (const item of newModels) {
      const existing = map.get(item.id);
      if (existing) {
        map.set(item.id, {
          ...item,
          status: existing.status === 'READY' ? 'READY' : (existing.status || item.status),
          progress: existing.status === 'READY' ? 100 : (existing.progress || item.progress),
          isActive: existing.isActive || item.isActive,
        });
      } else {
        map.set(item.id, item);
      }
    }
    this.models = Array.from(map.values());
  }

  public getModels(): DownloadableModel[] {
    return [...this.models];
  }

  /**
   * Returns installed models for the offline view.
   * Does NOT make any network calls; reads directly from verified local state.
   */
  public getInstalledModels(): DownloadableModel[] {
    return this.models.filter(m => m.status === 'READY');
  }

  /**
   * Returns paginated and filtered installed models for offline view
   */
  public fetchInstalledModels(params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}): PaginatedResult<DownloadableModel> {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const search = (params.search || '').toLowerCase().trim();

    let installed = this.getInstalledModels();
    if (search) {
      installed = installed.filter(m => this.matchesSearch(m, search));
    }
    return this.paginateList(installed, page, limit);
  }

  public getActiveTextModel(): DownloadableModel | null {
    return (
      this.models.find(
        m => (m.kind === 'text' || m.kind === 'voice_ai') && m.isActive && m.status === 'READY'
      ) || null
    );
  }

  public getActiveVoiceModel(): DownloadableModel | null {
    return (
      this.models.find(
        m => (m.kind === 'voice_pack' || m.kind === 'voice_ai' || m.kind === 'stt') && m.isActive && m.status === 'READY'
      ) || null
    );
  }

  public async getStorageInfo(): Promise<NativeStorageInfo> {
    return await ModelNative.getStorageInfo();
  }

  public async setBackend(backend: InferenceBackend): Promise<void> {
    this.activeBackend = backend;
    logger.info(`Inference backend changed to: ${backend}`);
  }

  public getBackend(): InferenceBackend {
    return this.activeBackend;
  }

  public setActiveModel(modelId: string): void {
    const target = this.models.find(m => m.id === modelId);
    if (!target || target.status !== 'READY') return;

    this.models = this.models.map(m => {
      if (m.kind === target.kind) {
        return { ...m, isActive: m.id === modelId };
      }
      return m;
    });

    // Persist to native Android SharedPreferences so it survives app restarts
    ModelNative.setActiveModel(modelId, target.kind).catch(() => {});

    logger.info(`Active model for ${target.kind} set to: ${target.name} (persisted)`);
  }

  /**
   * Starts downloading a model or voice pack directly into Android OBB storage
   * via the Android Foreground Service.
   */
  public async startDownload(
    modelId: string,
    onProgress: (model: DownloadableModel) => void
  ): Promise<void> {
    const target = this.models.find(m => m.id === modelId);
    if (!target) return;

    // Check and request Android notification permission if not yet granted
    if (Platform.OS === 'android') {
      try {
        const perms = await PermissionService.checkAllStatus();
        if (!perms.notifications) {
          await PermissionService.requestNotifications();
        }
      } catch (permErr) {
        logger.warn('[ModelService] Notification permission request error:', permErr);
      }
    }

    this.progressCallbacks.set(modelId, onProgress);

    // Initial state: Authorizing
    this.models = this.models.map(m =>
      m.id === modelId ? { ...m, status: 'DOWNLOADING', progress: 0, downloadSpeed: 'Authorizing...' } : m
    );
    this.notifyCatalogUpdated();
    onProgress(this.models.find(m => m.id === modelId)!);

    try {
      // Secure Step: Request short-lived authorized Backblaze B2 link via Cloud Functions Gateway
      let authorizedDownloadUrl: string;
      try {
        const authResult = await DownloadAuthService.requestAuthorizedDownloadUrl(target);
        authorizedDownloadUrl = authResult.downloadUrl;
      } catch (authErr: any) {
        logger.warn(`[ModelService] Cloud security gateway error, attempting fallback:`, authErr);
        if (target.downloadUrl && target.downloadUrl.startsWith('http')) {
          authorizedDownloadUrl = target.downloadUrl;
        } else {
          throw authErr;
        }
      }

      logger.info(`Starting background download for ${modelId} with temporary authorized URL.`);
      const metadataJson = JSON.stringify(target);
      await ModelNative.startDownload(
        modelId,
        authorizedDownloadUrl,
        target.kind,
        target.sha256 || '',
        target.name || modelId,
        metadataJson
      );
    } catch (e: any) {
      logger.error(`Download error for ${modelId}:`, e);
      this.models = this.models.map(m =>
        m.id === modelId ? { ...m, status: 'FAILED', progress: 0, downloadSpeed: undefined } : m
      );
      this.notifyCatalogUpdated();
      onProgress(this.models.find(m => m.id === modelId)!);
    }
  }

  public async pauseDownload(modelId: string): Promise<void> {
    this.models = this.models.map(m =>
      m.id === modelId ? { ...m, status: 'PAUSED', downloadSpeed: 'Paused' } : m
    );
    const updated = this.models.find(m => m.id === modelId);
    if (updated) {
      const cb = this.progressCallbacks.get(modelId);
      if (cb) cb(updated);
    }
    this.notifyCatalogUpdated();
    try {
      await ModelNative.pauseDownload(modelId);
    } catch (_e) {}
  }

  public async cancelDownload(modelId: string): Promise<void> {
    this.progressCallbacks.delete(modelId);
    this.models = this.models.map(m =>
      m.id === modelId ? { ...m, status: 'NOT_INSTALLED', progress: 0, downloadSpeed: undefined } : m
    );
    this.notifyCatalogUpdated();
    try {
      await ModelNative.cancelDownload(modelId);
    } catch (_e) {}
  }

  public async deleteModel(modelId: string): Promise<boolean> {
    const target = this.models.find(m => m.id === modelId);
    await ModelNative.deleteModel(modelId, target?.kind || '');

    this.models = this.models.map(m =>
      m.id === modelId
        ? { ...m, status: 'NOT_INSTALLED', progress: 0, isActive: false, downloadSpeed: undefined }
        : m
    );
    logger.info(`Deleted model ${modelId}`);
    return true;
  }
}

export const ModelService = new ModelServiceImpl();

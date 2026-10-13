import {
  MemoryRecord,
  MemoryCategory,
  MemoryEvent,
  MemoryEventListener,
  MemoryEventAction,
} from '../../ai/MemoryTypes';
import { LocalLLM } from '../../native/LocalLLM';
import { logger } from '../../utils/logger';

const INITIAL_DEFAULTS: MemoryRecord[] = [
  {
    id: 'mem-default-1',
    category: 'profile',
    title: 'User Profile & Style',
    content: 'User prefers concise, direct, and actionable responses without unnecessary filler.',
    importance: 4,
    isEnabled: true,
    keywords: ['user', 'profile', 'style', 'concise', 'direct', 'actionable'],
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
    lastAccessedAt: Date.now() - 86400000,
    source: 'system',
  },
  {
    id: 'mem-default-2',
    category: 'custom_instruction',
    title: 'Assistant Identity',
    content: 'Sara AI was created and developed by Vlight Group led by Azan Haider. Runs locally offline.',
    importance: 5,
    isEnabled: true,
    keywords: ['sara', 'developer', 'vlight', 'group', 'azan', 'haider', 'creator'],
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
    lastAccessedAt: Date.now() - 86400000,
    source: 'system',
  },
];

const STOP_WORDS = new Set([
  'the', 'is', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'ye', 'yeh', 'hai', 'hain', 'ka', 'ki', 'ke', 'ko', 'mein', 'me', 'main', 'se', 'par',
  'mera', 'meri', 'mere', 'aap', 'tum', 'karo', 'karna', 'kardo', 'kar', 'tha', 'thi', 'the',
  'this', 'that', 'it', 'my', 'your', 'please', 'can', 'you'
]);

export class MemoryManagerImpl {
  private cache: Map<string, MemoryRecord> = new Map();
  private tokenIndex: Map<string, Set<string>> = new Map();
  private categoryIndex: Map<MemoryCategory, Set<string>> = new Map();
  private listeners: Set<MemoryEventListener> = new Set();
  private isInitialized = false;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Initializes the Memory Manager once from persistent storage.
   * Reconstructs in-memory cache and indexes. Subsequent calls return cached state.
   */
  public async init(): Promise<MemoryRecord[]> {
    if (this.isInitialized) {
      return this.getAllMemories();
    }

    try {
      const storedJson = await LocalLLM.loadMemoriesFromStorage();
      if (storedJson && storedJson.trim().length > 0) {
        const parsed = JSON.parse(storedJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const item of parsed) {
            const normalized = this.normalizeRecord(item);
            this.cache.set(normalized.id, normalized);
          }
          logger.info(`[MemoryManager] Loaded ${this.cache.size} memories from storage.`);
        }
      }
    } catch (err) {
      logger.warn('[MemoryManager] Failed to read memories from storage, populating defaults', err);
    }

    // If storage is empty, populate initial defaults
    if (this.cache.size === 0) {
      for (const item of INITIAL_DEFAULTS) {
        this.cache.set(item.id, item);
      }
    }

    // Rebuild indexes in RAM
    this.rebuildIndexes();
    this.isInitialized = true;

    this.emitEvent({
      action: 'MEMORIES_LOADED',
      timestamp: Date.now(),
      metadata: { count: this.cache.size },
    });

    return this.getAllMemories();
  }

  // -------------------------------------------------------------------------
  // Event-Driven Subscriptions
  // -------------------------------------------------------------------------

  public subscribe(listener: MemoryEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitEvent(event: MemoryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        logger.error('[MemoryManager] Error in memory event listener', err);
      }
    }
  }

  // -------------------------------------------------------------------------
  // In-Memory Indexing & Normalization
  // -------------------------------------------------------------------------

  private normalizeTokens(text: string): string[] {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
      .split(/\s+/)
      .map(w => w.trim())
      .filter(w => w.length > 1 && !STOP_WORDS.has(w));
  }

  private normalizeRecord(raw: any): MemoryRecord {
    const id = raw.id || `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const title = (raw.title || 'Untitled Memory').trim();
    const content = (raw.content || '').trim();
    const category: MemoryCategory = raw.category || 'general';
    const importance = typeof raw.importance === 'number' ? Math.max(1, Math.min(5, raw.importance)) : 3;
    const isEnabled = raw.isEnabled !== false;
    const createdAt = raw.createdAt || Date.now();
    const updatedAt = raw.updatedAt || createdAt;
    const lastAccessedAt = raw.lastAccessedAt || updatedAt;
    const source = raw.source || 'explicit_user';
    const keywords = raw.keywords && Array.isArray(raw.keywords) && raw.keywords.length > 0
      ? raw.keywords
      : Array.from(new Set([...this.normalizeTokens(title), ...this.normalizeTokens(content)]));

    return {
      id,
      category,
      title,
      content,
      importance,
      isEnabled,
      keywords,
      createdAt,
      updatedAt,
      lastAccessedAt,
      expiresAt: raw.expiresAt,
      source,
    };
  }

  private rebuildIndexes(): void {
    this.tokenIndex.clear();
    this.categoryIndex.clear();

    for (const record of this.cache.values()) {
      if (!record.isEnabled) continue;
      this.indexRecord(record);
    }
  }

  private indexRecord(record: MemoryRecord): void {
    // 1. Index tokens
    for (const token of record.keywords) {
      if (!this.tokenIndex.has(token)) {
        this.tokenIndex.set(token, new Set());
      }
      this.tokenIndex.get(token)!.add(record.id);
    }

    // 2. Index category
    if (!this.categoryIndex.has(record.category)) {
      this.categoryIndex.set(record.category, new Set());
    }
    this.categoryIndex.get(record.category)!.add(record.id);
  }

  private unindexRecord(record: MemoryRecord): void {
    for (const token of record.keywords) {
      const set = this.tokenIndex.get(token);
      if (set) {
        set.delete(record.id);
        if (set.size === 0) this.tokenIndex.delete(token);
      }
    }
    const catSet = this.categoryIndex.get(record.category);
    if (catSet) {
      catSet.delete(record.id);
    }
  }

  // -------------------------------------------------------------------------
  // Incremental Mutations & Deduplication
  // -------------------------------------------------------------------------

  /**
   * Adds a memory record with automatic deduplication, merging, and event emission.
   */
  public addMemory(
    category: MemoryCategory,
    title: string,
    content: string,
    importance: number = 3,
    source: MemoryRecord['source'] = 'explicit_user'
  ): MemoryRecord {
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    const newTokens = new Set([...this.normalizeTokens(trimmedTitle), ...this.normalizeTokens(trimmedContent)]);

    // 1. Deduplication & Merge Check
    for (const existing of this.cache.values()) {
      if (existing.content.toLowerCase() === trimmedContent.toLowerCase()) {
        // Exact content match -> touch lastAccessedAt & return without duplicating
        existing.lastAccessedAt = Date.now();
        this.emitEvent({ action: 'MEMORY_UPDATED', record: existing, affectedId: existing.id, timestamp: Date.now() });
        this.schedulePersistence();
        return existing;
      }

      // Check keyword overlap
      let overlapCount = 0;
      for (const t of newTokens) {
        if (existing.keywords.includes(t)) overlapCount++;
      }
      const similarity = newTokens.size > 0 ? overlapCount / newTokens.size : 0;

      // If very high similarity (> 75%) and same category -> Merge/Update existing
      if (similarity >= 0.75 && existing.category === category) {
        existing.title = trimmedTitle;
        existing.content = trimmedContent;
        existing.updatedAt = Date.now();
        existing.lastAccessedAt = Date.now();
        existing.keywords = Array.from(new Set([...existing.keywords, ...newTokens]));
        existing.source = 'merged';

        this.unindexRecord(existing);
        this.indexRecord(existing);

        this.emitEvent({
          action: 'MEMORY_MERGED',
          record: existing,
          affectedId: existing.id,
          timestamp: Date.now(),
        });
        this.schedulePersistence();
        logger.info(`[MemoryManager] Merged memory with existing id=${existing.id}`);
        return existing;
      }
    }

    // 2. Create new Record
    const id = `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newRecord: MemoryRecord = {
      id,
      category,
      title: trimmedTitle,
      content: trimmedContent,
      importance,
      isEnabled: true,
      keywords: Array.from(newTokens),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastAccessedAt: Date.now(),
      source,
    };

    this.cache.set(id, newRecord);
    this.indexRecord(newRecord);

    this.emitEvent({
      action: 'MEMORY_ADDED',
      record: newRecord,
      affectedId: id,
      timestamp: Date.now(),
    });

    this.schedulePersistence();
    logger.info(`[MemoryManager] Added new memory id=${id} (title="${trimmedTitle}")`);
    return newRecord;
  }

  public updateMemory(id: string, updates: Partial<Omit<MemoryRecord, 'id' | 'createdAt'>>): void {
    const existing = this.cache.get(id);
    if (!existing) return;

    this.unindexRecord(existing);

    const updatedRecord: MemoryRecord = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    if (updates.title || updates.content) {
      updatedRecord.keywords = Array.from(
        new Set([
          ...this.normalizeTokens(updatedRecord.title),
          ...this.normalizeTokens(updatedRecord.content),
        ])
      );
    }

    this.cache.set(id, updatedRecord);
    if (updatedRecord.isEnabled) {
      this.indexRecord(updatedRecord);
    }

    this.emitEvent({
      action: 'MEMORY_UPDATED',
      record: updatedRecord,
      affectedId: id,
      timestamp: Date.now(),
    });

    this.schedulePersistence();
  }

  public toggleMemory(id: string): void {
    const existing = this.cache.get(id);
    if (!existing) return;

    existing.isEnabled = !existing.isEnabled;
    existing.updatedAt = Date.now();

    if (existing.isEnabled) {
      this.indexRecord(existing);
    } else {
      this.unindexRecord(existing);
    }

    this.emitEvent({
      action: 'MEMORY_UPDATED',
      record: existing,
      affectedId: id,
      timestamp: Date.now(),
    });

    this.schedulePersistence();
  }

  public deleteMemory(id: string): void {
    const existing = this.cache.get(id);
    if (!existing) return;

    this.unindexRecord(existing);
    this.cache.delete(id);

    this.emitEvent({
      action: 'MEMORY_DELETED',
      affectedId: id,
      timestamp: Date.now(),
    });

    this.schedulePersistence();
  }

  public clearAllMemories(): void {
    this.cache.clear();
    this.tokenIndex.clear();
    this.categoryIndex.clear();

    this.emitEvent({
      action: 'MEMORY_INVALIDATED',
      timestamp: Date.now(),
    });

    this.schedulePersistence();
  }

  public getAllMemories(): MemoryRecord[] {
    return Array.from(this.cache.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public getMemory(id: string): MemoryRecord | undefined {
    return this.cache.get(id);
  }

  // -------------------------------------------------------------------------
  // Smart Relevance Retrieval Pipeline
  // -------------------------------------------------------------------------

  /**
   * Intelligently evaluates user query and retrieves ONLY the top relevant memories.
   * Returns empty array if query does not warrant memory, keeping LLM prompt minimal.
   */
  public retrieveRelevantMemories(query: string, maxItems = 3): MemoryRecord[] {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length < 3) return [];

    // Skip retrieval for generic procedural queries or greetings
    if (/^(hi|hello|hey|salam|assalam|ok|okay|theek|good morning|thanks|bye)\b/i.test(trimmed) && trimmed.length < 15) {
      return [];
    }

    const queryTokens = this.normalizeTokens(trimmed);
    if (queryTokens.length === 0) return [];

    const candidateScores = new Map<string, number>();

    // 1. Keyword match scoring via Inverted Index
    for (const token of queryTokens) {
      const matchIds = this.tokenIndex.get(token);
      if (matchIds) {
        for (const id of matchIds) {
          const current = candidateScores.get(id) || 0;
          candidateScores.set(id, current + 2.0);
        }
      }
    }

    // 2. Personal inquiry boost (e.g. "mera", "naam", "kahan", "who am I", "my name", "office")
    const isPersonalQuery = /(?:mera|meri|mere|mujhe|my|who\s*am\s*i|my\s*name|where\s*is\s*my|kahan\s*hai|yaad\s*hai)/i.test(trimmed);

    if (candidateScores.size === 0 && !isPersonalQuery) {
      return [];
    }

    // 3. Final Scoring & Thresholding
    const scoredList: { record: MemoryRecord; score: number }[] = [];
    const now = Date.now();

    for (const [id, baseScore] of candidateScores.entries()) {
      const record = this.cache.get(id);
      if (!record || !record.isEnabled) continue;

      let score = baseScore;

      // Importance weight (1 to 5)
      score += record.importance * 0.4;

      // Category match boost
      if (isPersonalQuery && (record.category === 'profile' || record.category === 'custom_instruction')) {
        score += 2.5;
      }

      // Recency bonus: if accessed or updated within the last 48 hours
      const recencyHours = (now - record.lastAccessedAt) / (1000 * 60 * 60);
      if (recencyHours < 48) {
        score += Math.max(0, 1.5 - recencyHours * 0.03);
      }

      // Relevance threshold: only include confident matches
      if (score >= 2.0) {
        scoredList.push({ record, score });
      }
    }

    scoredList.sort((a, b) => b.score - a.score);
    const topResults = scoredList.slice(0, maxItems).map(item => item.record);

    // Touch lastAccessedAt
    for (const rec of topResults) {
      rec.lastAccessedAt = now;
    }

    return topResults;
  }

  // -------------------------------------------------------------------------
  // Strict Intent Validation (Eliminates Junk Message Saves)
  // -------------------------------------------------------------------------

  /**
   * Strictly determines if a user message explicitly instructs Sara AI to save or remember something.
   * Casual statements ("battery save", "save karni hai", "do you remember") return isExplicit: false.
   */
  public isExplicitMemorySaveCommand(input: string): {
    isExplicit: boolean;
    cleanedContent?: string;
    category?: MemoryCategory;
    title?: string;
  } {
    const raw = input.trim();
    if (raw.length < 3) return { isExplicit: false };

    // 1. Slash Command: /save <content>
    if (raw.toLowerCase().startsWith('/save')) {
      const content = raw.replace(/^\/save\s*[:\-–]?\s*/i, '').trim();
      if (content.length > 2) {
        return {
          isExplicit: true,
          cleanedContent: content,
          category: 'profile',
          title: this.generateCleanTitle(content),
        };
      }
    }

    // 2. Explicit Verbal Command: "save this:", "memory mein save karo:", "isko save karo:"
    const pExplicitSave = /^(?:please\s+)?(?:can\s+you\s+)?(?:(?:memory\s*(?:mein|me|main)\s*)?save\s+(?:this|that|details?|info)|(?:isko|ye|yeh)\s+(?:memory\s*(?:mein|me|main)\s*)?save\s+(?:kar(?:o|lo|dena|na|ein)|rakh(?:o|na))|save\s+to\s+memory)\s*[:\-–,]\s*(.+)$/i;
    const mExplicitSave = raw.match(pExplicitSave);
    if (mExplicitSave && mExplicitSave[1].trim().length > 2) {
      const content = mExplicitSave[1].trim();
      return {
        isExplicit: true,
        cleanedContent: content,
        category: 'profile',
        title: this.generateCleanTitle(content),
      };
    }

    // 3. Explicit Remember Command: "yaad rakhna ki...", "remember that..."
    const pExplicitRemember = /^(?:please\s+)?(?:can\s+you\s+)?(?:yaad\s+rakh(?:na|o|lein|kar\s*rakhna)\s*(?:ki|k)?|remember\s+that)\s*[:\-–,]?\s*(.+)$/i;
    const mExplicitRemember = raw.match(pExplicitRemember);
    if (mExplicitRemember && mExplicitRemember[1].trim().length > 2) {
      const content = mExplicitRemember[1].trim();
      return {
        isExplicit: true,
        cleanedContent: content,
        category: 'profile',
        title: this.generateCleanTitle(content),
      };
    }

    // 4. Suffix Command: "<content>, isko save karo" or "<content>, yaad rakhna"
    const pSuffix = /^(.+?)\s*[,.]?\s*(?:(?:isko|ye)\s+save\s+kar(?:o|lo|dena|na|ein)|save\s+this\s+to\s+memory|yaad\s+rakh(?:na|o|lein))$/i;
    const mSuffix = raw.match(pSuffix);
    if (mSuffix && mSuffix[1].trim().length > 3) {
      const content = mSuffix[1].trim();
      // Ensure the content is not a trivial question
      if (!/^(kia|kya|what|how|why|when|where)\b/i.test(content)) {
        return {
          isExplicit: true,
          cleanedContent: content,
          category: 'profile',
          title: this.generateCleanTitle(content),
        };
      }
    }

    // Otherwise, it is normal conversation -> NEVER save to memory!
    return { isExplicit: false };
  }

  private generateCleanTitle(content: string): string {
    const cleaned = content.replace(/^[:\-–,."'\s]+|[:\-–,."'\s]+$/g, '').trim();
    const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    return capitalized.length > 38 ? capitalized.slice(0, 38) + '...' : capitalized;
  }

  // -------------------------------------------------------------------------
  // Reliable Asynchronous Persistence
  // -------------------------------------------------------------------------

  private schedulePersistence(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(async () => {
      try {
        const records = Array.from(this.cache.values());
        const jsonString = JSON.stringify(records);
        await LocalLLM.saveMemoriesToStorage(jsonString);
        logger.info(`[MemoryManager] Persisted ${records.length} memories to phone storage.`);
      } catch (err) {
        logger.error('[MemoryManager] Failed to persist memories to storage', err);
      }
    }, 300);
  }
}

export const MemoryManager = new MemoryManagerImpl();

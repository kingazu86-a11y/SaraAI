export type MemoryCategory =
  | 'profile'
  | 'preference'
  | 'custom_instruction'
  | 'project'
  | 'app_rule'
  | 'general';

export type MemorySource = 'explicit_user' | 'command' | 'system' | 'merged';

export interface MemoryRecord {
  id: string;
  category: MemoryCategory;
  title: string;
  content: string;
  importance: number; // 1 (low) to 5 (critical)
  isEnabled: boolean;
  keywords: string[]; // Normalized search tokens for indexing
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
  expiresAt?: number; // Optional expiration timestamp
  source: MemorySource;
}

// Backward-compatible alias for existing UI components
export type MemoryItem = MemoryRecord;

export type MemoryEventAction =
  | 'MEMORY_ADDED'
  | 'MEMORY_UPDATED'
  | 'MEMORY_DELETED'
  | 'MEMORY_MERGED'
  | 'MEMORY_INVALIDATED'
  | 'MEMORIES_LOADED';

export interface MemoryEvent {
  action: MemoryEventAction;
  record?: MemoryRecord;
  affectedId?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export type MemoryEventListener = (event: MemoryEvent) => void;

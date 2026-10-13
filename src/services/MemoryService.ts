import { MemoryRecord, MemoryItem, MemoryCategory } from '../ai/MemoryTypes';
import { MemoryManager } from './memory/MemoryManager';

/**
 * MemoryService provides a facade over MemoryManager for seamless backward compatibility.
 * All memory records, indexing, deduplication, and persistence are centrally managed by MemoryManager.
 */
class MemoryServiceImpl {
  public async init(): Promise<MemoryItem[]> {
    return MemoryManager.init();
  }

  public getMemories(): MemoryItem[] {
    return MemoryManager.getAllMemories();
  }

  public addMemory(category: MemoryCategory, title: string, content: string): MemoryItem {
    return MemoryManager.addMemory(category, title, content);
  }

  public updateMemory(id: string, updates: Partial<Omit<MemoryItem, 'id' | 'createdAt'>>): void {
    MemoryManager.updateMemory(id, updates);
  }

  public toggleMemory(id: string): void {
    MemoryManager.toggleMemory(id);
  }

  public deleteMemory(id: string): void {
    MemoryManager.deleteMemory(id);
  }

  public clearAllMemories(): void {
    MemoryManager.clearAllMemories();
  }

  public retrieveRelevantMemories(query: string, maxItems = 3): MemoryItem[] {
    return MemoryManager.retrieveRelevantMemories(query, maxItems);
  }

  public getFormattedMemoryPrompt(): string {
    const enabled = MemoryManager.getAllMemories().filter(m => m.isEnabled);
    if (enabled.length === 0) return '';

    return [
      '### User Memory & Preferences:',
      ...enabled.map(m => `- [${m.title}]: ${m.content}`),
    ].join('\n');
  }
}

export const MemoryService = new MemoryServiceImpl();

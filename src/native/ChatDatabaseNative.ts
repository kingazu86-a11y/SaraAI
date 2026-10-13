import { NativeModules, Platform } from 'react-native';
import { Conversation, Message } from '../ai/AgentTypes';

const { ChatDatabaseModule } = NativeModules;

export interface RawDBSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  isPinned: boolean;
  metadata?: string | null;
}

export interface RawDBMessage {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  timestamp: number;
  msgType?: string;
  mode?: string | null;
  toolCall?: string | null;
  toolResult?: string | null;
  state?: string | null;
  attachment?: string | null;
  attachments?: string | null;
  studioData?: string | null;
  memoryState?: string | null;
  memorySaved?: string | null;
}

export class ChatDatabaseNative {
  private static isAvailable(): boolean {
    return Platform.OS === 'android' && !!ChatDatabaseModule;
  }

  public static async getAllSessions(): Promise<RawDBSession[]> {
    if (!this.isAvailable()) return [];
    try {
      return (await ChatDatabaseModule.getAllSessions()) || [];
    } catch (e) {
      console.warn('[ChatDatabaseNative] getAllSessions error:', e);
      return [];
    }
  }

  public static async getSession(sessionId: string): Promise<RawDBSession | null> {
    if (!this.isAvailable()) return null;
    try {
      return await ChatDatabaseModule.getSession(sessionId);
    } catch (e) {
      console.warn('[ChatDatabaseNative] getSession error:', e);
      return null;
    }
  }

  public static async createSession(session: {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    isPinned?: boolean;
    metadata?: string | null;
  }): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      return await ChatDatabaseModule.createSession(session);
    } catch (e) {
      console.warn('[ChatDatabaseNative] createSession error:', e);
      return false;
    }
  }

  public static async updateSessionTitle(
    sessionId: string,
    newTitle: string,
    updatedAt: number = Date.now()
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      return await ChatDatabaseModule.updateSessionTitle(sessionId, newTitle, updatedAt);
    } catch (e) {
      console.warn('[ChatDatabaseNative] updateSessionTitle error:', e);
      return false;
    }
  }

  public static async deleteSession(sessionId: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      return await ChatDatabaseModule.deleteSession(sessionId);
    } catch (e) {
      console.warn('[ChatDatabaseNative] deleteSession error:', e);
      return false;
    }
  }

  public static async getMessages(
    sessionId: string,
    limit: number = 0,
    offset: number = 0
  ): Promise<RawDBMessage[]> {
    if (!this.isAvailable()) return [];
    try {
      return (await ChatDatabaseModule.getMessages(sessionId, limit, offset)) || [];
    } catch (e) {
      console.warn('[ChatDatabaseNative] getMessages error:', e);
      return [];
    }
  }

  public static async getRecentMessages(
    sessionId: string,
    limit: number = 8
  ): Promise<RawDBMessage[]> {
    if (!this.isAvailable()) return [];
    try {
      return (await ChatDatabaseModule.getRecentMessages(sessionId, limit)) || [];
    } catch (e) {
      console.warn('[ChatDatabaseNative] getRecentMessages error:', e);
      return [];
    }
  }

  public static async getMessagesPaginated(
    sessionId: string,
    limit: number = 20,
    beforeTimestamp: number = 0
  ): Promise<RawDBMessage[]> {
    if (!this.isAvailable()) return [];
    try {
      return (await ChatDatabaseModule.getMessagesPaginated(sessionId, limit, beforeTimestamp)) || [];
    } catch (e) {
      console.warn('[ChatDatabaseNative] getMessagesPaginated error:', e);
      return [];
    }
  }

  public static async insertMessage(sessionId: string, message: RawDBMessage): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      return await ChatDatabaseModule.insertMessage(sessionId, message);
    } catch (e) {
      console.warn('[ChatDatabaseNative] insertMessage error:', e);
      return false;
    }
  }

  public static async updateMessage(message: RawDBMessage): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      return await ChatDatabaseModule.updateMessage(message);
    } catch (e) {
      console.warn('[ChatDatabaseNative] updateMessage error:', e);
      return false;
    }
  }

  public static async updateMessageContent(messageId: string, content: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      return await ChatDatabaseModule.updateMessageContent(messageId, content);
    } catch (e) {
      console.warn('[ChatDatabaseNative] updateMessageContent error:', e);
      return false;
    }
  }

  public static async cleanupEmptyAssistantMessages(): Promise<number> {
    if (!this.isAvailable()) return 0;
    try {
      return (await ChatDatabaseModule.cleanupEmptyAssistantMessages()) || 0;
    } catch (e) {
      console.warn('[ChatDatabaseNative] cleanupEmptyAssistantMessages error:', e);
      return 0;
    }
  }

  public static async deleteMessage(messageId: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      return await ChatDatabaseModule.deleteMessage(messageId);
    } catch (e) {
      console.warn('[ChatDatabaseNative] deleteMessage error:', e);
      return false;
    }
  }
}

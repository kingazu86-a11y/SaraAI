import { Conversation, Message, MessageRole, MessageType, ChatStudioMode, AssistantState, MemorySaveStatus } from '../ai/AgentTypes';
import { ChatDatabaseNative, RawDBSession, RawDBMessage } from '../native/ChatDatabaseNative';
import { logger } from '../utils/logger';

export class ChatStorageService {
  private static parseJsonSafely<T>(str?: string | null): T | undefined {
    if (!str) return undefined;
    try {
      return JSON.parse(str);
    } catch {
      return undefined;
    }
  }

  private static messageToRaw(sessionId: string, msg: Message): RawDBMessage {
    return {
      id: msg.id,
      sessionId,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      msgType: msg.msgType || 'chat',
      mode: msg.mode || null,
      toolCall: msg.toolCall ? JSON.stringify(msg.toolCall) : null,
      toolResult: msg.toolResult ? JSON.stringify(msg.toolResult) : null,
      state: msg.state || null,
      attachment: msg.attachment ? JSON.stringify(msg.attachment) : null,
      attachments: msg.attachments ? JSON.stringify(msg.attachments) : null,
      studioData: msg.studioData ? JSON.stringify(msg.studioData) : null,
      memoryState: msg.memoryState || null,
      memorySaved: msg.memorySaved ? JSON.stringify(msg.memorySaved) : null,
    };
  }

  private static rawToMessage(raw: RawDBMessage): Message {
    return {
      id: raw.id,
      role: raw.role as MessageRole,
      content: raw.content || '',
      timestamp: raw.timestamp,
      msgType: (raw.msgType as MessageType) || 'chat',
      mode: (raw.mode as ChatStudioMode) || undefined,
      toolCall: ChatStorageService.parseJsonSafely(raw.toolCall),
      toolResult: ChatStorageService.parseJsonSafely(raw.toolResult),
      state: (raw.state as AssistantState) || undefined,
      attachment: ChatStorageService.parseJsonSafely(raw.attachment),
      attachments: ChatStorageService.parseJsonSafely(raw.attachments),
      studioData: ChatStorageService.parseJsonSafely(raw.studioData),
      memoryState: (raw.memoryState as MemorySaveStatus) || undefined,
      memorySaved: ChatStorageService.parseJsonSafely(raw.memorySaved),
    };
  }

  /**
   * Initializes local storage. Retrieves all sessions from SQLite.
   * If none exist, initializes a default session.
   */
  public static async init(): Promise<{ sessions: Conversation[]; activeSession: Conversation }> {
    try {
      // Clean up any stale or empty assistant messages left by interrupted generations
      try {
        const cleaned = await ChatDatabaseNative.cleanupEmptyAssistantMessages();
        if (cleaned > 0) {
          logger.info(`[ChatStorageService] Purged ${cleaned} stale/empty assistant placeholders from SQLite.`);
        }
      } catch (err) {
        logger.warn('[ChatStorageService] Warning during initial cleanup:', err);
      }

      const rawSessions = await ChatDatabaseNative.getAllSessions();

      if (rawSessions.length === 0) {
        // First run or empty database: create initial session
        const initialSession: Conversation = {
          id: `conv-${Date.now()}`,
          title: 'New conversation',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isPinned: false,
          messages: [],
        };

        await ChatDatabaseNative.createSession({
          id: initialSession.id,
          title: initialSession.title,
          createdAt: initialSession.createdAt,
          updatedAt: initialSession.updatedAt,
          isPinned: initialSession.isPinned,
        });

        logger.info(`[ChatStorageService] Initialized new default session: ${initialSession.id}`);
        return {
          sessions: [initialSession],
          activeSession: initialSession,
        };
      }

      // Restore sessions sorted by updatedAt DESC
      const sessions: Conversation[] = rawSessions.map(s => ({
        id: s.id,
        title: s.title,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        isPinned: s.isPinned,
        messages: [],
      }));

      // Load ONLY the initial visible page of messages (20 messages) for the primary session
      const primarySession = sessions[0];
      const primaryMessages = await this.loadSessionMessagesPaginated(primarySession.id, 20);
      primarySession.messages = primaryMessages;

      logger.info(
        `[ChatStorageService] Restored ${sessions.length} sessions from SQLite. Loaded visible initial page (${primaryMessages.length} messages) for session ${primarySession.id}`
      );

      return {
        sessions,
        activeSession: primarySession,
      };
    } catch (err) {
      logger.error('[ChatStorageService] Error during init', err);
      const fallbackSession: Conversation = {
        id: `conv-${Date.now()}`,
        title: 'New conversation',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
      };
      return {
        sessions: [fallbackSession],
        activeSession: fallbackSession,
      };
    }
  }

  /**
   * Loads messages for a specific session using cursor-based pagination.
   * If beforeTimestamp is provided, loads messages older than that timestamp.
   * Otherwise loads the latest limit messages.
   * Results are returned in chronological order (ASC).
   */
  public static async loadSessionMessagesPaginated(
    sessionId: string,
    limit: number = 20,
    beforeTimestamp?: number
  ): Promise<Message[]> {
    try {
      const rawMessages = await ChatDatabaseNative.getMessagesPaginated(
        sessionId,
        limit,
        beforeTimestamp ?? 0
      );
      return rawMessages
        .map(this.rawToMessage)
        .filter(m => m.role !== 'assistant' || (m.content && m.content.trim().length > 0));
    } catch (e) {
      logger.error(`[ChatStorageService] Failed to load paginated messages for ${sessionId}`, e);
      return [];
    }
  }

  /**
   * Loads all valid messages for a specific session in chronological order.
   */
  public static async loadSessionMessages(sessionId: string): Promise<Message[]> {
    try {
      const rawMessages = await ChatDatabaseNative.getMessages(sessionId, 0, 0);
      return rawMessages
        .map(this.rawToMessage)
        .filter(m => m.role !== 'assistant' || (m.content && m.content.trim().length > 0));
    } catch (e) {
      logger.error(`[ChatStorageService] Failed to load messages for ${sessionId}`, e);
      return [];
    }
  }

  /**
   * Retrieves the most recent N valid messages for context construction before inference.
   */
  public static async getRecentMessages(sessionId: string, limit: number = 3): Promise<Message[]> {
    try {
      const rawMessages = await ChatDatabaseNative.getRecentMessages(sessionId, limit);
      return rawMessages
        .map(this.rawToMessage)
        .filter(m => m.role !== 'assistant' || (m.content && m.content.trim().length > 0));
    } catch (e) {
      logger.error(`[ChatStorageService] Failed to get recent messages for ${sessionId}`, e);
      return [];
    }
  }

  /**
   * Persists a newly created conversation session.
   */
  public static async createSession(conv: Conversation): Promise<boolean> {
    try {
      return await ChatDatabaseNative.createSession({
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        isPinned: conv.isPinned,
      });
    } catch (e) {
      logger.error(`[ChatStorageService] Failed to create session ${conv.id}`, e);
      return false;
    }
  }

  /**
   * Updates session title and updatedAt timestamp.
   */
  public static async updateSessionTitle(
    sessionId: string,
    newTitle: string,
    updatedAt: number = Date.now()
  ): Promise<boolean> {
    try {
      return await ChatDatabaseNative.updateSessionTitle(sessionId, newTitle, updatedAt);
    } catch (e) {
      logger.error(`[ChatStorageService] Failed to update title for ${sessionId}`, e);
      return false;
    }
  }

  /**
   * Deletes a session and all its associated messages from SQLite.
   */
  public static async deleteSession(sessionId: string): Promise<boolean> {
    try {
      return await ChatDatabaseNative.deleteSession(sessionId);
    } catch (e) {
      logger.error(`[ChatStorageService] Failed to delete session ${sessionId}`, e);
      return false;
    }
  }

  /**
   * Writes a message to SQLite.
   */
  public static async saveMessage(sessionId: string, message: Message): Promise<boolean> {
    try {
      const raw = this.messageToRaw(sessionId, message);
      return await ChatDatabaseNative.insertMessage(sessionId, raw);
    } catch (e) {
      logger.error(`[ChatStorageService] Failed to save message ${message.id}`, e);
      return false;
    }
  }

  /**
   * Updates message details (e.g. streaming finished, metadata added).
   */
  public static async updateMessage(sessionId: string, message: Message): Promise<boolean> {
    try {
      const raw = this.messageToRaw(sessionId, message);
      return await ChatDatabaseNative.updateMessage(raw);
    } catch (e) {
      logger.error(`[ChatStorageService] Failed to update message ${message.id}`, e);
      return false;
    }
  }

  /**
   * Updates only message content.
   */
  public static async updateMessageContent(messageId: string, content: string): Promise<boolean> {
    try {
      return await ChatDatabaseNative.updateMessageContent(messageId, content);
    } catch (e) {
      logger.error(`[ChatStorageService] Failed to update message content ${messageId}`, e);
      return false;
    }
  }
}

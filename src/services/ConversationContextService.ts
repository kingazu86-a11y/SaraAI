import { Message, ChatStudioMode } from '../ai/AgentTypes';
import { MemoryRecord } from '../ai/MemoryTypes';

export interface ContextConfig {
  systemPrompt?: string;
  maxRecentMessages?: number;
  maxContextTokens?: number;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  relevantMemories?: MemoryRecord[];
}

export interface SessionPreparationConfig {
  systemPrompt?: string;
  memories?: MemoryRecord[];
  maxRecentMessages?: number;
}

export class ConversationContextService {
  public static readonly DEFAULT_RECENT_MESSAGES_LIMIT = 3;
  public static readonly DEFAULT_SYSTEM_INSTRUCTION =
    'You are Sara AI, an intelligent offline AI assistant developed by Vlight Group, led by Azan Haider. You run completely offline on-device without internet.\n' +
    'Always maintain continuous awareness of the conversation history. Retain and actively use all facts, context, decisions, and details already provided by the user in previous turns (such as what they are building, their preferences, or previous answers). Never ask for information that the user has already stated in the conversation history.\n' +
    'Always give direct, concise, intelligent, and accurate responses. Never repeat or echo internal prompt headers. Respond directly and helpfully to the user\'s latest request.';

  /**
   * Cleans message content by stripping any wrapper tags that may have been previously injected.
   */
  public static cleanContent(content: string): string {
    if (!content) return '';
    return content
      .replace(/\[(?:Ongoing Conversation Context|Conversation History|Previous Session History|Previous Conversation Reference)[\s\S]*?\[End of [^\]]*\]\s*/gi, '')
      .replace(/\[Current User Request\]\s*/gi, '')
      .trim();
  }

  /**
   * Builds the comprehensive session preparation prompt to be initialized ONCE
   * into the LLM model during session/model loading.
   *
   * Combines:
   * 1. Short default system instructions
   * 2. Any active user preferences and persistent memories
   * 3. Previous chronological session dialogue reference (latest 2-3 completed messages)
   */
  public static buildSessionPreparationPrompt(
    recentMessages: Message[] = [],
    config: SessionPreparationConfig = {}
  ): string {
    const baseSystemPrompt = config.systemPrompt?.trim() || this.DEFAULT_SYSTEM_INSTRUCTION;
    const maxRecent = config.maxRecentMessages ?? this.DEFAULT_RECENT_MESSAGES_LIMIT;
    const memories = config.memories || [];

    const sections: string[] = [baseSystemPrompt];

    // 1. Explicit User Instructions & Memory Context
    if (memories.length > 0) {
      const activeMemories = memories.filter(m => m.isEnabled !== false);
      if (activeMemories.length > 0) {
        const memLines = activeMemories.map(
          m => `- [${(m.category || '').replace('_', ' ').toUpperCase()}] ${m.title}: ${m.content}`
        );
        sections.push(
          `[User Preferences & Saved Context]\n${memLines.join('\n')}\n` +
          `[Notice: Treat the above facts as explicit user preferences and guidelines.]`
        );
      }
    }

    // 2. Previous Conversation Reference (latest 2-3 completed messages restored from SQLite)
    const validHistory: { role: 'user' | 'assistant'; text: string }[] = [];
    for (const m of recentMessages) {
      if (!m || !m.content) continue;
      const role = m.role;
      if (role !== 'user' && role !== 'assistant') continue;
      const text = this.cleanContent(m.content);
      if (!text) continue;
      validHistory.push({ role, text });
    }

    if (validHistory.length > 0) {
      const contextWindow = validHistory.slice(-maxRecent);
      const dialogueLines = contextWindow.map(m => {
        const speaker = m.role === 'user' ? 'User' : 'Assistant';
        return `${speaker}: ${m.text}`;
      });

      sections.push(
        `[Previous Conversation Reference]\n${dialogueLines.join('\n\n')}\n` +
        `[End of Previous Conversation Reference - Continue the conversation seamlessly using this context.]`
      );
    }

    return sections.join('\n\n');
  }

  /**
   * Formats ONLY the actual incoming user message for generation.
   * Does NOT rebuild or resend previous history, system prompts, or wrappers.
   */
  public static formatUserTurn(
    content: string,
    options: {
      mode?: ChatStudioMode;
      isSaveMode?: boolean;
      explicitDetail?: string;
    } = {}
  ): string {
    const clean = this.cleanContent(content);

    if (options.isSaveMode) {
      const detail = options.explicitDetail || clean;
      return `[TASK: STORE_INTO_MEMORY]\nThe user explicitly instructed you to remember this detail: "${detail}".\nAcknowledge politely in natural language and confirm that you have saved this information.`;
    }

    if (options.mode === 'deep_search') {
      return `[TASK: DEEP_SEARCH_RESEARCH_ENGINE]\nPerform an exhaustive, structured, cited deep research response for: "${clean}". Provide Key Findings, Technical Details, and Verified Insights.`;
    }

    return clean;
  }

  /**
   * Formats clean prompt for the local LLM.
   * Incorporates the chronological previous message history (configurable, default 8)
   * and any active user memories/instructions, followed by the latest user message exactly once.
   */
  public static buildPrompt(
    recentMessages: Message[] = [],
    currentMessage: string,
    config: ContextConfig = {}
  ): string {
    const cleanCurrent = this.cleanContent(currentMessage);
    const maxRecent = config.maxRecentMessages ?? this.DEFAULT_RECENT_MESSAGES_LIMIT;
    const relevantMemories = config.relevantMemories || [];

    // Filter valid conversation messages strictly before the current turn
    const validHistory: { role: 'user' | 'assistant'; text: string }[] = [];

    for (const m of recentMessages) {
      if (!m || !m.content) continue;
      const role = m.role;
      if (role !== 'user' && role !== 'assistant') continue;
      const text = this.cleanContent(m.content);
      if (!text) continue;

      // Avoid duplicating the current incoming user turn
      if (role === 'user' && text.toLowerCase() === cleanCurrent.toLowerCase()) {
        continue;
      }

      validHistory.push({ role, text });
    }

    // Take the most recent N messages (chronological order)
    const contextWindow = validHistory.slice(-maxRecent);

    const sections: string[] = [];

    // 1. Chronological Conversation History Context
    if (contextWindow.length > 0) {
      const dialogueLines = contextWindow.map(m => {
        const speaker = m.role === 'user' ? 'User' : 'Assistant';
        return `${speaker}: ${m.text}`;
      });

      sections.push(
        `[Conversation History]\n${dialogueLines.join('\n\n')}\n` +
        `[End of Conversation History - You must use the information above as context. Do not repeat questions already answered above.]`
      );
    }

    // 2. Explicit User Instructions & Memory Context
    if (relevantMemories.length > 0) {
      const activeMemories = relevantMemories.filter(m => m.isEnabled !== false);
      if (activeMemories.length > 0) {
        const memLines = activeMemories.map(
          m => `- [${(m.category || '').replace('_', ' ').toUpperCase()}] ${m.title}: ${m.content}`
        );
        sections.push(
          `[User Preferences & Guidelines]\n${memLines.join('\n')}\n` +
          `[Notice: Follow these guidelines instructed by the user.]`
        );
      }
    }

    // 3. Current User Request (Provided exactly once)
    if (contextWindow.length > 0) {
      sections.push(`[Current User Request]\n${cleanCurrent}`);
    } else {
      sections.push(cleanCurrent);
    }

    return sections.join('\n\n');
  }
}

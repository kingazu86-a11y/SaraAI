import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import {
  AssistantState,
  Message,
  MessageType,
  MemorySaveStatus,
  Conversation,
  ToolCallData,
  ToolResultData,
  InferenceBackend,
  SafetyConfirmationRequest,
  AssistantCustomization,
  ChatStudioMode,
  MediaAttachment,
  StudioArtifactData,
} from '../ai/AgentTypes';
import { NativePermissionsMap } from '../native/AndroidNativeTypes';
import { DownloadableModel } from '../ai/ModelCatalog';
import { MemoryItem, MemoryCategory } from '../ai/MemoryTypes';
import { NativeStorageInfo } from '../native/ModelNative';
import { darkColors, lightColors, ThemeColors } from '../theme/colors';
import { SystemBarNative } from '../native/SystemBarNative';
import { ModelService, PaginatedResult } from '../services/ModelService';
import { PermissionService } from '../services/PermissionService';
import { MemoryService } from '../services/MemoryService';
import { MemoryManager } from '../services/memory/MemoryManager';
import { AssistantService } from '../services/AssistantService';
import { LocalLLM } from '../native/LocalLLM';
import { ConversationContextService } from '../services/ConversationContextService';
import { ChatStorageService } from '../services/ChatStorageService';
import { logger } from '../utils/logger';

export type ActiveModalType =
  | 'none'
  | 'settings'
  | 'customization'
  | 'model_manager'
  | 'permission_setup'
  | 'memory_manager'
  | 'voice_panel'
  | 'voice_pack_setup'
  | 'actions_sheet'
  | 'camera_modal'
  | 'image_picker_modal';

interface AssistantContextType {
  // State machine & Active session
  state: AssistantState;
  conversations: Conversation[];
  activeConversationId: string;
  activeConversation: Conversation;
  currentToolCall: ToolCallData | null;

  // Onboarding
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => void;
  resetOnboarding: () => void;

  // Feature Switches
  isAssistantEnabled: boolean;
  toggleAssistantMasterSwitch: () => void;
  isAccessibilityAutomationEnabled: boolean;
  toggleAccessibilityAutomation: () => Promise<void>;
  isMemoryEnabled: boolean;
  toggleMemoryMasterSwitch: () => void;

  // Multi-Model Management
  models: DownloadableModel[];
  activeTextModel: DownloadableModel | null;
  activeVoiceModel: DownloadableModel | null;
  activeTTSModel: DownloadableModel | null;
  storageInfo: NativeStorageInfo;
  fetchModelsFromBackend: (params?: { page?: number; limit?: number; search?: string; kind?: string; forceRefresh?: boolean }) => Promise<PaginatedResult<DownloadableModel>>;
  fetchVoicePacksFromBackend: (params?: { page?: number; limit?: number; search?: string; forceRefresh?: boolean }) => Promise<PaginatedResult<DownloadableModel>>;
  startDownloadModel: (id: string) => void;
  pauseDownloadModel: (id: string) => void;
  cancelDownloadModel: (id: string) => void;
  deleteModel: (id: string) => void;
  setActiveModel: (id: string) => void;

  // Memory System
  memories: MemoryItem[];
  addMemory: (category: MemoryCategory, title: string, content: string) => void;
  toggleMemory: (id: string) => void;
  deleteMemory: (id: string) => void;
  clearAllMemories: () => void;

  // Theme & UI
  themeMode: 'dark' | 'light';
  theme: ThemeColors;
  toggleThemeMode: () => void;
  setThemeMode: (mode: 'dark' | 'light') => void;
  isSidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;

  // Modals
  activeModal: ActiveModalType;
  openModal: (modal: ActiveModalType) => void;
  closeModal: () => void;

  // Conversation Session Management
  createNewConversation: () => void | Promise<void>;
  selectConversation: (id: string) => void | Promise<void>;
  renameConversation: (id: string, newTitle: string) => void | Promise<void>;
  deleteConversation: (id: string) => void | Promise<void>;
  hasMoreOlderMessages: boolean;
  isLoadingOlderMessages: boolean;
  loadOlderMessages: () => Promise<void>;

  // Customization & Settings
  customization: AssistantCustomization;
  updateCustomization: (updates: Partial<AssistantCustomization>) => void;
  permissions: NativePermissionsMap;
  isServiceRunning: boolean;
  maxSteps: number;
  confirmationRequest: SafetyConfirmationRequest | null;
  isGenerating: boolean;
  loadedModelId: string | null;
  loadingModelText: string | null;
  isModelSwitching: boolean;
  switchingModelId: string | null;

  // Chat Mode & Mini Commands
  chatMode: 'chat' | 'memory';
  setChatMode: (mode: 'chat' | 'memory') => void;

  // Studio Modes & Creation Switches
  isDeepSearchActive: boolean;
  toggleDeepSearch: () => void;
  isCreateImageActive: boolean;
  toggleCreateImage: () => void;
  isCreateAudioActive: boolean;
  toggleCreateAudio: () => void;
  isCreateVideoActive: boolean;
  toggleCreateVideo: () => void;
  clearActiveModes: () => void;
  activeAttachment: MediaAttachment | null;
  setActiveAttachment: (attachment: MediaAttachment | null) => void;
  activeAttachments: MediaAttachment[];
  addAttachment: (attachment: MediaAttachment) => void;
  addAttachments: (attachments: MediaAttachment[]) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;

  // Actions
  sendCommand: (command: string) => Promise<void>;
  stopGeneration: () => Promise<void>;
  startVoiceListening: () => void;
  stopVoiceListening: () => void;
  setBackend: (backend: InferenceBackend) => Promise<void>;
  setMaxSteps: (steps: number) => void;
  toggleAssistantService: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
  dismissConfirmation: () => void;
}

const AssistantContext = createContext<AssistantContextType | undefined>(undefined);

const INITIAL_CONVERSATION_ID = 'conv-initial';
const INITIAL_CONVERSATION: Conversation = {
  id: INITIAL_CONVERSATION_ID,
  title: 'New conversation',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  messages: [],
};

export const AssistantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModalType>('none');
  const [state, setState] = useState<AssistantState>('idle');
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(false);

  // Multi-Model State (Default: 0 models installed)
  const [models, setModels] = useState<DownloadableModel[]>(ModelService.getModels());
  const [storageInfo, setStorageInfo] = useState<NativeStorageInfo>({
    availableBytes: 1024 * 1024 * 1024 * 14,
    totalBytes: 1024 * 1024 * 1024 * 64,
    modelsUsedBytes: 0,
  });

  // Active Text-to-Text (TTT) LLM - strictly text reasoning models (never voice packs)
  const activeTextModel =
    models.find(m => m.kind === 'text' && m.isActive && m.status === 'READY') || null;

  // Active Combined Voice Pack (STT + TTS)
  const activeVoiceModel =
    models.find(
      m => (m.kind === 'voice_pack' || m.kind === 'voice_ai' || m.kind === 'stt') && m.isActive && m.status === 'READY'
    ) || null;

  const activeTTSModel =
    models.find(
      m => (m.kind === 'voice_pack' || m.kind === 'voice_ai' || m.kind === 'tts') && m.isActive && m.status === 'READY'
    ) || null;

  // Feature Switches: By default Assistant is inactive until voice model is installed & enabled
  const [isAssistantEnabled, setIsAssistantEnabled] = useState<boolean>(false);
  const [isAccessibilityAutomationEnabled, setIsAccessibilityAutomationEnabled] = useState<boolean>(false);
  const [isMemoryEnabled, setIsMemoryEnabled] = useState<boolean>(true);

  // Local LLM State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [loadedModelId, setLoadedModelId] = useState<string | null>(null);
  const [loadingModelText, setLoadingModelText] = useState<string | null>(null);

  // User Memory State
  const [memories, setMemories] = useState<MemoryItem[]>(MemoryService.getMemories());

  // Chat Mode: 'chat' for standard conversation, 'memory' for organizing and saving to storage
  const [chatMode, setChatMode] = useState<'chat' | 'memory'>('chat');
  const chatModeRef = useRef<'chat' | 'memory'>(chatMode);
  chatModeRef.current = chatMode;

  // Studio Modes & Creation Switches
  const [isDeepSearchActive, setIsDeepSearchActive] = useState<boolean>(false);
  const [isCreateImageActive, setIsCreateImageActive] = useState<boolean>(false);
  const [isCreateAudioActive, setIsCreateAudioActive] = useState<boolean>(false);
  const [isCreateVideoActive, setIsCreateVideoActive] = useState<boolean>(false);
  const [activeAttachments, setActiveAttachments] = useState<MediaAttachment[]>([]);
  const activeAttachment = activeAttachments[0] || null;
  const setActiveAttachment = (attachment: MediaAttachment | null) => {
    setActiveAttachments(attachment ? [attachment] : []);
  };
  const addAttachment = (attachment: MediaAttachment) => {
    setActiveAttachments(prev => [...prev, attachment]);
  };
  const addAttachments = (attachments: MediaAttachment[]) => {
    setActiveAttachments(prev => [...prev, ...attachments]);
  };
  const removeAttachment = (id: string) => {
    setActiveAttachments(prev => prev.filter(a => a.id !== id));
  };
  const clearAttachments = () => {
    setActiveAttachments([]);
  };

  const toggleDeepSearch = () => setIsDeepSearchActive(prev => !prev);
  const toggleCreateImage = () => {
    setIsCreateImageActive(prev => {
      const next = !prev;
      if (next) {
        setIsCreateAudioActive(false);
        setIsCreateVideoActive(false);
      }
      return next;
    });
  };
  const toggleCreateAudio = () => {
    setIsCreateAudioActive(prev => {
      const next = !prev;
      if (next) {
        setIsCreateImageActive(false);
        setIsCreateVideoActive(false);
      }
      return next;
    });
  };
  const toggleCreateVideo = () => {
    setIsCreateVideoActive(prev => {
      const next = !prev;
      if (next) {
        setIsCreateImageActive(false);
        setIsCreateAudioActive(false);
      }
      return next;
    });
  };
  const clearActiveModes = () => {
    setIsDeepSearchActive(false);
    setIsCreateImageActive(false);
    setIsCreateAudioActive(false);
    setIsCreateVideoActive(false);
    setActiveAttachments([]);
  };

  // Multi-session conversations & Pagination
  const [conversations, setConversations] = useState<Conversation[]>([INITIAL_CONVERSATION]);
  const [activeConversationId, setActiveConversationId] = useState<string>(INITIAL_CONVERSATION_ID);
  const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState<boolean>(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState<boolean>(false);
  const activeRespIdRef = useRef<string | null>(null);
  const activeConversationIdRef = useRef<string>(activeConversationId);
  activeConversationIdRef.current = activeConversationId;
  const accumulatedAssistantTextRef = useRef<string>('');
  const lastDbSaveTimeRef = useRef<number>(0);
  const activeMemoryNoticeRef = useRef<{
    title: string;
    category: string;
    content?: string;
    state: 'saving' | 'saved';
    isMemoryMode: boolean;
  } | null>(null);

  const conversationsRef = useRef<Conversation[]>(conversations);
  conversationsRef.current = conversations;
  const preparedSessionIdRef = useRef<string | null>(null);
  const isPreparingSessionRef = useRef<boolean>(false);
  const loadedModelIdRef = useRef<string | null>(null);
  loadedModelIdRef.current = loadedModelId;
  const isMemoryEnabledRef = useRef<boolean>(isMemoryEnabled);
  isMemoryEnabledRef.current = isMemoryEnabled;
  const memoriesRef = useRef<MemoryItem[]>(memories);
  memoriesRef.current = memories;

  const buildSystemPromptWithMemory = (_enabled: boolean, _memList: MemoryItem[]) => {
    return (
      'You are Sara AI, an intelligent, fast offline AI assistant developed by Vlight Group, led by Azan Haider. You run completely offline and locally on this device without internet.\n' +
      'Always maintain continuous awareness of the ongoing conversation history. Retain and actively use all facts, context, decisions, and details already provided by the user in previous turns (such as what they are building, their preferences, or previous answers). Never ask for information that the user has already stated in the conversation history.\n' +
      'Always give direct, concise, intelligent, and accurate responses. Never repeat or echo internal prompt headers. Respond directly and helpfully to the user\'s latest request.\n' +
      'When user instructions, preferences, or saved facts are provided in the prompt context, treat them as explicit guidelines provided by the user to follow.'
    );
  };

  /**
   * Prepares a session once inside the native LLM model:
   * 1. Retrieves strictly the latest 2-3 completed messages from SQLite for this session
   * 2. Builds the session context (short system prompt + user memories + 2-3 reference messages)
   * 3. Initializes native chat engine once, preloading the context into the KV cache.
   */
  const prepareSessionInModel = useCallback(
    async (sessionId: string): Promise<void> => {
      if (!loadedModelIdRef.current) {
        logger.info(`[AssistantStore] Model not loaded yet, skipping session preparation for ${sessionId}.`);
        return;
      }
      if (preparedSessionIdRef.current === sessionId && !isPreparingSessionRef.current) {
        return;
      }

      try {
        isPreparingSessionRef.current = true;
        logger.info(`[AssistantStore] Preparing session context for ${sessionId} in model ${loadedModelIdRef.current}...`);

        // Strictly fetch the latest 3 completed messages directly from SQLite for this specific session
        let recentReferenceMessages: Message[] = [];
        try {
          recentReferenceMessages = await ChatStorageService.getRecentMessages(sessionId, 3);
        } catch (e) {
          logger.warn(`[AssistantStore] Could not load recent reference messages for session ${sessionId}`, e);
          recentReferenceMessages = [];
        }

        const sysPrompt = buildSystemPromptWithMemory(isMemoryEnabledRef.current, memoriesRef.current);
        const sessionPrompt = ConversationContextService.buildSessionPreparationPrompt(
          recentReferenceMessages,
          {
            systemPrompt: sysPrompt,
            memories: isMemoryEnabledRef.current ? memoriesRef.current : [],
            maxRecentMessages: 3,
          }
        );

        await LocalLLM.resetChat(sessionPrompt).catch(() => {});
        preparedSessionIdRef.current = sessionId;
        logger.info(`[AssistantStore] Session ${sessionId} successfully prepared with ${recentReferenceMessages.length} reference messages in model KV cache.`);
      } catch (err) {
        logger.error(`[AssistantStore] Error preparing session ${sessionId} in model`, err);
      } finally {
        isPreparingSessionRef.current = false;
      }
    },
    []
  );

  /**
   * Progressively loads older messages from SQLite when the user scrolls upward.
   */
  const loadOlderMessages = useCallback(async () => {
    const currentId = activeConversationIdRef.current;
    if (!currentId || isLoadingOlderMessages || !hasMoreOlderMessages) {
      return;
    }

    const currentConv = conversationsRef.current.find(c => c.id === currentId);
    const currentMsgs = currentConv?.messages || [];
    if (currentMsgs.length === 0) {
      setHasMoreOlderMessages(false);
      return;
    }

    const oldestTimestamp = currentMsgs[0].timestamp;
    setIsLoadingOlderMessages(true);
    logger.info(`[AssistantStore] Loading older messages before timestamp ${oldestTimestamp} for session ${currentId}...`);

    try {
      const olderMsgs = await ChatStorageService.loadSessionMessagesPaginated(
        currentId,
        20,
        oldestTimestamp
      );

      if (olderMsgs.length === 0) {
        setHasMoreOlderMessages(false);
      } else {
        if (olderMsgs.length < 20) {
          setHasMoreOlderMessages(false);
        }
        setConversations(prev =>
          prev.map(c => {
            if (c.id === currentId) {
              const existingIds = new Set(c.messages.map(m => m.id));
              const uniqueOlder = olderMsgs.filter(m => !existingIds.has(m.id));
              return {
                ...c,
                messages: [...uniqueOlder, ...c.messages],
              };
            }
            return c;
          })
        );
        logger.info(`[AssistantStore] Loaded and prepended ${olderMsgs.length} older messages for session ${currentId}.`);
      }
    } catch (err) {
      logger.error('[AssistantStore] Failed to load older messages', err);
    } finally {
      setIsLoadingOlderMessages(false);
    }
  }, [hasMoreOlderMessages, isLoadingOlderMessages]);

  const [currentToolCall, setCurrentToolCall] = useState<ToolCallData | null>(null);
  const [permissions, setPermissions] = useState<NativePermissionsMap>({
    microphone: false,
    accessibility: false,
    notifications: false,
    batteryOptimization: false,
    storage: false,
  });
  const [isServiceRunning, setIsServiceRunning] = useState<boolean>(false);
  const [maxSteps, setMaxStepsState] = useState<number>(10);
  const [confirmationRequest, setConfirmationRequest] = useState<SafetyConfirmationRequest | null>(null);

  const [customization, setCustomization] = useState<AssistantCustomization>({
    assistantName: 'Assistant',
    personality: 'Professional',
    responseStyle: 'Balanced',
    autonomyLevel: 'Ask Before Sensitive',
    voiceEnabled: false,
  });

  const hasActiveVoice = Boolean(activeVoiceModel);
  const hasActiveText = Boolean(activeTextModel);

  // Auto-disable assistant if active voice pack or active text model is missing
  useEffect(() => {
    if ((!hasActiveVoice || !hasActiveText) && isAssistantEnabled) {
      setIsAssistantEnabled(false);
      logger.warn('AI Assistant disabled because active voice pack or TTT LLM is missing');
    }
  }, [hasActiveVoice, hasActiveText, isAssistantEnabled]);

  // Initialize memories from phone storage on startup & subscribe to event bus
  useEffect(() => {
    MemoryManager.init()
      .then(stored => {
        setMemories(stored);
      })
      .catch(() => {});

    const unsub = MemoryManager.subscribe(event => {
      logger.info(`[AssistantStore] Memory event received: ${event.action}`);
      setMemories(MemoryManager.getAllMemories());
    });

    return () => unsub();
  }, []);

  // Initialize SQLite Chat Storage on startup: restore all sessions and load active session messages
  useEffect(() => {
    ChatStorageService.init()
      .then(({ sessions, activeSession }) => {
        setConversations(sessions);
        setActiveConversationId(activeSession.id);
        activeConversationIdRef.current = activeSession.id;
        setHasMoreOlderMessages(activeSession.messages.length >= 20);

        // If model is already loaded in RAM, prepare this active session immediately
        if (loadedModelIdRef.current) {
          prepareSessionInModel(activeSession.id);
        }
      })
      .catch(err => {
        logger.error('[AssistantStore] Failed to initialize SQLite chat storage', err);
      });
  }, [prepareSessionInModel]);

  const extractMemoryJson = (text: string): { payload: { action: string; category?: MemoryCategory; title?: string; content?: string }; cleanText: string } | null => {
    // 1. Check for markdown json code block: ```json ... ```
    const codeBlockRegex = /```(?:json)?\s*(\{[\s\S]*?"action"\s*:\s*"save_memory"[\s\S]*?\})\s*```/i;
    const matchBlock = text.match(codeBlockRegex);
    if (matchBlock) {
      try {
        const parsed = JSON.parse(matchBlock[1]);
        const cleanText = text.replace(codeBlockRegex, '').trim();
        return { payload: parsed, cleanText };
      } catch {}
    }

    // 2. Check for raw JSON object with "action": "save_memory"
    const rawJsonRegex = /(\{[\s\S]*?"action"\s*:\s*"save_memory"[\s\S]*?\})/i;
    const matchRaw = text.match(rawJsonRegex);
    if (matchRaw) {
      try {
        const parsed = JSON.parse(matchRaw[1]);
        const cleanText = text.replace(rawJsonRegex, '').trim();
        return { payload: parsed, cleanText };
      } catch {}
    }

    return null;
  };

  // Subscribe to LocalLLM native streaming events
  useEffect(() => {
    let tokenBuffer = '';
    let animFrameId: number | null = null;

    const flushTokens = () => {
      if (!tokenBuffer) return;
      const textToAppend = tokenBuffer;
      tokenBuffer = '';

      const targetRespId = activeRespIdRef.current;
      setConversations(prev =>
        prev.map(c => {
          if (c.id === activeConversationIdRef.current) {
            const msgs = c.messages.map(m => {
              if (targetRespId ? m.id === targetRespId : (m.role === 'assistant' && m === c.messages[c.messages.length - 1])) {
                return {
                  ...m,
                  content: m.content + textToAppend,
                };
              }
              return m;
            });
            return { ...c, messages: msgs, updatedAt: Date.now() };
          }
          return c;
        })
      );
    };

    const subToken = LocalLLM.onToken(({ text }) => {
      if (!text) return;
      tokenBuffer += text;
      accumulatedAssistantTextRef.current += text;

      if (!animFrameId) {
        animFrameId = requestAnimationFrame(() => {
          animFrameId = null;
          flushTokens();
        });
      }

      // Efficient throttled intermediate SQLite updates during long streaming
      const now = Date.now();
      const currentRespId = activeRespIdRef.current;
      if (now - lastDbSaveTimeRef.current >= 2500 && currentRespId) {
        lastDbSaveTimeRef.current = now;
        const currentAcc = accumulatedAssistantTextRef.current;
        if (currentAcc.trim().length > 0) {
          ChatStorageService.updateMessageContent(currentRespId, currentAcc).catch(() => {});
        }
      }
    });

    const subStart = LocalLLM.onGenerationStarted(() => {
      tokenBuffer = '';
      accumulatedAssistantTextRef.current = '';
      lastDbSaveTimeRef.current = Date.now();
      setIsGenerating(true);
      setState('thinking');
    });

    const subComplete = LocalLLM.onGenerationCompleted(({ fullText }) => {
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      tokenBuffer = '';

      setIsGenerating(false);
      setState('idle');
      setLoadingModelText(null);

      const targetRespId = activeRespIdRef.current;
      const targetConvId = activeConversationIdRef.current;
      const memNotice = activeMemoryNoticeRef.current;
      activeMemoryNoticeRef.current = null;
      activeRespIdRef.current = null;

      let processedText = (fullText || accumulatedAssistantTextRef.current || '').trim();
      let finalMemoryNotice: { title: string; category: string; content?: string } | undefined = undefined;
      let finalMemoryState: 'saving' | 'saved' | undefined = undefined;
      const isMemoryOperation = Boolean(memNotice?.isMemoryMode);

      // Check if AI output structured JSON for memory
      const jsonExtract = extractMemoryJson(processedText);
      if (jsonExtract) {
        processedText = jsonExtract.cleanText;
        if (jsonExtract.payload && isMemoryOperation) {
          const { payload } = jsonExtract;
          const refinedTitle = (payload.title || payload.content || memNotice?.title || 'User Information').trim();
          const refinedContent = (payload.content || refinedTitle).trim();
          const refinedCategory: MemoryCategory =
            payload.category === 'profile' || payload.category === 'preference' || payload.category === 'custom_instruction' || payload.category === 'app_rule' || payload.category === 'project'
              ? payload.category
              : (memNotice?.category as MemoryCategory) || 'profile';

          // Update/merge in MemoryManager (automatically deduplicates and persists)
          MemoryManager.addMemory(refinedCategory, refinedTitle, refinedContent, 3, 'explicit_user');
          finalMemoryNotice = { title: refinedTitle, category: refinedCategory, content: refinedContent };
          finalMemoryState = 'saved';
          logger.info(`[AutoMemory] Explicit memory saved/merged via AI JSON: ${refinedTitle}`);
        }
      } else if (memNotice && isMemoryOperation) {
        const title = memNotice.title || 'User Information';
        const category = (memNotice.category as MemoryCategory) || 'profile';
        const content = memNotice.content || title;
        // Guarantee memory is added to MemoryManager & persistent storage
        MemoryManager.addMemory(category, title, content, 3, 'explicit_user');
        finalMemoryNotice = { title, category, content };
        finalMemoryState = 'saved';
        logger.info(`[AutoMemory] Explicit memory saved via natural text: ${title}`);
      }

      if (!processedText) {
        processedText = finalMemoryNotice
          ? `Maine aapki ye information phone storage mein save kar li hai: "${finalMemoryNotice.title}".`
          : 'I am here and ready to help. How can I assist you with your device?';
      }
      const resolvedType: MessageType = (isMemoryOperation || finalMemoryNotice) ? 'memory' : 'chat';
      const resolvedState: MemorySaveStatus | undefined = (isMemoryOperation || finalMemoryNotice) ? 'saved' : undefined;

      // 1. Immediately and reliably persist the finalized assistant message to SQLite
      if (targetRespId) {
        ChatStorageService.updateMessageContent(targetRespId, processedText).catch(err => {
          logger.error('[AssistantStore] Failed to update final assistant message content in SQLite', err);
        });
        ChatStorageService.updateMessage(targetConvId, {
          id: targetRespId,
          role: 'assistant',
          content: processedText,
          msgType: resolvedType,
          memoryState: resolvedState,
          memorySaved: finalMemoryNotice,
          timestamp: Date.now(),
        }).catch(err => {
          logger.error('[AssistantStore] Failed to persist final assistant message in SQLite', err);
        });
      }

      // 2. Update React State
      setConversations(prev =>
        prev.map(c => {
          if (c.id === targetConvId) {
            const msgs = c.messages.map(m => {
              if (m.id === targetRespId) {
                return {
                  ...m,
                  content: processedText,
                  msgType: resolvedType,
                  memoryState: resolvedState,
                  memorySaved: finalMemoryNotice || m.memorySaved,
                };
              }
              return m;
            });
            return { ...c, messages: msgs, updatedAt: Date.now() };
          }
          return c;
        })
      );
    });

    const subStopped = LocalLLM.onGenerationStopped(({ partialText }) => {
      setIsGenerating(false);
      setState('idle');
      setLoadingModelText(null);

      const targetRespId = activeRespIdRef.current;
      const targetConvId = activeConversationIdRef.current;
      const memNotice = activeMemoryNoticeRef.current;
      activeMemoryNoticeRef.current = null;
      activeRespIdRef.current = null;

      let finalContent = (partialText || accumulatedAssistantTextRef.current || '').trim();
      if (!finalContent) {
        finalContent = memNotice
          ? `Maine save kar liya hai: "${memNotice.title}".`
          : 'Generation stopped.';
      }
      const resolvedType: MessageType = memNotice ? 'memory' : 'chat';
      const resolvedState: MemorySaveStatus | undefined = memNotice ? 'saved' : undefined;

      // 1. Immediately and reliably persist the stopped assistant message to SQLite
      if (targetRespId) {
        ChatStorageService.updateMessageContent(targetRespId, finalContent).catch(() => {});
        ChatStorageService.updateMessage(targetConvId, {
          id: targetRespId,
          role: 'assistant',
          content: finalContent,
          msgType: resolvedType,
          memoryState: resolvedState,
          memorySaved: memNotice ? { title: memNotice.title, category: memNotice.category } : undefined,
          timestamp: Date.now(),
        }).catch(() => {});
      }

      // 2. Update React State
      setConversations(prev =>
        prev.map(c => {
          if (c.id === targetConvId) {
            const msgs = c.messages.map(m => {
              if (m.id === targetRespId) {
                return {
                  ...m,
                  content: finalContent,
                  msgType: resolvedType,
                  memoryState: resolvedState,
                  memorySaved: memNotice ? { title: memNotice.title, category: memNotice.category } : m.memorySaved,
                };
              }
              return m;
            });
            return { ...c, messages: msgs, updatedAt: Date.now() };
          }
          return c;
        })
      );
    });

    const subLoading = LocalLLM.onModelLoading(({ modelId }) => {
      setLoadingModelText(`Loading ${modelId}...`);
    });

    const subLoaded = LocalLLM.onModelLoaded(({ modelId }) => {
      setLoadedModelId(modelId);
      setLoadingModelText(null);
    });

    const subUnloaded = LocalLLM.onModelUnloaded(() => {
      setLoadedModelId(null);
      setLoadingModelText(null);
    });

    const subError = LocalLLM.onError(({ code, message }) => {
      setIsGenerating(false);
      setState('idle');
      setLoadingModelText(null);
      preparedSessionIdRef.current = null;
      logger.error(`[LLM Error: ${code}] ${message}`);

      const targetRespId = activeRespIdRef.current;
      const targetConvId = activeConversationIdRef.current;
      activeRespIdRef.current = null;
      const errContent = `⚠️ Generation error: ${message || code || 'Unable to generate response.'}`;

      if (targetRespId) {
        ChatStorageService.updateMessageContent(targetRespId, errContent).catch(err => {
          logger.error('[AssistantStore] Failed to persist error message content in SQLite', err);
        });
      }

      setConversations(prev =>
        prev.map(c => {
          if (c.id === targetConvId) {
            const msgs = c.messages.map(m => {
              if (targetRespId ? m.id === targetRespId : (m.role === 'assistant' && m === c.messages[c.messages.length - 1])) {
                return {
                  ...m,
                  content: errContent,
                };
              }
              return m;
            });
            return { ...c, messages: msgs, updatedAt: Date.now() };
          }
          return c;
        })
      );
    });

    return () => {
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
      }
      subToken.remove();
      subStart.remove();
      subComplete.remove();
      subStopped.remove();
      subLoading.remove();
      subLoaded.remove();
      subUnloaded.remove();
      subError.remove();
    };
  }, []);

  const assistantService = new AssistantService();
  const theme = themeMode === 'dark' ? darkColors : lightColors;

  const refreshPermissions = useCallback(async () => {
    const perms = await PermissionService.checkAllStatus();
    setPermissions(perms);
    if (!perms.accessibility) {
      setIsAccessibilityAutomationEnabled(false);
    }
  }, []);

  const refreshStorage = useCallback(async () => {
    const info = await ModelService.getStorageInfo();
    setStorageInfo(info);
  }, []);

  useEffect(() => {
    refreshPermissions();
    refreshStorage();
  }, [refreshPermissions, refreshStorage]);

  // Synchronize Android Status Bar and Navigation Bar colors with active theme
  useEffect(() => {
    SystemBarNative.setSystemBars(theme.background, theme.background, themeMode === 'light');
  }, [themeMode, theme.background]);

  const activeConversation =
    conversations.find(c => c.id === activeConversationId) || conversations[0] || INITIAL_CONVERSATION;

  const toggleThemeMode = () => setThemeMode(prev => (prev === 'dark' ? 'light' : 'dark'));
  const openSidebar = () => setIsSidebarOpen(true);
  const closeSidebar = () => setIsSidebarOpen(false);
  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);
  const openModal = (modal: ActiveModalType) => {
    setActiveModal(modal);
    SystemBarNative.setSystemBars(theme.background, theme.background, themeMode === 'light');
  };
  const closeModal = () => {
    setActiveModal('none');
    SystemBarNative.setSystemBars(theme.background, theme.background, themeMode === 'light');
  };

  const completeOnboarding = () => {
    setHasCompletedOnboarding(true);
    logger.info('User completed first-run onboarding');
  };

  const resetOnboarding = () => {
    setHasCompletedOnboarding(false);
  };

  const toggleAssistantMasterSwitch = () => {
    if (!isAssistantEnabled) {
      if (!activeVoiceModel || !activeTextModel) {
        logger.warn('Cannot enable assistant without both active voice pack and TTT LLM');
        return;
      }
      setIsAssistantEnabled(true);
    } else {
      setIsAssistantEnabled(false);
    }
  };

  const toggleAccessibilityAutomation = async () => {
    if (!isAccessibilityAutomationEnabled) {
      const currentPerms = await PermissionService.checkAllStatus();
      if (!currentPerms.accessibility) {
        await PermissionService.openAccessibilitySettings();
        return;
      }
      setIsAccessibilityAutomationEnabled(true);
    } else {
      setIsAccessibilityAutomationEnabled(false);
    }
  };

  const toggleMemoryMasterSwitch = () => {
    setIsMemoryEnabled(prev => {
      const next = !prev;
      preparedSessionIdRef.current = null;
      if (loadedModelIdRef.current) {
        prepareSessionInModel(activeConversationIdRef.current);
      }
      return next;
    });
  };

  // Model Operations & Direct Cloud Connectivity

  const [isModelSwitching, setIsModelSwitching] = useState<boolean>(false);
  const [switchingModelId, setSwitchingModelId] = useState<string | null>(null);
  const isPreloadingRef = useRef<boolean>(false);
  const pendingModelRef = useRef<DownloadableModel | null>(null);

  const preloadModel = useCallback(async (modelToLoad: DownloadableModel) => {
    if (loadedModelIdRef.current === modelToLoad.id && !isPreloadingRef.current) {
      logger.info(`[Warmup] Model ${modelToLoad.name} is already resident in RAM.`);
      return;
    }

    if (isPreloadingRef.current) {
      logger.info(`[Warmup] Model load in progress, queuing ${modelToLoad.name} as target.`);
      pendingModelRef.current = modelToLoad;
      setSwitchingModelId(modelToLoad.id);
      return;
    }

    try {
      isPreloadingRef.current = true;
      setIsModelSwitching(true);
      setSwitchingModelId(modelToLoad.id);
      setLoadingModelText(`Activating ${modelToLoad.name}...`);
      logger.info(`[Warmup] Preloading model ${modelToLoad.id} into resident RAM in background...`);
      await LocalLLM.loadModel(modelToLoad.id, modelToLoad.kind);
      setLoadedModelId(modelToLoad.id);
      loadedModelIdRef.current = modelToLoad.id;

      // Prepare active chat session context once during initial model loading phase
      const activeId = activeConversationIdRef.current;
      await prepareSessionInModel(activeId);
      logger.info(`[Warmup] Model ${modelToLoad.name} & session context successfully resident in RAM!`);
    } catch (err: any) {
      logger.warn(`[Warmup] Failed to preload model ${modelToLoad.id}`, err);
    } finally {
      isPreloadingRef.current = false;
      setIsModelSwitching(false);
      setSwitchingModelId(null);
      setLoadingModelText(null);

      // Check if another model switch was queued while loading
      if (pendingModelRef.current && pendingModelRef.current.id !== loadedModelIdRef.current) {
        const nextTarget = pendingModelRef.current;
        pendingModelRef.current = null;
        preloadModel(nextTarget);
      }
    }
  }, []);


  const fetchModelsFromBackend = useCallback(async (params?: { page?: number; limit?: number; search?: string; kind?: string; forceRefresh?: boolean }) => {
    return await ModelService.fetchServerModels(params);
  }, []);

  const fetchVoicePacksFromBackend = useCallback(async (params?: { page?: number; limit?: number; search?: string; forceRefresh?: boolean }) => {
    return await ModelService.fetchServerVoicePacks(params);
  }, []);

  // Listen to catalog updates from Realtime Sync, downloads, or deletions
  useEffect(() => {
    const unsubscribe = ModelService.subscribeCatalog(updated => {
      setModels(updated);
      refreshStorage();
    });
    return unsubscribe;
  }, [refreshStorage]);

  useEffect(() => {
    ModelService.syncInstalledModels().then(() => {
      const updated = ModelService.getModels();
      setModels(updated);
      refreshStorage();

      // Preload active text model into background RAM on startup
      const activeText = updated.find(m => m.kind === 'text' && m.isActive && m.status === 'READY');
      if (activeText) {
        preloadModel(activeText);
      }
    });
  }, [refreshStorage, preloadModel]);

  const startDownloadModel = async (id: string) => {
    if (Platform.OS === 'android') {
      try {
        const perms = await PermissionService.checkAllStatus();
        if (!perms.notifications) {
          await PermissionService.requestNotifications();
        }
      } catch (err) {
        logger.warn('[AssistantStore] Notification permission error:', err);
      }
    }

    ModelService.startDownload(id, updated => {
      setModels(prev => prev.map(m => (m.id === id ? { ...updated } : m)));
      if (updated.status === 'READY') {
        if (updated.kind === 'voice_ai' || updated.kind === 'stt') {
          setIsAssistantEnabled(true);
        }
        refreshStorage();
        if (updated.kind === 'text' && updated.isActive) {
          preloadModel(updated);
        }
      }
    });
  };

  const pauseDownloadModel = (id: string) => {
    ModelService.pauseDownload(id);
    setModels(ModelService.getModels());
  };

  const cancelDownloadModel = (id: string) => {
    ModelService.cancelDownload(id);
    setModels(ModelService.getModels());
  };

  const deleteModel = async (id: string) => {
    if (loadedModelIdRef.current === id) {
      await LocalLLM.unloadModel().catch(() => {});
      setLoadedModelId(null);
    }
    await ModelService.deleteModel(id);
    setModels(ModelService.getModels());
    refreshStorage();
  };

  const setActiveModel = (id: string) => {
    ModelService.setActiveModel(id);
    const updated = ModelService.getModels();
    setModels(updated);
    const hasVoice = updated.some(
      m => (m.kind === 'voice_pack' || m.kind === 'voice_ai' || m.kind === 'stt') && m.isActive && m.status === 'READY'
    );
    if (hasVoice) {
      setIsAssistantEnabled(true);
    }
    const selected = updated.find(m => m.id === id);
    if (selected && selected.kind === 'text' && selected.status === 'READY') {
      preloadModel(selected);
    }
  };

  // Memory Operations
  const addMemory = (category: MemoryCategory, title: string, content: string) => {
    MemoryService.addMemory(category, title, content);
    const updated = MemoryService.getMemories();
    setMemories(updated);
  };

  const toggleMemory = (id: string) => {
    MemoryService.toggleMemory(id);
    const updated = MemoryService.getMemories();
    setMemories(updated);
  };

  const deleteMemory = (id: string) => {
    MemoryService.deleteMemory(id);
    const updated = MemoryService.getMemories();
    setMemories(updated);
  };

  const clearAllMemories = () => {
    MemoryService.clearAllMemories();
    setMemories([]);
  };

  // Conversation Session Management
  const createNewConversation = async () => {
    const newId = `conv-${Date.now()}`;
    const newConv: Conversation = {
      id: newId,
      title: 'New conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newId);
    activeConversationIdRef.current = newId;
    setHasMoreOlderMessages(false);
    setIsLoadingOlderMessages(false);
    setState('idle');
    setCurrentToolCall(null);
    closeSidebar();

    // Prepare empty session in model once
    if (loadedModelIdRef.current) {
      await prepareSessionInModel(newId);
    }

    try {
      await ChatStorageService.createSession(newConv);
    } catch (err) {
      logger.error('[AssistantStore] Failed to persist new session to SQLite', err);
    }
  };

  const selectConversation = async (id: string) => {
    setActiveConversationId(id);
    activeConversationIdRef.current = id;
    setHasMoreOlderMessages(false);
    setIsLoadingOlderMessages(false);
    setState('idle');
    setCurrentToolCall(null);
    closeSidebar();

    // Parallelize: Load visible page of 20 messages from SQLite & prepare session in model
    const loadPromise = ChatStorageService.loadSessionMessagesPaginated(id, 20)
      .then(msgs => {
        setConversations(prev =>
          prev.map(c => (c.id === id ? { ...c, messages: msgs } : c))
        );
        setHasMoreOlderMessages(msgs.length >= 20);
      })
      .catch(err => {
        logger.error(`[AssistantStore] Failed to load paginated messages for session ${id}`, err);
      });

    const prepPromise = loadedModelIdRef.current
      ? prepareSessionInModel(id).catch(() => {})
      : Promise.resolve();

    await Promise.all([loadPromise, prepPromise]);
  };

  const renameConversation = async (id: string, newTitle: string) => {
    const cleanTitle = newTitle.trim();
    if (!cleanTitle) return;
    setConversations(prev =>
      prev.map(c => (c.id === id ? { ...c, title: cleanTitle, updatedAt: Date.now() } : c))
    );
    try {
      await ChatStorageService.updateSessionTitle(id, cleanTitle);
    } catch (err) {
      logger.error(`[AssistantStore] Failed to persist renamed title for session ${id}`, err);
    }
  };

  const deleteConversation = async (id: string) => {
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== id);
      return filtered.length > 0 ? filtered : [INITIAL_CONVERSATION];
    });

    if (activeConversationId === id) {
      const remaining = conversations.filter(c => c.id !== id);
      const nextId = remaining.length > 0 ? remaining[0].id : INITIAL_CONVERSATION_ID;
      setActiveConversationId(nextId);
      activeConversationIdRef.current = nextId;
      setHasMoreOlderMessages(false);
      ChatStorageService.loadSessionMessagesPaginated(nextId, 20).then(msgs => {
        setConversations(prev => prev.map(c => (c.id === nextId ? { ...c, messages: msgs } : c)));
        setHasMoreOlderMessages(msgs.length >= 20);
        if (loadedModelIdRef.current) {
          prepareSessionInModel(nextId).catch(() => {});
        }
      }).catch(() => {});
    }

    try {
      await ChatStorageService.deleteSession(id);
    } catch (err) {
      logger.error(`[AssistantStore] Failed to delete session ${id} in SQLite`, err);
    }
  };

  const updateCustomization = (updates: Partial<AssistantCustomization>) => {
    setCustomization(prev => ({ ...prev, ...updates }));
  };

  const stopGeneration = async () => {
    await LocalLLM.stopGeneration();
    setIsGenerating(false);
    setState('idle');
    setLoadingModelText(null);
  };

  const sendCommand = async (command: string) => {
    const raw = command.trim();
    if (!raw || isGenerating || state === 'thinking') return;

    // 1. Mini Commands Shortcuts
    if (raw.toLowerCase() === '/clear') {
      createNewConversation();
      return;
    }

    // 2. Strict Explicit Memory Check (Eliminates Junk Message Saves)
    const explicitCheck = MemoryManager.isExplicitMemorySaveCommand(raw);
    const isSaveMode = explicitCheck.isExplicit;
    const actualCommand = (explicitCheck.cleanedContent || raw).trim();

    // Resolve active studio mode & pending media attachment
    let currentMode: ChatStudioMode = 'chat';
    if (isCreateImageActive) currentMode = 'create_image';
    else if (isCreateAudioActive) currentMode = 'create_audio';
    else if (isCreateVideoActive) currentMode = 'create_video';
    else if (isDeepSearchActive) currentMode = 'deep_search';

    const currentAttachments = [...activeAttachments];
    if (activeAttachments.length > 0) {
      clearAttachments();
    }

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      msgType: isSaveMode ? 'memory' : 'chat',
      mode: currentMode,
      attachment: currentAttachments[0] || undefined,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      content: raw,
      timestamp: Date.now(),
    };

    const respId = `msg-resp-${Date.now() + 1}`;
    activeRespIdRef.current = respId;

    let initialMemoryNotice: { title: string; category: string; content?: string; state: 'saving' | 'saved'; isMemoryMode: boolean } | null = null;
    if (isSaveMode) {
      const memoryTitle = explicitCheck.title || (actualCommand.length > 36 ? actualCommand.slice(0, 36) + '...' : actualCommand);
      const memoryCategory = explicitCheck.category || 'profile';
      const memoryContent = explicitCheck.cleanedContent || actualCommand;

      // Immediately persist to MemoryManager (guarantees data is saved to storage instantly)
      MemoryManager.addMemory(memoryCategory, memoryTitle, memoryContent, 3, 'explicit_user');

      initialMemoryNotice = {
        title: memoryTitle,
        category: memoryCategory,
        content: memoryContent,
        state: 'saving',
        isMemoryMode: true,
      };
      activeMemoryNoticeRef.current = initialMemoryNotice;
      logger.info(`[AutoMemory] Explicit memory save operation initiated & persisted: "${memoryTitle}"`);
    } else {
      activeMemoryNoticeRef.current = null;
    }

    const initialStudioData: StudioArtifactData | undefined =
      currentMode === 'create_image'
        ? {
            mode: 'create_image',
            prompt: raw,
            resolution: '1024x1024',
            aspectRatio: '1:1',
            imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
          }
        : currentMode === 'create_audio'
        ? {
            mode: 'create_audio',
            prompt: raw,
            trackName: raw.length > 26 ? raw.slice(0, 26) + '...' : raw,
            duration: '0:48',
          }
        : currentMode === 'create_video'
        ? {
            mode: 'create_video',
            prompt: raw,
            durationSec: 8,
            fps: 60,
            videoUrl: 'sample_video_clip',
          }
        : currentMode === 'deep_search'
        ? {
            mode: 'deep_search',
            prompt: raw,
            searchDepth: 'Level 3 • Deep Knowledge Retrieval',
            sources: [
              { title: 'Verified Offline Knowledge Base', snippet: 'In-depth system indexing and verified domain synthesis.' },
              { title: 'Neural Reasoning Corpus', snippet: 'Cross-validated multi-perspective evidence.' },
            ],
          }
        : undefined;

    const studioContent =
      currentMode === 'create_image'
        ? `Here is your generated image artwork based on: "${raw}". Rendered at 1024x1024 with Sara Diffusion Studio.`
        : currentMode === 'create_audio'
        ? `Acoustic audio track composed and synthesized for: "${raw}". Ready for playback.`
        : currentMode === 'create_video'
        ? `Cinematic sequence rendered (1080p 60fps) based on scene description: "${raw}".`
        : '';

    const assistantMsg: Message = {
      id: respId,
      role: 'assistant',
      msgType: isSaveMode ? 'memory' : 'chat',
      mode: currentMode,
      studioData: initialStudioData,
      memoryState: isSaveMode ? 'saving' : undefined,
      content: studioContent,
      timestamp: Date.now() + 1,
      memorySaved: initialMemoryNotice
        ? { title: initialMemoryNotice.title, category: initialMemoryNotice.category }
        : undefined,
    };

    const targetConvId = activeConversationId;
    const currentConv = conversations.find(c => c.id === targetConvId);
    const isFirstUserMsg = !currentConv || currentConv.messages.filter(m => m.role === 'user').length === 0;
    const updatedTitle = isFirstUserMsg ? raw.slice(0, 32) : (currentConv?.title || 'New conversation');

    // Update UI state immediately for responsive rendering
    setConversations(prev =>
      prev.map(c => {
        if (c.id === targetConvId) {
          return {
            ...c,
            title: updatedTitle,
            updatedAt: Date.now(),
            messages: [...c.messages, userMsg, assistantMsg],
          };
        }
        return c;
      })
    );

    // Persist user and assistant placeholder messages to SQLite
    ChatStorageService.saveMessage(targetConvId, userMsg).catch(err => {
      logger.error('[AssistantStore] Failed to persist user message to SQLite', err);
    });
    ChatStorageService.saveMessage(targetConvId, assistantMsg).catch(err => {
      logger.error('[AssistantStore] Failed to persist assistant placeholder message to SQLite', err);
    });

    if (isFirstUserMsg) {
      ChatStorageService.updateSessionTitle(targetConvId, updatedTitle).catch(err => {
        logger.error('[AssistantStore] Failed to persist updated session title to SQLite', err);
      });
    }

    // Creative studio modes (create_image, create_audio, create_video) complete immediately with generated artifacts
    if (currentMode === 'create_image' || currentMode === 'create_audio' || currentMode === 'create_video') {
      activeRespIdRef.current = null;
      setState('idle');
      return;
    }

    // Guard: Validate active text model
    if (!activeTextModel) {
      activeRespIdRef.current = null;
      setConversations(prev =>
        prev.map(c => {
          if (c.id === targetConvId) {
            const msgs = [...c.messages];
            const lastIdx = msgs.length - 1;
            if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant') {
              msgs[lastIdx] = {
                ...msgs[lastIdx],
                content: currentMode === 'deep_search'
                  ? 'Deep Search Engine requires an active offline model to synthesize search results. Open the Model Center to activate a model.'
                  : 'Please select a downloaded model first. Open the Model Center to download and activate an offline model.',
              };
            }
            return { ...c, updatedAt: Date.now(), messages: msgs };
          }
          return c;
        })
      );
      return;
    }

    try {
      // Ensure active text model is loaded and session is prepared
      if (loadedModelIdRef.current !== activeTextModel.id) {
        setLoadingModelText(`Loading ${activeTextModel.name}...`);
        setState('thinking');
        await LocalLLM.loadModel(activeTextModel.id, activeTextModel.kind);
        setLoadedModelId(activeTextModel.id);
        loadedModelIdRef.current = activeTextModel.id;
        await prepareSessionInModel(targetConvId);
        setLoadingModelText(null);
      } else if (preparedSessionIdRef.current !== targetConvId) {
        // Ensure session is prepared once if switching happened or pending
        await prepareSessionInModel(targetConvId);
      }

      setIsGenerating(true);
      setState('thinking');

      // Send ONLY the actual user message/content together with the required chat mode.
      // Do not rebuild or resend previous history, duplicate system prompts, or redundant wrappers.
      const promptToSend = ConversationContextService.formatUserTurn(actualCommand, {
        mode: currentMode,
        isSaveMode,
        explicitDetail: explicitCheck.cleanedContent,
      });

      // Stream generation with the already-initialized conversation context/state
      await LocalLLM.generate(promptToSend, { maxTokens: 2048, temperature: 0.5, topP: 0.9 });
    } catch (err: any) {
      logger.error('Error during local LLM generation', err);
      setIsGenerating(false);
      setState('idle');
      setLoadingModelText(null);

      const targetRespId = activeRespIdRef.current;
      activeRespIdRef.current = null;
      const errContent = `⚠️ Unable to generate response: ${err?.message || 'Local LLM execution failed.'}`;

      if (targetRespId) {
        ChatStorageService.updateMessageContent(targetRespId, errContent).catch(() => {});
      }

      setConversations(prev =>
        prev.map(c => {
          if (c.id === activeConversationId) {
            const msgs = c.messages.map(m => {
              if (targetRespId ? m.id === targetRespId : (m.role === 'assistant' && m === c.messages[c.messages.length - 1])) {
                return {
                  ...m,
                  content: errContent,
                };
              }
              return m;
            });
            return { ...c, updatedAt: Date.now(), messages: msgs };
          }
          return c;
        })
      );
    }
  };

  const startVoiceListening = () => {
    // Check if any combined voice pack is installed
    const hasInstalledVoice = models.some(
      m => (m.kind === 'voice_pack' || m.kind === 'voice_ai' || m.kind === 'stt') && m.status === 'READY'
    );
    if (!hasInstalledVoice) {
      openModal('voice_pack_setup');
      return;
    }

    // Auto-activate an installed voice pack if none is currently marked active
    if (!activeVoiceModel) {
      const readyVoice = models.find(
        m => (m.kind === 'voice_pack' || m.kind === 'voice_ai' || m.kind === 'stt') && m.status === 'READY'
      );
      if (readyVoice) {
        setActiveModel(readyVoice.id);
      }
    }

    openModal('voice_panel');
  };

  const stopVoiceListening = () => {
    setState('idle');
  };

  const setBackend = async (backend: InferenceBackend) => {
    await ModelService.setBackend(backend);
  };

  const setMaxSteps = (steps: number) => {
    setMaxStepsState(steps);
  };

  const toggleAssistantService = async () => {
    setIsServiceRunning(prev => !prev);
  };

  const dismissConfirmation = () => {
    setConfirmationRequest(null);
    setState('idle');
  };

  return (
    <AssistantContext.Provider
      value={{
        state,
        conversations,
        activeConversationId,
        activeConversation,
        currentToolCall,
        hasCompletedOnboarding,
        completeOnboarding,
        resetOnboarding,
        isAssistantEnabled,
        toggleAssistantMasterSwitch,
        isAccessibilityAutomationEnabled,
        toggleAccessibilityAutomation,
        isMemoryEnabled,
        toggleMemoryMasterSwitch,
        models,
        activeTextModel,
        activeVoiceModel,
        activeTTSModel,
        storageInfo,
        fetchModelsFromBackend,
        fetchVoicePacksFromBackend,
        startDownloadModel,
        pauseDownloadModel,
        cancelDownloadModel,
        deleteModel,
        setActiveModel,
        memories,
        addMemory,
        toggleMemory,
        deleteMemory,
        clearAllMemories,
        themeMode,
        theme,
        toggleThemeMode,
        setThemeMode,
        isSidebarOpen,
        openSidebar,
        closeSidebar,
        toggleSidebar,
        activeModal,
        openModal,
        closeModal,
        createNewConversation,
        selectConversation,
        renameConversation,
        deleteConversation,
        hasMoreOlderMessages,
        isLoadingOlderMessages,
        loadOlderMessages,
        customization,
        updateCustomization,
        permissions,
        isServiceRunning,
        maxSteps,
        confirmationRequest,
        isGenerating,
        loadedModelId,
        loadingModelText,
        isModelSwitching,
        switchingModelId,
        chatMode,
        setChatMode,
        isDeepSearchActive,
        toggleDeepSearch,
        isCreateImageActive,
        toggleCreateImage,
        isCreateAudioActive,
        toggleCreateAudio,
        isCreateVideoActive,
        toggleCreateVideo,
        clearActiveModes,
        activeAttachment,
        setActiveAttachment,
        activeAttachments,
        addAttachment,
        addAttachments,
        removeAttachment,
        clearAttachments,
        sendCommand,
        stopGeneration,
        startVoiceListening,
        stopVoiceListening,
        setBackend,
        setMaxSteps,
        toggleAssistantService,
        refreshPermissions,
        dismissConfirmation,
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
};

export const useAssistant = (): AssistantContextType => {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return context;
};

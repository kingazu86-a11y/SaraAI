export type AssistantState =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'tool_requested'
  | 'executing'
  | 'observing'
  | 'completed'
  | 'failed'
  | 'confirmation_required';

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ToolCallData {
  tool: string;
  arguments: Record<string, any>;
  id?: string;
}

export interface ToolResultData {
  tool: string;
  success: boolean;
  result?: any;
  error?: string;
}

export type MessageType = 'chat' | 'memory';
export type MemorySaveStatus = 'saving' | 'saved' | 'failed';
export type ChatStudioMode = 'chat' | 'deep_search' | 'create_image' | 'create_audio' | 'create_video';

export interface MediaAttachment {
  id: string;
  type: 'camera' | 'image';
  uri?: string;
  name?: string;
  thumbnail?: string;
  timestamp?: number;
}

export interface StudioArtifactData {
  mode: ChatStudioMode;
  prompt?: string;
  sources?: Array<{ title: string; url?: string; snippet: string }>;
  searchDepth?: string;
  imageUrl?: string;
  aspectRatio?: string;
  resolution?: string;
  audioUrl?: string;
  duration?: string;
  trackName?: string;
  videoUrl?: string;
  durationSec?: number;
  fps?: number;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  toolCall?: ToolCallData;
  toolResult?: ToolResultData;
  state?: AssistantState;
  msgType?: MessageType;
  mode?: ChatStudioMode;
  attachment?: MediaAttachment;
  attachments?: MediaAttachment[];
  studioData?: StudioArtifactData;
  memoryState?: MemorySaveStatus;
  memorySaved?: {
    title: string;
    category: string;
    content?: string;
  };
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  isPinned?: boolean;
}

export type PersonalityType = 'Professional' | 'Friendly' | 'Concise' | 'Direct';
export type ResponseStyleType = 'Concise' | 'Balanced' | 'Detailed';
export type AutonomyLevel = 'Ask Before Sensitive' | 'Ask Before Every Action' | 'Always Autonomous';

export interface AssistantCustomization {
  assistantName: string;
  personality: PersonalityType;
  responseStyle: ResponseStyleType;
  autonomyLevel: AutonomyLevel;
  voiceEnabled: boolean;
}

export type ModelInstallStatus =
  | 'model_not_installed'
  | 'model_installing'
  | 'model_verifying'
  | 'model_initializing'
  | 'model_ready'
  | 'model_error';

export type InferenceBackend = 'AUTO' | 'GPU' | 'CPU';

export interface ModelMetadata {
  modelId: string;
  name: string;
  version: string;
  format: string;
  sizeBytes: number;
  sha256: string;
  runtime: string;
  installedPath?: string;
  activeBackend: InferenceBackend;
  status: ModelInstallStatus;
  installProgress: number;
  lastInferenceLatencyMs?: number;
  errorMessage?: string;
}

export interface SafetyConfirmationRequest {
  requestId: string;
  tool: string;
  description: string;
  arguments: Record<string, any>;
  onConfirm: () => void;
  onCancel: () => void;
}

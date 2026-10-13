export type ModelKind =
  | 'voice_pack'
  | 'voice_ai'
  | 'stt'
  | 'tts'
  | 'text'
  | 'vision'
  | 'image_gen'
  | 'image_edit'
  | 'multimodal';

export type SupportedModality =
  | 'text->text'
  | 'text->image'
  | 'image->text'
  | 'image->image'
  | 'audio->text'
  | 'text->audio';

export type ModelDownloadStatus =
  | 'NOT_INSTALLED'
  | 'QUEUED'
  | 'DOWNLOADING'
  | 'VERIFYING'
  | 'INSTALLING'
  | 'READY'
  | 'PAUSED'
  | 'FAILED';

export type CompatibilityLevel = 'GOOD' | 'LIMITED' | 'NOT_RECOMMENDED';

export interface DownloadableModel {
  id: string;
  name: string;
  tagline: string;
  kind: ModelKind;
  sizeBytes: number;
  sizeFormatted: string;
  ramRequirementMb: number;
  ramFormatted: string;
  runtime: string;
  format: string;
  sha256: string;
  version?: string;
  description?: string;
  architecture?: string;
  capabilities: string[];
  modalities?: string[];
  languages: string[];
  status: ModelDownloadStatus;
  progress: number;
  downloadSpeed?: string;
  downloadedBytes?: number;
  downloadUrl?: string;
  isActive?: boolean;
}

export const INITIAL_MODEL_CATALOG: DownloadableModel[] = [
  // ========================================================
  // COMBINED VOICE PACKS (STT Speech Recognition + TTS Speech Output)
  // These handle voice input & output; response reasoning is executed by the active TTT LLM
  // ========================================================
  {
    id: 'whisper-piper-neural-pack',
    name: 'Sara Neural Voice Pack (Whisper + Piper)',
    tagline: 'Combined STT & TTS: High-accuracy Whisper speech recognition + Piper natural offline voice',
    kind: 'voice_pack',
    modalities: ['audio->text', 'text->audio'],
    downloadUrl: 'https://f005.backblazeb2.com/file/SaraAI-Models/VoicePacks/whisper-piper-neural-pack.bin',
    sizeBytes: 1048576,
    sizeFormatted: '1.0 MB',
    ramRequirementMb: 1536,
    ramFormatted: '1.5 GB recommended',
    runtime: 'Whisper.cpp + Piper ONNX',
    format: 'GGML Q4 + ONNX Voice',
    sha256: '',
    version: '2.0.0',
    capabilities: ['Speech-to-Text (Whisper)', 'Text-to-Speech (Piper)', 'Noise Resistance', 'Natural Spoken Voice'],
    languages: ['English', 'Urdu / Hindi', 'Multilingual'],
    status: 'NOT_INSTALLED',
    progress: 0,
    isActive: false,
  },
  {
    id: 'whisper-piper-fast-pack',
    name: 'Sara Ultra-Fast Voice Pack (Whisper Tiny + Piper)',
    tagline: 'Combined STT & TTS: Ultra-fast low-power voice input & instant speech output',
    kind: 'voice_pack',
    modalities: ['audio->text', 'text->audio'],
    downloadUrl: 'https://f005.backblazeb2.com/file/SaraAI-Models/VoicePacks/whisper-piper-fast-pack.bin',
    sizeBytes: 1048576,
    sizeFormatted: '1.0 MB',
    ramRequirementMb: 1024,
    ramFormatted: '1 GB recommended',
    runtime: 'Whisper Tiny + Piper ONNX',
    format: 'GGML Q4_0 + ONNX',
    sha256: '',
    version: '1.5.0',
    capabilities: ['Fast Voice Input (STT)', 'Instant Speech Output (TTS)', 'Minimal Battery Drain'],
    languages: ['English', 'Multilingual'],
    status: 'NOT_INSTALLED',
    progress: 0,
    isActive: false,
  },
  {
    id: 'vosk-piper-stream-pack',
    name: 'Sara Real-Time Stream Pack (Vosk + Piper)',
    tagline: 'Combined STT & TTS: Zero-latency streaming voice transcription + offline speech output',
    kind: 'voice_pack',
    modalities: ['audio->text', 'text->audio'],
    downloadUrl: 'https://f005.backblazeb2.com/file/SaraAI-Models/VoicePacks/vosk-piper-stream-pack.bin',
    sizeBytes: 1048576,
    sizeFormatted: '1.0 MB',
    ramRequirementMb: 1280,
    ramFormatted: '1.2 GB recommended',
    runtime: 'Vosk Kaldi + Piper ONNX',
    format: 'Kaldi Model + ONNX',
    sha256: '',
    version: '1.1.0',
    capabilities: ['Zero-Latency Streaming STT', 'Instant Keyword Detection', 'Clear Speech Output'],
    languages: ['English', 'Urdu', 'Hindi'],
    status: 'NOT_INSTALLED',
    progress: 0,
    isActive: false,
  },

  // ========================================================
  // TEXT-TO-TEXT (TTT) GENERAL LLMs (Chatbot & Reasoning Brain)
  // Dedicated on-device LLMs that generate all responses for Chat & Voice
  // ========================================================
  {
    id: 'gemma-3-1b-it-q4-k-m',
    name: 'Gemma 3 1B IT (Q4_K_M)',
    tagline: 'Google on-device reasoning, structured function calling, and deep conversation',
    kind: 'text',
    modalities: ['text->text'],
    downloadUrl: 'https://f005.backblazeb2.com/file/SaraAI-Models/LLMs/gemma-3-1b-it-Q4_K_M.gguf',
    sizeBytes: 806058240, // 768.7 MB
    sizeFormatted: '768.7 MB',
    ramRequirementMb: 3456,
    ramFormatted: '3.4 GB recommended',
    runtime: 'llama.cpp GGUF',
    format: 'Q4_K_M',
    sha256: '',
    version: '1.0.0',
    capabilities: ['Structured Tool Calling', 'Android Automation', 'Logical Reasoning'],
    languages: ['English', 'Multilingual'],
    status: 'NOT_INSTALLED',
    progress: 0,
    isActive: false,
  },
  {
    id: 'qwen-2.5-0.5b',
    name: 'Qwen 2.5 0.5B Edge (Q4_K_M)',
    tagline: 'Compact high-speed instruction following, device tools, and chat',
    kind: 'text',
    modalities: ['text->text'],
    downloadUrl: 'https://f005.backblazeb2.com/file/SaraAI-Models/LLMs/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    sizeBytes: 491400032, // 468.6 MB
    sizeFormatted: '468.6 MB',
    ramRequirementMb: 2048,
    ramFormatted: '2 GB recommended',
    runtime: 'llama.cpp GGUF',
    format: 'Q4_K_M',
    sha256: '',
    version: '2.5.0',
    capabilities: ['Fast Instruction Following', 'Coding & Math', 'Device Automation'],
    languages: ['English', 'Multilingual'],
    status: 'NOT_INSTALLED',
    progress: 0,
    isActive: false,
  },
  {
    id: 'smollm2-360m',
    name: 'SmolLM2 360M Instruct (Q4_K_M)',
    tagline: 'Ultra-lightweight on-device language model for rapid responses and low memory devices',
    kind: 'text',
    modalities: ['text->text'],
    downloadUrl: 'https://f005.backblazeb2.com/file/SaraAI-Models/LLMs/SmolLM2-360M-Instruct-Q4_K_M.gguf',
    sizeBytes: 270590592, // 258 MB
    sizeFormatted: '258 MB',
    ramRequirementMb: 1024,
    ramFormatted: '1 GB recommended',
    runtime: 'llama.cpp GGUF',
    format: 'Q4_K_M',
    sha256: '',
    version: '1.0.0',
    capabilities: ['Ultra-Low Memory', 'Instant Inference', 'Zero Lag Chat'],
    languages: ['English'],
    status: 'NOT_INSTALLED',
    progress: 0,
    isActive: false,
  },
];

export function calculateCompatibility(
  model: DownloadableModel,
  totalRamMb: number = 8192
): CompatibilityLevel {
  if (totalRamMb >= model.ramRequirementMb + 1024) {
    return 'GOOD';
  } else if (totalRamMb >= model.ramRequirementMb) {
    return 'LIMITED';
  } else {
    return 'NOT_RECOMMENDED';
  }
}

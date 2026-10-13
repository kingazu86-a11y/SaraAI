const fs = require('fs');
const path = require('path');

// GGUF Quantization type map (from llama.cpp gguf enum)
const GGUF_FILE_TYPE_MAP = {
  0: 'ALL_F32',
  1: 'MOSTLY_F16',
  2: 'Q4_0',
  3: 'Q4_1',
  7: 'Q8_0',
  8: 'Q5_0',
  9: 'Q5_1',
  10: 'Q2_K',
  11: 'Q3_K_S',
  12: 'Q3_K_M',
  13: 'Q3_K_L',
  14: 'Q4_K_S',
  15: 'Q4_K_M',
  16: 'Q5_K_S',
  17: 'Q5_K_M',
  18: 'Q6_K',
  19: 'IQ2_XXS',
  20: 'IQ2_XS',
  21: 'Q2_K_S',
  22: 'IQ3_XS',
  23: 'IQ3_XXS',
  24: 'IQ1_S',
  25: 'IQ4_NL',
  26: 'IQ3_S',
  27: 'IQ3_M',
  28: 'IQ2_S',
  29: 'IQ2_M',
  30: 'IQ4_XS',
  31: 'IQ1_M',
  32: 'BF16',
};

// Map known architectures to Sara AI kind and runtime
const ARCHITECTURE_MAP = {
  llama: { kind: 'text', runtime: 'GGUF Edge Runtime', displayArch: 'LLaMA Transformer' },
  qwen: { kind: 'text', runtime: 'GGUF Edge Runtime', displayArch: 'Qwen Transformer' },
  qwen2: { kind: 'text', runtime: 'GGUF Edge Runtime', displayArch: 'Qwen2 Transformer' },
  mistral: { kind: 'text', runtime: 'GGUF Edge Runtime', displayArch: 'Mistral Transformer' },
  gemma: { kind: 'text', runtime: 'GGUF Edge Runtime', displayArch: 'Gemma Transformer' },
  gemma2: { kind: 'text', runtime: 'GGUF Edge Runtime', displayArch: 'Gemma 2 Transformer' },
  gemma3: { kind: 'text', runtime: 'GGUF Edge Runtime', displayArch: 'Gemma 3 Transformer' },
  phi: { kind: 'text', runtime: 'GGUF Edge Runtime', displayArch: 'Phi Transformer' },
  phi3: { kind: 'text', runtime: 'GGUF Edge Runtime', displayArch: 'Phi-3 Transformer' },
  smollm: { kind: 'text', runtime: 'GGUF Edge Runtime', displayArch: 'SmolLM Transformer' },
  whisper: { kind: 'voice_pack', runtime: 'Whisper.cpp', displayArch: 'Whisper Speech Transformer' },
  clip: { kind: 'vision', runtime: 'GGUF Edge Runtime', displayArch: 'CLIP Vision Encoder' },
  llava: { kind: 'vision', runtime: 'GGUF Edge Runtime', displayArch: 'LLaVA Multimodal' },
  stablelm: { kind: 'text', runtime: 'GGUF Edge Runtime', displayArch: 'StableLM' },
  deepseek: { kind: 'text', runtime: 'GGUF Edge Runtime', displayArch: 'DeepSeek MoE' },
  deepseek2: { kind: 'text', runtime: 'GGUF Edge Runtime', displayArch: 'DeepSeek-V2 MoE' },
  bert: { kind: 'text', runtime: 'GGUF Edge Runtime', displayArch: 'BERT Embedding' },
  falcon: { kind: 'text', runtime: 'GGUF Edge Runtime', displayArch: 'Falcon Transformer' },
  starcoder: { kind: 'text', runtime: 'GGUF Edge Runtime', displayArch: 'StarCoder' },
};

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatRam(ramMb) {
  if (!ramMb) return '1 GB recommended';
  if (ramMb < 1024) return `${ramMb} MB recommended`;
  return `${(ramMb / 1024).toFixed(1)} GB recommended`;
}

/**
 * Parse GGUF Binary header safely
 */
function parseGGUFHeader(filePath) {
  let fd = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(2 * 1024 * 1024); // read first 2MB for metadata
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);

    let offset = 0;
    const magic = buffer.toString('utf8', 0, 4);
    if (magic !== 'GGUF') {
      return null;
    }
    offset += 4;

    const version = buffer.readUInt32LE(offset);
    offset += 4;

    const tensorCount = Number(buffer.readBigUInt64LE(offset));
    offset += 8;

    const metadataKVCount = Number(buffer.readBigUInt64LE(offset));
    offset += 8;

    const metadata = {};

    function readString() {
      if (offset + 8 > bytesRead) return '';
      const len = Number(buffer.readBigUInt64LE(offset));
      offset += 8;
      if (offset + len > bytesRead) return '';
      const str = buffer.toString('utf8', offset, offset + len);
      offset += len;
      return str;
    }

    function readValue(type) {
      switch (type) {
        case 0: { const v = buffer.readUInt8(offset); offset += 1; return v; }
        case 1: { const v = buffer.readInt8(offset); offset += 1; return v; }
        case 2: { const v = buffer.readUInt16LE(offset); offset += 2; return v; }
        case 3: { const v = buffer.readInt16LE(offset); offset += 2; return v; }
        case 4: { const v = buffer.readUInt32LE(offset); offset += 4; return v; }
        case 5: { const v = buffer.readInt32LE(offset); offset += 4; return v; }
        case 6: { const v = buffer.readFloatLE(offset); offset += 4; return v; }
        case 7: { const v = buffer.readUInt8(offset) !== 0; offset += 1; return v; }
        case 8: { return readString(); }
        case 9: { // Array
          if (offset + 12 > bytesRead) return [];
          const itemType = buffer.readUInt32LE(offset);
          offset += 4;
          const count = Number(buffer.readBigUInt64LE(offset));
          offset += 8;
          const arr = [];
          for (let i = 0; i < count; i++) {
            if (offset >= bytesRead) break;
            arr.push(readValue(itemType));
          }
          return arr;
        }
        case 10: { const v = Number(buffer.readBigUInt64LE(offset)); offset += 8; return v; }
        case 11: { const v = Number(buffer.readBigInt64LE(offset)); offset += 8; return v; }
        case 12: { const v = buffer.readDoubleLE(offset); offset += 8; return v; }
        default:
          return null;
      }
    }

    for (let i = 0; i < metadataKVCount; i++) {
      if (offset >= bytesRead) break;
      const key = readString();
      if (!key) break;
      if (offset + 4 > bytesRead) break;
      const valueType = buffer.readUInt32LE(offset);
      offset += 4;
      const val = readValue(valueType);
      // Only keep relevant keys to avoid excessive memory usage
      if (
        key.startsWith('general.') ||
        key.endsWith('.context_length') ||
        key.endsWith('.block_count') ||
        key.endsWith('.embedding_length') ||
        key.endsWith('.feed_forward_length') ||
        key.endsWith('.head_count') ||
        key === 'tokenizer.ggml.model'
      ) {
        metadata[key] = val;
      }
    }

    return {
      isGGUF: true,
      version,
      tensorCount,
      metadataKVCount,
      metadata,
    };
  } catch (err) {
    console.error('GGUF parse error:', err.message);
    return null;
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch {}
    }
  }
}

/**
 * Intelligent filename and path analyzer (fallback & enrichment)
 */
function analyzeFilename(filename) {
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  const baseNameWithoutExt = path.parse(filename).name;

  // Detect quantization from filename
  const quantMatch = baseNameWithoutExt.match(/(Q[0-9]_[K0-9]_[SML]|Q[0-9]_[0-9]|Q[0-9]_K|IQ[0-9]_[A-Z]+|FP16|BF16|FP32)/i);
  const detectedQuant = quantMatch ? quantMatch[1].toUpperCase() : null;

  // Detect parameter size from filename (e.g. 0.5B, 1.5B, 360M, 1B, 3B, 7B, 8B, 14B)
  const paramMatch = baseNameWithoutExt.match(/(0\.[0-9]+B|[0-9]+\.?[0-9]*B|[0-9]+M)/i);
  const detectedParam = paramMatch ? paramMatch[1].toUpperCase() : null;

  // Detect family
  let detectedArch = 'llama';
  let kind = 'text';
  let runtime = 'GGUF Edge Runtime';

  const lower = baseNameWithoutExt.toLowerCase();
  if (lower.includes('whisper') || lower.includes('piper') || lower.includes('vosk') || lower.includes('voice')) {
    kind = 'voice_pack';
    detectedArch = 'whisper';
    runtime = lower.includes('piper') ? 'Whisper + Piper ONNX' : 'Whisper.cpp';
  } else if (lower.includes('vision') || lower.includes('llava') || lower.includes('vl-') || lower.includes('clip')) {
    kind = 'vision';
    detectedArch = 'llava';
  } else if (lower.includes('diffus') || lower.includes('flux') || lower.includes('sd-') || lower.includes('sdxl')) {
    kind = 'image_gen';
    detectedArch = 'diffusion';
  } else if (lower.includes('qwen')) {
    detectedArch = lower.includes('qwen2') ? 'qwen2' : 'qwen';
  } else if (lower.includes('smollm')) {
    detectedArch = 'smollm';
  } else if (lower.includes('gemma')) {
    detectedArch = lower.includes('gemma2') || lower.includes('gemma-2') || lower.includes('gemma-3') ? 'gemma2' : 'gemma';
  } else if (lower.includes('mistral')) {
    detectedArch = 'mistral';
  } else if (lower.includes('phi')) {
    detectedArch = lower.includes('phi-3') || lower.includes('phi3') ? 'phi3' : 'phi';
  } else if (lower.includes('llama')) {
    detectedArch = 'llama';
  }

  // Format detection
  let format = 'GGUF';
  if (ext === 'onnx') {
    format = 'ONNX';
    runtime = 'ONNX Runtime';
  } else if (ext === 'tflite') {
    format = 'LiteRT';
    runtime = 'Google AI Edge / LiteRT';
  } else if (ext === 'bin') {
    format = kind === 'voice_pack' ? 'BIN Voice Pack' : 'BIN';
  } else if (detectedQuant) {
    format = detectedQuant;
  }

  return {
    ext,
    detectedQuant,
    detectedParam,
    detectedArch,
    kind,
    runtime,
    format,
  };
}

/**
 * Format a clean display name
 */
function cleanDisplayName(rawName, filename, paramSize, quant) {
  const baseName = path.parse(filename).name;
  const fileClean = baseName
    .replace(/[._-](gguf|bin|onnx|tflite)$/i, '')
    .replace(/[._-](q[0-9]_[a-z0-9_]+|fp16|bf16|fp32)$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b[a-z]/g, c => c.toUpperCase());

  let chosen = fileClean;
  if (rawName && typeof rawName === 'string' && rawName.trim().length > 2) {
    const isTrainingName = /mix\d+|ep\d+|lc\d+|iter\d+|step\d+/i.test(rawName);
    if (!isTrainingName) {
      chosen = rawName.replace(/[-_]/g, ' ').trim().replace(/\b[a-z]/g, c => c.toUpperCase());
    }
  }

  chosen = chosen
    .replace(/\bLlm\b/g, 'LLM')
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bStt\b/g, 'STT')
    .replace(/\bTts\b/g, 'TTS')
    .replace(/\bGguf\b/gi, '')
    .trim();

  if (quant && !chosen.toUpperCase().includes(quant.toUpperCase())) {
    chosen += ` (${quant})`;
  }
  return chosen;
}

/**
 * Generate a clean, URL-safe slug ID
 */
function generateModelId(name, filename, quant) {
  const baseName = path.parse(filename).name;
  let base = baseName
    .replace(/[._-](gguf|bin|onnx|tflite)$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (quant && !base.includes(quant.toLowerCase().replace(/_/g, '-'))) {
    base += `-${quant.toLowerCase().replace(/_/g, '-')}`;
  }
  return base;
}

/**
 * Calculate accurate RAM requirement in Megabytes
 */
function calculateRamRequirementMb(fileSizeBytes, contextLength = 4096, kind = 'text') {
  const fileSizeMb = fileSizeBytes / (1024 * 1024);

  if (kind === 'voice_pack') {
    // Voice models are smaller and stream audio frames
    return Math.max(512, Math.ceil((fileSizeMb * 2.0 + 256) / 64) * 64);
  }

  if (kind === 'vision') {
    // Vision models need extra RAM for image tensor embedding buffers (typically +500MB)
    const visionContextCacheMb = Math.round((contextLength / 2048) * 160);
    return Math.ceil((fileSizeMb * 1.35 + visionContextCacheMb + 512) / 64) * 64;
  }

  // LLM on-device calculation:
  // 1. Model weights mapped to RAM: 1.05x - 1.15x of file size
  // 2. KV Cache for context window: ~128MB per 2048 tokens for typical small models
  // 3. Runtime activation scratchpad: ~200MB - 350MB
  const safeContext = Math.min(contextLength || 4096, 32768);
  const kvCacheMb = Math.round((safeContext / 2048) * 140);
  const runtimeOverheadMb = 250;
  const estimatedRam = Math.ceil((fileSizeMb * 1.2 + kvCacheMb + runtimeOverheadMb) / 64) * 64;

  // Round to nearest standard mobile RAM step if close
  return Math.max(300, estimatedRam);
}

/**
 * Determine Hardware Profile Tier
 */
function determineTier(ramMb) {
  if (ramMb <= 2560) {
    return 'Tier 1 (Lightweight & Fast)';
  } else if (ramMb <= 5120) {
    return 'Tier 2 (Balanced)';
  } else {
    return 'Tier 3 (Heavy Pro)';
  }
}

/**
 * Main Export: Inspects any local model file and extracts comprehensive metadata
 */
async function inspectModelFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Model file not found at: ${filePath}`);
  }

  const stat = fs.statSync(filePath);
  const filename = path.basename(filePath);
  const fileSizeBytes = stat.size;
  const sizeFormatted = formatBytes(fileSizeBytes);

  const fileAnalysis = analyzeFilename(filename);
  const ggufData = parseGGUFHeader(filePath);

  let displayName = '';
  let modelArch = fileAnalysis.detectedArch;
  let kind = fileAnalysis.kind;
  let runtime = fileAnalysis.runtime;
  let format = fileAnalysis.format;
  let contextLength = 4096;
  let parameterCountStr = fileAnalysis.detectedParam || '';
  let isGGUF = false;
  let rawMetadata = {};

  if (ggufData && ggufData.isGGUF) {
    isGGUF = true;
    rawMetadata = ggufData.metadata;

    // Architecture
    const ggufArch = rawMetadata['general.architecture'];
    if (ggufArch) {
      modelArch = String(ggufArch).toLowerCase();
      const archInfo = ARCHITECTURE_MAP[modelArch];
      if (archInfo) {
        kind = archInfo.kind;
        runtime = archInfo.runtime;
      }
    }

    // Context Length
    const ctxKey = `${modelArch}.context_length`;
    if (rawMetadata[ctxKey]) {
      contextLength = Number(rawMetadata[ctxKey]);
    }

    // Display Name
    const ggufName = rawMetadata['general.name'] || rawMetadata['general.basename'];
    if (ggufName) {
      displayName = String(ggufName).trim();
    }

    // Quantization format
    const fileType = rawMetadata['general.file_type'];
    if (typeof fileType === 'number' && GGUF_FILE_TYPE_MAP[fileType]) {
      format = GGUF_FILE_TYPE_MAP[fileType];
    } else if (fileAnalysis.detectedQuant) {
      format = fileAnalysis.detectedQuant;
    }

    // Parameter count / Size label
    const sizeLabel = rawMetadata['general.size_label'];
    if (sizeLabel) {
      parameterCountStr = String(sizeLabel);
    }
  }

  // Cleanup display name
  const finalDisplayName = cleanDisplayName(displayName, filename, parameterCountStr, format);
  const modelId = generateModelId(displayName || finalDisplayName, filename, format);

  // Compute RAM
  const ramRequirementMb = calculateRamRequirementMb(fileSizeBytes, contextLength, kind);
  const ramFormatted = formatRam(ramRequirementMb);
  const tier = determineTier(ramRequirementMb);

  // Modalities
  let modalities = ['text->text'];
  let capabilities = ['Fast Response', 'Device Automation', 'Local Reasoning'];

  if (kind === 'voice_pack') {
    modalities = ['audio->text', 'text->audio'];
    capabilities = ['Speech-to-Text', 'Text-to-Speech', 'Offline Voice', 'Natural Spoken Audio'];
  } else if (kind === 'vision') {
    modalities = ['image->text', 'text->text'];
    capabilities = ['Vision Scene Analysis', 'Image OCR', 'Visual Q&A', 'Local Multimodal'];
  } else if (kind === 'image_gen') {
    modalities = ['text->image'];
    capabilities = ['Image Generation', 'Creative Rendering', 'Offline Diffusion'];
  } else if (kind === 'image_edit') {
    modalities = ['image->image'];
    capabilities = ['Image Editing', 'Super Resolution', 'Inpainting'];
  }

  const archMeta = ARCHITECTURE_MAP[modelArch] || { displayArch: `${modelArch.toUpperCase()} Architecture` };

  return {
    filePath,
    filename,
    isGGUF,
    displayName: finalDisplayName,
    modelId,
    architecture: modelArch,
    architectureDisplay: archMeta.displayArch,
    kind,
    runtime,
    format,
    fileSizeBytes,
    sizeFormatted,
    ramRequirementMb,
    ramFormatted,
    tier,
    contextLength,
    parameterCount: parameterCountStr,
    modalities,
    capabilities,
    tagline: `${finalDisplayName} running on-device via ${runtime}`,
  };
}

module.exports = {
  inspectModelFile,
  parseGGUFHeader,
  formatBytes,
  formatRam,
  calculateRamRequirementMb,
};

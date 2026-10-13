const { app, BrowserWindow, ipcMain, dialog, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { exec } = require('child_process');

let mainWindow = null;
const activeDownloads = new Map(); // modelId -> { abortController, filePath, tempPath }

// Target Paths (Pure Desktop & Firebase RTDB Architecture - Zero Local Server)
const ADMIN_ROOT = __dirname;
const DATA_DIR = path.resolve(ADMIN_ROOT, 'data');
const LLM_DIR = path.resolve(DATA_DIR, 'LLM');
const VOICEPACK_DIR = path.resolve(DATA_DIR, 'VoicePack');
const ENV_PATH = path.resolve(ADMIN_ROOT, '.env');

// Firebase Realtime Database Endpoint (Dynamically read from .env if present)
function getFirebaseRtdbUrl() {
  if (fs.existsSync(ENV_PATH)) {
    try {
      const content = fs.readFileSync(ENV_PATH, 'utf-8');
      const match = content.match(/^FIREBASE_RTDB_URL=(.+)$/m);
      if (match && match[1]) return match[1].trim();
    } catch {}
  }
  return process.env.FIREBASE_RTDB_URL || 'https://saraai-d0858-default-rtdb.firebaseio.com';
}

const { inspectModelFile } = require('./utils/model-inspector');
const {
  getB2Config,
  saveB2Config,
  testB2Connection,
  uploadToBackblaze,
  cancelUpload,
} = require('./utils/b2-uploader');
const firebaseAdminService = require('./utils/firebase-admin-service');
const adminAuthService = require('./utils/admin-auth-service');

function isAuthorizedAdmin() {
  return firebaseAdminService.isInitialized() || adminAuthService.isAuthenticated();
}

// Ensure local storage folders exist inside admin
for (const dir of [DATA_DIR, LLM_DIR, VOICEPACK_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Helper: Format bytes
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Helper: Format RAM MB
function formatRam(ramMb) {
  if (!ramMb) return '1 GB recommended';
  if (ramMb < 1024) return `${ramMb} MB recommended`;
  return `${(ramMb / 1024).toFixed(1)} GB recommended`;
}

// Helper: Calculate SHA-256
async function calculateFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) return resolve('');
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

// ==========================================
// Firebase Realtime Database REST Helpers
// ==========================================
function sanitizeFirebaseKey(key) {
  return String(key || '').trim().replace(/[.#$[\]\/]/g, '-');
}

function sanitizeFirebaseSubpath(subpath) {
  const parts = String(subpath || '').split('/');
  const root = parts[0];
  const rest = parts.slice(1).map(sanitizeFirebaseKey);
  return rest.length > 0 ? `${root}/${rest.join('/')}` : root;
}

function firebaseGet(subpath) {
  return new Promise(resolve => {
    const cleanSubpath = sanitizeFirebaseSubpath(subpath);
    const url = `${getFirebaseRtdbUrl()}/${cleanSubpath}.json`;
    const req = https.get(url, { timeout: 8000 }, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            data: JSON.parse(data),
            statusCode: res.statusCode,
          });
        } catch {
          resolve({ ok: false, data: null, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', err => resolve({ ok: false, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'Firebase request timed out (8s)' });
    });
  });
}

async function firebasePut(subpath, data) {
  // 1. Use Firebase Admin SDK Realtime Database when active (Service Account credentials)
  const db = firebaseAdminService.getDatabase();
  if (db) {
    try {
      const cleanSubpath = sanitizeFirebaseSubpath(subpath);
      await db.ref(cleanSubpath).set(data);
      return { ok: true, statusCode: 200, data };
    } catch (err) {
      console.error('[Admin SDK RTDB Put Error]:', err.message);
      return { ok: false, error: err.message, statusCode: 403 };
    }
  }

  // 2. Use Admin User Firebase ID Token (Email/Password authenticated admin)
  let authToken = null;
  if (adminAuthService.isAuthenticated()) {
    authToken = await adminAuthService.getValidIdToken();
  }

  // If neither Service Account nor Admin User is authenticated, reject immediately
  if (!authToken) {
    return {
      ok: false,
      statusCode: 401,
      error: 'Authorization Required: No active Admin Email session or Service Account. Please sign in or load credentials.',
    };
  }

  // Send authenticated REST request with ?auth=<idToken> (satisfies RTDB security rules)
  return new Promise(resolve => {
    const cleanSubpath = sanitizeFirebaseSubpath(subpath);
    const url = `${getFirebaseRtdbUrl()}/${cleanSubpath}.json?auth=${encodeURIComponent(authToken)}`;
    const payload = JSON.stringify(data);
    const parsed = new URL(url);

    const req = https.request(
      parsed,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 10000,
      },
      res => {
        let body = '';
        res.on('data', chunk => (body += chunk));
        res.on('end', () => {
          const ok = res.statusCode >= 200 && res.statusCode < 300;
          try {
            const parsedBody = JSON.parse(body);
            resolve({
              ok,
              data: parsedBody,
              error: ok ? null : (parsedBody?.error || `HTTP ${res.statusCode}`),
              statusCode: res.statusCode,
            });
          } catch {
            resolve({ ok: false, error: body || `HTTP ${res.statusCode}`, statusCode: res.statusCode });
          }
        });
      }
    );

    req.on('error', err => resolve({ ok: false, error: err.message, statusCode: 500 }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'Firebase request timed out', statusCode: 408 });
    });
    req.write(payload);
    req.end();
  });
}

async function firebaseDelete(subpath) {
  const db = firebaseAdminService.getDatabase();
  if (db) {
    try {
      const cleanSubpath = sanitizeFirebaseSubpath(subpath);
      await db.ref(cleanSubpath).remove();
      return { ok: true, statusCode: 200 };
    } catch (err) {
      console.error('[Admin SDK RTDB Delete Error]:', err.message);
      return { ok: false, error: err.message, statusCode: 403 };
    }
  }

  let authToken = null;
  if (adminAuthService.isAuthenticated()) {
    authToken = await adminAuthService.getValidIdToken();
  }

  if (!authToken) {
    return {
      ok: false,
      statusCode: 401,
      error: 'Authorization Required: No active Admin Email session or Service Account. Please sign in or load credentials.',
    };
  }

  return new Promise(resolve => {
    const cleanSubpath = sanitizeFirebaseSubpath(subpath);
    const url = `${getFirebaseRtdbUrl()}/${cleanSubpath}.json?auth=${encodeURIComponent(authToken)}`;
    const parsed = new URL(url);

    const req = https.request(parsed, { method: 'DELETE', timeout: 8000 }, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        const ok = res.statusCode >= 200 && res.statusCode < 300;
        try {
          const parsedBody = JSON.parse(body);
          resolve({
            ok,
            error: ok ? null : (parsedBody?.error || `HTTP ${res.statusCode}`),
            statusCode: res.statusCode,
          });
        } catch {
          resolve({ ok, error: ok ? null : (body || `HTTP ${res.statusCode}`), statusCode: res.statusCode });
        }
      });
    });

    req.on('error', err => resolve({ ok: false, error: err.message, statusCode: 500 }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'Firebase delete request timed out', statusCode: 408 });
    });
    req.end();
  });
}

// Default Base Catalog Seed (with Backblaze B2 ready structures)
const SEED_CATALOG = [
  {
    id: 'gemma-3-1b-it-q4-k-m',
    name: 'Gemma 3 1B IT (Q4_K_M)',
    tagline: 'Google on-device reasoning, structured function calling, and deep conversation',
    kind: 'text',
    modalities: ['text->text'],
    filename: 'gemma-3-1b-it-Q4_K_M.gguf',
    downloadUrl: 'https://f005.backblazeb2.com/file/SaraAI-Models/LLMs/gemma-3-1b-it-Q4_K_M.gguf',
    ramRequirementMb: 3456,
    ramFormatted: '3.4 GB recommended',
    sizeBytes: 806058240,
    sizeFormatted: '768.7 MB',
    format: 'Q4_K_M',
    runtime: 'GGUF Edge Runtime',
    tier: 'Tier 2 (Balanced)',
    version: '1.0.0',
    capabilities: ['Structured Tool Calling', 'Android Automation', 'Logical Reasoning'],
    languages: ['English', 'Multilingual'],
    recommendedFor: '4GB - 6GB+ RAM Devices',
    status: 'NOT_INSTALLED',
  },
  {
    id: 'qwen-2-5-0-5b',
    name: 'Qwen 2.5 0.5B Instruct (Ultra Fast)',
    tagline: 'Lightning-fast on-device reasoning, instant device actions, and compact chat',
    kind: 'text',
    modalities: ['text->text'],
    filename: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    downloadUrl: 'https://f005.backblazeb2.com/file/SaraAI-Models/LLMs/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    ramRequirementMb: 512,
    ramFormatted: '500 MB (Ideal for 3GB - 4GB RAM)',
    sizeBytes: 491400032,
    sizeFormatted: '468.6 MB',
    format: 'Q4_K_M',
    runtime: 'GGUF Edge Runtime',
    tier: 'Tier 1 (Lightweight & Fast)',
    version: '2.5.0',
    capabilities: ['Lightning Fast Response', 'Android Device Automation', 'Urdu & English Chat', 'Zero Lag'],
    languages: ['English', 'Urdu', 'Multilingual'],
    recommendedFor: '3GB - 4GB RAM Devices',
    status: 'NOT_INSTALLED',
  },
  {
    id: 'smollm2-360m',
    name: 'SmolLM2 360M Instruct (Featherweight)',
    tagline: 'Ultra-compact model designed specifically for edge & smartphones',
    kind: 'text',
    modalities: ['text->text'],
    filename: 'SmolLM2-360M-Instruct-Q4_K_M.gguf',
    downloadUrl: 'https://f005.backblazeb2.com/file/SaraAI-Models/LLMs/SmolLM2-360M-Instruct-Q4_K_M.gguf',
    ramRequirementMb: 300,
    ramFormatted: '300 MB recommended (Ultra Battery Saver)',
    sizeBytes: 270590592,
    sizeFormatted: '258.0 MB',
    format: 'Q4_K_M',
    runtime: 'GGUF Edge Runtime',
    tier: 'Tier 1 (Featherweight)',
    version: '2.0.0',
    capabilities: ['Instant Actions', 'Fast Dialogue', 'Ultra-low RAM'],
    languages: ['English'],
    recommendedFor: 'All Devices (Ideal for 3GB RAM)',
    status: 'NOT_INSTALLED',
  },
];

// Default Base VoicePack Seed (for Firebase Realtime Database)
const SEED_VOICEPACKS = [
  {
    id: 'whisper-piper-neural-pack',
    name: 'Sara Neural Voice Pack (Whisper + Piper)',
    tagline: 'Combined STT & TTS: High-accuracy Whisper speech recognition + Piper natural offline voice',
    kind: 'voice_pack',
    modalities: ['audio->text', 'text->audio'],
    filename: 'whisper-piper-neural-pack.bin',
    downloadUrl: 'https://f005.backblazeb2.com/file/SaraAI-Models/VoicePacks/whisper-piper-neural-pack.bin',
    ramRequirementMb: 1536,
    ramFormatted: '1.5 GB recommended',
    runtime: 'Whisper.cpp + Piper ONNX',
    format: 'GGML Q4 + ONNX Voice',
    capabilities: ['Speech-to-Text (Whisper)', 'Text-to-Speech (Piper)', 'Noise Resistance', 'Natural Spoken Voice'],
    languages: ['English', 'Urdu / Hindi', 'Multilingual'],
    version: '2.0.0',
    sizeBytes: 1048576,
    sizeFormatted: '1.0 MB',
    status: 'NOT_INSTALLED',
  },
  {
    id: 'whisper-piper-fast-pack',
    name: 'Sara Ultra-Fast Voice Pack (Whisper Tiny + Piper)',
    tagline: 'Combined STT & TTS: Ultra-fast low-power voice input & instant speech output',
    kind: 'voice_pack',
    modalities: ['audio->text', 'text->audio'],
    filename: 'whisper-piper-fast-pack.bin',
    downloadUrl: 'https://f005.backblazeb2.com/file/SaraAI-Models/VoicePacks/whisper-piper-fast-pack.bin',
    ramRequirementMb: 1024,
    ramFormatted: '1 GB recommended',
    runtime: 'Whisper Tiny + Piper ONNX',
    format: 'GGML Q4_0 + ONNX',
    capabilities: ['Fast Voice Input (STT)', 'Instant Speech Output (TTS)', 'Minimal Battery Drain'],
    languages: ['English', 'Multilingual'],
    version: '1.5.0',
    sizeBytes: 1048576,
    sizeFormatted: '1.0 MB',
    status: 'NOT_INSTALLED',
  },
  {
    id: 'vosk-piper-stream-pack',
    name: 'Sara Real-Time Stream Pack (Vosk + Piper)',
    tagline: 'Combined STT & TTS: Zero-latency streaming voice transcription + offline speech output',
    kind: 'voice_pack',
    modalities: ['audio->text', 'text->audio'],
    filename: 'vosk-piper-stream-pack.bin',
    downloadUrl: 'https://f005.backblazeb2.com/file/SaraAI-Models/VoicePacks/vosk-piper-stream-pack.bin',
    ramRequirementMb: 1280,
    ramFormatted: '1.2 GB recommended',
    runtime: 'Vosk Kaldi + Piper ONNX',
    format: 'Kaldi Model + ONNX',
    capabilities: ['Zero-Latency Streaming STT', 'Instant Keyword Detection', 'Clear Speech Output'],
    languages: ['English', 'Urdu', 'Hindi'],
    version: '1.1.0',
    sizeBytes: 1048576,
    sizeFormatted: '1.0 MB',
    status: 'NOT_INSTALLED',
  },
];


function createWindow() {
  const iconPath = process.platform === 'win32' && fs.existsSync(path.join(__dirname, 'assets', 'icon.ico'))
    ? path.join(__dirname, 'assets', 'icon.ico')
    : path.join(__dirname, 'assets', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1300,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    backgroundColor: '#171717',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:stateChange', { isMaximized: true });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:stateChange', { isMaximized: false });
  });
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.saraai.admin');
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ==========================================
// IPC HANDLERS: Window Controls
// ==========================================
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() || false);

// ==========================================
// IPC HANDLERS: AI Models Management (Firebase RTDB)
// ==========================================
ipcMain.handle('models:list', async () => {
  let catalog = [];
  let isFirebaseSynced = false;

  // 1. Fetch directly from Firebase Realtime Database (/models endpoint)
  const fbRes = await firebaseGet('models');
  if (fbRes.ok && fbRes.data) {
    if (Array.isArray(fbRes.data)) {
      catalog = fbRes.data.filter(Boolean);
    } else if (typeof fbRes.data === 'object') {
      catalog = Object.entries(fbRes.data).map(([key, val]) => ({
        id: val.id || key,
        ...val,
      }));
    }
    isFirebaseSynced = true;
  }

  const diskFiles = fs.existsSync(LLM_DIR)
    ? fs.readdirSync(LLM_DIR).filter(f => f !== 'catalog.json' && !f.endsWith('.downloading'))
    : [];

  // Enrich models with disk presence
  const enrichedModels = catalog.map(item => {
    let isInstalled = false;
    let actualDiskSize = item.sizeBytes || 0;
    let matchedFilename = item.filename || '';

    if (item.filename && fs.existsSync(path.join(LLM_DIR, item.filename))) {
      isInstalled = true;
      actualDiskSize = fs.statSync(path.join(LLM_DIR, item.filename)).size;
    } else {
      const cleanId = (item.id || '').toLowerCase().replace(/[-_.]/g, '');
      const found = diskFiles.find(f => f.toLowerCase().replace(/[-_.]/g, '').includes(cleanId));
      if (found) {
        isInstalled = true;
        matchedFilename = found;
        actualDiskSize = fs.statSync(path.join(LLM_DIR, found)).size;
      }
    }

    const isDownloading = activeDownloads.has(item.id);

    return {
      ...item,
      filename: matchedFilename || item.filename || `${item.id}.gguf`,
      isInstalled,
      status: isDownloading ? 'DOWNLOADING' : isInstalled ? 'READY' : 'NOT_INSTALLED',
      actualDiskSize: isInstalled ? actualDiskSize : 0,
      actualDiskSizeFormatted: isInstalled ? formatBytes(actualDiskSize) : '',
      sizeFormatted: formatBytes(item.sizeBytes || actualDiskSize),
      ramFormatted: item.ramFormatted || formatRam(item.ramRequirementMb),
      modalities: Array.isArray(item.modalities) && item.modalities.length > 0
        ? item.modalities
        : (item.kind === 'vision' ? ['image->text', 'text->text']
          : item.kind === 'image_gen' ? ['text->image']
          : item.kind === 'image_edit' ? ['image->image']
          : item.kind === 'voice_pack' ? ['audio->text', 'text->audio']
          : ['text->text']),
      isFirebaseSynced,
    };
  });

  return enrichedModels;
});

/**
 * Add New Model:
 * Writes to Firebase Realtime Database at /models/<cleanId>.json
 * Must accept: downloadUrl (Backblaze B2 link), ramRequirementMb, sizeBytes
 */
ipcMain.handle('models:add', async (_event, modelData) => {
  try {
    const {
      name,
      id,
      downloadUrl,
      ramRequirementMb,
      sizeBytes,
      kind = 'text',
      modalities = [],
      format = 'GGUF',
      runtime = 'GGUF Edge Runtime',
      version = '1.0.0',
      tagline = '',
      capabilities = [],
      languages = ['English'],
      recommendedFor = '',
      tier = 'Tier 1 (Lightweight)',
      filename,
      downloadImmediately = false,
    } = modelData;

    if (!name || !downloadUrl) {
      return { success: false, error: 'Model Name and Download URL are mandatory.' };
    }

    const cleanId = (id || name).trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '-');

    let finalFilename = filename?.trim();
    if (!finalFilename) {
      try {
        const parsedUrl = new URL(downloadUrl);
        finalFilename = path.basename(parsedUrl.pathname);
      } catch {
        finalFilename = `${cleanId}.gguf`;
      }
    }
    if (!finalFilename || finalFilename === '/' || !finalFilename.includes('.')) {
      finalFilename = `${cleanId}.gguf`;
    }

    const ramMb = parseInt(ramRequirementMb, 10) || 1024;
    const bytes = parseInt(sizeBytes, 10) || 0;

    const resolvedModalities = Array.isArray(modalities) && modalities.length > 0
      ? modalities
      : (kind === 'vision' ? ['image->text', 'text->text']
        : kind === 'image_gen' ? ['text->image']
        : kind === 'image_edit' ? ['image->image']
        : kind === 'voice_pack' ? ['audio->text', 'text->audio']
        : ['text->text']);

    const newModelEntry = {
      id: cleanId,
      name: name.trim(),
      tagline: tagline.trim() || `${name} for on-device reasoning and automation`,
      kind: kind || 'text',
      modalities: resolvedModalities,
      filename: finalFilename,
      downloadUrl: downloadUrl.trim(),
      ramRequirementMb: ramMb,
      ramFormatted: formatRam(ramMb),
      sizeBytes: bytes,
      sizeFormatted: formatBytes(bytes),
      format: format || 'GGUF',
      runtime: runtime || 'GGUF Edge Runtime',
      tier: tier || (ramMb > 2048 ? 'Tier 2 (Heavy)' : 'Tier 1 (Lightweight)'),
      version: version.trim() || '1.0.0',
      capabilities: Array.isArray(capabilities) && capabilities.length > 0 ? capabilities : ['Fast Response', 'Device Automation'],
      languages: Array.isArray(languages) && languages.length > 0 ? languages : ['English'],
      recommendedFor: recommendedFor.trim() || (ramMb > 2048 ? '4GB - 6GB+ RAM Devices' : '3GB - 4GB RAM Devices'),
      createdAt: new Date().toISOString(),
      status: 'NOT_INSTALLED',
    };

    // Strict Admin Authorization Check (Service Account OR Admin Email/Password)
    if (!isAuthorizedAdmin()) {
      return {
        success: false,
        error: 'Authorization Required: Please sign in with your Admin Email & Password or load your Service Account in "Admin Users".',
      };
    }

    // 1. Write to Firebase Realtime Database
    const fbRes = await firebasePut(`models/${cleanId}`, newModelEntry);
    if (!fbRes.ok) {
      return {
        success: false,
        error: `Firebase Realtime Database Write Denied (${fbRes.statusCode || 401}): ${fbRes.error || 'Permission denied. Only authorized admins with { admin: true } can add models.'}`,
      };
    }

    // 2. Optional local background download
    if (downloadImmediately && downloadUrl.startsWith('http')) {
      startDownloadStream(newModelEntry);
    }

    return {
      success: true,
      model: newModelEntry,
      publishedToFirebase: true,
    };
  } catch (error) {
    console.error('Error adding model:', error);
    return { success: false, error: error.message };
  }
});

// Edit / Update Existing Model (in Firebase RTDB & local catalog)
ipcMain.handle('models:update', async (_event, modelData) => {
  try {
    const {
      id,
      name,
      downloadUrl,
      ramRequirementMb,
      sizeBytes,
      kind = 'text',
      modalities = [],
      format = 'GGUF',
      runtime = 'GGUF Edge Runtime',
      version = '1.0.0',
      tagline = '',
      capabilities = [],
      languages = ['English'],
      recommendedFor = '',
      tier = 'Tier 1 (Lightweight)',
      filename,
    } = modelData;

    if (!id) {
      return { success: false, error: 'Model ID is required to update an existing model.' };
    }
    if (!name || !downloadUrl) {
      return { success: false, error: 'Model Name and Download URL are mandatory.' };
    }

    // Strict Admin Authorization Check (Service Account OR Admin Email/Password)
    if (!isAuthorizedAdmin()) {
      return {
        success: false,
        error: 'Authorization Required: Please sign in with your Admin Email & Password or load your Service Account in "Admin Users".',
      };
    }

    const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '-');
    const ramMb = parseInt(ramRequirementMb, 10) || 1024;
    const bytes = parseInt(sizeBytes, 10) || 0;

    const existingRes = await firebaseGet(`models/${cleanId}`);
    const existing = (existingRes.ok && existingRes.data && typeof existingRes.data === 'object') ? existingRes.data : {};

    const updatedModelEntry = {
      ...existing,
      id: cleanId,
      name: name.trim(),
      tagline: tagline.trim() || `${name} for on-device reasoning and automation`,
      kind: kind || 'text',
      modalities: Array.isArray(modalities) && modalities.length > 0 ? modalities : ['text->text'],
      filename: filename?.trim() || existing.filename || `${cleanId}.gguf`,
      downloadUrl: downloadUrl.trim(),
      ramRequirementMb: ramMb,
      ramFormatted: formatRam(ramMb),
      sizeBytes: bytes,
      sizeFormatted: formatBytes(bytes),
      format: format || 'GGUF',
      runtime: runtime || 'GGUF Edge Runtime',
      tier: tier || (ramMb > 2048 ? 'Tier 2 (Heavy)' : 'Tier 1 (Lightweight)'),
      version: version.trim() || '1.0.0',
      capabilities: Array.isArray(capabilities) && capabilities.length > 0 ? capabilities : ['Fast Response'],
      languages: Array.isArray(languages) && languages.length > 0 ? languages : ['English'],
      recommendedFor: recommendedFor.trim() || (ramMb > 2048 ? '4GB - 6GB+ RAM Devices' : '3GB - 4GB RAM Devices'),
      updatedAt: new Date().toISOString(),
    };

    // 1. Write update to Firebase Realtime Database
    const fbRes = await firebasePut(`models/${cleanId}`, updatedModelEntry);
    if (!fbRes.ok) {
      return {
        success: false,
        error: `Firebase Realtime Database Update Denied (${fbRes.statusCode || 401}): ${fbRes.error || 'Permission denied. Only authorized admins with { admin: true } can edit models.'}`,
      };
    }

    return {
      success: true,
      model: updatedModelEntry,
      publishedToFirebase: true,
    };
  } catch (error) {
    console.error('Error updating model:', error);
    return { success: false, error: error.message };
  }
});

// Delete Model (from Firebase & local)
ipcMain.handle('models:delete', async (_event, { modelId, deleteFile }) => {
  try {
    // Strict Admin Authorization Check (Service Account OR Admin Email/Password)
    if (!isAuthorizedAdmin()) {
      return {
        success: false,
        error: 'Authorization Required: Please sign in with your Admin Email & Password or load your Service Account in "Admin Users".',
      };
    }

    // 1. Delete from Firebase
    const fbRes = await firebaseDelete(`models/${modelId}`);
    if (!fbRes.ok) {
      return {
        success: false,
        error: `Firebase Realtime Database Delete Denied (${fbRes.statusCode || 401}): ${fbRes.error || 'Permission denied. Only authorized admins with { admin: true } can delete models.'}`,
      };
    }

    // 2. Optionally delete file from server storage
    if (deleteFile) {
      const candidates = [
        path.join(LLM_DIR, `${modelId}.gguf`),
        path.join(LLM_DIR, `${modelId}.bin`),
      ];
      if (fs.existsSync(LLM_DIR)) {
        const files = fs.readdirSync(LLM_DIR);
        const match = files.find(f => f.toLowerCase().includes(modelId.toLowerCase()));
        if (match) candidates.push(path.join(LLM_DIR, match));
      }

      for (const filePath of candidates) {
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch {}
        }
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Seed / Sync Default Models to Firebase
ipcMain.handle('models:seedFirebase', async () => {
  try {
    if (!isAuthorizedAdmin()) {
      return {
        success: false,
        error: 'Authorization Required: Please sign in with your Admin Email & Password or load your Service Account in "Admin Users" before seeding models.',
      };
    }

    let successCount = 0;
    for (const model of SEED_CATALOG) {
      const res = await firebasePut(`models/${model.id}`, model);
      if (res.ok) {
        successCount++;
      } else {
        return {
          success: false,
          error: `Firebase Realtime Database Seed Denied (${res.statusCode || 401}): ${res.error || 'Permission denied.'}`,
        };
      }
    }
    return { success: true, count: successCount, total: SEED_CATALOG.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Check Firebase RTDB Connection & Latency
ipcMain.handle('firebase:checkStatus', async () => {
  const start = Date.now();
  try {
    const res = await firebaseGet('models');
    const latencyMs = Date.now() - start;
    return {
      online: res.ok,
      statusCode: res.statusCode,
      latencyMs,
      databaseUrl: getFirebaseRtdbUrl(),
      modelCount: res.data ? (Array.isArray(res.data) ? res.data.length : Object.keys(res.data).length) : 0,
    };
  } catch (err) {
    return {
      online: false,
      latencyMs: Date.now() - start,
      databaseUrl: getFirebaseRtdbUrl(),
      error: err.message,
    };
  }
});

// Verify SHA-256 Checksum
ipcMain.handle('models:verifySha256', async (_event, modelId) => {
  try {
    const fbRes = await firebaseGet(`models/${modelId}`);
    const model = (fbRes.ok && fbRes.data && typeof fbRes.data === 'object') ? fbRes.data : null;
    const targetFilename = model?.filename || `${modelId}.gguf`;
    const targetPath = path.join(LLM_DIR, targetFilename);

    if (!fs.existsSync(targetPath)) {
      return { success: false, error: `File ${targetFilename} does not exist on disk.` };
    }

    const sha256 = await calculateFileSha256(targetPath);
    return { success: true, sha256, filePath: targetPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Fetch Headers & Size from Remote URL (Supports Backblaze B2, S3, HuggingFace)
ipcMain.handle('models:fetchHeaders', async (_event, url) => {
  return new Promise(resolve => {
    try {
      const parsed = new URL(url);
      const client = parsed.protocol === 'https:' ? https : http;

      const req = client.request(
        url,
        {
          method: 'HEAD',
          headers: {
            'User-Agent': 'SaraAI-Admin-Desktop/1.0',
          },
          timeout: 10000,
        },
        res => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, url).toString();
            return resolve(fetchHeadersRecursive(redirectUrl, 1));
          }

          const contentLength = parseInt(res.headers['content-length'] || '0', 10);
          const disposition = res.headers['content-disposition'] || '';
          let filename = '';
          const match = disposition.match(/filename=["']?([^"';]+)["']?/i);
          if (match && match[1]) {
            filename = match[1];
          } else {
            filename = path.basename(parsed.pathname) || 'model.gguf';
          }

          resolve({
            success: true,
            sizeBytes: contentLength,
            sizeFormatted: formatBytes(contentLength),
            contentType: res.headers['content-type'] || 'application/octet-stream',
            filename,
            statusCode: res.statusCode,
          });
        }
      );

      req.on('error', err => resolve({ success: false, error: err.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Connection timed out while fetching URL headers.' });
      });
      req.end();
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

function fetchHeadersRecursive(url, depth = 0) {
  if (depth > 5) return Promise.resolve({ success: false, error: 'Too many redirects.' });
  return new Promise(resolve => {
    try {
      const parsed = new URL(url);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.request(
        url,
        {
          method: 'HEAD',
          headers: { 'User-Agent': 'SaraAI-Admin-Desktop/1.0' },
          timeout: 10000,
        },
        res => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, url).toString();
            return resolve(fetchHeadersRecursive(redirectUrl, depth + 1));
          }
          const contentLength = parseInt(res.headers['content-length'] || '0', 10);
          const disposition = res.headers['content-disposition'] || '';
          let filename = '';
          const match = disposition.match(/filename=["']?([^"';]+)["']?/i);
          if (match && match[1]) {
            filename = match[1];
          } else {
            filename = path.basename(parsed.pathname) || 'model.gguf';
          }

          resolve({
            success: true,
            sizeBytes: contentLength,
            sizeFormatted: formatBytes(contentLength),
            contentType: res.headers['content-type'] || 'application/octet-stream',
            filename,
            statusCode: res.statusCode,
          });
        }
      );
      req.on('error', err => resolve({ success: false, error: err.message }));
      req.end();
    } catch (e) {
      resolve({ success: false, error: e.message });
    }
  });
}

// Select local model file and extract metadata directly from the model
ipcMain.handle('models:selectLocalModel', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select AI Model from Local Storage',
      properties: ['openFile'],
      filters: [
        { name: 'AI Models (*.gguf, *.bin, *.onnx, *.tflite, *.safetensors)', extensions: ['gguf', 'bin', 'onnx', 'tflite', 'safetensors'] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const sourcePath = result.filePaths[0];
    const inspected = await inspectModelFile(sourcePath);
    return {
      canceled: false,
      ...inspected,
    };
  } catch (error) {
    return { canceled: false, error: error.message };
  }
});

// Import local file into server/LLM (backward compatibility)
ipcMain.handle('models:importLocalFile', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import AI Model into Sara AI Server',
      properties: ['openFile'],
      filters: [
        { name: 'Model Files (*.gguf, *.bin, *.onnx, *.tflite, *.safetensors)', extensions: ['gguf', 'bin', 'onnx', 'tflite', 'safetensors'] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const sourcePath = result.filePaths[0];
    const filename = path.basename(sourcePath);
    const destPath = path.join(LLM_DIR, filename);

    // If file is not already in LLM_DIR, copy it
    if (path.resolve(sourcePath) !== path.resolve(destPath)) {
      fs.copyFileSync(sourcePath, destPath);
    }

    const inspected = await inspectModelFile(destPath);
    return {
      canceled: false,
      ...inspected,
      suggestedId: inspected.modelId,
      suggestedName: inspected.displayName,
      sizeBytes: inspected.fileSizeBytes,
      ext: path.extname(filename).replace('.', '').toUpperCase(),
    };
  } catch (error) {
    return { canceled: false, error: error.message };
  }
});

// Select local voice pack
ipcMain.handle('voicepacks:selectLocalPack', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Voice Pack from Local Storage',
      properties: ['openFile'],
      filters: [
        { name: 'Voice Packs (*.bin, *.onnx, *.tar.gz, *.zip)', extensions: ['bin', 'onnx', 'tar.gz', 'zip', 'gz'] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const sourcePath = result.filePaths[0];
    const inspected = await inspectModelFile(sourcePath);
    return {
      canceled: false,
      ...inspected,
      kind: 'voice_pack',
      runtime: inspected.runtime.includes('Piper') ? inspected.runtime : 'Whisper + Piper ONNX',
    };
  } catch (error) {
    return { canceled: false, error: error.message };
  }
});

// ==========================================
// IPC HANDLERS: Backblaze B2 Cloud Storage
// ==========================================
ipcMain.handle('b2:getConfig', async () => {
  const config = getB2Config();
  return {
    ...config,
    applicationKeyMasked: config.applicationKey ? `${config.applicationKey.slice(0, 4)}••••••••${config.applicationKey.slice(-4)}` : '',
    hasCredentials: Boolean(config.keyId && config.applicationKey),
  };
});

ipcMain.handle('b2:saveConfig', async (_event, config) => {
  return saveB2Config(config);
});

ipcMain.handle('b2:testConnection', async (_event, customConfig) => {
  return testB2Connection(customConfig);
});

ipcMain.handle('b2:uploadModel', async (_event, params) => {
  try {
    const { filePath, uploadType = 'llm', customFilename, uploadId = `upload_${Date.now()}` } = params;
    const result = await uploadToBackblaze({
      filePath,
      uploadType,
      customFilename,
      uploadId,
      onProgress: (progressData) => {
        mainWindow?.webContents.send('b2:uploadProgress', progressData);
      },
    });
    return result;
  } catch (error) {
    mainWindow?.webContents.send('b2:uploadProgress', {
      status: 'FAILED',
      error: error.message,
    });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('b2:cancelUpload', async (_event, uploadId) => {
  const success = cancelUpload(uploadId);
  return { success };
});

// Download Model from URL to Server Storage (Backblaze B2 / Direct)
ipcMain.handle('models:download', async (_event, modelId) => {
  const fbRes = await firebaseGet(`models/${modelId}`);
  const model = (fbRes.ok && fbRes.data && typeof fbRes.data === 'object') ? fbRes.data : null;
  if (!model || !model.downloadUrl) {
    return { success: false, error: 'Model or Download URL not found in Firebase database.' };
  }
  return startDownloadStream(model);
});

// Cancel active download
ipcMain.handle('models:cancelDownload', async (_event, modelId) => {
  if (activeDownloads.has(modelId)) {
    const active = activeDownloads.get(modelId);
    active.isCancelled = true;
    if (active.stream) active.stream.destroy();
    if (active.clientReq) active.clientReq.destroy();
    if (fs.existsSync(active.tempPath)) {
      try { fs.unlinkSync(active.tempPath); } catch {}
    }
    activeDownloads.delete(modelId);

    mainWindow?.webContents.send('models:downloadProgress', {
      modelId,
      status: 'CANCELLED',
      progress: 0,
      downloadedBytes: 0,
    });
    return { success: true };
  }
  return { success: false, error: 'No active download found for this model.' };
});

function startDownloadStream(model) {
  if (activeDownloads.has(model.id)) {
    return { success: false, error: 'Download is already in progress.' };
  }

  const filename = model.filename || `${model.id}.gguf`;
  const destPath = path.join(LLM_DIR, filename);
  const tempPath = `${destPath}.downloading`;

  const downloadState = {
    modelId: model.id,
    url: model.downloadUrl,
    filePath: destPath,
    tempPath,
    isCancelled: false,
    startTime: Date.now(),
    lastSpeedCalc: Date.now(),
    bytesSinceLastCalc: 0,
    currentSpeed: '0 KB/s',
    totalBytes: model.sizeBytes || 0,
    downloadedBytes: 0,
  };

  activeDownloads.set(model.id, downloadState);

  mainWindow?.webContents.send('models:downloadProgress', {
    modelId: model.id,
    modelName: model.name,
    status: 'DOWNLOADING',
    progress: 0,
    downloadedBytes: 0,
    totalBytes: model.sizeBytes || 0,
    speed: 'Starting...',
  });

  executeStreamingDownload(model.downloadUrl, downloadState, model);
  return { success: true };
}

function executeStreamingDownload(targetUrl, state, model, redirectCount = 0) {
  if (redirectCount > 5) {
    activeDownloads.delete(model.id);
    mainWindow?.webContents.send('models:downloadProgress', {
      modelId: model.id,
      status: 'FAILED',
      error: 'Exceeded maximum redirects.',
    });
    return;
  }

  try {
    const parsed = new URL(targetUrl);
    const client = parsed.protocol === 'https:' ? https : http;

    const req = client.get(
      targetUrl,
      {
        headers: {
          'User-Agent': 'SaraAI-Admin-Desktop/1.0',
        },
      },
      res => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          const nextUrl = new URL(res.headers.location, targetUrl).toString();
          return executeStreamingDownload(nextUrl, state, model, redirectCount + 1);
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          activeDownloads.delete(model.id);
          mainWindow?.webContents.send('models:downloadProgress', {
            modelId: model.id,
            status: 'FAILED',
            error: `Server responded with HTTP ${res.statusCode}`,
          });
          return;
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10) || state.totalBytes;
        state.totalBytes = totalBytes;

        const fileStream = fs.createWriteStream(state.tempPath);
        state.stream = fileStream;

        res.on('data', chunk => {
          if (state.isCancelled) return;
          state.downloadedBytes += chunk.length;
          state.bytesSinceLastCalc += chunk.length;

          const now = Date.now();
          if (now - state.lastSpeedCalc > 500) {
            const timeDiff = (now - state.lastSpeedCalc) / 1000;
            const speedBytesPerSec = state.bytesSinceLastCalc / timeDiff;
            state.currentSpeed = `${formatBytes(speedBytesPerSec)}/s`;
            state.lastSpeedCalc = now;
            state.bytesSinceLastCalc = 0;

            const progress = totalBytes > 0 ? Math.min(100, Math.round((state.downloadedBytes / totalBytes) * 100)) : 0;

            mainWindow?.webContents.send('models:downloadProgress', {
              modelId: model.id,
              modelName: model.name,
              status: 'DOWNLOADING',
              progress,
              downloadedBytes: state.downloadedBytes,
              downloadedFormatted: formatBytes(state.downloadedBytes),
              totalBytes,
              totalFormatted: formatBytes(totalBytes),
              speed: state.currentSpeed,
            });
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', async () => {
          fileStream.close(async () => {
            if (state.isCancelled) return;
            if (fs.existsSync(state.filePath)) {
              try { fs.unlinkSync(state.filePath); } catch {}
            }
            fs.renameSync(state.tempPath, state.filePath);

            activeDownloads.delete(model.id);

            mainWindow?.webContents.send('models:downloadProgress', {
              modelId: model.id,
              modelName: model.name,
              status: 'READY',
              progress: 100,
              downloadedBytes: state.downloadedBytes,
              downloadedFormatted: formatBytes(state.downloadedBytes),
              totalBytes: state.downloadedBytes,
              totalFormatted: formatBytes(state.downloadedBytes),
              speed: 'Complete',
            });
          });
        });

        fileStream.on('error', err => {
          activeDownloads.delete(model.id);
          mainWindow?.webContents.send('models:downloadProgress', {
            modelId: model.id,
            status: 'FAILED',
            error: err.message,
          });
        });
      }
    );

    state.clientReq = req;
    req.on('error', err => {
      activeDownloads.delete(model.id);
      mainWindow?.webContents.send('models:downloadProgress', {
        modelId: model.id,
        status: 'FAILED',
        error: err.message,
      });
    });
  } catch (error) {
    activeDownloads.delete(model.id);
    mainWindow?.webContents.send('models:downloadProgress', {
      modelId: model.id,
      status: 'FAILED',
      error: error.message,
    });
  }
}

// ==========================================
// IPC HANDLERS: Voice Packs Management (Firebase RTDB)
// ==========================================
ipcMain.handle('voicepacks:list', async () => {
  try {
    const fbRes = await firebaseGet('voicepacks');
    if (fbRes.ok && fbRes.data) {
      if (Array.isArray(fbRes.data)) return fbRes.data.filter(Boolean);
      return Object.entries(fbRes.data).map(([key, val]) => ({ id: val.id || key, ...val }));
    }
    return [];
  } catch (err) {
    return [];
  }
});

ipcMain.handle('voicepacks:add', async (_event, packData) => {
  try {
    if (!isAuthorizedAdmin()) {
      return {
        success: false,
        error: 'Authorization Required: Please sign in with your Admin Email & Password or load your Service Account in "Admin Users".',
      };
    }
    const cleanId = (packData.id || packData.name).trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '-');
    const fbRes = await firebasePut(`voicepacks/${cleanId}`, { id: cleanId, ...packData });
    if (!fbRes.ok) {
      return {
        success: false,
        error: `Firebase Realtime Database Write Denied (${fbRes.statusCode || 401}): ${fbRes.error || 'Permission denied.'}`,
      };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('voicepacks:delete', async (_event, { packId, deleteFile }) => {
  try {
    if (!isAuthorizedAdmin()) {
      return {
        success: false,
        error: 'Authorization Required: Please sign in with your Admin Email & Password or load your Service Account in "Admin Users".',
      };
    }
    const fbRes = await firebaseDelete(`voicepacks/${packId}`);
    if (!fbRes.ok) {
      return {
        success: false,
        error: `Firebase Realtime Database Delete Denied (${fbRes.statusCode || 401}): ${fbRes.error || 'Permission denied.'}`,
      };
    }
    if (deleteFile) {
      const candidates = [
        path.join(VOICEPACK_DIR, `${packId}.bin`),
        path.join(VOICEPACK_DIR, packId),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Seed Voice Packs to Firebase Realtime Database
ipcMain.handle('voicepacks:seedFirebase', async () => {
  try {
    if (!isAuthorizedAdmin()) {
      return {
        success: false,
        error: 'Authorization Required: Please sign in with your Admin Email & Password or load your Service Account in "Admin Users".',
      };
    }
    let successCount = 0;
    for (const pack of SEED_VOICEPACKS) {
      const res = await firebasePut(`voicepacks/${pack.id}`, pack);
      if (res.ok) {
        successCount++;
      } else {
        return {
          success: false,
          error: `Firebase Realtime Database Seed Denied (${res.statusCode || 401}): ${res.error || 'Permission denied.'}`,
        };
      }
    }
    return { success: true, count: successCount, total: SEED_VOICEPACKS.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ==========================================
// IPC HANDLERS: Server / Firebase Test Explorer
// ==========================================
ipcMain.handle('server:checkHealth', async () => {
  // Pings Firebase Realtime Database
  const start = Date.now();
  const fb = await firebaseGet('models');
  const latencyMs = Date.now() - start;

  return {
    online: fb.ok,
    status: fb.ok ? 'ONLINE' : 'OFFLINE',
    latencyMs,
    endpoint: getFirebaseRtdbUrl(),
    provider: 'Firebase Realtime Database',
  };
});

ipcMain.handle('server:testEndpoint', async (_event, { endpoint, method }) => {
  const startTime = Date.now();
  return new Promise(resolve => {
    let clean = endpoint.trim();
    if (clean.startsWith('/')) clean = clean.slice(1);
    if (!clean.endsWith('.json') && !clean.startsWith('http')) {
      clean = `${clean}.json`;
    }

    const baseUrl = getFirebaseRtdbUrl();
    const targetUrl = clean.startsWith('http') ? clean : `${baseUrl}/${clean}`;

    try {
      const parsed = new URL(targetUrl);
      const client = parsed.protocol === 'https:' ? https : http;

      const req = client.request(
        parsed,
        { method: method || 'GET', timeout: 8000 },
        res => {
          let body = '';
          res.on('data', chunk => (body += chunk));
          res.on('end', () => {
            const durationMs = Date.now() - startTime;
            try {
              resolve({
                success: res.statusCode >= 200 && res.statusCode < 300,
                statusCode: res.statusCode,
                durationMs,
                data: JSON.parse(body),
              });
            } catch {
              resolve({
                success: res.statusCode >= 200 && res.statusCode < 300,
                statusCode: res.statusCode,
                durationMs,
                data: body,
              });
            }
          });
        }
      );

      req.on('error', err => {
        resolve({
          success: false,
          error: err.message,
          durationMs: Date.now() - startTime,
        });
      });

      req.end();
    } catch (e) {
      resolve({ success: false, error: e.message, durationMs: Date.now() - startTime });
    }
  });
});

ipcMain.handle('server:getNetworkIps', async () => {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({ name, ip: net.address });
      }
    }
  }
  return ips;
});

ipcMain.handle('server:readConfig', async () => {
  try {
    if (!fs.existsSync(ENV_PATH)) return {};
    const content = fs.readFileSync(ENV_PATH, 'utf-8');
    const lines = content.split(/\r?\n/);
    const config = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        config[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      }
    }
    return config;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('server:saveConfig', async (_event, config) => {
  try {
    let output = '# Sara AI Model Server & Firebase Configuration\n';
    for (const [k, v] of Object.entries(config)) {
      output += `${k}=${v}\n`;
    }
    fs.writeFileSync(ENV_PATH, output, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('server:runAdbReverse', async (_event, port = 8081) => {
  return new Promise(resolve => {
    exec(`adb reverse tcp:${port} tcp:${port}`, (error, _stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message });
      } else {
        resolve({ success: true, message: `adb reverse tcp:${port} tcp:${port} executed successfully!` });
      }
    });
  });
});

// ==========================================
// IPC HANDLERS: System & Utilities
// ==========================================
ipcMain.handle('system:getStats', async () => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  let llmDirBytes = 0;
  try {
    const files = fs.readdirSync(LLM_DIR);
    for (const f of files) {
      try { llmDirBytes += fs.statSync(path.join(LLM_DIR, f)).size; } catch {}
    }
  } catch {}

  let voicePackBytes = 0;
  try {
    const files = fs.readdirSync(VOICEPACK_DIR);
    for (const f of files) {
      try { voicePackBytes += fs.statSync(path.join(VOICEPACK_DIR, f)).size; } catch {}
    }
  } catch {}

  return {
    osPlatform: os.platform(),
    osArch: os.arch(),
    cpuCount: os.cpus().length,
    cpuModel: os.cpus()[0]?.model || 'Standard CPU',
    totalMem,
    totalMemFormatted: formatBytes(totalMem),
    freeMem,
    freeMemFormatted: formatBytes(freeMem),
    usedMem,
    usedMemFormatted: formatBytes(usedMem),
    memUsagePercent: Math.round((usedMem / totalMem) * 100),
    llmDirBytes,
    llmDirFormatted: formatBytes(llmDirBytes),
    voicePackBytes,
    voicePackFormatted: formatBytes(voicePackBytes),
    totalStorageBytes: llmDirBytes + voicePackBytes,
    totalStorageFormatted: formatBytes(llmDirBytes + voicePackBytes),
  };
});

ipcMain.handle('system:openFolder', async (_event, target) => {
  const targetDir = target === 'voicepacks' ? VOICEPACK_DIR : LLM_DIR;
  shell.openPath(targetDir);
  return { success: true };
});

ipcMain.handle('system:copyToClipboard', async (_event, text) => {
  clipboard.writeText(text);
  return { success: true };
});

ipcMain.handle('system:exportCatalog', async () => {
  let catalog = [];
  const fbRes = await firebaseGet('models');
  if (fbRes.ok && fbRes.data) {
    if (Array.isArray(fbRes.data)) {
      catalog = fbRes.data.filter(Boolean);
    } else if (typeof fbRes.data === 'object') {
      catalog = Object.entries(fbRes.data).map(([key, val]) => ({ id: val.id || key, ...val }));
    }
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Sara AI Model Catalog',
    defaultPath: 'sara-models-catalog.json',
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
  });

  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, JSON.stringify(catalog, null, 2), 'utf-8');
    return { success: true, filePath: result.filePath };
  }
  return { success: false, canceled: true };
});

ipcMain.handle('system:importCatalog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Sara AI Model Catalog',
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['openFile'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const content = fs.readFileSync(result.filePaths[0], 'utf-8');
      const imported = JSON.parse(content);
      if (Array.isArray(imported)) {
        // Direct sync to Firebase Realtime Database
        for (const m of imported) {
          if (m.id) await firebasePut(`models/${m.id}`, m);
        }
        return { success: true, count: imported.length };
      }
      return { success: false, error: 'Catalog must be a JSON array.' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: false, canceled: true };
});

// ==========================================
// IPC HANDLERS: Firebase Admin & User Management
// ==========================================
ipcMain.handle('adminUsers:getStatus', async () => {
  return firebaseAdminService.getStatus();
});

ipcMain.handle('adminUsers:selectServiceAccountFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Firebase Service Account Key JSON (In-Memory Session)',
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['openFile'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    // In-memory loading: strictly into RAM, zero disk persistence
    return firebaseAdminService.loadServiceAccountFromPath(result.filePaths[0]);
  }
  return { success: false, canceled: true };
});

ipcMain.handle('adminUsers:setServiceAccountPath', async (_event, filePath) => {
  return firebaseAdminService.loadServiceAccountFromPath(filePath);
});

ipcMain.handle('adminUsers:unloadServiceAccount', async () => {
  return firebaseAdminService.unloadServiceAccount();
});

ipcMain.handle('adminUsers:getUser', async (_event, uid) => {
  return await firebaseAdminService.getUser(uid);
});

ipcMain.handle('adminUsers:promoteToAdmin', async (_event, uid) => {
  return await firebaseAdminService.promoteToAdmin(uid);
});

ipcMain.handle('adminUsers:revokeAdmin', async (_event, uid) => {
  return await firebaseAdminService.revokeAdmin(uid);
});

ipcMain.handle('adminUsers:fetchAdminUsers', async () => {
  return await firebaseAdminService.fetchAdminUsers();
});

ipcMain.handle('adminUsers:getAuditLog', async () => {
  return firebaseAdminService.getAuditLog();
});

ipcMain.handle('adminUsers:clearAuditLog', async () => {
  return firebaseAdminService.clearAuditLog();
});

// Admin Email & Password Authentication Handlers
ipcMain.handle('auth:login', async (_event, { email, password }) => {
  return adminAuthService.signInWithEmailPassword(email, password);
});

ipcMain.handle('auth:logout', async () => {
  return adminAuthService.signOut();
});

ipcMain.handle('auth:getCurrentUser', async () => {
  return adminAuthService.getCurrentUser();
});

// Automatic security purge on app exit
app.on('will-quit', () => {
  try {
    firebaseAdminService.unloadServiceAccount();
    adminAuthService.signOut();
  } catch (_) {}
});

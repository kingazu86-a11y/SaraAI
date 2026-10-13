const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

const ADMIN_ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.resolve(ADMIN_ROOT, '.env');

// Default Backblaze B2 settings provided by user
const DEFAULT_B2_CONFIG = {
  endpoint: 's3.us-east-005.backblazeb2.com',
  region: 'us-east-005',
  bucketId: 'e36955b7c0526c7ba1050614',
  bucketName: 'SaraAI-Models',
  llmFolder: 'LLMs',
  voicePackFolder: 'VoicePacks',
  keyId: '005395702cb15640000000002',
  applicationKey: 'K005ObyDXddzxp4bK8O8w8B9/qwlKIk',
  downloadPrefix: 'https://f005.backblazeb2.com',
};

// Active uploads map: uploadId -> { req, isCancelled }
const activeUploads = new Map();

/**
 * Helper to read current .env file
 */
function readEnvFile() {
  if (!fs.existsSync(ENV_PATH)) return {};
  try {
    const content = fs.readFileSync(ENV_PATH, 'utf-8');
    const lines = content.split(/\r?\n/);
    const env = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      }
    }
    return env;
  } catch {
    return {};
  }
}

/**
 * Helper to write to .env file preserving existing non-B2 settings
 */
function writeEnvFile(updates) {
  try {
    const existing = readEnvFile();
    const merged = { ...existing, ...updates };
    let content = '# Sara AI Model Server & Cloud Configuration\n';
    for (const [k, v] of Object.entries(merged)) {
      content += `${k}=${v}\n`;
    }
    fs.writeFileSync(ENV_PATH, content, 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to write .env:', err);
    return false;
  }
}

/**
 * Get current Backblaze B2 Configuration
 */
function getB2Config() {
  const env = readEnvFile();
  return {
    endpoint: env.B2_ENDPOINT || DEFAULT_B2_CONFIG.endpoint,
    region: env.B2_REGION || DEFAULT_B2_CONFIG.region,
    bucketId: env.B2_BUCKET_ID || DEFAULT_B2_CONFIG.bucketId,
    bucketName: env.B2_BUCKET_NAME || DEFAULT_B2_CONFIG.bucketName,
    llmFolder: env.B2_LLM_FOLDER || DEFAULT_B2_CONFIG.llmFolder,
    voicePackFolder: env.B2_VOICEPACK_FOLDER || DEFAULT_B2_CONFIG.voicePackFolder,
    keyId: env.B2_KEY_ID || '',
    applicationKey: env.B2_APPLICATION_KEY || '',
    downloadPrefix: env.B2_DOWNLOAD_PREFIX || DEFAULT_B2_CONFIG.downloadPrefix,
  };
}

/**
 * Save updated Backblaze B2 Configuration
 */
function saveB2Config(config) {
  const updates = {
    B2_ENDPOINT: config.endpoint || DEFAULT_B2_CONFIG.endpoint,
    B2_REGION: config.region || DEFAULT_B2_CONFIG.region,
    B2_BUCKET_ID: config.bucketId || DEFAULT_B2_CONFIG.bucketId,
    B2_BUCKET_NAME: config.bucketName || DEFAULT_B2_CONFIG.bucketName,
    B2_LLM_FOLDER: config.llmFolder || DEFAULT_B2_CONFIG.llmFolder,
    B2_VOICEPACK_FOLDER: config.voicePackFolder || DEFAULT_B2_CONFIG.voicePackFolder,
  };

  if (config.keyId !== undefined) {
    updates.B2_KEY_ID = config.keyId.trim();
  }
  if (config.applicationKey !== undefined && !config.applicationKey.includes('•••')) {
    updates.B2_APPLICATION_KEY = config.applicationKey.trim();
  }
  if (config.downloadPrefix) {
    updates.B2_DOWNLOAD_PREFIX = config.downloadPrefix.trim();
  }

  const success = writeEnvFile(updates);
  return { success, config: getB2Config() };
}

/**
 * Format bytes into human-readable string
 */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format ETA seconds into human readable duration
 */
function formatEta(seconds) {
  if (!seconds || !isFinite(seconds) || seconds < 0) return '--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const remSec = Math.round(seconds % 60);
  return `${mins}m ${remSec}s`;
}

/**
 * Native HTTPS Request Promise Helper
 */
function sendRequest(urlStr, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const client = parsed.protocol === 'http:' ? http : https;

    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 30000,
    };

    const req = client.request(parsed, reqOptions, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json || body,
          rawBody: body,
          ok: res.statusCode >= 200 && res.statusCode < 300,
        });
      });
    });

    req.on('error', err => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request to ${parsed.hostname} timed out.`));
    });

    if (postData) {
      if (Buffer.isBuffer(postData) || typeof postData === 'string') {
        req.write(postData);
      } else {
        req.write(JSON.stringify(postData));
      }
    }
    req.end();
  });
}

/**
 * Authorize Account with Backblaze B2 API
 */
async function authorizeAccount(keyId, applicationKey) {
  const credentials = Buffer.from(`${keyId}:${applicationKey}`).toString('base64');
  const res = await sendRequest('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
    method: 'GET',
    headers: {
      Authorization: `Basic ${credentials}`,
    },
    timeout: 15000,
  });

  if (!res.ok) {
    const errMsg = typeof res.data === 'object' && res.data.message ? res.data.message : `HTTP ${res.statusCode}`;
    throw new Error(`Backblaze Authorization Failed: ${errMsg}`);
  }

  const data = res.data || {};
  const storageApi = data.apiInfo?.storageApi || {};
  const apiUrl = storageApi.apiUrl || data.apiUrl;
  const downloadUrl = storageApi.downloadUrl || data.downloadUrl || 'https://f005.backblazeb2.com';
  const s3ApiUrl = storageApi.s3ApiUrl || data.s3ApiUrl || 'https://s3.us-east-005.backblazeb2.com';
  const bucketId = storageApi.bucketId || data.allowed?.bucketId;
  const bucketName = storageApi.bucketName || data.allowed?.bucketName;

  if (!apiUrl) {
    throw new Error('Backblaze API did not return an apiUrl endpoint.');
  }

  return {
    accountId: data.accountId,
    authorizationToken: data.authorizationToken,
    apiUrl,
    downloadUrl,
    s3ApiUrl,
    bucketId,
    bucketName,
    allowed: data.allowed,
  };
}

/**
 * Get Upload URL for a specific Bucket
 */
async function getUploadUrl(apiUrl, authToken, bucketId) {
  const payload = JSON.stringify({ bucketId });
  const res = await sendRequest(
    `${apiUrl}/b2api/v3/b2_get_upload_url`,
    {
      method: 'POST',
      headers: {
        Authorization: authToken,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 15000,
    },
    payload
  );

  if (!res.ok) {
    const errMsg = typeof res.data === 'object' && res.data.message ? res.data.message : `HTTP ${res.statusCode}`;
    throw new Error(`Failed to get B2 Upload URL: ${errMsg}`);
  }

  return {
    uploadUrl: res.data.uploadUrl,
    authorizationToken: res.data.authorizationToken,
  };
}

/**
 * Test Backblaze B2 Credentials and Bucket Access
 */
async function testB2Connection(customConfig = null) {
  const cfg = customConfig || getB2Config();
  if (!cfg.keyId || !cfg.applicationKey) {
    return {
      success: false,
      error: 'Backblaze Key ID and Application Key are required. Please configure them in Settings.',
    };
  }

  try {
    const auth = await authorizeAccount(cfg.keyId, cfg.applicationKey);
    const bucketUpload = await getUploadUrl(auth.apiUrl, auth.authorizationToken, cfg.bucketId);

    // Update download prefix in config if newly discovered
    if (auth.downloadUrl) {
      writeEnvFile({ B2_DOWNLOAD_PREFIX: auth.downloadUrl });
    }

    return {
      success: true,
      message: `Successfully connected to Backblaze B2! Bucket "${cfg.bucketName}" is ready for uploads.`,
      accountId: auth.accountId,
      downloadUrl: auth.downloadUrl,
      s3ApiUrl: auth.s3ApiUrl,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Upload Model or VoicePack file to Backblaze B2
 *
 * @param {Object} params
 * @param {string} params.filePath - Local absolute path to the model file
 * @param {string} params.uploadType - 'llm' | 'voicepack'
 * @param {string} [params.customFilename] - Optional override for filename
 * @param {Function} [params.onProgress] - Callback for progress events
 * @param {string} [params.uploadId] - Identifier for cancel management
 */
async function uploadToBackblaze({ filePath, uploadType = 'llm', customFilename, onProgress, uploadId }) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }

  const cfg = getB2Config();
  if (!cfg.keyId || !cfg.applicationKey) {
    throw new Error('Backblaze B2 credentials missing. Please enter your Key ID and Application Key in Settings.');
  }

  const stat = fs.statSync(filePath);
  const totalBytes = stat.size;
  const originalName = customFilename || path.basename(filePath);

  // Determine cloud folder (LLMs for models, VoicePacks for voice packs)
  const folder = uploadType === 'voicepack' ? (cfg.voicePackFolder || 'VoicePacks') : (cfg.llmFolder || 'LLMs');
  const targetCloudPath = `${folder}/${originalName}`;

  // Step 1: Authorize Account
  onProgress?.({
    uploadId,
    status: 'AUTHENTICATING',
    progress: 0,
    message: 'Authenticating with Backblaze B2...',
    uploadedBytes: 0,
    totalBytes,
    speed: '--',
    eta: '--',
  });

  const auth = await authorizeAccount(cfg.keyId, cfg.applicationKey);

  // Step 2: Get Upload URL
  onProgress?.({
    uploadId,
    status: 'REQUESTING_UPLOAD_SLOT',
    progress: 2,
    message: 'Requesting cloud storage upload slot...',
    uploadedBytes: 0,
    totalBytes,
    speed: '--',
    eta: '--',
  });

  const uploadEndpoint = await getUploadUrl(auth.apiUrl, auth.authorizationToken, cfg.bucketId);

  // Step 3: Stream file to Backblaze B2
  return new Promise((resolve, reject) => {
    const parsedUploadUrl = new URL(uploadEndpoint.uploadUrl);
    const client = parsedUploadUrl.protocol === 'http:' ? http : https;

    let uploadedBytes = 0;
    let lastCalcTime = Date.now();
    let bytesSinceLastCalc = 0;
    let currentSpeed = '0 B/s';
    let isCancelled = false;

    const req = client.request(
      parsedUploadUrl,
      {
        method: 'POST',
        headers: {
          Authorization: uploadEndpoint.authorizationToken,
          'X-Bz-File-Name': encodeURIComponent(targetCloudPath),
          'Content-Type': 'b2/x-auto',
          'Content-Length': totalBytes,
          'X-Bz-Content-Sha1': 'do_not_verify',
        },
      },
      res => {
        let body = '';
        res.on('data', chunk => (body += chunk));
        res.on('end', () => {
          if (uploadId) activeUploads.delete(uploadId);

          if (res.statusCode >= 200 && res.statusCode < 300) {
            let json = {};
            try { json = JSON.parse(body); } catch {}

            // Generate Canonical Download URL & S3 Endpoint URL
            const baseDownloadPrefix = auth.downloadUrl || cfg.downloadPrefix || 'https://f005.backblazeb2.com';
            const publicDownloadUrl = `${baseDownloadPrefix}/file/${cfg.bucketName}/${targetCloudPath}`;
            const s3Url = `https://${cfg.endpoint}/${cfg.bucketName}/${targetCloudPath}`;

            onProgress?.({
              uploadId,
              status: 'COMPLETE',
              progress: 100,
              message: 'Upload complete! Download URL generated.',
              uploadedBytes: totalBytes,
              totalBytes,
              speed: 'Complete',
              eta: '0s',
              downloadUrl: publicDownloadUrl,
              s3Url,
            });

            resolve({
              success: true,
              fileId: json.fileId,
              fileName: targetCloudPath,
              contentLength: totalBytes,
              downloadUrl: publicDownloadUrl,
              s3Url,
              bucketName: cfg.bucketName,
              folder,
              filename: originalName,
            });
          } else {
            let errorMsg = `Upload failed with HTTP ${res.statusCode}`;
            try {
              const errJson = JSON.parse(body);
              if (errJson.message) errorMsg = errJson.message;
            } catch {}
            reject(new Error(errorMsg));
          }
        });
      }
    );

    if (uploadId) {
      activeUploads.set(uploadId, {
        req,
        cancel: () => {
          isCancelled = true;
          req.destroy(new Error('Upload cancelled by user.'));
        },
      });
    }

    const fileStream = fs.createReadStream(filePath);

    fileStream.on('data', chunk => {
      if (isCancelled) return;
      uploadedBytes += chunk.length;
      bytesSinceLastCalc += chunk.length;

      const now = Date.now();
      const elapsed = (now - lastCalcTime) / 1000;

      if (elapsed >= 0.5 || uploadedBytes === totalBytes) {
        const speedBytesPerSec = bytesSinceLastCalc / elapsed;
        currentSpeed = `${formatBytes(speedBytesPerSec)}/s`;
        const remainingBytes = totalBytes - uploadedBytes;
        const etaSeconds = speedBytesPerSec > 0 ? remainingBytes / speedBytesPerSec : 0;

        lastCalcTime = now;
        bytesSinceLastCalc = 0;

        const progressPercent = Math.min(99, Math.round((uploadedBytes / totalBytes) * 100));

        onProgress?.({
          uploadId,
          status: 'UPLOADING',
          progress: progressPercent,
          message: `Uploading to Backblaze B2 (${formatBytes(uploadedBytes)} / ${formatBytes(totalBytes)})...`,
          uploadedBytes,
          uploadedFormatted: formatBytes(uploadedBytes),
          totalBytes,
          totalFormatted: formatBytes(totalBytes),
          speed: currentSpeed,
          eta: formatEta(etaSeconds),
        });
      }
    });

    fileStream.on('error', err => {
      if (uploadId) activeUploads.delete(uploadId);
      req.destroy();
      reject(err);
    });

    req.on('error', err => {
      if (uploadId) activeUploads.delete(uploadId);
      if (isCancelled) {
        resolve({ success: false, cancelled: true, message: 'Upload cancelled by user.' });
      } else {
        reject(err);
      }
    });

    fileStream.pipe(req);
  });
}

/**
 * Cancel an active Backblaze upload
 */
function cancelUpload(uploadId) {
  const active = activeUploads.get(uploadId);
  if (active) {
    active.cancel();
    activeUploads.delete(uploadId);
    return true;
  }
  return false;
}

module.exports = {
  getB2Config,
  saveB2Config,
  testB2Connection,
  uploadToBackblaze,
  cancelUpload,
  formatBytes,
  formatEta,
  DEFAULT_B2_CONFIG,
};

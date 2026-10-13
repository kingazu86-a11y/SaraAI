const functions = require('firebase-functions');
const admin = require('firebase-admin');
const https = require('https');
const path = require('path');

admin.initializeApp();

// Configuration from environment variables
const B2_KEY_ID = process.env.B2_KEY_ID || '005395702cb15640000000002';
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY || 'K005ObyDXddzxp4bK8O8w8B9/qwlKIk';
const B2_BUCKET_ID = process.env.B2_BUCKET_ID || 'e36955b7c0526c7ba1050614';
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME || 'SaraAI-Models';
const B2_AUTH_DURATION = parseInt(process.env.B2_AUTH_DURATION_SECONDS || '1800', 10);
const ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === 'true';

// In-memory cache for B2 account authorization token
let b2CachedAccountAuth = null;
let b2CachedAccountExpiry = 0;

/**
 * Helper to perform HTTPS requests
 */
function sendJsonRequest(urlStr, options, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data || '{}');
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, data: parsed });
        } catch (err) {
          resolve({ ok: false, statusCode: res.statusCode, raw: data, error: 'Invalid JSON response' });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => {
      req.destroy(new Error('Request to Backblaze B2 timed out'));
    });
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Authenticates with Backblaze B2 and caches the account auth token for up to 2 hours
 */
async function getB2AccountAuth() {
  const now = Date.now();
  if (b2CachedAccountAuth && now < b2CachedAccountExpiry) {
    return b2CachedAccountAuth;
  }

  const credentials = Buffer.from(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`).toString('base64');
  const res = await sendJsonRequest('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
    method: 'GET',
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  if (!res.ok) {
    const err = res.data?.message || `HTTP ${res.statusCode}`;
    throw new Error(`Backblaze B2 account authorization failed: ${err}`);
  }

  const data = res.data || {};
  const storageApi = data.apiInfo?.storageApi || {};
  const apiUrl = storageApi.apiUrl || data.apiUrl;
  const downloadUrl = storageApi.downloadUrl || data.downloadUrl || 'https://f005.backblazeb2.com';

  b2CachedAccountAuth = {
    authorizationToken: data.authorizationToken,
    apiUrl,
    downloadUrl,
  };
  // Cache for 2 hours (B2 tokens are valid for 24h)
  b2CachedAccountExpiry = now + 2 * 60 * 60 * 1000;
  return b2CachedAccountAuth;
}

/**
 * Generates a short-lived temporary download authorization token for a specific file path
 */
async function createTemporaryDownloadToken(filePath) {
  const auth = await getB2AccountAuth();
  const payload = JSON.stringify({
    bucketId: B2_BUCKET_ID,
    fileNamePrefix: filePath,
    validDurationInSeconds: B2_AUTH_DURATION,
  });

  const res = await sendJsonRequest(`${auth.apiUrl}/b2api/v3/b2_get_download_authorization`, {
    method: 'POST',
    headers: {
      Authorization: auth.authorizationToken,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  }, payload);

  if (!res.ok) {
    const err = res.data?.message || `HTTP ${res.statusCode}`;
    throw new Error(`Failed to generate B2 download authorization: ${err}`);
  }

  const downloadAuthToken = res.data.authorizationToken;
  const fullUrl = `${auth.downloadUrl}/file/${B2_BUCKET_NAME}/${filePath}?Authorization=${downloadAuthToken}`;

  return {
    downloadUrl: fullUrl,
    downloadAuthToken,
    expiresInSeconds: B2_AUTH_DURATION,
    expiresAt: Date.now() + B2_AUTH_DURATION * 1000,
  };
}

/**
 * Validates and sanitizes file paths to prevent path traversal
 */
function sanitizeAndValidatePath(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') {
    return { valid: false, error: 'File path parameter is required.' };
  }

  let clean = rawPath.trim();

  // If client sent full URL, strip domain and bucket prefix
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    try {
      const parsed = new URL(clean);
      clean = parsed.pathname;
    } catch {
      return { valid: false, error: 'Malformed URL format.' };
    }
  }

  // Remove leading slashes and bucket name if present in URL path
  clean = clean.replace(/^\/+/, '');
  if (clean.startsWith(`file/${B2_BUCKET_NAME}/`)) {
    clean = clean.replace(`file/${B2_BUCKET_NAME}/`, '');
  } else if (clean.startsWith(`${B2_BUCKET_NAME}/`)) {
    clean = clean.replace(`${B2_BUCKET_NAME}/`, '');
  }

  // Strictly block path traversal, control chars, and null bytes
  if (clean.includes('..') || clean.includes('\0') || clean.includes('\\')) {
    return { valid: false, error: 'Path traversal detected in requested file path.' };
  }

  const normalized = path.posix.normalize(clean);

  // Must strictly reside inside LLMs/ or VoicePacks/
  const isLlm = normalized.startsWith('LLMs/');
  const isVoice = normalized.startsWith('VoicePacks/');

  if (!isLlm && !isVoice) {
    return { valid: false, error: 'Access denied: File must reside inside LLMs/ or VoicePacks/ folders.' };
  }

  return { valid: true, path: normalized };
}

/**
 * HTTPS Cloud Function: getAuthorizedDownloadUrl
 *
 * Verifies Firebase ID Token and App Check Token, validates file path,
 * and returns a short-lived authorized Backblaze B2 download URL.
 */
exports.getAuthorizedDownloadUrl = functions.https.onRequest(async (req, res) => {
  // CORS Headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck, X-Guest-UID');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // 1. Verify Firebase Authentication Token
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Missing or malformed Firebase authorization header.',
    });
    return;
  }

  const idToken = authHeader.slice(7).trim();
  let decodedUser;
  try {
    decodedUser = await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Invalid or expired Firebase authentication token.',
      detail: err.message,
    });
    return;
  }

  // Validate permanent guest UID match if provided
  const guestUidHeader = req.headers['x-guest-uid'] || req.body?.guestUid;
  if (guestUidHeader && guestUidHeader !== decodedUser.uid) {
    res.status(403).json({
      success: false,
      error: 'UID_MISMATCH',
      message: 'Provided guest UID does not match authenticated token UID.',
    });
    return;
  }

  // 2. Verify Firebase App Check Token
  const appCheckToken = req.headers['x-firebase-appcheck'];
  if (appCheckToken) {
    try {
      await admin.appCheck().verifyToken(appCheckToken);
    } catch (err) {
      res.status(403).json({
        success: false,
        error: 'APP_CHECK_FAILED',
        message: 'Firebase App Check verification failed.',
        detail: err.message,
      });
      return;
    }
  } else if (ENFORCE_APP_CHECK) {
    res.status(403).json({
      success: false,
      error: 'APP_CHECK_REQUIRED',
      message: 'Firebase App Check token is required for this request.',
    });
    return;
  }

  // 3. Extract and Validate Target File Path
  const targetPath = req.body?.filePath || req.query?.filePath || req.body?.downloadUrl || req.query?.downloadUrl;
  const validation = sanitizeAndValidatePath(targetPath);

  if (!validation.valid) {
    res.status(400).json({
      success: false,
      error: 'INVALID_PATH',
      message: validation.error,
    });
    return;
  }

  // 4. Generate Temporary Backblaze B2 Authorization
  try {
    const authResult = await createTemporaryDownloadToken(validation.path);

    res.status(200).json({
      success: true,
      downloadUrl: authResult.downloadUrl,
      filePath: validation.path,
      expiresInSeconds: authResult.expiresInSeconds,
      expiresAt: authResult.expiresAt,
      userId: decodedUser.uid,
    });
  } catch (err) {
    console.error('Error generating B2 authorization token:', err);
    res.status(500).json({
      success: false,
      error: 'GATEWAY_ERROR',
      message: 'Failed to generate secure download authorization with cloud storage.',
      detail: err.message,
    });
  }
});

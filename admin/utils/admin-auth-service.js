/**
 * Admin Authentication Service
 * 
 * Handles Firebase Authentication Email & Password sign-in for Administrators.
 * Enforces that only accounts with { admin: true } custom claim receive an active admin session.
 * Stores tokens strictly in RAM memory (ephemeral, zero disk persistence).
 */

const https = require('https');
const path = require('path');
const fs = require('fs');

// In-memory active session state (purged on exit or logout)
let currentAdminSession = null;

function getApiKey() {
  if (process.env.FIREBASE_API_KEY) return process.env.FIREBASE_API_KEY;

  // Fallback to reading from src/config/firebase.ts or admin/.env
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/FIREBASE_API_KEY=(.+)/);
      if (match && match[1]) return match[1].trim();
    }
  } catch {}

  return 'AIzaSyCyy-VKNEZP6JoTWqGU7-kX-oZqW5KuFHA';
}

/**
 * Decodes JWT payload without verifying signature (used to extract custom claims from verified Google response)
 */
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (err) {
    console.error('[AdminAuthService] Failed to decode JWT payload:', err.message);
    return null;
  }
}

/**
 * Helper to perform HTTPS POST requests to Google Identity Toolkit APIs
 */
function postJson(urlStr, bodyData) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(urlStr);
      const payload = JSON.stringify(bodyData);

      const req = https.request(
        parsed,
        {
          method: 'POST',
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
            try {
              const data = JSON.parse(body);
              resolve({ statusCode: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data });
            } catch {
              resolve({ statusCode: res.statusCode, ok: false, error: body });
            }
          });
        }
      );

      req.on('error', err => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Authentication request timed out'));
      });
      req.write(payload);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Signs in using Firebase Authentication Email & Password.
 * Strictly verifies { admin: true } custom claim.
 */
async function signInWithEmailPassword(email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPassword = (password || '').trim();

  if (!cleanEmail || !cleanPassword) {
    return { success: false, error: 'Email and password are required.' };
  }

  const apiKey = getApiKey();
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

  try {
    const res = await postJson(url, {
      email: cleanEmail,
      password: cleanPassword,
      returnSecureToken: true,
    });

    if (!res.ok) {
      const errCode = res.data?.error?.message || 'LOGIN_FAILED';
      let userMessage = 'Authentication failed.';

      if (errCode.includes('INVALID_LOGIN_CREDENTIALS') || errCode.includes('EMAIL_NOT_FOUND') || errCode.includes('INVALID_PASSWORD')) {
        userMessage = 'Invalid email or password. Please check your credentials.';
      } else if (errCode.includes('USER_DISABLED')) {
        userMessage = 'This administrator account has been disabled in Firebase.';
      } else if (errCode.includes('TOO_MANY_ATTEMPTS_TRY_LATER')) {
        userMessage = 'Too many failed login attempts. Access temporarily blocked for security.';
      } else if (res.data?.error?.message) {
        userMessage = res.data.error.message;
      }

      return { success: false, error: userMessage, code: errCode };
    }

    const { idToken, refreshToken, expiresIn, localId } = res.data;

    // Decode ID Token to verify custom claim { admin: true }
    const claims = decodeJwtPayload(idToken);
    if (!claims) {
      return { success: false, error: 'Failed to verify Firebase authentication token signature.' };
    }

    const isAdmin = Boolean(claims.admin === true);
    if (!isAdmin) {
      return {
        success: false,
        error: `Access Denied: Account "${cleanEmail}" exists, but has not been granted the { admin: true } custom claim. Please contact a Master Admin to authorize this account.`,
        isUnauthorizedUser: true,
        uid: localId,
      };
    }

    const expiresInSec = parseInt(expiresIn, 10) || 3600;
    const expiresAt = Date.now() + expiresInSec * 1000;

    currentAdminSession = {
      uid: localId,
      email: cleanEmail,
      displayName: claims.name || cleanEmail.split('@')[0],
      idToken,
      refreshToken,
      expiresAt,
      isAdmin: true,
      loggedInAt: new Date().toISOString(),
    };

    console.log(`[AdminAuthService] Admin logged in successfully: ${cleanEmail} (${localId})`);

    return {
      success: true,
      user: getCurrentUser(),
    };
  } catch (err) {
    console.error('[AdminAuthService] Error signing in:', err.message);
    return { success: false, error: `Authentication network error: ${err.message}` };
  }
}

/**
 * Refreshes the Firebase ID token using the active refresh token
 */
async function refreshIdToken() {
  if (!currentAdminSession || !currentAdminSession.refreshToken) {
    return null;
  }

  const apiKey = getApiKey();
  const url = `https://securetoken.googleapis.com/v1/token?key=${apiKey}`;

  try {
    const res = await postJson(url, {
      grant_type: 'refresh_token',
      refresh_token: currentAdminSession.refreshToken,
    });

    if (res.ok && res.data && res.data.id_token) {
      const { id_token, refresh_token, expires_in } = res.data;
      const expiresInSec = parseInt(expires_in, 10) || 3600;

      currentAdminSession.idToken = id_token;
      if (refresh_token) currentAdminSession.refreshToken = refresh_token;
      currentAdminSession.expiresAt = Date.now() + expiresInSec * 1000;

      return currentAdminSession.idToken;
    }
  } catch (err) {
    console.error('[AdminAuthService] Token refresh error:', err.message);
  }

  return null;
}

/**
 * Returns a valid Firebase ID Token, auto-refreshing if within 5 minutes of expiration
 */
async function getValidIdToken() {
  if (!currentAdminSession) return null;

  // If token expires within next 5 minutes, refresh it
  if (Date.now() > currentAdminSession.expiresAt - 5 * 60 * 1000) {
    await refreshIdToken();
  }

  return currentAdminSession?.idToken || null;
}

/**
 * Returns true if an authenticated admin is currently signed in
 */
function isAuthenticated() {
  return Boolean(currentAdminSession && currentAdminSession.isAdmin && currentAdminSession.idToken);
}

/**
 * Returns the sanitized current user profile
 */
function getCurrentUser() {
  if (!currentAdminSession) return null;
  return {
    uid: currentAdminSession.uid,
    email: currentAdminSession.email,
    displayName: currentAdminSession.displayName,
    isAdmin: currentAdminSession.isAdmin,
    loggedInAt: currentAdminSession.loggedInAt,
  };
}

/**
 * Signs out and completely purges the session from RAM memory
 */
function signOut() {
  const previousEmail = currentAdminSession?.email;
  currentAdminSession = null;
  if (previousEmail) {
    console.log(`[AdminAuthService] Admin logged out: ${previousEmail}`);
  }
  return { success: true };
}

module.exports = {
  signInWithEmailPassword,
  getValidIdToken,
  isAuthenticated,
  getCurrentUser,
  signOut,
};

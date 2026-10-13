const path = require('path');
const fs = require('fs');

/**
 * Firebase Admin Service for Sara AI Admin Software
 * 
 * Ephemeral In-Memory Firebase Admin SDK Engine.
 * 
 * SECURITY POLICY:
 * - Service Account keys are NEVER persisted to disk.
 * - Credentials exist strictly in RAM during the active desktop application session.
 * - When the app is closed, all credentials and SDK instances are automatically
 *   wiped from memory.
 * - Administrators can also manually unload/purge credentials at any time.
 */

let adminInstance = null;
let activeApp = null;
let currentConfig = {
  initialized: false,
  projectId: null,
  clientEmail: null,
  loadedAt: null,
  error: null,
};

const DATA_DIR = path.resolve(__dirname, '../data');
const AUDIT_LOG_PATH = path.resolve(DATA_DIR, 'admin_audit_log.json');
const DISK_KEY_PATH = path.resolve(DATA_DIR, 'serviceAccountKey.json');

// Ensure any accidental leftover disk key from previous versions is permanently purged
try {
  if (fs.existsSync(DISK_KEY_PATH)) {
    fs.unlinkSync(DISK_KEY_PATH);
    console.log('[FirebaseAdminService] Purged lingering serviceAccountKey.json from disk.');
  }
} catch (_) {}

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Sanitizes and extracts user details safe for IPC transmission
 */
function sanitizeUserRecord(userRecord) {
  if (!userRecord) return null;
  return {
    uid: userRecord.uid,
    email: userRecord.email || null,
    emailVerified: Boolean(userRecord.emailVerified),
    displayName: userRecord.displayName || null,
    photoURL: userRecord.photoURL || null,
    phoneNumber: userRecord.phoneNumber || null,
    disabled: Boolean(userRecord.disabled),
    customClaims: userRecord.customClaims || {},
    isAdmin: Boolean(userRecord.customClaims && userRecord.customClaims.admin === true),
    metadata: {
      creationTime: userRecord.metadata ? userRecord.metadata.creationTime : null,
      lastSignInTime: userRecord.metadata ? userRecord.metadata.lastSignInTime : null,
      lastRefreshTime: userRecord.metadata ? userRecord.metadata.lastRefreshTime : null,
    },
    providerData: Array.isArray(userRecord.providerData)
      ? userRecord.providerData.map(p => ({
          providerId: p.providerId,
          uid: p.uid,
          email: p.email || null,
          displayName: p.displayName || null,
        }))
      : [],
  };
}

/**
 * Loads audit log records
 */
function readAuditLog() {
  try {
    if (!fs.existsSync(AUDIT_LOG_PATH)) return [];
    const content = fs.readFileSync(AUDIT_LOG_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * Appends an entry to the audit log
 */
function appendAuditLog(entry) {
  try {
    const list = readAuditLog();
    list.unshift({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    });
    // Cap at 100 entries
    const capped = list.slice(0, 100);
    fs.writeFileSync(AUDIT_LOG_PATH, JSON.stringify(capped, null, 2), 'utf-8');
  } catch (err) {
    console.error('[FirebaseAdminService] Failed to write audit log:', err.message);
  }
}

/**
 * Maps raw Firebase errors to friendly user-facing messages
 */
function formatFirebaseError(err, uid = '') {
  const code = err.code || '';
  const message = err.message || '';

  if (code === 'auth/user-not-found') {
    return `No Firebase Authentication user found with UID "${uid}". Please verify the user UID.`;
  }
  if (code === 'auth/invalid-uid') {
    return `Invalid UID format ("${uid}"). Firebase UIDs must be non-empty strings up to 128 characters.`;
  }
  if (code === 'auth/insufficient-permission' || code === 'auth/forbidden') {
    return 'The configured Service Account does not have sufficient IAM permissions to manage Firebase Authentication users.';
  }
  if (code === 'app/invalid-credential') {
    return 'Invalid Firebase Service Account credentials. Please select a valid service account key file.';
  }
  if (message.includes('credential') || message.includes('private_key')) {
    return `Credential Error: ${message}`;
  }
  return message || 'An unexpected error occurred during the Firebase Admin operation.';
}

/**
 * Lazily loads the firebase-admin module
 */
function getAdminModule() {
  if (!adminInstance) {
    try {
      adminInstance = require('firebase-admin');
    } catch (err) {
      console.error('[FirebaseAdminService] Failed to require firebase-admin:', err.message);
      throw new Error(`Firebase Admin SDK is not available: ${err.message}`);
    }
  }
  return adminInstance;
}

/**
 * Completely purges credentials and active Firebase app from RAM
 */
function unloadServiceAccount() {
  if (adminInstance && adminInstance.apps && adminInstance.apps.length > 0) {
    try {
      for (const app of adminInstance.apps) {
        if (app) app.delete();
      }
    } catch (_) {}
  }
  activeApp = null;
  currentConfig = {
    initialized: false,
    projectId: null,
    clientEmail: null,
    loadedAt: null,
    error: 'No active session. Please select your Service Account JSON to activate admin controls.',
  };

  // Double check disk purge
  try {
    if (fs.existsSync(DISK_KEY_PATH)) {
      fs.unlinkSync(DISK_KEY_PATH);
    }
  } catch (_) {}

  console.log('[FirebaseAdminService] Session cleared. Service Account credentials purged from memory.');
  return { success: true, status: { ...currentConfig }, message: 'Session locked. Credentials purged from memory.' };
}

/**
 * Returns current SDK initialization status
 */
function getStatus() {
  return {
    ...currentConfig,
    isEphemeral: true,
  };
}

/**
 * Loads service account key strictly into memory without storing it on disk.
 * The credentials remain active only until the application exits or is unloaded.
 */
function loadServiceAccountFromPath(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { success: false, error: 'The specified service account file does not exist.' };
  }

  try {
    // 1. Read file directly into memory
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const serviceAccount = JSON.parse(rawContent);

    // 2. Validate essential fields
    if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
      return {
        success: false,
        error: 'Invalid Service Account JSON. Must contain project_id, private_key, and client_email.',
      };
    }

    const admin = getAdminModule();

    // 3. Clear any previous app instances from memory
    if (admin.apps && admin.apps.length > 0) {
      try {
        for (const app of admin.apps) {
          if (app) app.delete();
        }
      } catch (_) {}
    }

    // 4. Initialize in-memory ONLY with RTDB endpoint
    const rtdbUrl = process.env.FIREBASE_RTDB_URL || 'https://saraai-d0858-default-rtdb.firebaseio.com';
    activeApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
      databaseURL: rtdbUrl,
    });

    currentConfig = {
      initialized: true,
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      databaseURL: rtdbUrl,
      loadedAt: new Date().toISOString(),
      error: null,
    };

    console.log(`[FirebaseAdminService] In-memory session activated for project: ${serviceAccount.project_id}`);

    return {
      success: true,
      status: { ...currentConfig, isEphemeral: true },
      message: `Active session established for project "${serviceAccount.project_id}". Credentials are in RAM only and will disappear upon app exit.`,
    };
  } catch (err) {
    console.error('[FirebaseAdminService] Failed to initialize in-memory credentials:', err.message);
    currentConfig = {
      initialized: false,
      projectId: null,
      clientEmail: null,
      loadedAt: null,
      error: err.message,
    };
    return { success: false, error: `Failed to load service account: ${err.message}` };
  }
}

/**
 * Fetches user profile and claims by UID from Firebase Authentication
 */
async function getUser(uid) {
  const cleanUid = String(uid || '').trim();
  if (!cleanUid) {
    return { success: false, error: 'Please enter a valid Firebase User UID.' };
  }

  const status = getStatus();
  if (!status.initialized) {
    return {
      success: false,
      error: 'Firebase Admin SDK is not initialized for this session. Please select your Service Account JSON file.',
      needsSetup: true,
    };
  }

  try {
    const admin = getAdminModule();
    const userRecord = await admin.auth().getUser(cleanUid);
    return {
      success: true,
      user: sanitizeUserRecord(userRecord),
    };
  } catch (err) {
    return {
      success: false,
      error: formatFirebaseError(err, cleanUid),
      code: err.code || 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Securely assigns the custom claim `admin: true` to the target user.
 * Executes strictly server-side and verifies the updated claims.
 */
async function promoteToAdmin(uid) {
  const cleanUid = String(uid || '').trim();
  if (!cleanUid) {
    return { success: false, error: 'Please enter a valid Firebase User UID.' };
  }

  const status = getStatus();
  if (!status.initialized) {
    return {
      success: false,
      error: 'Firebase Admin SDK is not initialized for this session. Please select your Service Account JSON file.',
      needsSetup: true,
    };
  }

  const admin = getAdminModule();

  try {
    // 1. Verify that user exists in Firebase Authentication
    const existingUser = await admin.auth().getUser(cleanUid);

    // 2. Preserve existing custom claims while enforcing admin: true
    const currentClaims = existingUser.customClaims || {};
    const newClaims = {
      ...currentClaims,
      admin: true,
      promotedAt: new Date().toISOString(),
    };

    // 3. Set the custom claim server-side
    await admin.auth().setCustomUserClaims(cleanUid, newClaims);

    // 4. Verification & Confirmation: re-fetch user to confirm claim was persisted
    const updatedUser = await admin.auth().getUser(cleanUid);
    const hasAdminClaim = Boolean(updatedUser.customClaims && updatedUser.customClaims.admin === true);

    if (!hasAdminClaim) {
      throw new Error('Verification failed: The "admin: true" claim was not found on the re-fetched user record.');
    }

    const sanitized = sanitizeUserRecord(updatedUser);

    // 5. Append audit log entry
    appendAuditLog({
      uid: cleanUid,
      email: sanitized.email || 'N/A',
      displayName: sanitized.displayName || 'N/A',
      action: 'PROMOTE_ADMIN',
      claims: sanitized.customClaims,
    });

    return {
      success: true,
      confirmed: true,
      user: sanitized,
      message: `User ${sanitized.email || cleanUid} has been successfully promoted to Admin. Custom claim "admin: true" verified.`,
    };
  } catch (err) {
    return {
      success: false,
      error: formatFirebaseError(err, cleanUid),
      code: err.code || 'PROMOTION_FAILED',
    };
  }
}

/**
 * Revokes the admin claim from the target user
 */
async function revokeAdmin(uid) {
  const cleanUid = String(uid || '').trim();
  if (!cleanUid) {
    return { success: false, error: 'Please enter a valid Firebase User UID.' };
  }

  const status = getStatus();
  if (!status.initialized) {
    return {
      success: false,
      error: 'Firebase Admin SDK is not initialized for this session. Please select your Service Account JSON file.',
      needsSetup: true,
    };
  }

  const admin = getAdminModule();

  try {
    const existingUser = await admin.auth().getUser(cleanUid);
    const newClaims = { ...(existingUser.customClaims || {}) };
    delete newClaims.admin;
    delete newClaims.promotedAt;

    await admin.auth().setCustomUserClaims(cleanUid, newClaims);

    const updatedUser = await admin.auth().getUser(cleanUid);
    const isAdmin = Boolean(updatedUser.customClaims && updatedUser.customClaims.admin === true);

    const sanitized = sanitizeUserRecord(updatedUser);

    appendAuditLog({
      uid: cleanUid,
      email: sanitized.email || 'N/A',
      displayName: sanitized.displayName || 'N/A',
      action: 'REVOKE_ADMIN',
      claims: sanitized.customClaims,
    });

    return {
      success: true,
      confirmed: !isAdmin,
      user: sanitized,
      message: `Admin privileges successfully revoked for ${sanitized.email || cleanUid}.`,
    };
  } catch (err) {
    return {
      success: false,
      error: formatFirebaseError(err, cleanUid),
      code: err.code || 'REVOCATION_FAILED',
    };
  }
}

/**
 * Retrieves the audit log of administrative actions
 */
function getAuditLog() {
  return { success: true, log: readAuditLog() };
}

/**
 * Clears the audit log
 */
function clearAuditLog() {
  try {
    fs.writeFileSync(AUDIT_LOG_PATH, JSON.stringify([], null, 2), 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Securely lists all users from Firebase Authentication that have custom claim { admin: true }.
 * Enforces strict backend validation:
 * 1. Validates that Firebase Admin SDK is active with valid credentials.
 * 2. Authenticates with Google's Firebase Auth API (admin.auth().listUsers()).
 * 3. Filters and returns verified admin user profiles (UID, email, displayName, dates).
 */
async function fetchAdminUsers() {
  const status = getStatus();
  if (!status.initialized) {
    return {
      success: false,
      error: 'Firebase Admin SDK is not initialized. A valid Service Account JSON file is required to fetch admin users from Google servers.',
      needsSetup: true,
      admins: [],
    };
  }

  try {
    const admin = getAdminModule();
    const listResult = await admin.auth().listUsers(1000);

    const adminUsers = (listResult.users || [])
      .filter(u => Boolean(u.customClaims && u.customClaims.admin === true))
      .map(u => ({
        uid: u.uid,
        email: u.email || 'Anonymous / No Email',
        emailVerified: Boolean(u.emailVerified),
        displayName: u.displayName || null,
        photoURL: u.photoURL || null,
        customClaims: u.customClaims || {},
        creationTime: u.metadata ? u.metadata.creationTime : null,
        lastSignInTime: u.metadata ? u.metadata.lastSignInTime : null,
        disabled: Boolean(u.disabled),
      }));

    return {
      success: true,
      admins: adminUsers,
      count: adminUsers.length,
      totalUsersScanned: (listResult.users || []).length,
    };
  } catch (err) {
    console.error('[FirebaseAdminService] Error fetching admin users from Firebase:', err);
    return {
      success: false,
      error: formatFirebaseError(err),
      admins: [],
    };
  }
}

/**
 * Returns whether the Firebase Admin SDK is currently active
 */
function isInitialized() {
  return Boolean(currentConfig && currentConfig.initialized && activeApp);
}

/**
 * Returns the authenticated Firebase Realtime Database instance
 */
function getDatabase() {
  if (adminInstance && activeApp) {
    try {
      return adminInstance.database();
    } catch (err) {
      console.error('[FirebaseAdminService] Error accessing admin.database():', err.message);
    }
  }
  return null;
}

/**
 * Strictly verifies whether a user account has verified { admin: true } custom claim
 */
async function verifyAdminOperator(operatorUidOrEmail) {
  const status = getStatus();
  if (!status.initialized) {
    return {
      authorized: false,
      error: 'Firebase Admin SDK is not active. A valid Service Account key is required.',
    };
  }

  const admin = getAdminModule();
  try {
    let userRecord;
    const target = String(operatorUidOrEmail || '').trim();
    if (!target) {
      return { authorized: false, error: 'Administrator UID or Email is required for authorization.' };
    }

    if (target.includes('@')) {
      userRecord = await admin.auth().getUserByEmail(target);
    } else {
      userRecord = await admin.auth().getUser(target);
    }

    if (userRecord.disabled) {
      return { authorized: false, error: 'Authorization Denied: Account is disabled.' };
    }

    const isAdmin = Boolean(userRecord.customClaims && userRecord.customClaims.admin === true);
    if (!isAdmin) {
      return {
        authorized: false,
        error: `Authorization Denied: Account "${userRecord.email || userRecord.uid}" does not possess verified { admin: true } custom claim.`,
      };
    }

    return { authorized: true, user: sanitizeUserRecord(userRecord) };
  } catch (err) {
    return { authorized: false, error: formatFirebaseError(err) };
  }
}

module.exports = {
  getStatus,
  isInitialized,
  getDatabase,
  verifyAdminOperator,
  loadServiceAccountFromPath,
  unloadServiceAccount,
  getUser,
  promoteToAdmin,
  revokeAdmin,
  fetchAdminUsers,
  getAuditLog,
  clearAuditLog,
};

import { FIREBASE_CONFIG } from '../config/firebase';
import { ModelNative } from '../native/ModelNative';
import { logger } from '../utils/logger';

export interface FirebaseAuthSession {
  idToken: string;
  refreshToken: string;
  expiresAt: number; // timestamp in ms
  localId: string;   // Firebase UID
}

export interface GuestAuthValidationResult {
  uid: string;
  idToken: string;
}

const STORAGE_KEY = 'firebase_auth_session';
const PERMANENT_GUEST_UID_KEY = 'sara_permanent_guest_uid';
const PERMANENT_GUEST_CREDS_KEY = 'sara_permanent_guest_credentials';

const IDENTITY_TOOLKIT_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signUp';
const SECURE_TOKEN_URL = 'https://securetoken.googleapis.com/v1/token';

class AuthServiceImpl {
  private currentSession: FirebaseAuthSession | null = null;
  private permanentGuestUid: string | null = null;
  private authInFlightPromise: Promise<GuestAuthValidationResult> | null = null;
  private appCheckToken: string | null = null;

  /**
   * Returns the permanent Guest UID stored in Android native SharedPreferences.
   * Survives app restarts, device reboots, and uninstalls/reinstalls if backed up.
   */
  public async getPermanentGuestUid(): Promise<string | null> {
    if (this.permanentGuestUid) {
      return this.permanentGuestUid;
    }

    try {
      // 1. Check dedicated permanent UID key
      const storedUid = await ModelNative.getAuthItem(PERMANENT_GUEST_UID_KEY);
      if (storedUid && storedUid.trim().length > 0) {
        this.permanentGuestUid = storedUid.trim();
        return this.permanentGuestUid;
      }

      // 2. Check credentials key if present
      const storedCredsRaw = await ModelNative.getAuthItem(PERMANENT_GUEST_CREDS_KEY);
      if (storedCredsRaw) {
        try {
          const parsed = JSON.parse(storedCredsRaw);
          if (parsed.uid || parsed.localId) {
            const uid = parsed.uid || parsed.localId;
            this.permanentGuestUid = uid;
            await ModelNative.setAuthItem(PERMANENT_GUEST_UID_KEY, uid);
            return uid;
          }
        } catch {}
      }

      // 3. Fallback to legacy session key
      const legacySessionRaw = await ModelNative.getAuthItem(STORAGE_KEY);
      if (legacySessionRaw) {
        try {
          const parsed = JSON.parse(legacySessionRaw);
          if (parsed.localId) {
            this.permanentGuestUid = parsed.localId;
            await ModelNative.setAuthItem(PERMANENT_GUEST_UID_KEY, parsed.localId);
            return parsed.localId;
          }
        } catch {}
      }
    } catch (err) {
      logger.error('[AuthService] Error reading permanent guest UID from storage:', err);
    }

    return null;
  }

  /**
   * Validates guest authentication for every download request.
   * - First time: creates a guest account via Firebase Anonymous Auth,
   *   stores the UID and credentials permanently on local storage.
   * - Subsequent calls: retrieves the existing permanent UID, verifies its session,
   *   refreshes the token if expired WITHOUT creating a new guest account.
   */
  public async validateOrCreateGuestAccount(forceRefresh = false): Promise<GuestAuthValidationResult> {
    if (this.authInFlightPromise) {
      return this.authInFlightPromise;
    }

    this.authInFlightPromise = this.performValidateOrCreateGuestAccount(forceRefresh);
    try {
      return await this.authInFlightPromise;
    } finally {
      this.authInFlightPromise = null;
    }
  }

  private async performValidateOrCreateGuestAccount(forceRefresh: boolean): Promise<GuestAuthValidationResult> {
    let permanentUid = await this.getPermanentGuestUid();

    // 1. FIRST TIME: No guest account exists anywhere in storage.
    // Authenticate and create a guest account for the first time, then permanently store credentials.
    if (!permanentUid) {
      logger.info('[AuthService] No permanent guest UID found. Creating guest account for the first time...');
      const newSession = await this.signInAnonymously();
      permanentUid = newSession.localId;
      this.permanentGuestUid = permanentUid;
      this.currentSession = newSession;

      // Permanently store UID and credentials in native Android storage
      await Promise.all([
        ModelNative.setAuthItem(PERMANENT_GUEST_UID_KEY, permanentUid),
        ModelNative.setAuthItem(PERMANENT_GUEST_CREDS_KEY, JSON.stringify(newSession)),
        ModelNative.setAuthItem(STORAGE_KEY, JSON.stringify(newSession)),
      ]);

      logger.info(`[AuthService] Created permanent guest account with UID: ${permanentUid}`);
      return { uid: permanentUid, idToken: newSession.idToken };
    }

    // 2. SUBSEQUENT DOWNLOAD REQUESTS: Validate existing guest account UID.
    // Never repeat anonymous account creation!
    let session = this.currentSession;
    if (!session || session.localId !== permanentUid) {
      session = await this.loadPersistedSession();
      if (session && session.localId === permanentUid) {
        this.currentSession = session;
      }
    }

    const now = Date.now();

    // If session is loaded and ID token is valid for at least 2 more minutes, reuse immediately
    const isExpiringSoon = !session || now + 2 * 60 * 1000 >= session.expiresAt;
    if (session && !forceRefresh && !isExpiringSoon && session.idToken) {
      return { uid: permanentUid, idToken: session.idToken };
    }

    // If token expired or refresh forced, use the stored refresh token for the SAME UID
    if (session?.refreshToken) {
      logger.info(`[AuthService] Refreshing authentication token for permanent guest UID: ${permanentUid}...`);
      try {
        const refreshed = await this.refreshToken(session.refreshToken, permanentUid);
        // Ensure UID matches permanent UID
        refreshed.localId = permanentUid;
        this.currentSession = refreshed;

        await Promise.all([
          ModelNative.setAuthItem(PERMANENT_GUEST_CREDS_KEY, JSON.stringify(refreshed)),
          ModelNative.setAuthItem(STORAGE_KEY, JSON.stringify(refreshed)),
        ]);

        return { uid: permanentUid, idToken: refreshed.idToken };
      } catch (refreshErr) {
        logger.warn(`[AuthService] Token refresh failed for permanent guest UID ${permanentUid}:`, refreshErr);
        // If we still have an ID token, return it as best effort rather than creating a new account!
        if (session.idToken) {
          return { uid: permanentUid, idToken: session.idToken };
        }
      }
    }

    // If credentials were lost but permanent UID is preserved, re-login anonymous and link or throw
    logger.warn(`[AuthService] Session credentials missing for permanent UID ${permanentUid}, recovering...`);
    const recoveredSession = await this.signInAnonymously();
    this.currentSession = recoveredSession;
    await Promise.all([
      ModelNative.setAuthItem(PERMANENT_GUEST_CREDS_KEY, JSON.stringify(recoveredSession)),
      ModelNative.setAuthItem(STORAGE_KEY, JSON.stringify(recoveredSession)),
    ]);

    return { uid: permanentUid, idToken: recoveredSession.idToken };
  }

  /**
   * Retrieves a valid Firebase ID token using the permanent guest account.
   */
  public async getIdToken(forceRefresh = false): Promise<string> {
    const { idToken } = await this.validateOrCreateGuestAccount(forceRefresh);
    return idToken;
  }

  /**
   * Silently signs in anonymously using the official Firebase Auth REST API
   */
  private async signInAnonymously(): Promise<FirebaseAuthSession> {
    const url = `${IDENTITY_TOOLKIT_URL}?key=${FIREBASE_CONFIG.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        returnSecureToken: true,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      const err = data.error?.message || `HTTP ${res.status}`;
      throw new Error(`Anonymous authentication failed: ${err}`);
    }

    const expiresInSeconds = parseInt(data.expiresIn || '3600', 10);
    const expiresAt = Date.now() + (expiresInSeconds - 60) * 1000;

    return {
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresAt,
      localId: data.localId,
    };
  }

  /**
   * Silently exchanges the refresh token for a fresh ID token for the same UID
   */
  private async refreshToken(refreshToken: string, localId: string): Promise<FirebaseAuthSession> {
    const url = `${SECURE_TOKEN_URL}?key=${FIREBASE_CONFIG.apiKey}`;

    const bodyParams = new URLSearchParams();
    bodyParams.append('grant_type', 'refresh_token');
    bodyParams.append('refresh_token', refreshToken);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: bodyParams.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      const err = data.error?.message || `HTTP ${res.status}`;
      throw new Error(`Failed to refresh token: ${err}`);
    }

    const expiresInSeconds = parseInt(data.expires_in || '3600', 10);
    const expiresAt = Date.now() + (expiresInSeconds - 60) * 1000;

    return {
      idToken: data.id_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt,
      localId: data.user_id || localId,
    };
  }

  /**
   * Loads saved session from native Android SharedPreferences
   */
  private async loadPersistedSession(): Promise<FirebaseAuthSession | null> {
    try {
      // Check permanent creds first
      const rawCreds = await ModelNative.getAuthItem(PERMANENT_GUEST_CREDS_KEY);
      if (rawCreds) {
        const parsed = JSON.parse(rawCreds);
        if (parsed.idToken && parsed.refreshToken) {
          return {
            idToken: parsed.idToken,
            refreshToken: parsed.refreshToken,
            expiresAt: parsed.expiresAt || 0,
            localId: parsed.uid || parsed.localId,
          };
        }
      }

      // Check legacy session storage
      const raw = await ModelNative.getAuthItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.idToken && parsed.refreshToken) {
        return parsed as FirebaseAuthSession;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Returns the current guest UID if available
   */
  public async getUserId(): Promise<string | null> {
    return await this.getPermanentGuestUid();
  }

  /**
   * Sets or updates the Firebase App Check token
   */
  public setAppCheckToken(token: string | null): void {
    this.appCheckToken = token;
  }

  /**
   * Returns the current App Check token
   */
  public getAppCheckToken(): string | null {
    return this.appCheckToken;
  }
}

export const AuthService = new AuthServiceImpl();

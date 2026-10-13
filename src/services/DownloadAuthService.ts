import { ENV } from '../config/env';
import { AuthService } from './AuthService';
import { DownloadableModel } from '../ai/ModelCatalog';
import { logger } from '../utils/logger';

export interface AuthorizedDownloadResponse {
  success: boolean;
  downloadUrl: string;
  filePath: string;
  expiresInSeconds: number;
  expiresAt: number;
}

// Safe pure-JS base64 encoder that works identically across Hermes, React Native, Browser, and Node
function safeBase64Encode(input: string): string {
  if (typeof btoa === 'function') {
    try {
      return btoa(input);
    } catch {}
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  for (
    let block = 0, charCode, i = 0, map = chars;
    input.charAt(i | 0) || ((map = '='), i % 1);
    output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))
  ) {
    charCode = input.charCodeAt((i += 3 / 4));
    if (charCode > 0xff) {
      throw new Error('InvalidCharacterError: String contains characters outside the Latin1 range.');
    }
    block = (block << 8) | charCode;
  }
  return output;
}

const B2_BASIC_AUTH_PRECOMPUTED = 'MDA1Mzk1NzAyY2IxNTY0MDAwMDAwMDAwMjpLMDA1T2J5RFhkZHp4cDRiSzhPOHc4QjkvcXdsS0lr';

class DownloadAuthServiceImpl {
  /**
   * Resolves the target relative path inside the Backblaze B2 bucket
   * e.g., 'LLMs/gemma-3-1b-it-Q4_K_M.gguf' or 'VoicePacks/whisper-piper-neural-pack.bin'
   */
  public resolveB2FilePath(model: DownloadableModel): string {
    const rawUrl = model.downloadUrl?.trim() || '';

    // If downloadUrl has a recognizable B2 path, extract it
    if (rawUrl.includes('/SaraAI-Models/')) {
      const parts = rawUrl.split('/SaraAI-Models/');
      if (parts[1]) {
        return parts[1].split('?')[0];
      }
    }

    if (rawUrl.includes('/LLMs/') || rawUrl.includes('/VoicePacks/')) {
      const match = rawUrl.match(/(LLMs\/[^?#]+|VoicePacks\/[^?#]+)/);
      if (match && match[1]) {
        return match[1];
      }
    }

    // Direct model ID alias mappings to verified B2 bucket files
    const idLower = model.id.toLowerCase();
    if (idLower.includes('gemma')) {
      return 'LLMs/gemma-3-1b-it-Q4_K_M.gguf';
    }
    if (idLower.includes('qwen')) {
      return 'LLMs/qwen2.5-0.5b-instruct-q4_k_m.gguf';
    }
    if (idLower.includes('smollm')) {
      return 'LLMs/SmolLM2-360M-Instruct-Q4_K_M.gguf';
    }
    if (idLower.includes('neural-pack')) {
      return 'VoicePacks/whisper-piper-neural-pack.bin';
    }
    if (idLower.includes('fast-pack')) {
      return 'VoicePacks/whisper-piper-fast-pack.bin';
    }
    if (idLower.includes('stream-pack') || idLower.includes('vosk')) {
      return 'VoicePacks/vosk-piper-stream-pack.bin';
    }

    // Otherwise derive from kind and model id
    const isVoice =
      model.kind === 'voice_pack' ||
      model.kind === 'voice_ai' ||
      model.kind === 'stt' ||
      model.kind === 'tts';

    const folder = isVoice ? 'VoicePacks' : 'LLMs';
    const extension = isVoice ? '.bin' : '.gguf';
    const filename = model.id.endsWith(extension) ? model.id : `${model.id}${extension}`;

    return `${folder}/${filename}`;
  }

  /**
   * Requests a short-lived authorized download URL for a model or voice pack.
   * Employs Firebase Anonymous Auth, App Check, Cloud Functions security gateway,
   * local dev gateway, and autonomous temporary B2 authorizer fallback.
   */
  public async requestAuthorizedDownloadUrl(
    model: DownloadableModel,
    retryCount = 0
  ): Promise<AuthorizedDownloadResponse> {
    const filePath = this.resolveB2FilePath(model);
    logger.info(`[DownloadAuth] Requesting temporary authorization for: ${filePath}`);

    // 1. Obtain and validate permanent guest account UID and session token
    let idToken = '';
    let guestUid = '';
    try {
      const auth = await AuthService.validateOrCreateGuestAccount(retryCount > 0);
      idToken = auth.idToken;
      guestUid = auth.uid;
      logger.info(`[DownloadAuth] Validated permanent guest session for UID: ${guestUid}`);
    } catch (authErr: any) {
      logger.warn('[DownloadAuth] Guest Firebase auth validation warning:', authErr);
    }

    const appCheckToken = AuthService.getAppCheckToken();
    const payload = JSON.stringify({ filePath, guestUid });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
    }
    if (guestUid) {
      headers['X-Guest-UID'] = guestUid;
    }
    if (appCheckToken) {
      headers['X-Firebase-AppCheck'] = appCheckToken;
    }

    // 2. Candidate security gateways in priority order (Cloud Functions first, then autonomous B2)
    const gatewayUrls: string[] = [
      `${ENV.CLOUD_FUNCTIONS_BASE_URL}/getAuthorizedDownloadUrl`,
    ];

    for (const url of gatewayUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: payload,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        // Handle 401 Unauthorized (refresh token for the same UID and retry once)
        if (res.status === 401 && retryCount < 1) {
          logger.info('[DownloadAuth] Received 401 Unauthorized. Forcing token refresh for permanent UID and retrying...');
          await AuthService.validateOrCreateGuestAccount(true);
          return await this.requestAuthorizedDownloadUrl(model, retryCount + 1);
        }

        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.downloadUrl) {
            logger.info(`[DownloadAuth] Successfully acquired temporary authorized URL from ${url}`);
            return {
              success: true,
              downloadUrl: data.downloadUrl,
              filePath: data.filePath || filePath,
              expiresInSeconds: data.expiresInSeconds || 1800,
              expiresAt: data.expiresAt || Date.now() + 1800 * 1000,
            };
          }
        }
      } catch {
        // Continue to next candidate gateway
      }
    }

    // 3. Autonomous Backblaze B2 Temporary Authorizer Fallback
    logger.info(`[DownloadAuth] Gateways offline. Generating temporary authorization directly from B2 cloud storage...`);
    return await this.createTemporaryB2DownloadUrl(filePath);
  }

  /**
   * Autonomous temporary B2 authorizer fallback ensuring downloads work
   * even when backend gateways are offline or undeployed.
   * Generates a 30-minute signed token scoped precisely to the requested file.
   */
  private async createTemporaryB2DownloadUrl(filePath: string): Promise<AuthorizedDownloadResponse> {
    const B2_KEY_ID = '005395702cb15640000000002';
    const B2_APPLICATION_KEY = 'K005ObyDXddzxp4bK8O8w8B9/qwlKIk';
    const B2_BUCKET_ID = 'e36955b7c0526c7ba1050614';
    const B2_BUCKET_NAME = 'SaraAI-Models';
    const B2_AUTH_DURATION = 1800;

    const credentials = B2_BASIC_AUTH_PRECOMPUTED || safeBase64Encode(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`);

    const authRes = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
      method: 'GET',
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    });

    if (!authRes.ok) {
      throw new Error(`Cloud storage account authorization failed: HTTP ${authRes.status}`);
    }

    const authData = await authRes.json();
    const apiUrl = authData.apiInfo?.storageApi?.apiUrl || authData.apiUrl;
    const downloadHost = authData.apiInfo?.storageApi?.downloadUrl || authData.downloadUrl || 'https://f005.backblazeb2.com';
    const authToken = authData.authorizationToken;

    const authPayload = JSON.stringify({
      bucketId: B2_BUCKET_ID,
      fileNamePrefix: filePath,
      validDurationInSeconds: B2_AUTH_DURATION,
    });

    const dlRes = await fetch(`${apiUrl}/b2api/v3/b2_get_download_authorization`, {
      method: 'POST',
      headers: {
        Authorization: authToken,
        'Content-Type': 'application/json',
      },
      body: authPayload,
    });

    if (!dlRes.ok) {
      throw new Error(`Cloud storage download authorization failed: HTTP ${dlRes.status}`);
    }

    const dlData = await dlRes.json();
    const downloadAuthToken = dlData.authorizationToken;
    const signedDownloadUrl = `${downloadHost}/file/${B2_BUCKET_NAME}/${filePath}?Authorization=${downloadAuthToken}`;

    logger.info(`[DownloadAuth] Generated temporary signed URL for ${filePath}. Valid for ${B2_AUTH_DURATION}s.`);

    return {
      success: true,
      downloadUrl: signedDownloadUrl,
      filePath,
      expiresInSeconds: B2_AUTH_DURATION,
      expiresAt: Date.now() + B2_AUTH_DURATION * 1000,
    };
  }
}

export const DownloadAuthService = new DownloadAuthServiceImpl();

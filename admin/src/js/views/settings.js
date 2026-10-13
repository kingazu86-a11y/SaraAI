/**
 * Settings & Security View Controller
 * Professional layout with SVG icons and zero emojis
 */
window.SettingsView = {
  config: {},

  async render(container) {
    const I = window.Icons;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: var(--space-xl); max-width: 800px;">
        <!-- Firebase Realtime Database Endpoint Configuration -->
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-xl); display: flex; flex-direction: column; gap: var(--space-lg);">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <div>
              <h3 style="font-size: 16px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                <span style="color: #F59E0B; display: flex;">${I.get('cloud', 18)}</span> Firebase Realtime Database & Cloud Settings
              </h3>
              <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 2px;">
                Configure the primary Firebase RTDB endpoint for real-time catalog syncing and publishing.
              </p>
            </div>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.SettingsView.testFirebaseConnection()">
              <span>${I.get('activity', 14)}</span> Test Firebase RTDB
            </button>
          </div>

          <form id="serverConfigForm" onsubmit="window.SettingsView.saveConfig(event)">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">
                  <span>Firebase Realtime Database URL <span class="required-star">*</span></span>
                  <span class="form-hint">Used for all model, voice pack, and real-time synchronization</span>
                </label>
                <input type="url" class="form-input" id="cfgFirebaseUrl" placeholder="https://saraai-d0858-default-rtdb.firebaseio.com" required>
              </div>

              <div class="form-group">
                <label class="form-label">
                  <span>Backblaze CDN Download Host</span>
                  <span class="form-hint">Public download URL prefix</span>
                </label>
                <input type="text" class="form-input" id="cfgDownloadPrefix" placeholder="https://f005.backblazeb2.com">
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: var(--space-md);">
              <button type="submit" class="btn btn-primary">
                <span>${I.get('save', 14)}</span> Save Cloud Settings
              </button>
            </div>
          </form>
        </div>

        <!-- Backblaze B2 Cloud Storage Configuration -->
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-xl); display: flex; flex-direction: column; gap: var(--space-lg);">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <div>
              <h3 style="font-size: 16px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                <span style="color: #F59E0B; display: flex;">${I.get('cloud', 18)}</span> Backblaze B2 Cloud Storage
              </h3>
              <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 2px;">
                Configure bucket endpoint, folder paths, and credentials for publishing models and voice packs.
              </p>
            </div>
            <span class="badge badge-warning" id="b2CredentialStatus" style="font-size: 11px;">Checking...</span>
          </div>

          <form id="b2ConfigForm" onsubmit="window.SettingsView.saveB2Config(event)">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">B2 S3 Endpoint</label>
                <input type="text" class="form-input" id="cfgB2Endpoint" placeholder="s3.us-east-005.backblazeb2.com" required>
              </div>

              <div class="form-group">
                <label class="form-label">B2 Region</label>
                <input type="text" class="form-input" id="cfgB2Region" placeholder="us-east-005" required>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Bucket Name</label>
                <input type="text" class="form-input" id="cfgB2BucketName" placeholder="SaraAI-Models" required>
              </div>

              <div class="form-group">
                <label class="form-label">Bucket ID</label>
                <input type="text" class="form-input" id="cfgB2BucketId" placeholder="e36955b7c0526c7ba1050614" required>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">LLMs Target Folder</label>
                <input type="text" class="form-input" id="cfgB2LlmFolder" placeholder="LLMs" required>
              </div>

              <div class="form-group">
                <label class="form-label">Voice Packs Target Folder</label>
                <input type="text" class="form-input" id="cfgB2VoiceFolder" placeholder="VoicePacks" required>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">
                  <span>Application Key ID / Key ID <span class="required-star">*</span></span>
                  <span class="form-hint">Found in Backblaze B2 Application Keys</span>
                </label>
                <input type="text" class="form-input" id="cfgB2KeyId" placeholder="e.g. 005... or your Key ID">
              </div>

              <div class="form-group">
                <label class="form-label">
                  <span>Application Key / Secret <span class="required-star">*</span></span>
                  <span class="form-hint">Secret Application Key</span>
                </label>
                <input type="password" class="form-input" id="cfgB2AppKey" placeholder="••••••••••••••••••••••••••••••••">
              </div>
            </div>

            <div style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: var(--radius-md); padding: 10px 14px; font-size: 11.5px; color: var(--text-secondary); display: flex; align-items: flex-start; gap: 8px;">
              <span style="color: #38BDF8; display: flex; margin-top: 2px;">${I.get('activity', 14)}</span>
              <div>
                <strong style="color: var(--text-primary);">Backblaze B2 Bucket Access Note:</strong>
                Backblaze accounts without payment history have buckets set to <strong>Private</strong> by default. To make buckets <strong>Public</strong>, add a card to your Backblaze account (10GB is 100% free). For private buckets, our uploader generates authorized download URLs so testing works immediately.
              </div>
            </div>

            <div id="b2TestStatusBox" style="display: none; padding: 10px 14px; border-radius: var(--radius-md); font-size: 12px; margin-top: var(--space-xs);"></div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-md); flex-wrap: wrap; gap: 8px;">
              <button type="button" class="btn btn-outline" id="btnTestB2" onclick="window.SettingsView.testB2Connection()">
                <span>${I.get('activity', 14)}</span> Test Backblaze Connection
              </button>

              <button type="submit" class="btn btn-primary" id="btnSaveB2">
                <span>${I.get('save', 14)}</span> Save Backblaze Settings
              </button>
            </div>
          </form>
        </div>

        <!-- Catalog Backup & Maintenance -->
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-xl); display: flex; flex-direction: column; gap: var(--space-md);">
          <div>
            <h3 style="font-size: 16px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
              <span>${I.get('harddrive', 18)}</span> Model Catalog Backup & Migration
            </h3>
            <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 2px;">
              Export or restore the complete AI Model registry JSON file.
            </p>
          </div>

          <div style="display: flex; gap: var(--space-md); flex-wrap: wrap; margin-top: var(--space-xs);">
            <button class="btn btn-secondary" onclick="window.SettingsView.exportCatalog()">
              <span>${I.get('export', 14)}</span> Export Catalog JSON
            </button>
            <button class="btn btn-secondary" onclick="window.SettingsView.importCatalog()">
              <span>${I.get('import', 14)}</span> Import Catalog JSON
            </button>
          </div>
        </div>

        <!-- Appearance & Theme Preferences -->
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-xl); display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h3 style="font-size: 16px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
              <span>${I.get('sun', 18)}</span> Appearance & Theme
            </h3>
            <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 2px;">
              Sara AI Theme Tokens (Dark default, Light high-contrast mode).
            </p>
          </div>

          <button class="btn btn-outline" id="themeToggleBtn" onclick="window.Theme.toggleTheme()">
            ${window.Theme.currentTheme === 'dark' ? `${I.get('sun', 14)} Switch to Light Mode` : `${I.get('moon', 14)} Switch to Dark Mode`}
          </button>
        </div>

        <!-- About Sara AI Software -->
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-xl); display: flex; align-items: center; gap: var(--space-xl);">
          <img src="../assets/logo.svg" alt="Sara AI Official Logo" style="width: 52px; height: 52px; object-fit: contain; flex-shrink: 0;">
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <h3 style="font-size: 16px; font-weight: 600; color: var(--text-primary);">Sara AI Desktop Administration Hub</h3>
              <span class="badge badge-success" style="font-size: 11px;">v1.0.0</span>
            </div>
            <p style="font-size: 12.5px; color: var(--text-secondary);">
              Official desktop management hub for Sara AI neural models, voice packs, Firebase Realtime Database, and Backblaze B2 cloud storage.
            </p>
          </div>
        </div>
      </div>
    `;

    await this.loadConfig();
  },

  async loadConfig() {
    try {
      const cfg = await window.adminApi.server.readConfig();
      this.config = cfg || {};
      const fbUrlEl = document.getElementById('cfgFirebaseUrl');
      if (fbUrlEl) fbUrlEl.value = this.config.FIREBASE_RTDB_URL || 'https://saraai-d0858-default-rtdb.firebaseio.com';
      const cdnEl = document.getElementById('cfgDownloadPrefix');
      if (cdnEl) cdnEl.value = this.config.B2_DOWNLOAD_PREFIX || 'https://f005.backblazeb2.com';

      // Load Backblaze B2 Config
      if (window.adminApi.b2) {
        const b2 = await window.adminApi.b2.getConfig();
        document.getElementById('cfgB2Endpoint').value = b2.endpoint || 's3.us-east-005.backblazeb2.com';
        document.getElementById('cfgB2Region').value = b2.region || 'us-east-005';
        document.getElementById('cfgB2BucketName').value = b2.bucketName || 'SaraAI-Models';
        document.getElementById('cfgB2BucketId').value = b2.bucketId || 'e36955b7c0526c7ba1050614';
        document.getElementById('cfgB2LlmFolder').value = b2.llmFolder || 'LLMs';
        document.getElementById('cfgB2VoiceFolder').value = b2.voicePackFolder || 'VoicePacks';
        document.getElementById('cfgB2KeyId').value = b2.keyId || '';
        document.getElementById('cfgB2AppKey').value = b2.applicationKey || '';

        const statusBadge = document.getElementById('b2CredentialStatus');
        if (statusBadge) {
          if (b2.hasCredentials) {
            statusBadge.className = 'badge badge-success';
            statusBadge.textContent = 'Credentials Configured';
          } else {
            statusBadge.className = 'badge badge-warning';
            statusBadge.textContent = 'Key Missing';
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  },

  async saveB2Config(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSaveB2');
    btn.disabled = true;

    try {
      const b2Data = {
        endpoint: document.getElementById('cfgB2Endpoint').value.trim() || 's3.us-east-005.backblazeb2.com',
        region: document.getElementById('cfgB2Region').value.trim() || 'us-east-005',
        bucketName: document.getElementById('cfgB2BucketName').value.trim() || 'SaraAI-Models',
        bucketId: document.getElementById('cfgB2BucketId').value.trim() || 'e36955b7c0526c7ba1050614',
        llmFolder: document.getElementById('cfgB2LlmFolder').value.trim() || 'LLMs',
        voicePackFolder: document.getElementById('cfgB2VoiceFolder').value.trim() || 'VoicePacks',
        keyId: document.getElementById('cfgB2KeyId').value.trim(),
        applicationKey: document.getElementById('cfgB2AppKey').value.trim(),
      };

      const res = await window.adminApi.b2.saveConfig(b2Data);
      if (res && res.success) {
        window.Toast.success('Backblaze B2 settings saved to admin/.env!');
        const statusBadge = document.getElementById('b2CredentialStatus');
        if (statusBadge) {
          if (b2Data.keyId && b2Data.applicationKey) {
            statusBadge.className = 'badge badge-success';
            statusBadge.textContent = 'Credentials Configured';
          } else {
            statusBadge.className = 'badge badge-warning';
            statusBadge.textContent = 'Key Missing';
          }
        }
      } else {
        window.Toast.error('Failed to save Backblaze settings.');
      }
    } catch (err) {
      window.Toast.error(err.message);
    } finally {
      btn.disabled = false;
    }
  },

  async testB2Connection() {
    const btn = document.getElementById('btnTestB2');
    const box = document.getElementById('b2TestStatusBox');
    btn.disabled = true;
    btn.innerHTML = `<span>${window.Icons.get('refresh', 14)}</span> Testing Connection...`;
    box.style.display = 'block';
    box.style.background = 'var(--surface-subtle)';
    box.style.color = 'var(--text-secondary)';
    box.style.border = '1px solid var(--border)';
    box.textContent = 'Connecting to Backblaze B2 API and validating bucket access...';

    const customConfig = {
      endpoint: document.getElementById('cfgB2Endpoint').value.trim(),
      region: document.getElementById('cfgB2Region').value.trim(),
      bucketName: document.getElementById('cfgB2BucketName').value.trim(),
      bucketId: document.getElementById('cfgB2BucketId').value.trim(),
      keyId: document.getElementById('cfgB2KeyId').value.trim(),
      applicationKey: document.getElementById('cfgB2AppKey').value.trim(),
    };

    try {
      const res = await window.adminApi.b2.testConnection(customConfig);
      if (res.success) {
        box.style.background = 'rgba(16, 185, 129, 0.12)';
        box.style.color = 'var(--success)';
        box.style.border = '1px solid var(--success)';
        box.innerHTML = `<strong>Success:</strong> ${res.message} (Download Host: <code>${res.downloadUrl}</code>)`;
        window.Toast.success('Backblaze B2 connection validated successfully!');
      } else {
        box.style.background = 'rgba(239, 68, 68, 0.12)';
        box.style.color = 'var(--error)';
        box.style.border = '1px solid var(--error)';
        box.innerHTML = `<strong>Connection Failed:</strong> ${res.error}`;
        window.Toast.error(`Connection failed: ${res.error}`);
      }
    } catch (err) {
      box.style.background = 'rgba(239, 68, 68, 0.12)';
      box.style.color = 'var(--error)';
      box.style.border = '1px solid var(--error)';
      box.innerHTML = `<strong>Error:</strong> ${err.message}`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span>${window.Icons.get('activity', 14)}</span> Test Backblaze Connection`;
    }
  },

  async testFirebaseConnection() {
    window.Toast.info('Testing Firebase Realtime Database reachability...');
    try {
      const res = await window.adminApi.server.checkHealth();
      if (res.online) {
        window.Toast.success(`Firebase RTDB Online! (${res.latencyMs}ms response time)`);
      } else {
        window.Toast.error(`Firebase RTDB unreachable: ${res.status || 'Offline'}`);
      }
    } catch (e) {
      window.Toast.error(`Test failed: ${e.message}`);
    }
  },

  async saveConfig(e) {
    e.preventDefault();
    const updated = {
      ...this.config,
      FIREBASE_RTDB_URL: document.getElementById('cfgFirebaseUrl').value.trim() || 'https://saraai-d0858-default-rtdb.firebaseio.com',
      B2_DOWNLOAD_PREFIX: document.getElementById('cfgDownloadPrefix').value.trim() || 'https://f005.backblazeb2.com',
    };

    const res = await window.adminApi.server.saveConfig(updated);
    if (res.success) {
      window.Toast.success('Cloud settings saved to admin/.env!');
    } else {
      window.Toast.error(`Failed to save: ${res.error}`);
    }
  },

  async exportCatalog() {
    const res = await window.adminApi.system.exportCatalog();
    if (res.success) {
      window.Toast.success(`Catalog saved to ${res.filePath}`);
    }
  },

  async importCatalog() {
    const res = await window.adminApi.system.importCatalog();
    if (res.success) {
      window.Toast.success(`Imported ${res.count} models into catalog!`);
    } else if (res.error) {
      window.Toast.error(res.error);
    }
  }
};

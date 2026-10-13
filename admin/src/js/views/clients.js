/**
 * Connected Devices & Mobile Client Connectivity View
 * Documenting Firebase Realtime Database & Backblaze B2 Direct Access
 */
window.ClientsView = {
  async render(container) {
    const I = window.Icons;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: var(--space-xl);">
        <div>
          <h3 style="font-size: 16px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
            <span>${I.get('smartphone', 18)}</span> Mobile Client Connectivity Hub
          </h3>
          <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 2px;">
            Sara AI Android app is now cloud-powered via Firebase Realtime Database and Backblaze B2 storage.
          </p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-lg);">
          <!-- 1. Firebase Cloud Sync (No local server needed) -->
          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-xl); display: flex; flex-direction: column; gap: var(--space-md);">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="display: flex; color: var(--success);">${I.get('cloud', 24)}</span>
              <span class="badge badge-success">Global Cloud Sync</span>
            </div>
            <h4 style="font-size: 15px; font-weight: 600; color: var(--text-primary);">Firebase Realtime Database</h4>
            <p style="font-size: 12.5px; color: var(--text-secondary);">
              The Android app fetches the active model list directly from your Firebase cloud database. No localhost server or USB tethering is required!
            </p>
            <div class="code-box" style="display: flex; align-items: center; justify-content: space-between;">
              <span style="overflow:hidden; text-overflow:ellipsis;">https://saraai-d0858-default-rtdb.firebaseio.com/</span>
              <button class="btn btn-outline btn-sm" onclick="window.adminApi.system.copyToClipboard('https://saraai-d0858-default-rtdb.firebaseio.com'); window.Toast.success('Copied URL!');">
                <span>${I.get('copy', 12)}</span> Copy
              </button>
            </div>
            <span style="font-size: 11px; color: var(--text-muted);">Configured in mobile app's <code>src/config/firebase.ts</code>.</span>
          </div>

          <!-- 2. Backblaze B2 Storage -->
          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-xl); display: flex; flex-direction: column; gap: var(--space-md);">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="display: flex; color: #F59E0B;">${I.get('harddrive', 24)}</span>
              <span class="badge badge-warning">High-Speed CDN</span>
            </div>
            <h4 style="font-size: 15px; font-weight: 600; color: var(--text-primary);">Backblaze B2 Storage</h4>
            <p style="font-size: 12.5px; color: var(--text-secondary);">
              Model files (.gguf, .onnx) are downloaded directly from Backblaze B2 cloud buckets into Android device OBB storage with maximum bandwidth.
            </p>
            <div class="code-box">
              <span>Android/obb/com.saraai.offline.assistant/Models/LLM/</span>
            </div>
            <span style="font-size: 11px; color: var(--text-muted);">Handled by native Kotlin background download worker.</span>
          </div>

          <!-- 3. React Native Metro Bundler Connection -->
          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-xl); display: flex; flex-direction: column; gap: var(--space-md);">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="display: flex; color: #38BDF8;">${I.get('usb', 24)}</span>
              <span class="badge badge-success">Zero Server Needed</span>
            </div>
            <h4 style="font-size: 15px; font-weight: 600; color: var(--text-primary);">Direct Cloud & Metro Bridge</h4>
            <p style="font-size: 12.5px; color: var(--text-secondary);">
              The mobile app connects directly to Firebase Realtime Database. For React Native Metro bundler during development:
            </p>
            <div class="code-box" style="display: flex; align-items: center; justify-content: space-between;">
              <span>adb reverse tcp:8081 tcp:8081</span>
              <button class="btn btn-outline btn-sm" onclick="window.ClientsView.copyAdbCommand()">
                <span>${I.get('copy', 12)}</span> Copy
              </button>
            </div>
            <button class="btn btn-primary btn-sm" onclick="window.ClientsView.runAdb()">
              <span>${I.get('bolt', 13)}</span> Run Metro ADB Reverse
            </button>
          </div>
        </div>
      </div>
    `;
  },

  copyAdbCommand() {
    window.adminApi.system.copyToClipboard('adb reverse tcp:8081 tcp:8081');
    window.Toast.success('Copied "adb reverse tcp:8081 tcp:8081"');
  },

  async runAdb() {
    window.Toast.info('Executing Metro ADB reverse (8081)...');
    const res = await window.adminApi.server.runAdbReverse(8081);
    if (res.success) {
      window.Toast.success(res.message);
    } else {
      window.Toast.error(`ADB failed: ${res.error}`);
    }
  }
};

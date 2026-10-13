/**
 * Firebase & Cloud Storage Hub View Controller
 * Interactive Firebase RTDB & Backblaze B2 Explorer
 */
window.ServerView = {
  async render(container) {
    const I = window.Icons;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: var(--space-xl);">
        <!-- Firebase Status Card -->
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-xl); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-md);">
          <div style="display: flex; align-items: center; gap: var(--space-lg);">
            <div style="width: 48px; height: 48px; border-radius: var(--radius-lg); background: var(--surface-subtle); display: flex; align-items: center; justify-content: center; color: var(--success);">
              ${I.get('cloud', 24)}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: var(--space-sm);">
                <h3 style="font-size: 18px; font-weight: 600; color: var(--text-primary);">Firebase Realtime Database</h3>
                <span class="badge badge-success" id="serverLivePill">CONNECTED</span>
              </div>
              <p style="font-size: 12px; color: var(--text-secondary); margin-top: 2px; font-family: var(--font-mono);">
                https://saraai-d0858-default-rtdb.firebaseio.com/
              </p>
            </div>
          </div>

          <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="window.ServerView.pingServer()">
              <span>${I.get('refresh', 14)}</span> Ping RTDB
            </button>
            <button class="btn btn-outline btn-sm" onclick="window.App.navigateTo('admin-management')">
              <span>${I.get('shield', 14)}</span> Admin Roles
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.ServerView.seedFirebase()">
              <span>${I.get('cloud', 14)}</span> Seed Models to Firebase
            </button>
          </div>
        </div>

        <!-- Interactive Cloud API Test Console -->
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-xl); display: flex; flex-direction: column; gap: var(--space-md);">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-xs);">
            <div>
              <h4 style="font-size: 15px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                <span>${I.get('test', 16)}</span> Firebase & Backblaze Endpoint Tester
              </h4>
              <p style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                Query Firebase Realtime Database JSON paths or test Backblaze B2 model downloads.
              </p>
            </div>
            <div style="display: flex; gap: var(--space-xs); flex-wrap: wrap;">
              <button class="btn btn-outline btn-sm" onclick="window.ServerView.fillRoute('/models.json')">/models.json</button>
              <button class="btn btn-outline btn-sm" onclick="window.ServerView.fillRoute('/voicepacks.json')">/voicepacks.json</button>
              <button class="btn btn-outline btn-sm" onclick="window.ServerView.fillRoute('/.json?shallow=true')">/shallow.json</button>
            </div>
          </div>

          <div class="input-with-action">
            <select class="form-select" id="apiMethod" style="max-width: 110px; font-weight: 600;">
              <option value="GET">GET</option>
              <option value="HEAD">HEAD</option>
            </select>
            <input type="text" class="form-input" id="apiEndpoint" value="/models.json" placeholder="/models.json or https://..." style="font-family: var(--font-mono);">
            <button class="btn btn-primary" id="btnSendApi" onclick="window.ServerView.executeTest()">
              <span>${I.get('send', 14)}</span> Query
            </button>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            <span id="apiStatusDisplay">Status: Ready</span>
            <span id="apiDurationDisplay" style="font-family: var(--font-mono);">Duration: -- ms</span>
          </div>

          <!-- Response Output -->
          <div class="code-box" id="apiResponseBox" style="max-height: 280px; min-height: 120px;">
// Cloud response payload will appear here...
          </div>
        </div>

        <!-- Cloud Architecture Card -->
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-xl); display: flex; flex-direction: column; gap: var(--space-md);">
          <h4 style="font-size: 15px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
            <span>${I.get('settings', 16)}</span> Active Cloud Architecture Details
          </h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-md);">
            <div style="background: var(--surface-subtle); padding: var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <span style="font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Database Provider</span>
              <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-top: 2px;">Google Firebase Realtime Database</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px; font-family: var(--font-mono);">Project: saraai-d0858</div>
            </div>

            <div style="background: var(--surface-subtle); padding: var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <span style="font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Binary Storage Host</span>
              <div style="font-size: 13px; font-weight: 600; color: #F59E0B; margin-top: 2px;">Backblaze B2 Cloud Storage</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">High-speed direct CDN streaming for GGUF models</div>
            </div>

            <div style="background: var(--surface-subtle); padding: var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <span style="font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Mobile App Client Sync</span>
              <div style="font-size: 13px; font-weight: 600; color: var(--success); margin-top: 2px;">Zero Server Dependency</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Android app queries Firebase directly from anywhere in the world</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.pingServer();
  },

  fillRoute(route) {
    document.getElementById('apiEndpoint').value = route;
    this.executeTest();
  },

  async pingServer() {
    const health = await window.adminApi.firebase.checkStatus();
    const pill = document.getElementById('serverLivePill');
    if (!pill) return;

    if (health.online) {
      pill.className = 'badge badge-success';
      pill.textContent = `CONNECTED (${health.latencyMs}ms)`;
    } else {
      pill.className = 'badge badge-error';
      pill.textContent = 'OFFLINE';
    }
  },

  async seedFirebase() {
    window.Toast.info('Seeding default models to Firebase Realtime Database...');
    const res = await window.adminApi.models.seedFirebase();
    if (res.success) {
      window.Toast.success(`Successfully published ${res.count} models to Firebase RTDB!`);
      this.fillRoute('/models.json');
    } else {
      window.Toast.error(`Failed to seed: ${res.error}`);
    }
  },

  async executeTest() {
    const method = document.getElementById('apiMethod').value;
    const endpoint = document.getElementById('apiEndpoint').value.trim();
    const btn = document.getElementById('btnSendApi');
    const statusEl = document.getElementById('apiStatusDisplay');
    const durationEl = document.getElementById('apiDurationDisplay');
    const responseBox = document.getElementById('apiResponseBox');

    btn.disabled = true;
    btn.textContent = 'Querying...';
    responseBox.textContent = 'Awaiting cloud response...';

    try {
      const res = await window.adminApi.server.testEndpoint(endpoint, method);
      durationEl.textContent = `Duration: ${res.durationMs}ms`;

      if (res.success) {
        statusEl.innerHTML = `Status: <span style="color: var(--success); font-weight: 600;">${res.statusCode || '200'} OK</span>`;
        responseBox.textContent = typeof res.data === 'object' ? JSON.stringify(res.data, null, 2) : res.data;
      } else {
        statusEl.innerHTML = `Status: <span style="color: var(--error); font-weight: 600;">Failed</span>`;
        responseBox.textContent = res.error || 'Request failed';
      }
    } catch (e) {
      statusEl.innerHTML = `Status: <span style="color: var(--error);">Error</span>`;
      responseBox.textContent = e.message;
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span>${window.Icons.get('send', 14)}</span> Query`;
    }
  }
};

/**
 * Dashboard View Controller
 * Connected to Firebase Realtime Database & Backblaze B2
 * Professional aesthetic with SVG icons and zero emojis
 */
window.DashboardView = {
  async render(container) {
    const I = window.Icons;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: var(--space-xl);">
        <!-- Top Metrics Cards -->
        <div class="metrics-grid" id="dashMetrics">
          <!-- 1. Firebase Realtime Database Status -->
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-title">Firebase RTDB</span>
              <div class="metric-icon" id="serverIconBadge">${I.get('cloud', 16)}</div>
            </div>
            <div class="metric-value" id="dashServerStatus">Connecting...</div>
            <div class="metric-subtext" id="dashServerLatency">
              <span class="server-beacon" id="dashServerBeacon"></span> Checking saraai-d0858 RTDB...
            </div>
          </div>

          <!-- 2. AI Models Count -->
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-title">AI Models (Cloud)</span>
              <div class="metric-icon">${I.get('cpu', 16)}</div>
            </div>
            <div class="metric-value" id="dashModelCount">--</div>
            <div class="metric-subtext" id="dashModelSubtext">Syncing with Firebase...</div>
          </div>

          <!-- 3. Local Model Cache -->
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-title">Local Cache Storage</span>
              <div class="metric-icon">${I.get('harddrive', 16)}</div>
            </div>
            <div class="metric-value" id="dashStorageSize">--</div>
            <div class="metric-subtext" id="dashStorageSubtext">admin/data storage</div>
          </div>

          <!-- 4. System RAM -->
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-title">System RAM</span>
              <div class="metric-icon">${I.get('ram', 16)}</div>
            </div>
            <div class="metric-value" id="dashRamUsage">--</div>
            <div class="metric-subtext" id="dashRamSubtext">Calculating memory...</div>
          </div>
        </div>

        <!-- Quick Actions Banner -->
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-lg) var(--space-xl); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-md);">
          <div>
            <h3 style="font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px;">Firebase & Cloud Actions</h3>
            <p style="font-size: 12.5px; color: var(--text-secondary);">Manage models in Firebase Realtime Database and configure Backblaze B2 storage.</p>
          </div>
          <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="window.ModelsView.openAddModelModal()">
              <span>${I.get('plus', 14)}</span> Add New AI Model
            </button>
            <button class="btn btn-secondary" onclick="window.DashboardView.seedFirebase()">
              <span>${I.get('cloud', 14)}</span> Seed / Sync to Firebase
            </button>
            <button class="btn btn-secondary" onclick="window.adminApi.system.openFolder('llm')">
              <span>${I.get('folder', 14)}</span> Open LLM Folder
            </button>
            <button class="btn btn-secondary" onclick="window.App.checkServerStatus(true)">
              <span>${I.get('refresh', 14)}</span> Ping Firebase
            </button>
          </div>
        </div>

        <!-- Storage & Cloud Breakdown -->
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: var(--space-lg);">
          <!-- Storage Bar & Distribution -->
          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-xl); display: flex; flex-direction: column; gap: var(--space-lg);">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <h3 style="font-size: 15px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                <span>${I.get('harddrive', 16)}</span> Storage & Cloud Infrastructure
              </h3>
              <button class="btn btn-outline btn-sm" onclick="window.DashboardView.refresh()">
                <span>${I.get('refresh', 12)}</span> Refresh
              </button>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
              <div style="display: flex; justify-content: space-between; font-size: 13px;">
                <span style="color: var(--text-secondary);">Local LLM Cache (<span id="dashLlmFilesCount">--</span> files)</span>
                <span style="font-weight: 600; font-family: var(--font-mono);" id="dashLlmDirFormatted">-- MB</span>
              </div>
              <div class="progress-container" style="height: 8px;">
                <div class="progress-bar" id="storageBarLlm" style="width: 40%; background: #38BDF8;"></div>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
              <div style="display: flex; justify-content: space-between; font-size: 13px;">
                <span style="color: var(--text-secondary);">Voice Packs Cache</span>
                <span style="font-weight: 600; font-family: var(--font-mono);" id="dashVpDirFormatted">-- MB</span>
              </div>
              <div class="progress-container" style="height: 8px;">
                <div class="progress-bar" id="storageBarVp" style="width: 15%; background: #A855F7;"></div>
              </div>
            </div>

            <div style="display: flex; gap: var(--space-xl); margin-top: var(--space-xs); border-top: 1px solid var(--border-subtle); padding-top: var(--space-md);">
              <div style="display: flex; align-items: center; gap: var(--space-xs); font-size: 12px; color: var(--text-secondary);">
                <span style="width: 10px; height: 10px; border-radius: 2px; background: #38BDF8; display: inline-block;"></span> Local LLMs
              </div>
              <div style="display: flex; align-items: center; gap: var(--space-xs); font-size: 12px; color: var(--text-secondary);">
                <span style="width: 10px; height: 10px; border-radius: 2px; background: #22C55E; display: inline-block;"></span> Firebase RTDB
              </div>
              <div style="display: flex; align-items: center; gap: var(--space-xs); font-size: 12px; color: var(--text-secondary);">
                <span style="width: 10px; height: 10px; border-radius: 2px; background: #F59E0B; display: inline-block;"></span> Backblaze B2
              </div>
            </div>
          </div>

          <!-- Cloud Architecture Card -->
          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-xl); display: flex; flex-direction: column; gap: var(--space-md);">
            <h3 style="font-size: 15px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
              <span>${I.get('cloud', 16)}</span> Cloud Endpoints
            </h3>
            <div style="display: flex; flex-direction: column; gap: var(--space-sm); font-size: 12px;">
              <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border-subtle);">
                <span style="color: var(--text-muted);">Database</span>
                <span style="font-family: var(--font-mono); color: var(--text-primary);">Firebase RTDB</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border-subtle);">
                <span style="color: var(--text-muted);">Models Path</span>
                <span style="font-family: var(--font-mono); color: var(--text-primary);">/models.json</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border-subtle);">
                <span style="color: var(--text-muted);">Voice Packs</span>
                <span style="font-family: var(--font-mono); color: var(--text-primary);">/voicepacks.json</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 6px 0;">
                <span style="color: var(--text-muted);">Binary Storage</span>
                <span style="font-family: var(--font-mono); color: #F59E0B;">Backblaze B2</span>
              </div>
            </div>

            <div style="margin-top: auto; padding-top: var(--space-sm);">
              <button class="btn btn-outline btn-sm" style="width: 100%;" onclick="window.App.navigateTo('server')">
                Open Firebase Explorer ->
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    await this.refresh();
  },

  async refresh() {
    try {
      const stats = await window.adminApi.system.getStats();
      if (stats) {
        document.getElementById('dashStorageSize').textContent = stats.llmDirFormatted || '0 B';
        document.getElementById('dashRamUsage').textContent = `${stats.memUsagePercent}%`;
        document.getElementById('dashRamSubtext').textContent = `${stats.usedMemFormatted} used of ${stats.totalMemFormatted}`;
        document.getElementById('dashLlmDirFormatted').textContent = stats.llmDirFormatted;
        document.getElementById('dashVpDirFormatted').textContent = stats.voicePackFormatted;
      }

      const models = await window.adminApi.models.list();
      if (models) {
        const installedCount = models.filter(m => m.isInstalled).length;
        document.getElementById('dashModelCount').textContent = models.length;
        document.getElementById('dashModelSubtext').textContent = `${installedCount} cached locally, ${models.length} in cloud`;
        document.getElementById('dashLlmFilesCount').textContent = installedCount;
      }

      const fb = await window.adminApi.firebase.checkStatus();
      const statusEl = document.getElementById('dashServerStatus');
      const latencyEl = document.getElementById('dashServerLatency');
      const beaconEl = document.getElementById('dashServerBeacon');

      if (fb.online) {
        statusEl.textContent = 'CONNECTED';
        statusEl.style.color = 'var(--success)';
        beaconEl.className = 'server-beacon online';
        latencyEl.innerHTML = `<span class="server-beacon online"></span> RTDB Connected (${fb.latencyMs}ms)`;
      } else {
        statusEl.textContent = 'OFFLINE';
        statusEl.style.color = 'var(--error)';
        beaconEl.className = 'server-beacon offline';
        latencyEl.innerHTML = `<span class="server-beacon offline"></span> Could not connect to Firebase`;
      }
    } catch (e) {
      console.error('Error refreshing dashboard:', e);
    }
  },

  async seedFirebase() {
    window.Toast.info('Publishing default models to Firebase Realtime Database...');
    const res = await window.adminApi.models.seedFirebase();
    if (res.success) {
      window.Toast.success(`Successfully published ${res.count} models to Firebase RTDB!`);
      this.refresh();
    } else {
      window.Toast.error(`Failed to seed: ${res.error}`);
    }
  }
};

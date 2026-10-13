/**
 * Sara AI Admin Application Master Orchestrator
 * Fully professional layout with SVG icons and zero emojis
 */
window.App = {
  currentView: 'dashboard',
  views: {},

  init() {
    this.renderStaticIcons();
    this.setupWindowControls();
    this.setupNavigation();
    this.setupSearch();
    this.startServerHealthMonitor();

    // Initialize Admin Auth topbar widget
    if (window.AdminAuth) {
      window.AdminAuth.init();
    }

    // Default view: Dashboard
    this.navigateTo('dashboard');
  },

  renderStaticIcons() {
    // Populate sidebar icons with clean vector SVGs
    const iconMap = {
      navIconDashboard: 'dashboard',
      navIconModels: 'cpu',
      navIconVoice: 'mic',
      navIconServer: 'server',
      navIconAdminMgmt: 'shield',
      navIconClients: 'smartphone',
      navIconSettings: 'settings',
      searchIconSpan: 'search',
      btnPlusIcon: 'plus',
      dockDownloadIcon: 'download',
    };

    for (const [id, iconName] of Object.entries(iconMap)) {
      const el = document.getElementById(id);
      if (el && window.Icons) {
        el.innerHTML = window.Icons.get(iconName, 16);
      }
    }
  },

  setupWindowControls() {
    const minBtn = document.getElementById('windowMinBtn');
    const maxBtn = document.getElementById('windowMaxBtn');
    const closeBtn = document.getElementById('windowCloseBtn');

    if (minBtn) minBtn.addEventListener('click', () => window.adminApi.window.minimize());
    if (maxBtn) maxBtn.addEventListener('click', () => window.adminApi.window.maximize());
    if (closeBtn) closeBtn.addEventListener('click', () => window.adminApi.window.close());

    // Update maximize/restore icon state
    window.adminApi.window.onWindowStateChange(({ isMaximized }) => {
      if (maxBtn && window.Icons) {
        maxBtn.innerHTML = isMaximized
          ? window.Icons.get('restore', 12)
          : window.Icons.get('maximize', 12);
      }
    });
  },

  setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        const targetView = item.getAttribute('data-view');
        if (targetView) this.navigateTo(targetView);
      });
    });
  },

  setupSearch() {
    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        const query = e.target.value;
        if (this.currentView !== 'models') {
          this.navigateTo('models');
        }
        if (window.ModelsView) {
          window.ModelsView.applySearch(query);
        }
      });
    }
  },

  async navigateTo(viewName) {
    this.currentView = viewName;

    // Update active nav class
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update topbar titles
    const titleEl = document.getElementById('pageTitle');
    const subEl = document.getElementById('pageSubtitle');
    const viewport = document.getElementById('viewportContainer');

    const viewMeta = {
      dashboard: { title: 'Dashboard Overview', subtitle: 'System health, storage metrics, and active node status' },
      models: { title: 'AI Models Hub', subtitle: 'Manage, download, and register on-device LLM reasoning engines' },
      voicepacks: { title: 'Voice Packs Hub', subtitle: 'Combined STT speech recognition & Piper TTS voice synthesis' },
      server: { title: 'Server & API Monitor', subtitle: 'Live latency, endpoint diagnostics, and network traffic' },
      'admin-management': { title: 'Admin & Role Management', subtitle: 'Secure server-side Firebase Authentication custom claims & privileges' },
      clients: { title: 'Mobile Device Connections', subtitle: 'Setup guides for Android Emulator, Wi-Fi, and USB ADB' },
      settings: { title: 'Admin Settings & Security', subtitle: 'Server environment parameters, ports, and catalog backup' },
    };

    const meta = viewMeta[viewName] || { title: 'Admin', subtitle: '' };
    if (titleEl) titleEl.textContent = meta.title;
    if (subEl) subEl.textContent = meta.subtitle;

    // Loading indicator
    viewport.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 300px; color: var(--text-muted); gap: 10px;">
        <span style="display: flex; animation: spin 1s linear infinite;">${window.Icons.get('refresh', 20)}</span>
        <span>Loading...</span>
      </div>
    `;

    try {
      if (viewName === 'dashboard' && window.DashboardView) {
        await window.DashboardView.render(viewport);
      } else if (viewName === 'models' && window.ModelsView) {
        await window.ModelsView.render(viewport);
      } else if (viewName === 'voicepacks' && window.VoicePacksView) {
        await window.VoicePacksView.render(viewport);
      } else if (viewName === 'server' && window.ServerView) {
        await window.ServerView.render(viewport);
      } else if (viewName === 'clients' && window.ClientsView) {
        await window.ClientsView.render(viewport);
      } else if (viewName === 'admin-management' && window.AdminManagementView) {
        await window.AdminManagementView.render(viewport);
      } else if (viewName === 'settings' && window.SettingsView) {
        await window.SettingsView.render(viewport);
      }
    } catch (err) {
      viewport.innerHTML = `
        <div class="badge badge-error" style="padding: 16px; font-size: 13px;">
          Failed to load view: ${err.message}
        </div>
      `;
    }
  },

  startServerHealthMonitor() {
    this.checkServerStatus();
    // Auto-ping every 10s
    setInterval(() => this.checkServerStatus(), 10000);
  },

  async checkServerStatus(userInitiated = false) {
    const beacon = document.getElementById('sidebarServerBeacon');
    const label = document.getElementById('sidebarServerLabel');

    try {
      const health = await window.adminApi.server.checkHealth();
      if (health.online) {
        if (beacon) beacon.className = 'server-beacon online';
        if (label) label.textContent = `RTDB Online (${health.latencyMs}ms)`;
        if (userInitiated) window.Toast.success(`Firebase RTDB online (${health.latencyMs}ms)`);
      } else {
        if (beacon) beacon.className = 'server-beacon offline';
        if (label) label.textContent = 'Offline';
        if (userInitiated) window.Toast.warning('Firebase Realtime Database unreachable.');
      }
    } catch {
      if (beacon) beacon.className = 'server-beacon offline';
      if (label) label.textContent = 'Offline';
    }
  }
};

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.App.init();
});

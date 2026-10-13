/**
 * Admin Authentication UI Controller
 * 
 * Manages Admin Email & Password login modal, topbar user status widget,
 * and user session state.
 */

window.AdminAuth = {
  currentUser: null,

  async init() {
    try {
      this.currentUser = await window.adminApi.auth.getCurrentUser();
    } catch (err) {
      console.warn('[AdminAuth] Error fetching current user on boot:', err.message);
      this.currentUser = null;
    }
    this.renderWidget();
  },

  renderWidget() {
    const container = document.getElementById('adminAuthTopbarWidget');
    if (!container) return;
    const I = window.Icons;

    if (this.currentUser && this.currentUser.isAdmin) {
      container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.25); border-radius: 9999px; padding: 3px 10px 3px 10px; font-size: 12px;">
          <span style="width: 7px; height: 7px; border-radius: 50%; background: var(--success); display: inline-block;"></span>
          <span style="font-weight: 500; color: var(--text-primary); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="Logged in as ${this.currentUser.email}">
            ${this.currentUser.email}
          </span>
          <span class="badge badge-success" style="font-size: 9px; padding: 1px 5px; text-transform: uppercase;">ADMIN</span>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.AdminAuth.handleLogout()" style="padding: 2px 6px; font-size: 11px; margin-left: 2px; color: var(--text-muted);" title="Sign Out">
            Sign Out
          </button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <button type="button" class="btn btn-outline btn-sm" onclick="window.AdminAuth.openLoginModal()" style="display: flex; align-items: center; gap: 6px;" title="Sign in with verified Firebase Admin email & password">
          <span style="display: flex; color: #F59E0B;">${I.get('lock', 13)}</span>
          <span>Admin Sign In</span>
        </button>
      `;
    }
  },

  openLoginModal() {
    this.hideError();
    const emailInput = document.getElementById('adminLoginEmail');
    const passInput = document.getElementById('adminLoginPassword');
    if (emailInput) emailInput.value = '';
    if (passInput) passInput.value = '';
    window.Modal.open('adminLoginModal');
    if (emailInput) setTimeout(() => emailInput.focus(), 150);
  },

  showError(msg) {
    const errorBox = document.getElementById('adminLoginError');
    const errorMsg = document.getElementById('adminLoginErrorMsg');
    if (errorBox && errorMsg) {
      errorMsg.textContent = msg;
      errorBox.style.display = 'block';
    }
  },

  hideError() {
    const errorBox = document.getElementById('adminLoginError');
    if (errorBox) errorBox.style.display = 'none';
  },

  async handleLoginSubmit(e) {
    e.preventDefault();
    this.hideError();

    const email = document.getElementById('adminLoginEmail').value.trim();
    const password = document.getElementById('adminLoginPassword').value;
    const submitBtn = document.getElementById('btnSubmitAdminLogin');

    if (!email || !password) {
      this.showError('Email and password are required.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Verifying...</span>`;
    }

    try {
      const res = await window.adminApi.auth.login(email, password);

      if (!res.success) {
        this.showError(res.error || 'Authentication failed');
        window.Toast.error(res.error || 'Admin Sign In Failed');
        return;
      }

      this.currentUser = res.user;
      this.renderWidget();
      window.Modal.close('adminLoginModal');
      window.Toast.success(`Signed in as Administrator: ${res.user.email}`);

      // If ModelsView is rendered, reload to refresh states
      if (window.ModelsView && typeof window.ModelsView.loadModels === 'function') {
        window.ModelsView.loadModels();
      }
    } catch (err) {
      this.showError(err.message || 'Network error during authentication');
      window.Toast.error(err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Sign In as Admin</span>`;
      }
    }
  },

  async handleLogout() {
    if (!confirm('Are you sure you want to sign out of this administrator session?')) {
      return;
    }

    try {
      await window.adminApi.auth.logout();
      this.currentUser = null;
      this.renderWidget();
      window.Toast.info('Signed out of administrator session.');
    } catch (err) {
      window.Toast.error(`Logout error: ${err.message}`);
    }
  }
};

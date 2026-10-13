/**
 * Firebase Admin & Role Management View Controller
 * 
 * Secure Server-Side Firebase Authentication Claims Administration.
 * Sets custom claim `admin: true` strictly via Firebase Admin SDK in Electron Main.
 */

window.AdminManagementView = {
  currentStatus: null,
  activeUser: null,
  auditLog: [],

  async render(container) {
    const I = window.Icons;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: var(--space-xl); max-width: 960px;">
        
        <!-- SDK Status & Service Account Setup Card -->
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-xl); display: flex; flex-direction: column; gap: var(--space-lg);">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-md);">
            <div style="display: flex; align-items: center; gap: var(--space-lg);">
              <div style="width: 48px; height: 48px; border-radius: var(--radius-lg); background: var(--surface-subtle); display: flex; align-items: center; justify-content: center; color: #F59E0B;">
                ${I.get('shield', 26)}
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: var(--space-sm);">
                  <h3 style="font-size: 17px; font-weight: 600; color: var(--text-primary);">Firebase Admin SDK & Access Control</h3>
                  <span class="badge badge-warning" id="sdkStatusBadge">Checking SDK...</span>
                </div>
                <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 3px;">
                  Server-side privilege management. Custom claims are signed by Google Firebase Admin SDK and tamper-proof.
                </p>
              </div>
            </div>

            <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap;">
              <button type="button" class="btn btn-outline btn-sm" onclick="window.AdminManagementView.refreshStatus()" title="Refresh SDK Status">
                <span>${I.get('refresh', 14)}</span> Refresh
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.AdminManagementView.selectServiceAccount()" id="btnSelectKey">
                <span>${I.get('key', 14)}</span> Select Service Account JSON
              </button>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.AdminManagementView.unloadServiceAccount()" id="btnUnloadKey" style="display: none; border-color: rgba(239, 68, 68, 0.4); color: var(--error);" title="Purge credentials from RAM memory immediately">
                <span>${I.get('lock', 14)}</span> Lock Session (Purge RAM)
              </button>
            </div>
          </div>

          <!-- Service Account Details Strip -->
          <div id="sdkDetailsContainer" style="background: var(--surface-subtle); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: var(--space-md) var(--space-lg); font-size: 12px; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; align-items: center; gap: 8px; color: var(--text-muted);">
              <span>${I.get('info', 14)}</span>
              <span>Loading credentials configuration...</span>
            </div>
          </div>
        </div>

        <!-- Admin Promotion Form Card -->
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-xl); display: flex; flex-direction: column; gap: var(--space-lg);">
          <div>
            <h4 style="font-size: 16px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--accent);">${I.get('user-check', 18)}</span> Promote User to Administrator
            </h4>
            <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px;">
              Enter a registered Firebase Authentication User ID (UID) to securely assign the <code style="background: var(--surface-elevated); padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono); color: var(--success); font-weight: 600;">admin: true</code> custom claim.
            </p>
          </div>

          <form id="promoteUserForm" onsubmit="window.AdminManagementView.handlePromote(event)">
            <div class="form-group" style="margin-bottom: var(--space-md);">
              <label class="form-label" for="targetUserUid">
                <span>Firebase Authentication User UID <span class="required-star">*</span></span>
                <span class="form-hint">Existing user's unique identifier from Firebase Auth</span>
              </label>
              
              <div style="display: flex; gap: var(--space-sm); align-items: stretch;">
                <div style="position: relative; flex: 1;">
                  <input
                    type="text"
                    class="form-input"
                    id="targetUserUid"
                    placeholder="e.g. 4kL89mX2sQp0Yw1Zr9vD7a8B9C2"
                    style="font-family: var(--font-mono); font-size: 13.5px; letter-spacing: 0.5px; width: 100%; padding-right: 40px;"
                    required
                  >
                  <button
                    type="button"
                    onclick="window.AdminManagementView.clearUidInput()"
                    style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-muted); cursor: pointer; display: none;"
                    id="clearUidBtn"
                    title="Clear UID"
                  >
                    ${I.get('x', 14)}
                  </button>
                </div>

                <button
                  type="button"
                  class="btn btn-secondary"
                  onclick="window.AdminManagementView.handleLookup()"
                  id="btnLookupUser"
                  title="Check existing account details before promoting"
                >
                  <span id="lookupIconSpan">${I.get('search', 14)}</span> Lookup User
                </button>
              </div>
            </div>

            <!-- Action Buttons -->
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-sm); margin-top: var(--space-sm);">
              <div style="font-size: 11.5px; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
                <span>${I.get('shield', 13)}</span>
                <span>Claim <code style="color: var(--text-primary); font-family: var(--font-mono); font-weight: 500;">{ admin: true }</code> will be validated immediately via server-side verification.</span>
              </div>

              <div style="display: flex; gap: var(--space-sm);">
                <button
                  type="button"
                  class="btn btn-outline"
                  onclick="window.AdminManagementView.handleRevoke()"
                  id="btnRevokeAdmin"
                  style="display: none; border-color: rgba(239, 68, 68, 0.4); color: var(--error);"
                >
                  <span>${I.get('user-x', 14)}</span> Revoke Admin Claim
                </button>

                <button
                  type="submit"
                  class="btn btn-primary"
                  id="btnPromoteAdmin"
                  style="min-width: 190px;"
                >
                  <span id="promoteIconSpan">${I.get('shield', 14)}</span> Promote to Admin
                </button>
              </div>
            </div>
          </form>

          <!-- Inline Error Banner -->
          <div id="adminActionError" style="display: none; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-md); padding: var(--space-md); font-size: 13px; color: #FCA5A5; display: flex; align-items: flex-start; gap: 10px;">
            <span style="color: var(--error); flex-shrink: 0; margin-top: 1px;">${I.get('alert', 16)}</span>
            <div id="adminActionErrorMsg" style="flex: 1;"></div>
          </div>
        </div>

        <!-- Active Verified Administrators Card (Fetched from Firebase Auth) -->
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-xl); display: flex; flex-direction: column; gap: var(--space-md);">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-sm);">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h4 style="font-size: 15px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                  <span style="color: var(--success);">${I.get('user-check', 17)}</span> Active Administrators in Firebase Auth
                </h4>
                <span class="badge badge-neutral" id="activeAdminsCountBadge">--</span>
              </div>
              <p style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                Accounts confirmed with <code style="font-family: var(--font-mono); color: var(--success);">admin: true</code> custom claims fetched directly from Google servers.
              </p>
            </div>

            <button type="button" class="btn btn-outline btn-sm" onclick="window.AdminManagementView.loadAdminUsers()" id="btnFetchAdmins" title="Fetch verified admin accounts from Google Firebase">
              <span id="fetchAdminsIconSpan">${I.get('refresh', 13)}</span> Fetch Admin Users
            </button>
          </div>

          <div id="activeAdminsContainer" style="overflow-x: auto;">
            <!-- Rendered dynamically -->
          </div>
        </div>

        <!-- Recent Admin Operations Audit Log -->
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-xl); display: flex; flex-direction: column; gap: var(--space-md);">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <h4 style="font-size: 15px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                <span>${I.get('clock', 16)}</span> Promotion & Access Audit History
              </h4>
              <p style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                Local record of admin promotions and claim modifications executed from this console.
              </p>
            </div>

            <button type="button" class="btn btn-outline btn-sm" onclick="window.AdminManagementView.clearAuditLog()" id="btnClearAudit" title="Clear local audit log">
              <span>${I.get('trash', 13)}</span> Clear Log
            </button>
          </div>

          <div id="auditTableContainer" style="overflow-x: auto;">
            <!-- Rendered dynamically -->
          </div>
        </div>

      </div>
    `;

    // Input clear button toggle
    const inputEl = document.getElementById('targetUserUid');
    const clearBtn = document.getElementById('clearUidBtn');
    if (inputEl && clearBtn) {
      inputEl.addEventListener('input', () => {
        clearBtn.style.display = inputEl.value.trim() ? 'block' : 'none';
      });
    }

    // Initial data fetch
    await this.refreshStatus();
    await this.loadAdminUsers();
    await this.loadAuditLog();
  },

  clearUidInput() {
    const inputEl = document.getElementById('targetUserUid');
    const clearBtn = document.getElementById('clearUidBtn');
    if (inputEl) {
      inputEl.value = '';
      inputEl.focus();
    }
    if (clearBtn) clearBtn.style.display = 'none';
    this.hideError();
  },

  async refreshStatus() {
    const I = window.Icons;
    const badgeEl = document.getElementById('sdkStatusBadge');
    const detailsEl = document.getElementById('sdkDetailsContainer');

    try {
      const status = await window.adminApi.adminUsers.getStatus();
      this.currentStatus = status;
      const unloadBtn = document.getElementById('btnUnloadKey');

      if (!status || !status.initialized) {
        if (unloadBtn) unloadBtn.style.display = 'none';
        if (badgeEl) {
          badgeEl.className = 'badge badge-warning';
          badgeEl.innerHTML = `${I.get('lock', 12)} TEMPORARY SESSION INACTIVE`;
        }
        if (detailsEl) {
          detailsEl.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 10px; color: #F59E0B;">
              <span style="flex-shrink: 0; margin-top: 1px;">${I.get('alert', 16)}</span>
              <div>
                <div style="font-weight: 600;">In-Memory Session Only (Zero Disk Storage)</div>
                <div style="color: var(--text-secondary); font-size: 12px; margin-top: 2px;">
                  Credentials are kept strictly in RAM and are never permanently saved to disk. When the application exits, all session access is automatically wiped.
                </div>
                <div style="margin-top: 8px;">
                  <button type="button" class="btn btn-secondary btn-sm" onclick="window.AdminManagementView.selectServiceAccount()">
                    <span>${I.get('folder', 13)}</span> Select Service Account JSON for This Session
                  </button>
                </div>
              </div>
            </div>
          `;
        }
        return;
      }

      // Initialized Successfully in RAM
      if (unloadBtn) unloadBtn.style.display = 'inline-flex';
      if (badgeEl) {
        badgeEl.className = 'badge badge-success';
        badgeEl.innerHTML = `${I.get('check', 12)} IN-MEMORY SESSION ACTIVE`;
      }

      if (detailsEl) {
        const loadedTimeStr = status.loadedAt ? new Date(status.loadedAt).toLocaleTimeString() : 'Active';
        detailsEl.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; font-size: 12px;">
            <div>
              <span style="color: var(--text-muted);">Firebase Project ID:</span>
              <div style="font-weight: 600; color: var(--text-primary); font-family: var(--font-mono); margin-top: 1px;">
                ${status.projectId || 'saraai-d0858'}
              </div>
            </div>
            <div>
              <span style="color: var(--text-muted);">Service Account Client:</span>
              <div style="font-weight: 500; color: var(--text-secondary); font-family: var(--font-mono); font-size: 11.5px; margin-top: 1px; word-break: break-all;">
                ${status.clientEmail || 'In-Memory Key'}
              </div>
            </div>
            <div>
              <span style="color: var(--text-muted);">Storage Policy:</span>
              <div style="color: var(--success); font-weight: 500; margin-top: 1px; display: flex; align-items: center; gap: 4px;">
                <span>${I.get('shield', 12)}</span> RAM Only (Purged on Exit)
              </div>
              <div style="color: var(--text-muted); font-size: 10.5px; margin-top: 1px;">Activated at ${loadedTimeStr}</div>
            </div>
          </div>
        `;
      }

      await this.loadAdminUsers();
    } catch (err) {
      if (badgeEl) {
        badgeEl.className = 'badge badge-error';
        badgeEl.innerHTML = `${I.get('close', 12)} STATUS ERROR`;
      }
      if (detailsEl) {
        detailsEl.innerHTML = `<span style="color: var(--error);">${err.message}</span>`;
      }
    }
  },

  async selectServiceAccount() {
    try {
      const res = await window.adminApi.adminUsers.selectServiceAccountFile();
      if (res.canceled) return;

      if (!res.success) {
        window.Toast.show({ title: 'Service Account Error', message: res.error, type: 'error' });
        return;
      }

      window.Toast.show({
        title: 'Session Activated',
        message: res.message || 'Firebase Admin SDK loaded in RAM memory.',
        type: 'success',
      });

      await this.refreshStatus();
    } catch (err) {
      window.Toast.show({ title: 'Setup Failed', message: err.message, type: 'error' });
    }
  },

  async unloadServiceAccount() {
    const confirmed = confirm('Are you sure you want to end this admin session and purge credentials from RAM memory?');
    if (!confirmed) return;

    try {
      const res = await window.adminApi.adminUsers.unloadServiceAccount();
      this.activeUser = null;
      this.renderUserCard(null);
      await this.refreshStatus();
      await this.loadAdminUsers();
      window.Toast.show({
        title: 'Session Locked',
        message: res.message || 'Credentials successfully purged from memory.',
        type: 'info',
      });
    } catch (err) {
      window.Toast.show({ title: 'Error', message: err.message, type: 'error' });
    }
  },

  showError(msg) {
    const box = document.getElementById('adminActionError');
    const txt = document.getElementById('adminActionErrorMsg');
    if (box && txt) {
      txt.textContent = msg;
      box.style.display = 'flex';
    }
  },

  hideError() {
    const box = document.getElementById('adminActionError');
    if (box) box.style.display = 'none';
  },

  async handleLookup() {
    const I = window.Icons;
    const input = document.getElementById('targetUserUid');
    const uid = input ? input.value.trim() : '';

    if (!uid) {
      this.showError('Please enter a Firebase User UID to look up.');
      if (input) input.focus();
      return;
    }

    this.hideError();
    const btnLookup = document.getElementById('btnLookupUser');
    const iconSpan = document.getElementById('lookupIconSpan');

    if (btnLookup) btnLookup.disabled = true;
    if (iconSpan) iconSpan.innerHTML = `<span style="animation: spin 1s linear infinite; display: inline-block;">${I.get('refresh', 14)}</span>`;

    try {
      const res = await window.adminApi.adminUsers.getUser(uid);

      if (!res.success) {
        this.showError(res.error);
        window.Toast.show({ title: 'Lookup Failed', message: res.error, type: 'error' });
        this.renderUserCard(null);
        return;
      }

      this.activeUser = res.user;
      this.renderUserCard(res.user, 'LOOKUP');
      window.Toast.show({
        title: 'User Found',
        message: `Found account: ${res.user.email || res.user.uid}`,
        type: 'info',
      });
    } catch (err) {
      this.showError(err.message);
      window.Toast.show({ title: 'Error', message: err.message, type: 'error' });
    } finally {
      if (btnLookup) btnLookup.disabled = false;
      if (iconSpan) iconSpan.innerHTML = I.get('search', 14);
    }
  },

  async handlePromote(e) {
    if (e) e.preventDefault();
    const I = window.Icons;
    const input = document.getElementById('targetUserUid');
    const uid = input ? input.value.trim() : '';

    if (!uid) {
      this.showError('Please enter a Firebase User UID to promote.');
      if (input) input.focus();
      return;
    }

    this.hideError();
    const btnPromote = document.getElementById('btnPromoteAdmin');
    const iconSpan = document.getElementById('promoteIconSpan');

    if (btnPromote) btnPromote.disabled = true;
    if (iconSpan) iconSpan.innerHTML = `<span style="animation: spin 1s linear infinite; display: inline-block;">${I.get('refresh', 14)}</span>`;

    try {
      const res = await window.adminApi.adminUsers.promoteToAdmin(uid);

      if (!res.success) {
        this.showError(res.error);
        window.Toast.show({ title: 'Promotion Failed', message: res.error, type: 'error' });
        return;
      }

      this.activeUser = res.user;
      this.renderUserCard(res.user, 'PROMOTED');

      window.Toast.show({
        title: 'Admin Promoted',
        message: res.message,
        type: 'success',
      });

      // Reload admin users list and audit log
      await this.loadAdminUsers();
      await this.loadAuditLog();
    } catch (err) {
      this.showError(err.message);
      window.Toast.show({ title: 'Promotion Error', message: err.message, type: 'error' });
    } finally {
      if (btnPromote) btnPromote.disabled = false;
      if (iconSpan) iconSpan.innerHTML = I.get('shield', 14);
    }
  },

  async handleRevoke() {
    const I = window.Icons;
    const input = document.getElementById('targetUserUid');
    const uid = input ? input.value.trim() : '';

    if (!uid) return;

    const confirmed = confirm(`Are you sure you want to revoke admin privileges for user ${uid}?`);
    if (!confirmed) return;

    this.hideError();
    const btnRevoke = document.getElementById('btnRevokeAdmin');
    if (btnRevoke) btnRevoke.disabled = true;

    try {
      const res = await window.adminApi.adminUsers.revokeAdmin(uid);

      if (!res.success) {
        this.showError(res.error);
        window.Toast.show({ title: 'Revocation Failed', message: res.error, type: 'error' });
        return;
      }

      this.activeUser = res.user;
      this.renderUserCard(res.user, 'REVOKED');

      window.Toast.show({
        title: 'Admin Claim Revoked',
        message: res.message,
        type: 'info',
      });

      await this.loadAdminUsers();
      await this.loadAuditLog();
    } catch (err) {
      this.showError(err.message);
    } finally {
      if (btnRevoke) btnRevoke.disabled = false;
    }
  },

  renderUserCard(user, mode = 'LOOKUP') {
    const I = window.Icons;
    const cardEl = document.getElementById('userConfirmationCard');
    const revokeBtn = document.getElementById('btnRevokeAdmin');

    if (!cardEl) return;

    if (!user) {
      cardEl.style.display = 'none';
      if (revokeBtn) revokeBtn.style.display = 'none';
      return;
    }

    const isAdmin = user.isAdmin;
    if (revokeBtn) {
      revokeBtn.style.display = isAdmin ? 'inline-flex' : 'none';
    }

    let statusHeader = '';
    if (mode === 'PROMOTED') {
      statusHeader = `
        <div style="background: rgba(34, 197, 94, 0.15); border-bottom: 1px solid rgba(34, 197, 94, 0.3); padding: var(--space-md) var(--space-xl); display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px; color: var(--success); font-weight: 600; font-size: 13.5px;">
            <span>${I.get('shield', 18)}</span>
            <span>SUCCESSFULLY PROMOTED TO ADMINISTRATOR</span>
          </div>
          <span class="badge badge-success" style="font-family: var(--font-mono); font-size: 11px;">VERIFIED SERVER-SIDE</span>
        </div>
      `;
    } else if (mode === 'REVOKED') {
      statusHeader = `
        <div style="background: rgba(239, 68, 68, 0.12); border-bottom: 1px solid rgba(239, 68, 68, 0.3); padding: var(--space-md) var(--space-xl); display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px; color: var(--error); font-weight: 600; font-size: 13.5px;">
            <span>${I.get('user-x', 18)}</span>
            <span>ADMIN PRIVILEGES REVOKED</span>
          </div>
          <span class="badge badge-error" style="font-family: var(--font-mono); font-size: 11px;">ROLE REMOVED</span>
        </div>
      `;
    } else {
      statusHeader = `
        <div style="background: var(--surface-subtle); border-bottom: 1px solid var(--border-subtle); padding: var(--space-md) var(--space-xl); display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px; color: var(--text-primary); font-weight: 600; font-size: 13.5px;">
            <span>${I.get('user', 18)}</span>
            <span>AUTHENTICATION USER RECORD</span>
          </div>
          <span class="badge ${isAdmin ? 'badge-success' : 'badge-neutral'}" style="font-size: 11px;">
            ${isAdmin ? 'ACTIVE ADMIN' : 'STANDARD USER'}
          </span>
        </div>
      `;
    }

    const createdStr = user.metadata?.creationTime
      ? new Date(user.metadata.creationTime).toLocaleString()
      : 'N/A';
    const lastSignInStr = user.metadata?.lastSignInTime
      ? new Date(user.metadata.lastSignInTime).toLocaleString()
      : 'Never signed in';

    cardEl.style.display = 'block';
    cardEl.innerHTML = `
      <div style="background: var(--surface); border: 1px solid ${isAdmin ? 'rgba(34, 197, 94, 0.4)' : 'var(--border)'}; border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-elevated);">
        ${statusHeader}

        <div style="padding: var(--space-xl); display: flex; flex-direction: column; gap: var(--space-lg);">
          
          <!-- Identity Summary Grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-lg);">
            
            <!-- User UID -->
            <div>
              <span style="font-size: 11.5px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">User UID</span>
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                <code style="font-family: var(--font-mono); font-size: 13px; font-weight: 600; color: var(--text-primary); background: var(--surface-subtle); padding: 4px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                  ${user.uid}
                </code>
                <button type="button" class="btn btn-outline btn-sm btn-icon-only" onclick="window.adminApi.system.copyToClipboard('${user.uid}'); window.Toast.show({ title: 'Copied', message: 'UID copied to clipboard', type: 'info' })" title="Copy UID">
                  ${I.get('copy', 13)}
                </button>
              </div>
            </div>

            <!-- Email & Display Name -->
            <div>
              <span style="font-size: 11.5px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Account Email</span>
              <div style="font-size: 13.5px; font-weight: 500; color: var(--text-primary); margin-top: 4px; display: flex; align-items: center; gap: 6px;">
                <span>${user.email || '<span style="color: var(--text-muted); font-style: italic;">Anonymous / No Email</span>'}</span>
                ${user.emailVerified ? `<span class="badge badge-success" style="font-size: 10px;">VERIFIED</span>` : ''}
              </div>
              ${user.displayName ? `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">${user.displayName}</div>` : ''}
            </div>

            <!-- Created Date -->
            <div>
              <span style="font-size: 11.5px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Account Created</span>
              <div style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px;">
                ${createdStr}
              </div>
            </div>

            <!-- Last Sign-In -->
            <div>
              <span style="font-size: 11.5px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Last Sign-In</span>
              <div style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px;">
                ${lastSignInStr}
              </div>
            </div>
          </div>

          <!-- Custom Claims Inspector Box -->
          <div style="background: var(--surface-subtle); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: var(--space-md) var(--space-lg);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-size: 12px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                <span>${I.get('shield', 14)}</span> Active Firebase Custom Claims
              </span>
              <div>
                ${isAdmin
                  ? `<span class="badge badge-success" style="font-weight: 600;">admin: true</span>`
                  : `<span class="badge badge-neutral">No admin claim</span>`
                }
              </div>
            </div>

            <pre style="margin: 0; padding: 10px; background: var(--bg-app); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 12px; color: ${isAdmin ? 'var(--success)' : 'var(--text-secondary)'}; max-height: 140px; overflow-y: auto;">${JSON.stringify(user.customClaims, null, 2)}</pre>
          </div>

          <!-- Client Device Propagation Note -->
          <div style="display: flex; align-items: flex-start; gap: 10px; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: var(--radius-md); padding: var(--space-md); font-size: 12px; color: #93C5FD;">
            <span style="color: #60A5FA; flex-shrink: 0; margin-top: 1px;">${I.get('info', 15)}</span>
            <div>
              <strong style="color: #BFDBFE;">Token Propagation Guidance:</strong>
              Firebase Auth ID tokens are cached on client devices for up to 1 hour. The client application will instantly pick up the new <code style="font-family: var(--font-mono); color: #FFFFFF;">admin: true</code> claim on its next automatic token refresh, or by invoking <code style="font-family: var(--font-mono); color: #FFFFFF;">await auth.currentUser.getIdToken(true)</code>.
            </div>
          </div>

        </div>
      </div>
    `;

    // Smooth scroll into view
    cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  async loadAuditLog() {
    const I = window.Icons;
    const container = document.getElementById('auditTableContainer');
    if (!container) return;

    try {
      const res = await window.adminApi.adminUsers.getAuditLog();
      const log = res && Array.isArray(res.log) ? res.log : [];
      this.auditLog = log;

      if (log.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: var(--space-xl); color: var(--text-muted); font-size: 13px;">
            No admin promotion events recorded yet. Enter a UID above to promote a user.
          </div>
        `;
        return;
      }

      let rows = '';
      for (const item of log) {
        const isPromote = item.action === 'PROMOTE_ADMIN';
        const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString() : 'N/A';
        rows += `
          <tr style="border-bottom: 1px solid var(--border-subtle); transition: background 0.15s ease;">
            <td style="padding: 10px 14px; font-family: var(--font-mono); font-size: 12px;">
              <span class="badge ${isPromote ? 'badge-success' : 'badge-error'}" style="font-size: 10.5px;">
                ${isPromote ? 'PROMOTED' : 'REVOKED'}
              </span>
            </td>
            <td style="padding: 10px 14px; font-family: var(--font-mono); font-size: 12.5px; color: var(--text-primary);">
              ${item.uid}
            </td>
            <td style="padding: 10px 14px; font-size: 12.5px; color: var(--text-secondary);">
              ${item.email || 'Anonymous'}
            </td>
            <td style="padding: 10px 14px; font-size: 12px; color: var(--text-muted);">
              ${dateStr}
            </td>
            <td style="padding: 10px 14px; text-align: right;">
              <button
                type="button"
                class="btn btn-outline btn-sm"
                onclick="window.AdminManagementView.fillAndLookup('${item.uid}')"
                title="Inspect this user"
                style="padding: 3px 8px; font-size: 11px;"
              >
                Inspect
              </button>
            </td>
          </tr>
        `;
      }

      container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border); color: var(--text-muted); font-size: 11px; text-transform: uppercase;">
              <th style="padding: 8px 14px;">Action</th>
              <th style="padding: 8px 14px;">UID</th>
              <th style="padding: 8px 14px;">Email</th>
              <th style="padding: 8px 14px;">Date</th>
              <th style="padding: 8px 14px; text-align: right;">Quick Action</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    } catch (_) {
      container.innerHTML = `<div style="color: var(--text-muted); padding: 12px;">Failed to load audit history.</div>`;
    }
  },

  fillAndLookup(uid) {
    const input = document.getElementById('targetUserUid');
    const clearBtn = document.getElementById('clearUidBtn');
    if (input) {
      input.value = uid;
      if (clearBtn) clearBtn.style.display = 'block';
    }
    this.handleLookup();
  },

  async clearAuditLog() {
    const confirmed = confirm('Are you sure you want to clear the local admin audit history?');
    if (!confirmed) return;

    try {
      await window.adminApi.adminUsers.clearAuditLog();
      await this.loadAuditLog();
      window.Toast.show({ title: 'Cleared', message: 'Admin audit log reset.', type: 'info' });
    } catch (err) {
      window.Toast.show({ title: 'Error', message: err.message, type: 'error' });
    }
  },

  async loadAdminUsers() {
    const I = window.Icons;
    const container = document.getElementById('activeAdminsContainer');
    const badgeEl = document.getElementById('activeAdminsCountBadge');
    const btnFetch = document.getElementById('btnFetchAdmins');
    const iconSpan = document.getElementById('fetchAdminsIconSpan');

    if (!container) return;

    if (!this.currentStatus || !this.currentStatus.initialized) {
      if (badgeEl) {
        badgeEl.className = 'badge badge-neutral';
        badgeEl.textContent = 'Locked';
      }
      container.innerHTML = `
        <div style="background: var(--surface-subtle); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: var(--space-lg); text-align: center; color: var(--text-muted); font-size: 12.5px; display: flex; flex-direction: column; align-items: center; gap: 6px;">
          <span style="color: #F59E0B;">${I.get('lock', 22)}</span>
          <div style="font-weight: 500; color: var(--text-secondary);">Firebase Service Account Required</div>
          <div>Admin user emails and identities can only be fetched from Google Auth servers after a valid Service Account JSON is loaded for this session.</div>
        </div>
      `;
      return;
    }

    if (btnFetch) btnFetch.disabled = true;
    if (iconSpan) iconSpan.innerHTML = `<span style="animation: spin 1s linear infinite; display: inline-block;">${I.get('refresh', 13)}</span>`;

    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: var(--space-xl); color: var(--text-muted); font-size: 12.5px;">
        <span style="animation: spin 1s linear infinite; display: inline-block;">${I.get('refresh', 16)}</span>
        <span>Scanning Firebase Authentication users via Google Cloud API...</span>
      </div>
    `;

    try {
      const res = await window.adminApi.adminUsers.fetchAdminUsers();

      if (!res.success) {
        if (badgeEl) {
          badgeEl.className = 'badge badge-error';
          badgeEl.textContent = 'Error';
        }
        container.innerHTML = `
          <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-md); padding: var(--space-md); color: #FCA5A5; font-size: 12.5px;">
            ${res.error}
          </div>
        `;
        window.Toast.show({ title: 'Fetch Error', message: res.error, type: 'error' });
        return;
      }

      const admins = res.admins || [];
      if (badgeEl) {
        badgeEl.className = admins.length > 0 ? 'badge badge-success' : 'badge badge-neutral';
        badgeEl.textContent = `${admins.length} Admin${admins.length === 1 ? '' : 's'}`;
      }

      if (admins.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: var(--space-xl); color: var(--text-muted); font-size: 12.5px;">
            No users currently have the <code style="font-family: var(--font-mono); color: var(--text-primary);">admin: true</code> claim in your Firebase project.
          </div>
        `;
        return;
      }

      let rows = '';
      for (const admin of admins) {
        const lastSignIn = admin.lastSignInTime ? new Date(admin.lastSignInTime).toLocaleString() : 'Never';
        rows += `
          <tr style="border-bottom: 1px solid var(--border-subtle);">
            <td style="padding: 10px 14px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: var(--success); display: flex;">${I.get('shield', 15)}</span>
                <div>
                  <div style="font-weight: 500; color: var(--text-primary); font-size: 13px;">
                    ${admin.email}
                    ${admin.emailVerified ? `<span class="badge badge-success" style="font-size: 9.5px; padding: 1px 5px; margin-left: 4px;">VERIFIED</span>` : ''}
                  </div>
                  ${admin.displayName ? `<div style="font-size: 11.5px; color: var(--text-muted);">${admin.displayName}</div>` : ''}
                </div>
              </div>
            </td>
            <td style="padding: 10px 14px; font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary);">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span>${admin.uid}</span>
                <button type="button" class="btn btn-outline btn-sm btn-icon-only" onclick="window.adminApi.system.copyToClipboard('${admin.uid}'); window.Toast.show({ title: 'Copied', message: 'UID copied to clipboard', type: 'info' })" title="Copy UID" style="padding: 2px; width: 22px; height: 22px;">
                  ${I.get('copy', 11)}
                </button>
              </div>
            </td>
            <td style="padding: 10px 14px; font-size: 12px; color: var(--text-secondary);">
              ${lastSignIn}
            </td>
            <td style="padding: 10px 14px; text-align: right;">
              <div style="display: flex; gap: 6px; justify-content: flex-end;">
                <button type="button" class="btn btn-outline btn-sm" onclick="window.AdminManagementView.fillAndLookup('${admin.uid}')" style="padding: 3px 8px; font-size: 11px;">
                  Inspect
                </button>
                <button type="button" class="btn btn-outline btn-sm" onclick="window.AdminManagementView.quickRevoke('${admin.uid}', '${admin.email}')" style="padding: 3px 8px; font-size: 11px; color: var(--error); border-color: rgba(239, 68, 68, 0.3);">
                  Revoke
                </button>
              </div>
            </td>
          </tr>
        `;
      }

      container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border); color: var(--text-muted); font-size: 11px; text-transform: uppercase;">
              <th style="padding: 8px 14px;">Administrator Email</th>
              <th style="padding: 8px 14px;">User UID</th>
              <th style="padding: 8px 14px;">Last Active</th>
              <th style="padding: 8px 14px; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    } catch (err) {
      if (badgeEl) {
        badgeEl.className = 'badge badge-error';
        badgeEl.textContent = 'Error';
      }
      container.innerHTML = `<div style="color: var(--error); padding: 12px; font-size: 12px;">Failed to fetch admins: ${err.message}</div>`;
    } finally {
      if (btnFetch) btnFetch.disabled = false;
      if (iconSpan) iconSpan.innerHTML = I.get('refresh', 13);
    }
  },

  async quickRevoke(uid, email) {
    const confirmed = confirm(`Are you sure you want to revoke admin privileges for ${email || uid}?`);
    if (!confirmed) return;

    try {
      const res = await window.adminApi.adminUsers.revokeAdmin(uid);
      if (!res.success) {
        window.Toast.show({ title: 'Revocation Failed', message: res.error, type: 'error' });
        return;
      }
      window.Toast.show({ title: 'Admin Revoked', message: res.message, type: 'info' });
      await this.loadAdminUsers();
      await this.loadAuditLog();
      if (this.activeUser && this.activeUser.uid === uid) {
        this.activeUser = res.user;
        this.renderUserCard(res.user, 'REVOKED');
      }
    } catch (err) {
      window.Toast.show({ title: 'Error', message: err.message, type: 'error' });
    }
  }
};

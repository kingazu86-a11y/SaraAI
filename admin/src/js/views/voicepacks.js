/**
 * Voice Packs View Controller
 * Professional layout with SVG icons and zero emojis
 */
window.VoicePacksView = {
  packs: [],
  currentPage: 1,
  pageSize: 6,
  activeSearch: '',

  async render(container) {
    const I = window.Icons;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: var(--space-lg);">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-md);">
          <div>
            <h3 style="font-size: 16px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
              <span>${I.get('mic', 18)}</span> Combined Voice Packs (STT + TTS)
            </h3>
            <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 2px;">
              Combined Whisper/Vosk speech recognition and Piper offline speech synthesis packages.
            </p>
          </div>
          <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap;">
            <button class="btn btn-outline btn-sm" onclick="window.VoicePacksView.seedToFirebase()">
              <span>${I.get('cloud', 14)}</span> Seed to Firebase
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.adminApi.system.openFolder('voicepacks')">
              <span>${I.get('folder', 14)}</span> Open Folder
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.VoicePacksView.openAddPackModal()">
              <span>${I.get('plus', 14)}</span> Upload Voice Pack (B2)
            </button>
            <button class="btn btn-secondary btn-sm btn-icon-only" onclick="window.VoicePacksView.refresh()" title="Refresh">
              <span style="display: flex;">${I.get('refresh', 14)}</span>
            </button>
          </div>
        </div>

        <!-- Filter & Search Controls -->
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-sm);">
          <div style="display: flex; align-items: center; gap: 8px; flex: 1; max-width: 360px;">
            <input type="text" class="form-input" style="padding: 6px 12px; font-size: 12.5px;" placeholder="Search voice packs by name, engine, or language..." oninput="window.VoicePacksView.applySearch(this.value)">
          </div>
          <div style="font-size: 12px; color: var(--text-muted);">
            Direct Firebase RTDB: <code>/voicepacks</code>
          </div>
        </div>

        <div id="voicePacksListContainer">
          <div style="text-align: center; padding: 40px; color: var(--text-muted); display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span>${I.get('refresh', 16)}</span> Loading voice packs from Firebase RTDB...
          </div>
        </div>
      </div>

      <!-- Add Voice Pack Modal -->
      <div class="modal-backdrop" id="addVoicePackModal">
        <div class="modal-card">
          <div class="modal-header">
            <div style="display: flex; align-items: center; gap: var(--space-sm);">
              <span style="display: flex; color: #A855F7;">${I.get('mic', 18)}</span>
              <h3 class="modal-title">Add Voice Pack (Publish to Backblaze B2 & Firebase)</h3>
            </div>
            <button class="modal-close-btn" onclick="window.Modal.close('addVoicePackModal')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div class="modal-body">
            <form id="addVoicePackForm" onsubmit="window.VoicePacksView.handleFormSubmit(event)">
              <!-- Personal Storage Picker Card -->
              <div style="background: linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%); border: 1px solid rgba(168, 85, 247, 0.35); border-radius: var(--radius-lg); padding: var(--space-md); margin-bottom: var(--space-md);">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="display: flex; color: #A855F7; background: rgba(168, 85, 247, 0.15); padding: 7px; border-radius: var(--radius-md);">${I.get('harddrive', 18)}</span>
                    <div>
                      <div style="font-size: 13.5px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                        <span>Personal Storage & B2 VoicePacks Folder</span>
                        <span style="font-size: 10px; background: #A855F7; color: #fff; font-weight: 700; padding: 1px 5px; border-radius: 3px;">AUTO-FETCH</span>
                      </div>
                      <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 1px;">
                        Select local voice binary (.bin, .onnx, .zip). System auto-detects RAM, Size, Slug & publishes to <code>VoicePacks/</code> folder.
                      </div>
                    </div>
                  </div>
                  <button type="button" class="btn btn-outline btn-sm" id="btnSelectLocalPack" onclick="window.VoicePacksView.selectLocalPackFile()" style="border-color: #A855F7; color: #A855F7;">
                    <span>${I.get('folder', 14)}</span> Choose from Local Storage
                  </button>
                </div>

                <!-- Inspected Pack Details Box -->
                <div id="localPackSelectedBox" style="display: none; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px; margin-top: 10px;">
                  <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                      <span style="color: var(--success); display: flex; background: rgba(16, 185, 129, 0.15); padding: 6px; border-radius: 50%;">${I.get('check', 16)}</span>
                      <div style="min-width: 0;">
                        <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);" id="selectedPackTitle">voicepack.bin</div>
                        <div style="font-size: 11.5px; color: var(--text-secondary); display: flex; gap: 10px; flex-wrap: wrap; margin-top: 2px;">
                          <span style="color: #38BDF8; font-family: var(--font-mono); font-weight: 600;" id="selectedPackSize">--</span>
                          <span>•</span>
                          <span style="color: #A78BFA; font-weight: 600;" id="selectedPackArch">Whisper + Piper</span>
                          <span>•</span>
                          <span style="color: #F59E0B; font-family: var(--font-mono); font-weight: 600;" id="selectedPackRam">--</span>
                        </div>
                      </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <button type="button" class="btn btn-primary btn-sm" id="btnUploadPackToB2" onclick="window.VoicePacksView.uploadSelectedToB2()">
                        <span>${I.get('cloud', 14)}</span> Upload to Backblaze B2
                      </button>
                    </div>
                  </div>

                  <!-- Upload Progress Bar -->
                  <div id="b2PackUploadProgressContainer" style="display: none; margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--border);">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px;">
                      <span style="font-weight: 600; color: #A855F7;" id="b2PackUploadStatusText">Uploading to Backblaze B2 (VoicePacks/)...</span>
                      <span style="font-family: var(--font-mono); color: var(--text-primary); font-weight: 600;" id="b2PackUploadPercentText">0%</span>
                    </div>
                    <div style="height: 8px; background: var(--surface-subtle); border-radius: 4px; overflow: hidden;">
                      <div id="b2PackUploadProgressBar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #A855F7, #10B981); transition: width 0.3s ease;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 5px; font-family: var(--font-mono);">
                      <span id="b2PackUploadBytesText">0 B / 0 B</span>
                      <span id="b2PackUploadSpeedText">Speed: --</span>
                      <span id="b2PackUploadEtaText">ETA: --</span>
                    </div>
                  </div>

                  <div id="b2PackSuccessBadge" style="display: none; margin-top: 10px; padding: 8px 12px; background: rgba(16, 185, 129, 0.12); border: 1px solid var(--success); border-radius: var(--radius-sm); font-size: 12px; color: var(--success);">
                    <span>${I.get('check', 14)}</span> Uploaded to Backblaze B2 VoicePacks! Download URL linked.
                  </div>
                </div>
              </div>

              <!-- Download URL -->
              <div class="form-group">
                <label class="form-label">Download URL (Backblaze B2 / HTTPS) <span class="required-star">*</span></label>
                <input type="url" class="form-input" id="packDownloadUrl" placeholder="https://f005.backblazeb2.com/file/SaraAI-Models/VoicePacks/pack.bin" required>
              </div>

              <!-- Name & Slug -->
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Voice Pack Display Name <span class="required-star">*</span></label>
                  <input type="text" class="form-input" id="packName" placeholder="e.g. Sara Neural Voice Pack" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Voice Pack ID / Slug</label>
                  <input type="text" class="form-input" id="packId" placeholder="e.g. whisper-piper-neural-pack">
                </div>
              </div>

              <!-- RAM & Size -->
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Required RAM (MB) <span class="required-star">*</span></label>
                  <input type="number" class="form-input" id="packRamMb" value="1024" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Package Size (Bytes or MB) <span class="required-star">*</span></label>
                  <input type="text" class="form-input" id="packSizeBytes" placeholder="e.g. 250 MB" required>
                </div>
              </div>

              <!-- Runtime & Tagline -->
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Runtime Engine</label>
                  <input type="text" class="form-input" id="packRuntime" value="Whisper + Piper ONNX">
                </div>
                <div class="form-group">
                  <label class="form-label">Tagline</label>
                  <input type="text" class="form-input" id="packTagline" value="High-accuracy Whisper STT + Piper natural offline voice">
                </div>
              </div>

              <div class="modal-footer" style="margin-top: var(--space-lg); margin-left: -20px; margin-right: -20px; margin-bottom: -20px;">
                <button type="button" class="btn btn-secondary" onclick="window.Modal.close('addVoicePackModal')">Cancel</button>
                <button type="submit" class="btn btn-primary" id="btnSaveVoicePack">
                  <span>${I.get('cloud', 14)}</span> Publish to Firebase RTDB
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

    `;

    await this.refresh();
  },

  async refresh() {
    try {
      this.packs = await window.adminApi.voicePacks.list();
      this.renderList();
    } catch (err) {
      document.getElementById('voicePacksListContainer').innerHTML = `
        <div class="badge badge-error">Failed to load voice packs: ${err.message}</div>
      `;
    }
  },

  applySearch(query) {
    this.activeSearch = (query || '').toLowerCase().trim();
    this.currentPage = 1;
    this.renderList();
  },

  goToPage(p) {
    this.currentPage = p;
    this.renderList();
    const el = document.getElementById('voicePacksListContainer');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  setPageSize(sz) {
    this.pageSize = sz === 'all' ? 'all' : parseInt(sz, 10);
    this.currentPage = 1;
    this.renderList();
  },

  renderList() {
    const container = document.getElementById('voicePacksListContainer');
    if (!container) return;
    const I = window.Icons;

    let filtered = this.packs;

    if (this.activeSearch) {
      filtered = filtered.filter(p =>
        (p.name && p.name.toLowerCase().includes(this.activeSearch)) ||
        (p.id && p.id.toLowerCase().includes(this.activeSearch)) ||
        (p.tagline && p.tagline.toLowerCase().includes(this.activeSearch)) ||
        (p.runtime && p.runtime.toLowerCase().includes(this.activeSearch)) ||
        (Array.isArray(p.languages) && p.languages.some(l => l.toLowerCase().includes(this.activeSearch)))
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 50px 20px; background: var(--surface); border: 1px dashed var(--border); border-radius: var(--radius-xl);">
          <div style="display: flex; justify-content: center; margin-bottom: 12px; color: var(--text-muted);">${I.get('mic', 32)}</div>
          <h4 style="font-size: 15px; font-weight: 600; color: var(--text-primary);">No Voice Packs Found</h4>
          <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px;">
            ${this.activeSearch ? `No voice packs match "${this.activeSearch}".` : 'Place voice pack binaries (.bin) inside <code>admin/data/VoicePack/</code> or click "Seed to Firebase".'}
          </p>
          <div style="display: flex; gap: 8px; justify-content: center; margin-top: var(--space-md);">
            <button class="btn btn-secondary btn-sm" onclick="window.VoicePacksView.seedToFirebase()">
              <span>${I.get('cloud', 14)}</span> Seed Default Voice Packs
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.VoicePacksView.openAddPackModal()">
              <span>${I.get('plus', 14)}</span> Add Voice Pack
            </button>
          </div>
        </div>
      `;
      return;
    }

    // Pagination calculations
    const total = filtered.length;
    const pageSize = this.pageSize === 'all' ? total : parseInt(this.pageSize, 10) || 6;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    if (this.currentPage < 1) this.currentPage = 1;

    const startIndex = (this.currentPage - 1) * pageSize;
    const pageItems = filtered.slice(startIndex, startIndex + pageSize);

    const contentHtml = `
      <div class="models-grid">
        ${pageItems.map(p => `
          <div class="model-card">
            <div class="model-card-top">
              <div class="model-title-group">
                <span style="font-size: 11px; font-weight: 600; color: #A855F7; text-transform: uppercase;">
                  Voice Pack | Combined STT + TTS
                </span>
                <h4 class="model-name">${p.name}</h4>
                <p class="model-tagline">${p.tagline || 'Combined Whisper speech-to-text with Piper offline voice'}</p>
              </div>
              <span class="badge badge-success" style="flex-shrink: 0; display: flex; align-items: center; gap: 4px;">
                <span>${I.get('cloud', 11)}</span> In Firebase RTDB
              </span>
            </div>

            <div class="model-specs">
              <div class="spec-item" title="Required RAM: ${p.ramFormatted || `${p.ramRequirementMb} MB`}">
                <span class="spec-label" style="display: flex; align-items: center; gap: 4px;">
                  <span>${I.get('ram', 11)}</span> Required RAM
                </span>
                <span class="spec-val highlight-ram">${p.ramFormatted || `${p.ramRequirementMb} MB`}</span>
              </div>
              <div class="spec-item" title="Package Size: ${p.sizeFormatted || 'Unknown'}">
                <span class="spec-label" style="display: flex; align-items: center; gap: 4px;">
                  <span>${I.get('harddrive', 11)}</span> Package Size
                </span>
                <span class="spec-val highlight-size">${p.sizeFormatted || 'Unknown'}</span>
              </div>
              <div class="spec-item" title="Engine: ${p.runtime}">
                <span class="spec-label">Engine</span>
                <span class="spec-val">${p.runtime}</span>
              </div>
              <div class="spec-item" title="Languages: ${Array.isArray(p.languages) ? p.languages.join(', ') : (p.languages || '')}">
                <span class="spec-label">Languages</span>
                <span class="spec-val" style="font-size: 11px;">${Array.isArray(p.languages) ? p.languages.join(', ') : (p.languages || '')}</span>
              </div>
            </div>

            <!-- Download URL Bar -->
            <div class="model-url-bar" onclick="navigator.clipboard.writeText('${p.downloadUrl}'); window.Toast.success('Copied Download URL!');" title="Click to copy Download URL: ${p.downloadUrl || ''}">
              <span style="display:flex; color: var(--text-muted); flex-shrink: 0;">${I.get('link', 12)}</span>
              <span class="model-url-text">${p.downloadUrl || 'No Backblaze URL configured'}</span>
              <span style="font-size: 10px; color: var(--text-muted); background: var(--surface); padding: 2px 5px; border-radius: 2px; flex-shrink: 0;">Copy</span>
            </div>

            <div class="model-card-actions">
              <button class="btn btn-outline btn-sm" onclick="window.adminApi.server.testEndpoint('voicepacks')">
                <span>${I.get('test', 12)}</span> Test Endpoint
              </button>
              <button class="btn btn-danger btn-sm btn-icon-only" style="flex-shrink: 0;" onclick="window.VoicePacksView.deletePack('${p.id}')" title="Delete Voice Pack">
                <span style="display: flex;">${I.get('trash', 14)}</span>
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Seamless pagination bar
    const paginationHtml = `
      <div class="pagination-card">
        <div class="pagination-info">
          <span>Showing <strong>${total === 0 ? 0 : startIndex + 1}–${Math.min(startIndex + pageSize, total)}</strong> of <strong>${total}</strong> voice packs</span>
        </div>

        <div class="pagination-nav">
          <button class="pagination-btn" ${this.currentPage <= 1 ? 'disabled' : ''} onclick="window.VoicePacksView.goToPage(${this.currentPage - 1})" title="Previous Page">
            ◀ Prev
          </button>

          ${Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - this.currentPage) <= 1)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) {
                acc.push('<span style="color: var(--text-muted); padding: 0 4px;">…</span>');
              }
              acc.push(`
                <button class="pagination-btn ${p === this.currentPage ? 'active' : ''}" onclick="window.VoicePacksView.goToPage(${p})">
                  ${p}
                </button>
              `);
              return acc;
            }, []).join('')}

          <button class="pagination-btn" ${this.currentPage >= totalPages ? 'disabled' : ''} onclick="window.VoicePacksView.goToPage(${this.currentPage + 1})" title="Next Page">
            Next ▶
          </button>
        </div>

        <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary);">
          <span>Per page:</span>
          <select class="pagination-size-select" onchange="window.VoicePacksView.setPageSize(this.value)">
            <option value="6" ${this.pageSize === 6 ? 'selected' : ''}>6</option>
            <option value="12" ${this.pageSize === 12 ? 'selected' : ''}>12</option>
            <option value="24" ${this.pageSize === 24 ? 'selected' : ''}>24</option>
            <option value="all" ${this.pageSize === 'all' ? 'selected' : ''}>All</option>
          </select>
        </div>
      </div>
    `;

    container.innerHTML = contentHtml + paginationHtml;
  },

  async deletePack(packId) {
    if (!confirm(`Delete voice pack "${packId}" from server?`)) return;
    const res = await window.adminApi.voicePacks.delete(packId, true);
    if (res.success) {
      window.Toast.success(`Voice pack deleted.`);
      this.refresh();
    } else {
      window.Toast.error(res.error || 'Failed to delete pack.');
    }
  },

  openAddPackModal() {
    this.selectedLocalPack = null;
    document.getElementById('addVoicePackForm').reset();
    document.getElementById('packRamMb').value = '1024';
    document.getElementById('packRuntime').value = 'Whisper + Piper ONNX';
    document.getElementById('packTagline').value = 'High-accuracy Whisper STT + Piper natural offline voice';
    const box = document.getElementById('localPackSelectedBox');
    if (box) box.style.display = 'none';
    const progress = document.getElementById('b2PackUploadProgressContainer');
    if (progress) progress.style.display = 'none';
    const badge = document.getElementById('b2PackSuccessBadge');
    if (badge) badge.style.display = 'none';
    window.Modal.open('addVoicePackModal');
  },

  async selectLocalPackFile() {
    try {
      const res = await window.adminApi.voicePacks.selectLocalPack();
      if (!res || res.canceled) return;

      if (res.error) {
        window.Toast.error(`Failed to inspect file: ${res.error}`);
        return;
      }

      this.selectedLocalPack = res;

      const box = document.getElementById('localPackSelectedBox');
      if (box) box.style.display = 'block';

      document.getElementById('selectedPackTitle').textContent = res.filename;
      document.getElementById('selectedPackSize').textContent = res.sizeFormatted;
      document.getElementById('selectedPackRam').textContent = `RAM: ${res.ramFormatted}`;

      // Auto populate inputs
      document.getElementById('packName').value = res.displayName;
      document.getElementById('packId').value = res.modelId;
      document.getElementById('packSizeBytes').value = res.fileSizeBytes;
      document.getElementById('packRamMb').value = res.ramRequirementMb;
      document.getElementById('packRuntime').value = res.runtime || 'Whisper + Piper ONNX';
      document.getElementById('packTagline').value = res.tagline || 'Combined Whisper speech-to-text with Piper offline voice';

      window.Toast.success(`Auto-extracted voice pack metadata: ${res.sizeFormatted}, ${res.ramFormatted}! Click "Upload to Backblaze B2" to publish.`);
    } catch (err) {
      window.Toast.error(err.message);
    }
  },

  async uploadSelectedToB2() {
    if (!this.selectedLocalPack || !this.selectedLocalPack.filePath) {
      window.Toast.warning('Please select a local voice pack file first.');
      return false;
    }

    const b2Config = await window.adminApi.b2.getConfig();
    if (!b2Config.hasCredentials) {
      window.Toast.warning('Backblaze B2 credentials missing. Please enter your Key ID and Application Key in Settings.');
      window.App.navigateTo('settings');
      return false;
    }

    const btn = document.getElementById('btnUploadPackToB2');
    btn.disabled = true;
    btn.innerHTML = `<span>${window.Icons.get('refresh', 13)}</span> Initializing...`;

    const progressBox = document.getElementById('b2PackUploadProgressContainer');
    if (progressBox) progressBox.style.display = 'block';

    const statusText = document.getElementById('b2PackUploadStatusText');
    const folder = b2Config.voicePackFolder || 'VoicePacks';
    if (statusText) statusText.textContent = `Uploading to Backblaze B2 (${b2Config.bucketName} / ${folder})...`;

    // Listen for progress
    const unsubscribe = window.adminApi.b2.onUploadProgress((data) => {
      if (data.status === 'UPLOADING' || data.status === 'COMPLETE') {
        const bar = document.getElementById('b2PackUploadProgressBar');
        const pct = document.getElementById('b2PackUploadPercentText');
        const bytes = document.getElementById('b2PackUploadBytesText');
        const spd = document.getElementById('b2PackUploadSpeedText');
        const eta = document.getElementById('b2PackUploadEtaText');

        if (bar) bar.style.width = `${data.progress}%`;
        if (pct) pct.textContent = `${data.progress}%`;
        if (bytes) bytes.textContent = `${data.uploadedFormatted || ''} / ${data.totalFormatted || ''}`;
        if (spd) spd.textContent = `Speed: ${data.speed || '--'}`;
        if (eta) eta.textContent = `ETA: ${data.eta || '--'}`;
      }
    });

    try {
      const res = await window.adminApi.b2.uploadModel({
        filePath: this.selectedLocalPack.filePath,
        uploadType: 'voicepack',
        customFilename: this.selectedLocalPack.filename,
      });

      if (res && res.success && res.downloadUrl) {
        document.getElementById('packDownloadUrl').value = res.downloadUrl;
        const badge = document.getElementById('b2PackSuccessBadge');
        if (badge) badge.style.display = 'block';

        btn.disabled = false;
        btn.innerHTML = `<span>${window.Icons.get('check', 13)}</span> Uploaded to B2`;
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline');

        window.Toast.success(`Uploaded ${res.filename} to Backblaze B2 VoicePacks! Download URL linked.`);
        return true;
      } else {
        throw new Error(res?.error || 'Upload failed');
      }
    } catch (err) {
      window.Toast.error(`Upload error: ${err.message}`);
      btn.disabled = false;
      btn.innerHTML = `<span>${window.Icons.get('cloud', 14)}</span> Retry Upload`;
      return false;
    } finally {
      if (unsubscribe) unsubscribe();
    }
  },

  async handleFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSaveVoicePack');
    btn.disabled = true;

    try {
      let downloadUrl = document.getElementById('packDownloadUrl').value.trim();

      if (!downloadUrl && this.selectedLocalPack) {
        btn.textContent = 'Uploading to Backblaze B2...';
        const ok = await this.uploadSelectedToB2();
        if (!ok) throw new Error('Please wait for Backblaze B2 upload to complete or provide a download URL.');
        downloadUrl = document.getElementById('packDownloadUrl').value.trim();
      }

      if (!downloadUrl) {
        throw new Error('Download URL is required.');
      }

      btn.textContent = 'Publishing to Firebase...';

      let sizeVal = document.getElementById('packSizeBytes').value.trim();
      let sizeBytes = 0;
      if (sizeVal.toLowerCase().includes('mb')) {
        sizeBytes = Math.round(parseFloat(sizeVal) * 1024 * 1024);
      } else {
        sizeBytes = parseInt(sizeVal.replace(/[^0-9]/g, ''), 10) || 0;
      }

      const packData = {
        name: document.getElementById('packName').value.trim(),
        id: document.getElementById('packId').value.trim(),
        downloadUrl,
        ramRequirementMb: parseInt(document.getElementById('packRamMb').value, 10) || 1024,
        sizeBytes,
        kind: 'voice_pack',
        runtime: document.getElementById('packRuntime').value.trim() || 'Whisper + Piper ONNX',
        tagline: document.getElementById('packTagline').value.trim(),
        modalities: ['audio->text', 'text->audio'],
        capabilities: ['Speech-to-Text (Whisper)', 'Text-to-Speech (Piper)', 'Offline Natural Voice'],
        languages: ['English', 'Urdu', 'Hindi'],
        format: 'BIN Voice Pack',
        status: 'READY',
      };

      const res = await window.adminApi.voicePacks.add(packData);
      if (res.success) {
        window.Modal.close('addVoicePackModal');
        window.Toast.success(`Voice Pack "${packData.name}" published to Firebase!`);
        this.refresh();
      } else {
        window.Toast.error(res.error || 'Failed to save voice pack.');
      }
    } catch (err) {
      window.Toast.error(err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span>${window.Icons.get('cloud', 14)}</span> Publish to Firebase RTDB`;
    }
  },

  async seedToFirebase() {
    window.Toast.info('Publishing seed voice packs to Firebase Realtime Database...');
    const res = await window.adminApi.voicePacks.seedFirebase();
    if (res.success) {
      window.Toast.success(`Seeded ${res.count} voice packs to Firebase!`);
      this.refresh();
    } else {
      window.Toast.error(res.error || 'Failed to seed voice packs.');
    }
  }
};

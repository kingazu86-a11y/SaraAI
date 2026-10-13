/**
 * AI Models View Controller
 * Complete Hub for Managing, Adding, Downloading, and Verifying AI Models
 * Powered by Firebase Realtime Database & Backblaze B2 Storage
 */
window.ModelsView = {
  models: [],
  activeFilter: 'all',
  activeSearch: '',
  viewMode: 'grid',
  currentPage: 1,
  pageSize: 6,

  MODALITIES_CONFIG: [
    { id: 'text->text', key: 't2t', label: 'Text → Text', sub: 'LLM, Chat, Device Tools', icon: 'message' },
    { id: 'image->text', key: 'i2t', label: 'Image → Text', sub: 'Vision, OCR, Scene Q&A', icon: 'eye' },
    { id: 'text->image', key: 't2i', label: 'Text → Image', sub: 'Diffusion, Art & Photo Gen', icon: 'image' },
    { id: 'image->image', key: 'i2i', label: 'Image → Image', sub: 'Editing, Upscaling, Inpainting', icon: 'palette' },
    { id: 'audio->text', key: 'a2t', label: 'Audio → Text', sub: 'Whisper, Vosk, STT', icon: 'mic' },
    { id: 'text->audio', key: 't2a', label: 'Text → Audio', sub: 'Piper, TTS, Natural Voice', icon: 'voice' },
  ],

  PRESET_CAPABILITIES: [
    'Android Automation',
    'Function & Tool Calling',
    'Urdu & English Reasoning',
    'Offline Reasoning',
    'Document & OCR Scan',
    'Visual Scene Understanding',
    'Photo & Art Generation',
    'Image Upscaling & Edit',
    'Zero Lag Inference',
    'Low Battery Mode',
    'Code & Math Engine',
    'Voice Dialogue',
  ],

  selectedModalities: ['text->text'],
  selectedCapabilities: ['Android Automation', 'Function & Tool Calling', 'Urdu & English Reasoning'],
  selectedLocalModel: null,
  isUploadingToB2: false,
  currentUploadId: null,
  b2ListenerAttached: false,
  editingModelId: null,
  editSelectedModalities: [],
  editSelectedCapabilities: [],

  async render(container) {
    const I = window.Icons;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: var(--space-lg);">
        <!-- Subheader & Controls -->
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-md);">
          <!-- Filters -->
          <div style="display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm active" id="filterAll" onclick="window.ModelsView.setFilter('all')">All Models</button>
            <button class="btn btn-secondary btn-sm" id="filterT2t" onclick="window.ModelsView.setFilter('t2t')">
              <span style="display:flex;">${I.get('message', 12)}</span> Text → Text
            </button>
            <button class="btn btn-secondary btn-sm" id="filterI2t" onclick="window.ModelsView.setFilter('i2t')">
              <span style="display:flex;">${I.get('eye', 12)}</span> Image → Text (Vision)
            </button>
            <button class="btn btn-secondary btn-sm" id="filterT2i" onclick="window.ModelsView.setFilter('t2i')">
              <span style="display:flex;">${I.get('image', 12)}</span> Text → Image (Gen)
            </button>
            <button class="btn btn-secondary btn-sm" id="filterI2i" onclick="window.ModelsView.setFilter('i2i')">
              <span style="display:flex;">${I.get('palette', 12)}</span> Image → Image
            </button>
            <button class="btn btn-secondary btn-sm" id="filterVoice" onclick="window.ModelsView.setFilter('voice')">
              <span style="display:flex;">${I.get('mic', 12)}</span> Voice Packs
            </button>
            <button class="btn btn-secondary btn-sm" id="filterInstalled" onclick="window.ModelsView.setFilter('installed')">
              <span style="display:flex;">${I.get('harddrive', 12)}</span> Cached on Disk
            </button>
          </div>

          <!-- View toggles & Add CTA -->
          <div style="display: flex; align-items: center; gap: var(--space-sm);">
            <button class="btn btn-secondary btn-sm btn-icon-only" title="Grid View" onclick="window.ModelsView.setViewMode('grid')">
              <span style="display:flex;">${I.get('grid', 14)}</span>
            </button>
            <button class="btn btn-secondary btn-sm btn-icon-only" title="Table View" onclick="window.ModelsView.setViewMode('table')">
              <span style="display:flex;">${I.get('list', 14)}</span>
            </button>
            <button class="btn btn-outline btn-sm" onclick="window.ModelsView.seedDefaultModels()" title="Sync base models to Firebase">
              <span>${I.get('cloud', 14)}</span> Seed to Firebase
            </button>
            <button class="btn btn-outline btn-sm" onclick="window.ModelsView.importLocalFile()" title="Select local model and publish">
              <span>${I.get('folder', 14)}</span> Select Model File
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.ModelsView.openAddModelModal()">
              <span>${I.get('plus', 14)}</span> Add New AI Model
            </button>
          </div>
        </div>

        <!-- Models Container -->
        <div id="modelsListContainer">
          <div style="text-align: center; padding: 40px; color: var(--text-muted); display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span>${I.get('refresh', 16)}</span> Syncing with Firebase Realtime Database...
          </div>
        </div>
      </div>

      <!-- Add AI Model Modal -->
      <div class="modal-backdrop" id="addModelModal">
        <div class="modal-card">
          <div class="modal-header">
            <div style="display: flex; align-items: center; gap: var(--space-sm);">
              <span style="display: flex; color: var(--success);">${I.get('cpu', 18)}</span>
              <h3 class="modal-title">Add AI Model (Publish to Firebase)</h3>
            </div>
            <button class="modal-close-btn" onclick="window.Modal.close('addModelModal')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div class="modal-body">
            <form id="addModelForm" onsubmit="window.ModelsView.handleFormSubmit(event)">
              <!-- Section 1: Personal Storage & Backblaze B2 Publisher Card -->
              <div style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: var(--radius-lg); padding: var(--space-md); margin-bottom: var(--space-md);">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="display: flex; color: #F59E0B; background: rgba(245, 158, 11, 0.15); padding: 7px; border-radius: var(--radius-md);">${I.get('harddrive', 18)}</span>
                    <div>
                      <div style="font-size: 13.5px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                        <span>Personal Storage & Backblaze B2 Publisher</span>
                        <span style="font-size: 10px; background: #F59E0B; color: #000; font-weight: 700; padding: 1px 5px; border-radius: 3px;">AUTO-FETCH</span>
                      </div>
                      <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 1px;">
                        Select local model file (.gguf, .bin, .onnx). System auto-detects RAM, Size, Slug, Display Name, & Architecture!
                      </div>
                    </div>
                  </div>
                  <button type="button" class="btn btn-outline btn-sm" id="btnSelectLocalModel" onclick="window.ModelsView.selectLocalModelFile()" style="border-color: #F59E0B; color: #F59E0B;">
                    <span>${I.get('folder', 14)}</span> Choose from Local Storage
                  </button>
                </div>

                <!-- Inspected Model Details Box (Revealed when file is picked) -->
                <div id="localModelSelectedBox" style="display: none; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px; margin-top: 10px;">
                  <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                      <span style="color: var(--success); display: flex; background: rgba(16, 185, 129, 0.15); padding: 6px; border-radius: 50%;">${I.get('check', 16)}</span>
                      <div style="min-width: 0;">
                        <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" id="selectedFileTitle">Filename.gguf</div>
                        <div style="font-size: 11.5px; color: var(--text-secondary); display: flex; gap: 10px; flex-wrap: wrap; margin-top: 2px;" id="selectedFileMeta">
                          <span style="color: #38BDF8; font-family: var(--font-mono); font-weight: 600;" id="selectedFileSize">--</span>
                          <span>•</span>
                          <span style="color: #A78BFA; font-weight: 600;" id="selectedFileArch">--</span>
                          <span>•</span>
                          <span style="color: #F59E0B; font-family: var(--font-mono); font-weight: 600;" id="selectedFileRam">--</span>
                        </div>
                      </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <button type="button" class="btn btn-primary btn-sm" id="btnUploadToB2" onclick="window.ModelsView.uploadSelectedToB2()">
                        <span>${I.get('cloud', 14)}</span> Upload to Backblaze B2
                      </button>
                      <button type="button" class="btn btn-secondary btn-sm btn-icon-only" title="Clear selection" onclick="window.ModelsView.clearLocalSelection()">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  </div>

                  <!-- Upload Progress Bar & Stats -->
                  <div id="b2UploadProgressContainer" style="display: none; margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--border);">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px;">
                      <span style="font-weight: 600; color: #F59E0B;" id="b2UploadStatusText">Uploading to Backblaze B2...</span>
                      <span style="font-family: var(--font-mono); color: var(--text-primary); font-weight: 600;" id="b2UploadPercentText">0%</span>
                    </div>
                    <div style="height: 8px; background: var(--surface-subtle); border-radius: 4px; overflow: hidden;">
                      <div id="b2UploadProgressBar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #F59E0B, #10B981); transition: width 0.3s ease;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 5px; font-family: var(--font-mono);">
                      <span id="b2UploadBytesText">0 B / 0 B</span>
                      <span id="b2UploadSpeedText">Speed: --</span>
                      <span id="b2UploadEtaText">ETA: --</span>
                    </div>
                  </div>

                  <!-- Upload Success Link Badge -->
                  <div id="b2UploadSuccessBadge" style="display: none; margin-top: 10px; padding: 8px 12px; background: rgba(16, 185, 129, 0.12); border: 1px solid var(--success); border-radius: var(--radius-sm); font-size: 12px; color: var(--success); align-items: center; justify-content: space-between;">
                    <span style="display: flex; align-items: center; gap: 8px; font-weight: 500;">
                      <span>${I.get('check', 14)}</span>
                      <span>Uploaded to Backblaze B2! Download URL automatically placed into configuration below.</span>
                    </span>
                    <span style="font-family: var(--font-mono); font-size: 11px; opacity: 0.9;" id="b2TargetCloudPath">SaraAI-Models / LLMs</span>
                  </div>
                </div>
              </div>

              <!-- Required: Download URL (Backblaze B2 / Direct) -->
              <div class="form-group">
                <label class="form-label">
                  <span>Download URL (Backblaze B2 / HTTPS) <span class="required-star">*</span></span>
                  <span class="form-hint">Backblaze B2 bucket download link or direct URL (auto-filled on upload)</span>
                </label>
                <div class="input-with-action">
                  <input type="url" class="form-input" id="modelDownloadUrl" placeholder="https://f005.backblazeb2.com/file/SaraAI-Models/LLMs/model.gguf" required onchange="window.ModelsView.onUrlChange(this.value)">
                  <button type="button" class="btn btn-secondary btn-sm" id="btnFetchHeaders" onclick="window.ModelsView.fetchUrlHeaders()" title="Fetch file size and headers from Backblaze B2">
                    <span>${I.get('bolt', 13)}</span> Auto-Fetch Size
                  </button>
                </div>
                <span class="form-hint" id="fetchHeaderStatus" style="display: none;"></span>
              </div>

              <!-- Model Name & Slug ID -->
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Model Display Name <span class="required-star">*</span></label>
                  <input type="text" class="form-input" id="modelName" placeholder="e.g. Qwen 2.5 1.5B Instruct" required oninput="window.ModelsView.autoSuggestSlug(this.value)">
                </div>

                <div class="form-group">
                  <label class="form-label">Model ID / Slug</label>
                  <input type="text" class="form-input" id="modelId" placeholder="qwen2.5-1.5b-instruct">
                </div>
              </div>

              <!-- Model Architecture / Kind & Tier -->
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Model Architecture / Kind <span class="required-star">*</span></label>
                  <select class="form-select" id="modelKind" onchange="window.ModelsView.onKindChange(this.value)">
                    <option value="text" selected>Text LLM (Chat, Reasoning, Device Actions)</option>
                    <option value="vision">Vision-Language Model (Image-to-Text / OCR / Scene Q&A)</option>
                    <option value="image_gen">Image Generation (Diffusion / Text-to-Image)</option>
                    <option value="image_edit">Image-to-Image (Editing, Upscaling, Inpainting)</option>
                    <option value="voice_pack">Voice Pack (Speech-to-Text + Text-to-Speech)</option>
                    <option value="multimodal">Multimodal (Omni AI Model)</option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">Hardware Profile / Tier</label>
                  <select class="form-select" id="modelTier">
                    <option value="Tier 1 (Lightweight & Fast)" selected>Tier 1 (Lightweight & Fast - 3GB RAM)</option>
                    <option value="Tier 2 (Balanced)">Tier 2 (Balanced - 4GB-6GB RAM)</option>
                    <option value="Tier 3 (Heavy Pro)">Tier 3 (Heavy Pro - 8GB+ RAM)</option>
                  </select>
                </div>
              </div>

              <!-- Supported Modalities (I/O Tasks) Multi-select -->
              <div class="form-group">
                <label class="form-label">
                  <span>Supported Modalities (I/O Tasks) <span class="required-star">*</span></span>
                  <span class="form-hint">Select what inputs & outputs this AI model handles</span>
                </label>
                <div class="modality-selector-grid" id="modalitiesSelectorGrid">
                  <!-- Dynamically populated by renderModalitiesSelector -->
                </div>
              </div>

              <!-- Required: Required RAM & Size -->
              <div class="form-row">
                <!-- Required RAM -->
                <div class="form-group">
                  <label class="form-label">Required RAM (MB) <span class="required-star">*</span></label>
                  <input type="number" class="form-input" id="modelRamMb" placeholder="e.g. 2048" required min="128" step="64" value="2048">
                  <!-- Quick RAM Presets -->
                  <div style="display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap;">
                    <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 6px; font-size: 10.5px;" onclick="window.ModelsView.setRamPreset(512)">512 MB</button>
                    <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 6px; font-size: 10.5px;" onclick="window.ModelsView.setRamPreset(1024)">1 GB</button>
                    <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 6px; font-size: 10.5px;" onclick="window.ModelsView.setRamPreset(2048)">2 GB</button>
                    <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 6px; font-size: 10.5px;" onclick="window.ModelsView.setRamPreset(3072)">3 GB</button>
                    <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 6px; font-size: 10.5px;" onclick="window.ModelsView.setRamPreset(4096)">4 GB</button>
                  </div>
                </div>

                <!-- Model Size (in Bytes or MB) -->
                <div class="form-group">
                  <label class="form-label">Model Size (MB or Bytes) <span class="required-star">*</span></label>
                  <input type="text" class="form-input" id="modelSizeBytes" placeholder="e.g. 480 MB or 503316480" required>
                  <span class="form-hint" id="sizeFormattedPreview">Calculated size: --</span>
                </div>
              </div>

              <!-- Format, Runtime & Version -->
              <div class="form-row-3">
                <div class="form-group">
                  <label class="form-label">Quantization / Format</label>
                  <select class="form-select" id="modelFormat">
                    <option value="Q4_K_M" selected>Q4_K_M (Balanced)</option>
                    <option value="Q4_0">Q4_0 (Fastest)</option>
                    <option value="Q8_0">Q8_0 (High Quality)</option>
                    <option value="FP16">FP16 (Full Precision)</option>
                    <option value="ONNX">ONNX Runtime</option>
                    <option value="LiteRT">Google LiteRT</option>
                    <option value="GGUF">Generic GGUF</option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">Edge Runtime</label>
                  <select class="form-select" id="modelRuntime">
                    <option value="GGUF Edge Runtime" selected>GGUF Edge Runtime</option>
                    <option value="Google AI Edge / LiteRT">Google AI Edge / LiteRT</option>
                    <option value="ONNX Runtime">ONNX Runtime</option>
                    <option value="Whisper.cpp">Whisper.cpp</option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">Version</label>
                  <input type="text" class="form-input" id="modelVersion" value="1.0.0" placeholder="1.0.0">
                </div>
              </div>

              <!-- Model Tagline / Purpose -->
              <div class="form-group">
                <label class="form-label">Tagline & Description</label>
                <input type="text" class="form-input" id="modelTagline" placeholder="High-speed reasoning, Android device automation, and chat">
              </div>

              <!-- Interactive Capabilities Manager -->
              <div class="form-group">
                <label class="form-label">
                  <span>Model Capabilities & Features</span>
                  <span class="form-hint">Toggle popular presets or add custom tags</span>
                </label>
                <div class="capability-manager-box">
                  <div>
                    <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Active Capabilities:</span>
                    <div class="selected-tags-box" id="selectedTagsBox" style="margin-top: 4px;"></div>
                  </div>

                  <div>
                    <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Quick Presets (Click to toggle):</span>
                    <div class="preset-chips-container" id="presetChipsContainer" style="margin-top: 4px;"></div>
                  </div>

                  <div class="tag-adder-row">
                    <input type="text" class="form-input" id="customTagInput" placeholder="Add custom capability (e.g. Urdu OCR, Realtime Speech)..." onkeydown="if(event.key==='Enter'){event.preventDefault();window.ModelsView.addCustomCapabilityFromInput();}">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.ModelsView.addCustomCapabilityFromInput()">
                      <span>${I.get('plus', 13)}</span> Add
                    </button>
                  </div>
                </div>
              </div>

              <!-- Ingestion Option -->
              <div style="background: var(--surface-subtle); border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-md); margin-top: var(--space-sm);">
                <label style="display: flex; align-items: center; gap: var(--space-sm); cursor: pointer;">
                  <input type="checkbox" id="downloadImmediately" style="width: 16px; height: 16px;">
                  <div>
                    <strong style="font-size: 13px; color: var(--text-primary);">Also cache file locally on PC</strong>
                    <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
                      Downloads a local copy from Backblaze B2 into <code>admin/data/LLM/</code> for local inspection.
                    </p>
                  </div>
                </label>
              </div>

              <div class="modal-footer" style="margin-top: var(--space-lg); margin-left: -20px; margin-right: -20px; margin-bottom: -20px;">
                <button type="button" class="btn btn-secondary" onclick="window.Modal.close('addModelModal')">Cancel</button>
                <button type="submit" class="btn btn-primary" id="btnSaveModel">
                  <span>${I.get('cloud', 14)}</span> Publish to Firebase
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Edit AI Model Modal -->
      <div class="modal-backdrop" id="editModelModal">
        <div class="modal-card">
          <div class="modal-header">
            <div style="display: flex; align-items: center; gap: var(--space-sm);">
              <span style="display: flex; color: #F59E0B;">${I.get('edit', 18)}</span>
              <h3 class="modal-title">Edit AI Model Configuration</h3>
            </div>
            <button class="modal-close-btn" onclick="window.Modal.close('editModelModal')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div class="modal-body">
            <form id="editModelForm" onsubmit="window.ModelsView.handleEditFormSubmit(event)">
              <!-- Security Badge -->
              <div style="background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.25); border-radius: var(--radius-md); padding: 10px 14px; margin-bottom: var(--space-md); display: flex; align-items: center; justify-content: space-between; font-size: 12px;">
                <div style="display: flex; align-items: center; gap: 8px; color: var(--success); font-weight: 500;">
                  <span>${I.get('shield', 15)}</span>
                  <span>Server-Side Authorization Enforced by Firebase RTDB Security Rules</span>
                </div>
                <span class="badge badge-success" style="font-size: 10px;">AUTH ENFORCED</span>
              </div>

              <!-- Model Name & Slug ID -->
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Model Display Name <span class="required-star">*</span></label>
                  <input type="text" class="form-input" id="editModelName" required>
                </div>

                <div class="form-group">
                  <label class="form-label">Model ID / Primary Key</label>
                  <input type="text" class="form-input" id="editModelId" readonly style="background: var(--surface-subtle); color: var(--text-muted); cursor: not-allowed; font-family: var(--font-mono);">
                </div>
              </div>

              <!-- Required: Download URL -->
              <div class="form-group">
                <label class="form-label">
                  <span>Download URL (Backblaze B2 / HTTPS) <span class="required-star">*</span></span>
                  <span class="form-hint">Public CDN or direct download URL for on-device AI engines</span>
                </label>
                <input type="url" class="form-input" id="editModelDownloadUrl" required style="font-family: var(--font-mono);">
              </div>

              <!-- Filename & Tier -->
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Filename (.gguf / .bin / .onnx)</label>
                  <input type="text" class="form-input" id="editModelFilename" style="font-family: var(--font-mono);">
                </div>

                <div class="form-group">
                  <label class="form-label">Hardware Profile / Tier</label>
                  <select class="form-select" id="editModelTier">
                    <option value="Tier 1 (Lightweight & Fast)">Tier 1 (Lightweight & Fast - 3GB RAM)</option>
                    <option value="Tier 2 (Balanced)">Tier 2 (Balanced - 4GB-6GB RAM)</option>
                    <option value="Tier 3 (Heavy Pro)">Tier 3 (Heavy Pro - 8GB+ RAM)</option>
                  </select>
                </div>
              </div>

              <!-- Architecture / Kind & Version -->
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Model Architecture / Kind <span class="required-star">*</span></label>
                  <select class="form-select" id="editModelKind">
                    <option value="text">Text LLM (Chat, Reasoning, Device Actions)</option>
                    <option value="vision">Vision-Language Model (Image-to-Text / OCR / Scene Q&A)</option>
                    <option value="image_gen">Image Generation (Diffusion / Text-to-Image)</option>
                    <option value="image_edit">Image-to-Image (Editing, Upscaling, Inpainting)</option>
                    <option value="voice_pack">Voice Pack (Speech-to-Text + Text-to-Speech)</option>
                    <option value="multimodal">Multimodal (Omni AI Model)</option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">Version</label>
                  <input type="text" class="form-input" id="editModelVersion" placeholder="1.0.0">
                </div>
              </div>

              <!-- Supported Modalities Multi-select for Edit -->
              <div class="form-group">
                <label class="form-label">
                  <span>Supported Modalities (I/O Tasks) <span class="required-star">*</span></span>
                  <span class="form-hint">Select what inputs & outputs this model supports</span>
                </label>
                <div class="modality-selector-grid" id="editModalitiesSelectorGrid">
                  <!-- Rendered dynamically -->
                </div>
              </div>

              <!-- Required RAM & Size -->
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Required RAM (MB) <span class="required-star">*</span></label>
                  <input type="number" class="form-input" id="editModelRamMb" required min="128" step="64">
                  <div style="display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap;">
                    <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 6px; font-size: 10.5px;" onclick="window.ModelsView.setEditRamPreset(512)">512 MB</button>
                    <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 6px; font-size: 10.5px;" onclick="window.ModelsView.setEditRamPreset(1024)">1 GB</button>
                    <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 6px; font-size: 10.5px;" onclick="window.ModelsView.setEditRamPreset(2048)">2 GB</button>
                    <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 6px; font-size: 10.5px;" onclick="window.ModelsView.setEditRamPreset(3072)">3 GB</button>
                    <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 6px; font-size: 10.5px;" onclick="window.ModelsView.setEditRamPreset(4096)">4 GB</button>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Model Size (Bytes) <span class="required-star">*</span></label>
                  <input type="text" class="form-input" id="editModelSizeBytes" required oninput="window.ModelsView.updateEditSizePreview()">
                  <span class="form-hint" id="editSizeFormattedPreview">Size preview: --</span>
                </div>
              </div>

              <!-- Format & Runtime -->
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Quantization / Format</label>
                  <select class="form-select" id="editModelFormat">
                    <option value="Q4_K_M">Q4_K_M (Balanced)</option>
                    <option value="Q4_0">Q4_0 (Fastest)</option>
                    <option value="Q8_0">Q8_0 (High Quality)</option>
                    <option value="FP16">FP16 (Full Precision)</option>
                    <option value="ONNX">ONNX Runtime</option>
                    <option value="LiteRT">Google LiteRT</option>
                    <option value="GGUF">Generic GGUF</option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">Edge Runtime</label>
                  <select class="form-select" id="editModelRuntime">
                    <option value="GGUF Edge Runtime">GGUF Edge Runtime</option>
                    <option value="Google AI Edge / LiteRT">Google AI Edge / LiteRT</option>
                    <option value="ONNX Runtime">ONNX Runtime</option>
                    <option value="Whisper.cpp">Whisper.cpp</option>
                  </select>
                </div>
              </div>

              <!-- Tagline & Description -->
              <div class="form-group">
                <label class="form-label">Tagline & Purpose</label>
                <input type="text" class="form-input" id="editModelTagline" placeholder="High-speed reasoning, Android device automation, and chat">
              </div>

              <!-- Target Devices -->
              <div class="form-group">
                <label class="form-label">Recommended Target Devices</label>
                <input type="text" class="form-input" id="editModelRecommendedFor" placeholder="e.g. 4GB - 6GB+ RAM Devices">
              </div>

              <!-- Capabilities Manager for Edit -->
              <div class="form-group">
                <label class="form-label">
                  <span>Model Capabilities & Features</span>
                  <span class="form-hint">Toggle popular presets or add custom tags</span>
                </label>
                <div class="capability-manager-box">
                  <div>
                    <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Active Capabilities:</span>
                    <div class="selected-tags-box" id="editSelectedTagsBox" style="margin-top: 4px;"></div>
                  </div>

                  <div>
                    <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Quick Presets (Click to toggle):</span>
                    <div class="preset-chips-container" id="editPresetChipsContainer" style="margin-top: 4px;"></div>
                  </div>

                  <div class="tag-adder-row">
                    <input type="text" class="form-input" id="editCustomTagInput" placeholder="Add custom capability..." onkeydown="if(event.key==='Enter'){event.preventDefault();window.ModelsView.addCustomEditCapabilityFromInput();}">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.ModelsView.addCustomEditCapabilityFromInput()">
                      <span>${I.get('plus', 13)}</span> Add
                    </button>
                  </div>
                </div>
              </div>

              <div class="modal-footer" style="margin-top: var(--space-lg); margin-left: -20px; margin-right: -20px; margin-bottom: -20px;">
                <button type="button" class="btn btn-secondary" onclick="window.Modal.close('editModelModal')">Cancel</button>
                <button type="submit" class="btn btn-primary" id="btnUpdateModel">
                  <span>${I.get('save', 14)}</span> Save Changes to Firebase
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Verification Modal -->
      <div class="modal-backdrop" id="verifyModelModal">
        <div class="modal-card">
          <div class="modal-header">
            <h3 class="modal-title">SHA-256 Checksum Verification</h3>
            <button class="modal-close-btn" onclick="window.Modal.close('verifyModelModal')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="modal-body" id="verifyModalBody">
            <div style="text-align: center; padding: 20px;">Calculating hash...</div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="window.Modal.close('verifyModelModal')">Close</button>
          </div>
        </div>
      </div>
    `;

    window.adminApi.models.onDownloadProgress(data => this.handleDownloadProgress(data));
    if (window.adminApi.b2 && !this.b2ListenerAttached) {
      window.adminApi.b2.onUploadProgress(data => this.handleB2UploadProgress(data));
      this.b2ListenerAttached = true;
    }
    await this.loadModels();
  },

  async loadModels() {
    try {
      this.models = await window.adminApi.models.list();
      this.renderList();
    } catch (err) {
      document.getElementById('modelsListContainer').innerHTML = `
        <div class="badge badge-error" style="padding: 12px; width: 100%;">
          Failed to load models: ${err.message}
        </div>
      `;
    }
  },

  setFilter(filter) {
    this.activeFilter = filter;
    this.currentPage = 1;
    ['filterAll', 'filterT2t', 'filterI2t', 'filterT2i', 'filterI2i', 'filterVoice', 'filterInstalled'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });

    const activeBtn = document.getElementById(`filter${filter.charAt(0).toUpperCase() + filter.slice(1)}`);
    if (activeBtn) activeBtn.classList.add('active');

    this.renderList();
  },

  setViewMode(mode) {
    this.viewMode = mode;
    this.renderList();
  },

  applySearch(query) {
    this.activeSearch = (query || '').toLowerCase().trim();
    this.currentPage = 1;
    this.renderList();
  },

  goToPage(p) {
    this.currentPage = p;
    this.renderList();
    const el = document.getElementById('modelsListContainer');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  setPageSize(sz) {
    this.pageSize = sz === 'all' ? 'all' : parseInt(sz, 10);
    this.currentPage = 1;
    this.renderList();
  },

  getModalities(model) {
    if (Array.isArray(model.modalities) && model.modalities.length > 0) {
      return model.modalities;
    }
    switch (model.kind) {
      case 'vision':
        return ['image->text', 'text->text'];
      case 'image_gen':
        return ['text->image'];
      case 'image_edit':
        return ['image->image'];
      case 'voice_pack':
        return ['audio->text', 'text->audio'];
      case 'stt':
        return ['audio->text'];
      case 'tts':
        return ['text->audio'];
      case 'multimodal':
        return ['text->text', 'image->text', 'text->image'];
      case 'text':
      default:
        return ['text->text'];
    }
  },

  renderModalityBadges(model) {
    const I = window.Icons;
    const mods = this.getModalities(model);
    return mods.map(mId => {
      const cfg = this.MODALITIES_CONFIG.find(c => c.id === mId) || {
        id: mId,
        key: 't2t',
        label: mId,
        icon: 'layers'
      };
      return `<span class="modality-pill modality-${cfg.key}" title="Supported Modality: ${cfg.label}">
        <span style="display:flex;">${I.get(cfg.icon, 11)}</span>
        <span>${cfg.label}</span>
      </span>`;
    }).join('');
  },

  renderList() {
    const container = document.getElementById('modelsListContainer');
    if (!container) return;
    const I = window.Icons;

    let filtered = this.models;

    if (this.activeFilter === 'installed') {
      filtered = filtered.filter(m => m.isInstalled);
    } else if (this.activeFilter === 't2t') {
      filtered = filtered.filter(m => this.getModalities(m).includes('text->text'));
    } else if (this.activeFilter === 'i2t') {
      filtered = filtered.filter(m => this.getModalities(m).includes('image->text'));
    } else if (this.activeFilter === 't2i') {
      filtered = filtered.filter(m => this.getModalities(m).includes('text->image'));
    } else if (this.activeFilter === 'i2i') {
      filtered = filtered.filter(m => this.getModalities(m).includes('image->image'));
    } else if (this.activeFilter === 'voice') {
      filtered = filtered.filter(m => m.kind === 'voice_pack' || this.getModalities(m).some(mod => mod.includes('audio')));
    }

    if (this.activeSearch) {
      filtered = filtered.filter(m => {
        const mods = this.getModalities(m);
        return (
          m.name.toLowerCase().includes(this.activeSearch) ||
          m.id.toLowerCase().includes(this.activeSearch) ||
          (m.tagline && m.tagline.toLowerCase().includes(this.activeSearch)) ||
          (m.capabilities && m.capabilities.some(c => c.toLowerCase().includes(this.activeSearch))) ||
          mods.some(mod => mod.toLowerCase().includes(this.activeSearch))
        );
      });
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; background: var(--surface); border: 1px dashed var(--border); border-radius: var(--radius-xl);">
          <div style="display: flex; justify-content: center; margin-bottom: 12px; color: var(--text-muted);">${I.get('cloud', 32)}</div>
          <h4 style="font-size: 16px; font-weight: 600; color: var(--text-primary);">Firebase RTDB Catalog Ready</h4>
          <p style="font-size: 13px; color: var(--text-secondary); margin-top: 4px; max-width: 440px; margin-left: auto; margin-right: auto;">
            Click "Seed to Firebase" to instantly populate default models, or click "Add New AI Model" to register Backblaze B2 model links.
          </p>
          <div style="display: flex; gap: 8px; justify-content: center; margin-top: var(--space-md);">
            <button class="btn btn-secondary btn-sm" onclick="window.ModelsView.seedDefaultModels()">
              <span>${I.get('cloud', 14)}</span> Seed Default Models
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.ModelsView.openAddModelModal()">
              <span>${I.get('plus', 14)}</span> Add AI Model
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

    const contentHtml = this.viewMode === 'grid'
      ? `<div class="models-grid">${pageItems.map(m => this.renderModelCard(m)).join('')}</div>`
      : `
        <div class="table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Required RAM</th>
                <th>Size</th>
                <th>Format / Runtime</th>
                <th>Cloud State</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${pageItems.map(m => this.renderTableRow(m)).join('')}
            </tbody>
          </table>
        </div>
      `;

    // Seamless pagination bar
    const paginationHtml = `
      <div class="pagination-card">
        <div class="pagination-info">
          <span>Showing <strong>${total === 0 ? 0 : startIndex + 1}–${Math.min(startIndex + pageSize, total)}</strong> of <strong>${total}</strong> models</span>
        </div>

        <div class="pagination-nav">
          <button class="pagination-btn" ${this.currentPage <= 1 ? 'disabled' : ''} onclick="window.ModelsView.goToPage(${this.currentPage - 1})" title="Previous Page">
            ◀ Prev
          </button>

          ${Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - this.currentPage) <= 1)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) {
                acc.push('<span style="color: var(--text-muted); padding: 0 4px;">…</span>');
              }
              acc.push(`
                <button class="pagination-btn ${p === this.currentPage ? 'active' : ''}" onclick="window.ModelsView.goToPage(${p})">
                  ${p}
                </button>
              `);
              return acc;
            }, []).join('')}

          <button class="pagination-btn" ${this.currentPage >= totalPages ? 'disabled' : ''} onclick="window.ModelsView.goToPage(${this.currentPage + 1})" title="Next Page">
            Next ▶
          </button>
        </div>

        <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary);">
          <span>Per page:</span>
          <select class="pagination-size-select" onchange="window.ModelsView.setPageSize(this.value)">
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

  renderModelCard(m) {
    const I = window.Icons;
    const isDownloading = m.status === 'DOWNLOADING';
    const statusBadge = `<span class="badge badge-success" style="display: flex; align-items: center; gap: 4px; white-space: nowrap; flex-shrink: 0;">
      <span>${I.get('cloud', 11)}</span> In Firebase RTDB
    </span>`;

    return `
      <div class="model-card ${isDownloading ? 'downloading' : ''}" id="modelCard-${m.id}">
        <div class="model-card-top">
          <div class="model-title-group">
            <span style="font-size: 11px; font-weight: 600; color: #22C55E; text-transform: uppercase;">
              ${m.tier || 'Tier 1'} | v${m.version || '1.0'}
            </span>
            <h4 class="model-name" title="${m.name}">${m.name}</h4>
            <p class="model-tagline" title="${m.tagline || ''}">${m.tagline || ''}</p>
          </div>
          <div style="flex-shrink: 0;">${statusBadge}</div>
        </div>

        <!-- Supported Modalities -->
        <div class="model-modalities-row">
          ${this.renderModalityBadges(m)}
        </div>

        <!-- Required RAM & Size -->
        <div class="model-specs">
          <div class="spec-item" title="Required RAM: ${m.ramFormatted || `${m.ramRequirementMb} MB`}">
            <span class="spec-label" style="display: flex; align-items: center; gap: 4px;">
              <span>${I.get('ram', 11)}</span> Required RAM
            </span>
            <span class="spec-val highlight-ram">${m.ramFormatted || `${m.ramRequirementMb} MB`}</span>
          </div>

          <div class="spec-item" title="Model Size: ${m.sizeFormatted || 'Unknown'}">
            <span class="spec-label" style="display: flex; align-items: center; gap: 4px;">
              <span>${I.get('harddrive', 11)}</span> Model Size
            </span>
            <span class="spec-val highlight-size">${m.sizeFormatted || 'Unknown'}</span>
          </div>

          <div class="spec-item" title="Format: ${m.format || 'GGUF'} (${m.runtime || 'GGUF Edge Runtime'})">
            <span class="spec-label">Format / Quant</span>
            <span class="spec-val">${m.format || 'GGUF'}</span>
          </div>

          <div class="spec-item" title="Target Devices: ${m.recommendedFor || 'All Devices'}">
            <span class="spec-label">Target Devices</span>
            <span class="spec-val" style="font-size: 11.5px; font-family: var(--font-family);">${m.recommendedFor || 'All Devices'}</span>
          </div>
        </div>

        <!-- Download URL Bar (Backblaze B2 link) -->
        <div class="model-url-bar" onclick="window.ModelsView.copyUrl('${m.downloadUrl}')" title="Click to copy Download URL: ${m.downloadUrl || ''}">
          <span style="display:flex; color: var(--text-muted); flex-shrink: 0;">${I.get('link', 12)}</span>
          <span class="model-url-text">${m.downloadUrl || 'No Backblaze URL configured'}</span>
          <span style="font-size: 10px; color: var(--text-muted); background: var(--surface); padding: 2px 5px; border-radius: 2px; flex-shrink: 0;">Copy</span>
        </div>

        <!-- Progress Bar (shown if caching locally) -->
        <div id="progressBox-${m.id}" style="${isDownloading ? 'display: flex;' : 'display: none;'} flex-direction: column; gap: 4px; min-width: 0;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-secondary);">
            <span id="progressText-${m.id}">Caching locally...</span>
            <span id="progressSpeed-${m.id}" style="color: var(--success); font-family: var(--font-mono);">-- MB/s</span>
          </div>
          <div class="progress-container">
            <div class="progress-bar" id="progressBar-${m.id}" style="width: ${m.progress || 0}%;"></div>
          </div>
        </div>

        <!-- Capabilities -->
        <div class="model-capabilities">
          ${(m.capabilities || []).map(c => `
            <span class="capability-pill" title="${c}">
              <span style="display:inline-flex; vertical-align:middle; opacity:0.75; margin-right:3px;">${I.get('tag', 10)}</span>${c}
            </span>`).join('')}
        </div>

        <!-- Actions -->
        <div class="model-card-actions">
          <div style="display: flex; gap: var(--space-xs); flex-wrap: wrap; min-width: 0;">
            <button class="btn btn-outline btn-sm" onclick="window.ModelsView.testModelEndpoint('${m.id}')" title="Test Backblaze B2 / download URL reachability">
              <span>${I.get('test', 12)}</span> Test URL
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.ModelsView.openEditModelModal('${m.id}')" title="Edit model configuration and publish to Firebase">
              <span>${I.get('edit', 12)}</span> Edit
            </button>
            ${
              !m.isInstalled
                ? `<button class="btn btn-secondary btn-sm" onclick="window.ModelsView.startDownload('${m.id}')" title="Download local copy to PC">
                     <span>${I.get('download', 12)}</span> Cache to PC
                   </button>`
                : `<button class="btn btn-outline btn-sm" onclick="window.ModelsView.verifySha256('${m.id}')" title="Verify SHA-256 Checksum">
                     <span>${I.get('shield', 12)}</span> Verify
                   </button>`
            }
          </div>

          <button class="btn btn-danger btn-sm btn-icon-only" style="flex-shrink: 0;" onclick="window.ModelsView.deleteModel('${m.id}')" title="Delete from Firebase RTDB">
            <span style="display: flex;">${I.get('trash', 14)}</span>
          </button>
        </div>
      </div>
    `;
  },

  renderTableRow(m) {
    return `
      <tr>
        <td>
          <div style="font-weight: 600;">${m.name}</div>
          <div style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">${m.filename || m.id}</div>
          <div class="model-modalities-row" style="margin-top: 4px;">${this.renderModalityBadges(m)}</div>
        </td>
        <td style="color: #F59E0B; font-weight: 600; font-family: var(--font-mono);">${m.ramFormatted || `${m.ramRequirementMb} MB`}</td>
        <td style="color: #38BDF8; font-weight: 600; font-family: var(--font-mono);">${m.sizeFormatted}</td>
        <td>${m.format} (${m.runtime})</td>
        <td><span class="badge badge-success">Firebase RTDB</span></td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn btn-secondary btn-sm" onclick="window.ModelsView.openEditModelModal('${m.id}')" title="Edit Model">Edit</button>
            <button class="btn btn-outline btn-sm" onclick="window.ModelsView.testModelEndpoint('${m.id}')">Test</button>
            <button class="btn btn-danger btn-sm" onclick="window.ModelsView.deleteModel('${m.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
  },

  openAddModelModal() {
    this.selectedLocalModel = null;
    this.isUploadingToB2 = false;
    this.currentUploadId = null;
    this.clearLocalSelection();
    document.getElementById('addModelForm').reset();
    document.getElementById('modelRamMb').value = '2048';
    document.getElementById('modelVersion').value = '1.0.0';
    document.getElementById('sizeFormattedPreview').textContent = 'Calculated size: --';
    document.getElementById('fetchHeaderStatus').style.display = 'none';
    this.selectedModalities = ['text->text'];
    this.selectedCapabilities = ['Android Automation', 'Function & Tool Calling', 'Urdu & English Reasoning'];
    window.Modal.open('addModelModal');
    this.renderModalitiesSelector();
    this.renderCapabilitiesManager();
  },

  renderModalitiesSelector() {
    const container = document.getElementById('modalitiesSelectorGrid');
    if (!container) return;
    const I = window.Icons;

    container.innerHTML = this.MODALITIES_CONFIG.map(cfg => {
      const isActive = this.selectedModalities.includes(cfg.id);
      return `
        <div class="modality-option-card ${isActive ? `active ${cfg.key}-active` : ''}"
             onclick="window.ModelsView.toggleModality('${cfg.id}')"
             title="Toggle ${cfg.label}">
          <div class="modality-icon-wrapper">
            ${I.get(cfg.icon, 15)}
          </div>
          <div class="modality-text-group">
            <div class="modality-label">${cfg.label}</div>
            <div class="modality-sub">${cfg.sub}</div>
          </div>
        </div>
      `;
    }).join('');
  },

  toggleModality(modId) {
    if (this.selectedModalities.includes(modId)) {
      if (this.selectedModalities.length > 1) {
        this.selectedModalities = this.selectedModalities.filter(id => id !== modId);
      } else {
        window.Toast.warning('At least one supported modality must remain selected.');
        return;
      }
    } else {
      this.selectedModalities.push(modId);
    }
    this.renderModalitiesSelector();
  },

  onKindChange(kind) {
    if (kind === 'text') {
      this.selectedModalities = ['text->text'];
      this.addCustomCapability('Urdu & English Reasoning');
      this.addCustomCapability('Android Automation');
    } else if (kind === 'vision') {
      this.selectedModalities = ['image->text', 'text->text'];
      this.addCustomCapability('Document & OCR Scan');
      this.addCustomCapability('Visual Scene Understanding');
    } else if (kind === 'image_gen') {
      this.selectedModalities = ['text->image'];
      this.addCustomCapability('Photo & Art Generation');
    } else if (kind === 'image_edit') {
      this.selectedModalities = ['image->image'];
      this.addCustomCapability('Image Upscaling & Edit');
    } else if (kind === 'voice_pack') {
      this.selectedModalities = ['audio->text', 'text->audio'];
      this.addCustomCapability('Voice Dialogue');
    } else if (kind === 'multimodal') {
      this.selectedModalities = ['text->text', 'image->text', 'text->image'];
      this.addCustomCapability('Visual Scene Understanding');
      this.addCustomCapability('Photo & Art Generation');
    }
    this.renderModalitiesSelector();
    this.renderCapabilitiesManager();
  },

  renderCapabilitiesManager() {
    const selectedBox = document.getElementById('selectedTagsBox');
    const presetBox = document.getElementById('presetChipsContainer');
    if (!selectedBox || !presetBox) return;

    if (this.selectedCapabilities.length === 0) {
      selectedBox.innerHTML = '<span style="font-size: 11px; color: var(--text-muted); font-style: italic;">No capabilities added yet. Click presets below or type to add.</span>';
    } else {
      selectedBox.innerHTML = this.selectedCapabilities.map(cap => `
        <span class="active-tag-pill">
          <span>${cap}</span>
          <span class="active-tag-remove" onclick="window.ModelsView.removeCapability('${cap.replace(/'/g, "\\'")}')" title="Remove">&times;</span>
        </span>
      `).join('');
    }

    presetBox.innerHTML = this.PRESET_CAPABILITIES.map(p => {
      const isSelected = this.selectedCapabilities.includes(p);
      return `
        <button type="button" class="preset-chip-btn ${isSelected ? 'active' : ''}" onclick="window.ModelsView.togglePresetCapability('${p.replace(/'/g, "\\'")}')">
          <span>${isSelected ? '✓ ' : '+ '}</span>${p}
        </button>
      `;
    }).join('');
  },

  togglePresetCapability(cap) {
    if (this.selectedCapabilities.includes(cap)) {
      this.selectedCapabilities = this.selectedCapabilities.filter(c => c !== cap);
    } else {
      this.selectedCapabilities.push(cap);
    }
    this.renderCapabilitiesManager();
  },

  removeCapability(cap) {
    this.selectedCapabilities = this.selectedCapabilities.filter(c => c !== cap);
    this.renderCapabilitiesManager();
  },

  addCustomCapability(cap) {
    const clean = (cap || '').trim();
    if (clean && !this.selectedCapabilities.includes(clean)) {
      this.selectedCapabilities.push(clean);
    }
  },

  addCustomCapabilityFromInput() {
    const input = document.getElementById('customTagInput');
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;
    this.addCustomCapability(val);
    input.value = '';
    this.renderCapabilitiesManager();
  },

  setRamPreset(ramMb) {
    document.getElementById('modelRamMb').value = ramMb;
  },

  onUrlChange(url) {
    if (!url) return;
    try {
      const parsed = new URL(url);
      const filename = parsed.pathname.split('/').pop();
      if (filename && !document.getElementById('modelName').value) {
        const cleanName = filename
          .replace(/\.gguf$/i, '')
          .replace(/\.bin$/i, '')
          .replace(/[-_.]/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
        document.getElementById('modelName').value = cleanName;
        this.autoSuggestSlug(cleanName);
      }
    } catch {}
  },

  autoSuggestSlug(name) {
    const slugEl = document.getElementById('modelId');
    if (slugEl && name) {
      slugEl.value = name.toLowerCase().replace(/[^a-z0-9_.-]/g, '-').replace(/-+/g, '-');
    }
  },

  async fetchUrlHeaders() {
    const url = document.getElementById('modelDownloadUrl').value.trim();
    if (!url) {
      window.Toast.warning('Please enter a Download URL first.');
      return;
    }

    const statusEl = document.getElementById('fetchHeaderStatus');
    const btn = document.getElementById('btnFetchHeaders');
    btn.textContent = 'Querying B2...';
    btn.disabled = true;
    statusEl.style.display = 'block';
    statusEl.style.color = 'var(--text-secondary)';
    statusEl.textContent = 'Performing HEAD request to Backblaze B2 to detect size and headers...';

    try {
      const res = await window.adminApi.models.fetchHeaders(url);
      if (res.success && res.sizeBytes > 0) {
        document.getElementById('modelSizeBytes').value = res.sizeBytes;
        document.getElementById('sizeFormattedPreview').textContent = `Calculated size: ${res.sizeFormatted} (${res.sizeBytes.toLocaleString()} bytes)`;
        statusEl.style.color = 'var(--success)';
        statusEl.textContent = `Successfully retrieved Content-Length from storage: ${res.sizeFormatted}`;

        const ramMb = Math.round((res.sizeBytes / (1024 * 1024)) * 1.5);
        document.getElementById('modelRamMb').value = ramMb;
        window.Toast.success(`Detected model size: ${res.sizeFormatted}`);
      } else {
        statusEl.style.color = 'var(--warning)';
        statusEl.textContent = `Could not auto-detect size (${res.error || 'No Content-Length header'}). Please enter manually.`;
      }
    } catch (e) {
      statusEl.style.color = 'var(--error)';
      statusEl.textContent = `Error querying URL: ${e.message}`;
    } finally {
      btn.innerHTML = `<span>${window.Icons.get('bolt', 13)}</span> Auto-Fetch Size`;
      btn.disabled = false;
    }
  },

  async seedDefaultModels() {
    window.Toast.info('Publishing default models to Firebase Realtime Database...');
    const res = await window.adminApi.models.seedFirebase();
    if (res.success) {
      window.Toast.success(`Successfully published ${res.count} models to Firebase RTDB!`);
      await this.loadModels();
    } else {
      window.Toast.error(`Failed: ${res.error}`);
    }
  },

  async selectLocalModelFile() {
    try {
      const res = await window.adminApi.models.selectLocalModel();
      if (!res || res.canceled) return;

      if (res.error) {
        window.Toast.error(`Failed to inspect model file: ${res.error}`);
        return;
      }

      this.selectedLocalModel = res;

      // Update the local selection UI box
      const selBox = document.getElementById('localModelSelectedBox');
      if (selBox) selBox.style.display = 'block';

      const titleEl = document.getElementById('selectedFileTitle');
      if (titleEl) titleEl.textContent = res.filename;

      const sizeEl = document.getElementById('selectedFileSize');
      if (sizeEl) sizeEl.textContent = res.sizeFormatted;

      const archEl = document.getElementById('selectedFileArch');
      if (archEl) archEl.textContent = `${res.architectureDisplay || res.architecture} (${res.format})`;

      const ramEl = document.getElementById('selectedFileRam');
      if (ramEl) ramEl.textContent = `RAM: ${res.ramFormatted}`;

      // Reset any previous upload status
      const progressBox = document.getElementById('b2UploadProgressContainer');
      if (progressBox) progressBox.style.display = 'none';
      const successBadge = document.getElementById('b2UploadSuccessBadge');
      if (successBadge) successBadge.style.display = 'none';
      const uploadBtn = document.getElementById('btnUploadToB2');
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = `<span>${window.Icons.get('cloud', 14)}</span> Upload to Backblaze B2`;
        uploadBtn.classList.remove('btn-outline');
        uploadBtn.classList.add('btn-primary');
      }

      // Auto-populate form fields directly from model binary
      document.getElementById('modelName').value = res.displayName || res.filename;
      document.getElementById('modelId').value = res.modelId;
      document.getElementById('modelSizeBytes').value = res.fileSizeBytes;
      document.getElementById('sizeFormattedPreview').textContent = `Calculated size: ${res.sizeFormatted} (${res.fileSizeBytes} bytes)`;
      document.getElementById('modelRamMb').value = res.ramRequirementMb;

      if (res.kind && document.getElementById('modelKind')) {
        document.getElementById('modelKind').value = res.kind;
        this.onKindChange(res.kind);
      }

      if (res.tier && document.getElementById('modelTier')) {
        document.getElementById('modelTier').value = res.tier;
      }

      if (res.format && document.getElementById('modelFormat')) {
        const fmtSelect = document.getElementById('modelFormat');
        let matched = false;
        for (let i = 0; i < fmtSelect.options.length; i++) {
          if (fmtSelect.options[i].value.toLowerCase() === res.format.toLowerCase()) {
            fmtSelect.selectedIndex = i;
            matched = true;
            break;
          }
        }
        if (!matched) {
          const opt = document.createElement('option');
          opt.value = res.format;
          opt.textContent = `${res.format} (Detected)`;
          fmtSelect.appendChild(opt);
          fmtSelect.value = res.format;
        }
      }

      if (res.runtime && document.getElementById('modelRuntime')) {
        document.getElementById('modelRuntime').value = res.runtime;
      }

      if (res.tagline && document.getElementById('modelTagline')) {
        document.getElementById('modelTagline').value = res.tagline;
      }

      if (Array.isArray(res.modalities) && res.modalities.length > 0) {
        this.selectedModalities = res.modalities;
        this.renderModalitiesSelector();
      }

      if (Array.isArray(res.capabilities) && res.capabilities.length > 0) {
        this.selectedCapabilities = res.capabilities;
        this.renderCapabilitiesManager();
      }

      // If modal is not currently open, open it
      const modal = document.getElementById('addModelModal');
      if (modal && !modal.classList.contains('active')) {
        window.Modal.open('addModelModal');
      }

      window.Toast.success(`Auto-extracted metadata from ${res.filename}: ${res.architectureDisplay}, ${res.sizeFormatted}, ${res.ramFormatted}! Ready to publish.`);
    } catch (err) {
      window.Toast.error(err.message || 'Error inspecting model file');
    }
  },

  clearLocalSelection() {
    this.selectedLocalModel = null;
    const selBox = document.getElementById('localModelSelectedBox');
    if (selBox) selBox.style.display = 'none';
    const progressBox = document.getElementById('b2UploadProgressContainer');
    if (progressBox) progressBox.style.display = 'none';
    const successBadge = document.getElementById('b2UploadSuccessBadge');
    if (successBadge) successBadge.style.display = 'none';
    const uploadBtn = document.getElementById('btnUploadToB2');
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = `<span>${window.Icons.get('cloud', 14)}</span> Upload to Backblaze B2`;
      uploadBtn.classList.remove('btn-outline');
      uploadBtn.classList.add('btn-primary');
    }
  },

  async uploadSelectedToB2() {
    if (!this.selectedLocalModel || !this.selectedLocalModel.filePath) {
      window.Toast.warning('Please choose a model from local storage first.');
      return false;
    }

    const b2Config = await window.adminApi.b2.getConfig();
    if (!b2Config.hasCredentials) {
      window.Toast.warning('Backblaze B2 credentials missing. Please enter your Key ID and Application Key in Settings.');
      window.App.navigateTo('settings');
      return false;
    }

    const uploadBtn = document.getElementById('btnUploadToB2');
    if (uploadBtn) {
      uploadBtn.disabled = true;
      uploadBtn.innerHTML = `<span>${window.Icons.get('refresh', 13)}</span> Initializing...`;
    }

    const progressBox = document.getElementById('b2UploadProgressContainer');
    if (progressBox) progressBox.style.display = 'block';

    const statusText = document.getElementById('b2UploadStatusText');
    const folder = this.selectedLocalModel.kind === 'voice_pack' ? (b2Config.voicePackFolder || 'VoicePacks') : (b2Config.llmFolder || 'LLMs');
    if (statusText) statusText.textContent = `Uploading to Backblaze B2 (${b2Config.bucketName} / ${folder})...`;

    this.isUploadingToB2 = true;
    this.currentUploadId = `upload_${Date.now()}`;

    try {
      const res = await window.adminApi.b2.uploadModel({
        filePath: this.selectedLocalModel.filePath,
        uploadType: this.selectedLocalModel.kind === 'voice_pack' ? 'voicepack' : 'llm',
        customFilename: this.selectedLocalModel.filename,
        uploadId: this.currentUploadId,
      });

      if (res && res.success && res.downloadUrl) {
        // Auto-fill download URL into model configuration!
        const urlInput = document.getElementById('modelDownloadUrl');
        if (urlInput) {
          urlInput.value = res.downloadUrl;
          urlInput.dispatchEvent(new Event('change'));
        }

        // Show success badge
        const successBadge = document.getElementById('b2UploadSuccessBadge');
        if (successBadge) {
          successBadge.style.display = 'flex';
          const targetEl = document.getElementById('b2TargetCloudPath');
          if (targetEl) targetEl.textContent = `${res.bucketName} / ${res.folder} / ${res.filename}`;
        }

        if (uploadBtn) {
          uploadBtn.disabled = false;
          uploadBtn.innerHTML = `<span>${window.Icons.get('check', 13)}</span> Uploaded to B2`;
          uploadBtn.classList.remove('btn-primary');
          uploadBtn.classList.add('btn-outline');
        }

        window.Toast.success(`Uploaded ${res.filename} to Backblaze B2! Download URL linked.`);
        return true;
      } else {
        throw new Error(res?.error || 'Upload failed');
      }
    } catch (err) {
      window.Toast.error(`Backblaze upload failed: ${err.message}`);
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = `<span>${window.Icons.get('cloud', 14)}</span> Retry Upload`;
      }
      return false;
    } finally {
      this.isUploadingToB2 = false;
    }
  },

  handleB2UploadProgress(data) {
    if (data.status === 'UPLOADING' || data.status === 'COMPLETE') {
      const progressBar = document.getElementById('b2UploadProgressBar');
      const percentText = document.getElementById('b2UploadPercentText');
      const bytesText = document.getElementById('b2UploadBytesText');
      const speedText = document.getElementById('b2UploadSpeedText');
      const etaText = document.getElementById('b2UploadEtaText');
      const statusText = document.getElementById('b2UploadStatusText');

      if (progressBar) progressBar.style.width = `${data.progress}%`;
      if (percentText) percentText.textContent = `${data.progress}%`;
      if (bytesText) bytesText.textContent = `${data.uploadedFormatted || ''} / ${data.totalFormatted || ''}`;
      if (speedText) speedText.textContent = `Speed: ${data.speed || '--'}`;
      if (etaText) etaText.textContent = `ETA: ${data.eta || '--'}`;
      if (statusText && data.message) statusText.textContent = data.message;
    } else if (data.status === 'AUTHENTICATING' || data.status === 'REQUESTING_UPLOAD_SLOT') {
      const statusText = document.getElementById('b2UploadStatusText');
      if (statusText) statusText.textContent = data.message;
    } else if (data.status === 'FAILED') {
      const statusText = document.getElementById('b2UploadStatusText');
      if (statusText) statusText.textContent = `Failed: ${data.error || 'Upload error'}`;
    }
  },

  async importLocalFile() {
    this.openAddModelModal();
    await this.selectLocalModelFile();
  },

  async handleFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSaveModel');
    btn.disabled = true;

    try {
      let downloadUrl = document.getElementById('modelDownloadUrl').value.trim();

      // If user selected a local file but hasn't uploaded to Backblaze yet, auto-upload now!
      if (!downloadUrl && this.selectedLocalModel) {
        btn.textContent = 'Uploading to Backblaze B2...';
        const uploadSuccess = await this.uploadSelectedToB2();
        if (!uploadSuccess) {
          throw new Error('Please wait for the Backblaze B2 upload to complete or enter a valid download URL.');
        }
        downloadUrl = document.getElementById('modelDownloadUrl').value.trim();
      }

      if (!downloadUrl) {
        throw new Error('Model Download URL is required. Please upload to Backblaze B2 or provide a direct URL.');
      }

      btn.textContent = 'Publishing to Firebase...';

      let sizeVal = document.getElementById('modelSizeBytes').value.trim();
      let sizeBytes = 0;

      if (sizeVal.toLowerCase().includes('gb')) {
        sizeBytes = Math.round(parseFloat(sizeVal) * 1024 * 1024 * 1024);
      } else if (sizeVal.toLowerCase().includes('mb')) {
        sizeBytes = Math.round(parseFloat(sizeVal) * 1024 * 1024);
      } else {
        sizeBytes = parseInt(sizeVal.replace(/[^0-9]/g, ''), 10) || 0;
      }

      const modelData = {
        name: document.getElementById('modelName').value.trim(),
        id: document.getElementById('modelId').value.trim(),
        downloadUrl,
        ramRequirementMb: parseInt(document.getElementById('modelRamMb').value, 10),
        sizeBytes,
        kind: document.getElementById('modelKind') ? document.getElementById('modelKind').value : 'text',
        tier: document.getElementById('modelTier') ? document.getElementById('modelTier').value : 'Tier 1 (Lightweight & Fast)',
        format: document.getElementById('modelFormat').value,
        runtime: document.getElementById('modelRuntime').value,
        version: document.getElementById('modelVersion').value.trim(),
        tagline: document.getElementById('modelTagline').value.trim(),
        modalities: this.selectedModalities.length > 0 ? this.selectedModalities : ['text->text'],
        capabilities: this.selectedCapabilities.length > 0 ? this.selectedCapabilities : ['Fast Response', 'Device Automation'],
        downloadImmediately: document.getElementById('downloadImmediately').checked,
      };

      const res = await window.adminApi.models.add(modelData);
      if (res.success) {
        window.Modal.close('addModelModal');
        window.Toast.success(`AI Model "${modelData.name}" published to Firebase Realtime Database!`);
        await this.loadModels();
      } else {
        window.Toast.error(res.error || 'Failed to publish model.');
      }
    } catch (err) {
      window.Toast.error(err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span>${window.Icons.get('cloud', 14)}</span> Publish to Firebase`;
    }
  },

  async startDownload(modelId) {
    window.Toast.info(`Downloading local copy of ${modelId}...`);
    const res = await window.adminApi.models.download(modelId);
    if (!res.success) {
      window.Toast.error(res.error || 'Failed to start download.');
    }
  },

  handleDownloadProgress(data) {
    const { modelId, status, progress, speed, downloadedFormatted, totalFormatted, error } = data;

    const dock = document.getElementById('downloadDock');
    if (dock) {
      if (status === 'DOWNLOADING') {
        dock.classList.add('active');
        document.getElementById('dockTitle').textContent = `Caching ${data.modelName || modelId}`;
        document.getElementById('dockSpeed').textContent = `${speed || ''} (${progress}%)`;
        document.getElementById('dockProgress').style.width = `${progress}%`;
        document.getElementById('dockBytes').textContent = `${downloadedFormatted || '0 B'} / ${totalFormatted || '--'}`;
        document.getElementById('dockCancelBtn').onclick = () => window.adminApi.models.cancelDownload(modelId);
      } else if (status === 'READY') {
        dock.classList.remove('active');
        window.Toast.success(`Local cache ready: ${data.modelName || modelId}`);
        this.loadModels();
      } else if (status === 'FAILED' || status === 'CANCELLED') {
        dock.classList.remove('active');
        if (status === 'FAILED') window.Toast.error(`Download error: ${error || 'Unknown'}`);
        this.loadModels();
      }
    }

    const progressBox = document.getElementById(`progressBox-${modelId}`);
    const progressBar = document.getElementById(`progressBar-${modelId}`);
    const progressText = document.getElementById(`progressText-${modelId}`);
    const progressSpeed = document.getElementById(`progressSpeed-${modelId}`);

    if (progressBox && progressBar) {
      if (status === 'DOWNLOADING') {
        progressBox.style.display = 'flex';
        progressBar.style.width = `${progress}%`;
        if (progressText) progressText.textContent = `${downloadedFormatted || '0 B'} of ${totalFormatted || '--'}`;
        if (progressSpeed) progressSpeed.textContent = speed || '';
      } else {
        progressBox.style.display = 'none';
      }
    }
  },

  async verifySha256(modelId) {
    window.Modal.open('verifyModelModal');
    const body = document.getElementById('verifyModalBody');
    body.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-md); padding: 20px;">
        <span style="display: flex; color: var(--success); animation: spin 1s linear infinite;">${window.Icons.get('refresh', 24)}</span>
        <div style="font-size: 14px; font-weight: 600;">Calculating SHA-256 for ${modelId}...</div>
        <p style="font-size: 12px; color: var(--text-muted); text-align: center;">
          Verifying local file checksum.
        </p>
      </div>
    `;

    const res = await window.adminApi.models.verifySha256(modelId);
    if (res.success) {
      body.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: var(--space-md);">
          <div class="badge badge-success" style="padding: 6px 12px; font-size: 12px; width: fit-content; display: flex; align-items: center; gap: 6px;">
            <span>${window.Icons.get('check', 14)}</span> Integrity Verified
          </div>
          <div>
            <span style="font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">File Path:</span>
            <div class="code-box" style="margin-top: 4px; font-size: 11px;">${res.filePath}</div>
          </div>
          <div>
            <span style="font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">SHA-256 Hash Digest:</span>
            <div class="code-box" style="margin-top: 4px; color: #22C55E;">${res.sha256}</div>
          </div>
          <button class="btn btn-secondary btn-sm" style="width: fit-content;" onclick="window.adminApi.system.copyToClipboard('${res.sha256}'); window.Toast.success('Checksum copied!');">
            <span>${window.Icons.get('copy', 12)}</span> Copy Checksum
          </button>
        </div>
      `;
    } else {
      body.innerHTML = `
        <div class="badge badge-error" style="padding: 8px 12px; width: 100%;">
          Failed to verify: ${res.error}
        </div>
      `;
    }
  },

  async deleteModel(modelId) {
    if (!confirm(`Are you sure you want to remove model "${modelId}" from Firebase Realtime Database?`)) return;
    const deleteFile = confirm(`Do you also want to remove any local cached file on PC?`);
    const res = await window.adminApi.models.delete(modelId, deleteFile);
    if (res.success) {
      window.Toast.success(`Model "${modelId}" removed from Firebase.`);
      await this.loadModels();
    } else {
      window.Toast.error(res.error || 'Failed to remove model.');
    }
  },

  copyUrl(url) {
    if (!url) return;
    window.adminApi.system.copyToClipboard(url);
    window.Toast.success('Download URL copied to clipboard!');
  },

  async testModelEndpoint(modelId) {
    const target = this.models.find(m => m.id === modelId);
    if (!target || !target.downloadUrl) {
      window.Toast.warning('No download URL configured for this model.');
      return;
    }
    window.Toast.info(`Testing URL reachability for ${modelId}...`);
    const res = await window.adminApi.models.fetchHeaders(target.downloadUrl);
    if (res.success) {
      window.Toast.success(`URL reachable! Status: ${res.statusCode || '200 OK'}, Size: ${res.sizeFormatted}`);
    } else {
      window.Toast.warning(`URL error: ${res.error}`);
    }
  },

  formatBytes(bytes) {
    if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  updateEditSizePreview() {
    const el = document.getElementById('editModelSizeBytes');
    const preview = document.getElementById('editSizeFormattedPreview');
    if (!el || !preview) return;
    const val = el.value.trim();
    let bytes = 0;
    if (val.toLowerCase().includes('gb')) {
      bytes = Math.round(parseFloat(val) * 1024 * 1024 * 1024);
    } else if (val.toLowerCase().includes('mb')) {
      bytes = Math.round(parseFloat(val) * 1024 * 1024);
    } else {
      bytes = parseInt(val.replace(/[^0-9]/g, ''), 10) || 0;
    }
    preview.textContent = bytes > 0 ? `Calculated size: ${this.formatBytes(bytes)} (${bytes.toLocaleString()} bytes)` : 'Size preview: --';
  },

  openEditModelModal(modelId) {
    const model = this.models.find(m => m.id === modelId);
    if (!model) {
      window.Toast.error(`Model "${modelId}" not found in current catalog.`);
      return;
    }

    this.editingModelId = modelId;
    this.editSelectedModalities = [...this.getModalities(model)];
    this.editSelectedCapabilities = Array.isArray(model.capabilities) ? [...model.capabilities] : [];

    const nameEl = document.getElementById('editModelName');
    const idEl = document.getElementById('editModelId');
    const urlEl = document.getElementById('editModelDownloadUrl');
    const filenameEl = document.getElementById('editModelFilename');
    const tierEl = document.getElementById('editModelTier');
    const kindEl = document.getElementById('editModelKind');
    const verEl = document.getElementById('editModelVersion');
    const ramEl = document.getElementById('editModelRamMb');
    const sizeEl = document.getElementById('editModelSizeBytes');
    const formatEl = document.getElementById('editModelFormat');
    const runtimeEl = document.getElementById('editModelRuntime');
    const taglineEl = document.getElementById('editModelTagline');
    const recEl = document.getElementById('editModelRecommendedFor');

    if (nameEl) nameEl.value = model.name || '';
    if (idEl) idEl.value = model.id;
    if (urlEl) urlEl.value = model.downloadUrl || '';
    if (filenameEl) filenameEl.value = model.filename || '';
    if (tierEl && model.tier) tierEl.value = model.tier;
    if (kindEl && model.kind) kindEl.value = model.kind;
    if (verEl) verEl.value = model.version || '1.0.0';
    if (ramEl) ramEl.value = model.ramRequirementMb || 2048;
    if (sizeEl) sizeEl.value = model.sizeBytes || 0;
    if (formatEl && model.format) formatEl.value = model.format;
    if (runtimeEl && model.runtime) runtimeEl.value = model.runtime;
    if (taglineEl) taglineEl.value = model.tagline || '';
    if (recEl) recEl.value = model.recommendedFor || '';

    this.updateEditSizePreview();
    this.renderEditModalitiesSelector();
    this.renderEditCapabilitiesManager();

    window.Modal.open('editModelModal');
  },

  renderEditModalitiesSelector() {
    const container = document.getElementById('editModalitiesSelectorGrid');
    if (!container) return;
    const I = window.Icons;

    container.innerHTML = this.MODALITIES_CONFIG.map(cfg => {
      const isActive = this.editSelectedModalities.includes(cfg.id);
      return `
        <div class="modality-option-card ${isActive ? `active ${cfg.key}-active` : ''}"
             onclick="window.ModelsView.toggleEditModality('${cfg.id}')"
             title="Toggle ${cfg.label}">
          <div class="modality-icon-wrapper">
            ${I.get(cfg.icon, 15)}
          </div>
          <div class="modality-text-group">
            <div class="modality-label">${cfg.label}</div>
            <div class="modality-sub">${cfg.sub}</div>
          </div>
        </div>
      `;
    }).join('');
  },

  toggleEditModality(modId) {
    if (this.editSelectedModalities.includes(modId)) {
      if (this.editSelectedModalities.length > 1) {
        this.editSelectedModalities = this.editSelectedModalities.filter(id => id !== modId);
      } else {
        window.Toast.warning('At least one supported modality must remain selected.');
        return;
      }
    } else {
      this.editSelectedModalities.push(modId);
    }
    this.renderEditModalitiesSelector();
  },

  renderEditCapabilitiesManager() {
    const selectedBox = document.getElementById('editSelectedTagsBox');
    const presetBox = document.getElementById('editPresetChipsContainer');
    if (!selectedBox || !presetBox) return;

    if (this.editSelectedCapabilities.length === 0) {
      selectedBox.innerHTML = '<span style="font-size: 11px; color: var(--text-muted); font-style: italic;">No capabilities added yet. Click presets below or type to add.</span>';
    } else {
      selectedBox.innerHTML = this.editSelectedCapabilities.map(cap => `
        <span class="active-tag-pill">
          <span>${cap}</span>
          <span class="active-tag-remove" onclick="window.ModelsView.removeEditCapability('${cap.replace(/'/g, "\\'")}')" title="Remove">&times;</span>
        </span>
      `).join('');
    }

    presetBox.innerHTML = this.PRESET_CAPABILITIES.map(p => {
      const isSelected = this.editSelectedCapabilities.includes(p);
      return `
        <button type="button" class="preset-chip-btn ${isSelected ? 'active' : ''}" onclick="window.ModelsView.toggleEditPresetCapability('${p.replace(/'/g, "\\'")}')">
          <span>${isSelected ? '✓ ' : '+ '}</span>${p}
        </button>
      `;
    }).join('');
  },

  toggleEditPresetCapability(cap) {
    if (this.editSelectedCapabilities.includes(cap)) {
      this.editSelectedCapabilities = this.editSelectedCapabilities.filter(c => c !== cap);
    } else {
      this.editSelectedCapabilities.push(cap);
    }
    this.renderEditCapabilitiesManager();
  },

  removeEditCapability(cap) {
    this.editSelectedCapabilities = this.editSelectedCapabilities.filter(c => c !== cap);
    this.renderEditCapabilitiesManager();
  },

  addCustomEditCapability(cap) {
    const clean = (cap || '').trim();
    if (clean && !this.editSelectedCapabilities.includes(clean)) {
      this.editSelectedCapabilities.push(clean);
    }
  },

  addCustomEditCapabilityFromInput() {
    const input = document.getElementById('editCustomTagInput');
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;
    this.addCustomEditCapability(val);
    input.value = '';
    this.renderEditCapabilitiesManager();
  },

  setEditRamPreset(ramMb) {
    const el = document.getElementById('editModelRamMb');
    if (el) el.value = ramMb;
  },

  async handleEditFormSubmit(e) {
    e.preventDefault();
    if (!this.editingModelId) {
      window.Toast.error('No model selected for editing.');
      return;
    }

    const btn = document.getElementById('btnUpdateModel');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span>${window.Icons.get('refresh', 13)}</span> Saving Changes...`;
    }

    try {
      const name = document.getElementById('editModelName').value.trim();
      const downloadUrl = document.getElementById('editModelDownloadUrl').value.trim();

      if (!name) throw new Error('Model Name is required.');
      if (!downloadUrl) throw new Error('Download URL is required.');

      let sizeVal = document.getElementById('editModelSizeBytes').value.trim();
      let sizeBytes = 0;
      if (sizeVal.toLowerCase().includes('gb')) {
        sizeBytes = Math.round(parseFloat(sizeVal) * 1024 * 1024 * 1024);
      } else if (sizeVal.toLowerCase().includes('mb')) {
        sizeBytes = Math.round(parseFloat(sizeVal) * 1024 * 1024);
      } else {
        sizeBytes = parseInt(sizeVal.replace(/[^0-9]/g, ''), 10) || 0;
      }

      const updatedModelData = {
        id: this.editingModelId,
        name,
        downloadUrl,
        filename: document.getElementById('editModelFilename').value.trim(),
        tier: document.getElementById('editModelTier').value,
        kind: document.getElementById('editModelKind').value,
        version: document.getElementById('editModelVersion').value.trim() || '1.0.0',
        ramRequirementMb: parseInt(document.getElementById('editModelRamMb').value, 10) || 1024,
        sizeBytes,
        format: document.getElementById('editModelFormat').value,
        runtime: document.getElementById('editModelRuntime').value,
        tagline: document.getElementById('editModelTagline').value.trim(),
        recommendedFor: document.getElementById('editModelRecommendedFor').value.trim(),
        modalities: this.editSelectedModalities.length > 0 ? this.editSelectedModalities : ['text->text'],
        capabilities: this.editSelectedCapabilities.length > 0 ? this.editSelectedCapabilities : ['Fast Response'],
      };

      const res = await window.adminApi.models.update(updatedModelData);
      if (res && res.success) {
        window.Modal.close('editModelModal');
        window.Toast.success({
          title: 'Model Updated',
          message: `Model "${updatedModelData.name}" has been updated in Firebase RTDB and local catalog.`,
          type: 'success'
        });
        await this.loadModels();
      } else {
        window.Toast.error(res?.error || 'Failed to update model in Firebase RTDB.');
      }
    } catch (err) {
      window.Toast.error(err.message || 'Error updating model');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<span>${window.Icons.get('save', 14)}</span> Save Changes to Firebase`;
      }
    }
  }
};

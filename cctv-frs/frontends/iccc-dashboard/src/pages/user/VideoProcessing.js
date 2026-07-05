/* ============================================================
   SENTINEL PRO — Video Post Processing Module
   ============================================================ */

const VideoProcessing = {
    _isProcessing: false,
    _detectionMode: 'hybrid',
    _threshold: 50,
    _uploadedVideo: null,
    _targetImages: [],
    _progress: 0,
    _progressInterval: null,

    render() {
        const settings = SentinelStore.getSettings();
        this._detectionMode = this._detectionMode || settings.defaultDetectionMode || 'hybrid';
        this._threshold = this._threshold || settings.defaultThreshold || 50;

        return `
            <div class="panel-layout">
                ${UserSidebar.render('video-processing')}
                <main class="panel-content">
                    <div class="page-header">
                        <div>
                            <h1 class="page-title">Video Post Processing</h1>
                            <p class="page-subtitle">Upload and analyze recorded video footage</p>
                        </div>
                        <div class="page-actions">
                            ${this._isProcessing ? `
                                <span class="badge badge-green" style="padding:6px 12px;">Processing...</span>
                                <button class="btn btn-red" onclick="VideoProcessing.stopProcessing()">
                                    <i data-lucide="square"></i> Stop Post Processing
                                </button>
                            ` : `
                                <button class="btn ${this._uploadedVideo ? 'btn-red' : 'btn-ghost'} btn-lg" id="start-processing-btn" onclick="VideoProcessing.startProcessing()" ${!this._uploadedVideo ? 'disabled' : ''}>
                                    <i data-lucide="play"></i> Start Video Processing
                                </button>
                            `}
                        </div>
                    </div>

                    <div class="processing-config">
                        <!-- Video Upload -->
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title"><i data-lucide="film" style="width:18px;height:18px;display:inline;vertical-align:middle;margin-right:6px;"></i>Video Upload</h3>
                            </div>

                            ${this._uploadedVideo ? `
                                <div style="background:var(--bg-tertiary);border-radius:var(--radius-md);padding:var(--sp-4);display:flex;align-items:center;gap:var(--sp-3);">
                                    <i data-lucide="file-video" style="width:32px;height:32px;color:var(--accent-blue);"></i>
                                    <div style="flex:1;min-width:0;">
                                        <div style="font-size:var(--fs-sm);font-weight:var(--fw-medium);color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${SentinelHelpers.escapeHtml(this._uploadedVideo.name)}</div>
                                        <div style="font-size:var(--fs-xs);color:var(--text-tertiary);">${SentinelHelpers.formatFileSize(this._uploadedVideo.size)}</div>
                                    </div>
                                    <button class="btn btn-icon-sm btn-ghost" onclick="VideoProcessing.removeVideo()" style="color:var(--accent-red);">
                                        <i data-lucide="x" style="width:14px;height:14px;"></i>
                                    </button>
                                </div>
                            ` : `
                                <div class="file-upload-zone" id="video-upload-zone" onclick="document.getElementById('video-file-input').click()" ondragover="event.preventDefault();this.classList.add('dragover')" ondragleave="this.classList.remove('dragover')" ondrop="VideoProcessing.handleVideoDrop(event)">
                                    <i data-lucide="upload"></i>
                                    <div class="file-upload-text">
                                        <span>Click to upload</span> or drag and drop
                                    </div>
                                    <div style="font-size:var(--fs-xs);color:var(--text-tertiary);">MP4, AVI, MKV up to 2GB</div>
                                </div>
                                <input type="file" id="video-file-input" accept="video/*" style="display:none;" onchange="VideoProcessing.handleVideoSelect(event)">
                            `}
                        </div>

                        <!-- Target Person -->
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title"><i data-lucide="user-search" style="width:18px;height:18px;display:inline;vertical-align:middle;margin-right:6px;"></i>Target Person</h3>
                            </div>
                            <div class="form-group" style="margin-bottom:var(--sp-3);">
                                <label class="form-label">Target Person Name (Optional)</label>
                                <input type="text" class="form-input" id="vp-target-name" placeholder="Enter target person name">
                            </div>
                            <div class="file-upload-zone" onclick="document.getElementById('vp-target-file-input').click()" ondragover="event.preventDefault();this.classList.add('dragover')" ondragleave="this.classList.remove('dragover')" ondrop="VideoProcessing.handleTargetDrop(event)" style="padding:var(--sp-6);">
                                <i data-lucide="upload" style="width:24px;height:24px;"></i>
                                <div class="file-upload-text" style="font-size:var(--fs-xs);">
                                    <span>Upload target images</span>
                                </div>
                            </div>
                            <input type="file" id="vp-target-file-input" accept="image/*" multiple style="display:none;" onchange="VideoProcessing.handleTargetSelect(event)">
                            <div class="file-preview-grid" id="vp-target-preview"></div>
                        </div>
                    </div>

                    <div class="processing-config" style="margin-top:var(--sp-4);">
                        <!-- Detection Mode -->
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title"><i data-lucide="scan-face" style="width:18px;height:18px;display:inline;vertical-align:middle;margin-right:6px;"></i>Detection Mode</h3>
                            </div>
                            <div class="detection-modes" style="margin-bottom:var(--sp-4);">
                                <button class="detection-mode-btn ${this._detectionMode === 'face' ? 'active' : ''}" onclick="VideoProcessing.setMode('face')">
                                    <i data-lucide="scan-face" style="width:16px;height:16px;"></i> Face
                                </button>
                                <button class="detection-mode-btn ${this._detectionMode === 'body' ? 'active' : ''}" onclick="VideoProcessing.setMode('body')">
                                    <i data-lucide="person-standing" style="width:16px;height:16px;"></i> Body
                                </button>
                                <button class="detection-mode-btn ${this._detectionMode === 'hybrid' ? 'active' : ''}" onclick="VideoProcessing.setMode('hybrid')">
                                    <i data-lucide="combine" style="width:16px;height:16px;"></i> Hybrid
                                </button>
                            </div>
                            <div class="threshold-slider-wrapper">
                                <div class="threshold-labels">
                                    <span ${this._threshold < 35 ? 'class="active"' : ''}>Low</span>
                                    <span ${this._threshold >= 35 && this._threshold <= 70 ? 'class="active"' : ''}>Medium</span>
                                    <span ${this._threshold > 70 ? 'class="active"' : ''}>High</span>
                                </div>
                                <input type="range" class="threshold-slider" min="10" max="100" value="${this._threshold}" oninput="VideoProcessing.setThreshold(this.value)">
                                <div class="threshold-value" id="vp-threshold-display">${this._threshold}%</div>
                            </div>
                        </div>

                        <!-- Processing Info -->
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title"><i data-lucide="info" style="width:18px;height:18px;display:inline;vertical-align:middle;margin-right:6px;"></i>Processing Info</h3>
                            </div>
                            <div style="display:flex;flex-direction:column;gap:var(--sp-3);">
                                <div style="display:flex;justify-content:space-between;padding:var(--sp-2) 0;border-bottom:1px solid var(--border-primary);">
                                    <span style="font-size:var(--fs-sm);color:var(--text-secondary);">Video File</span>
                                    <span style="font-size:var(--fs-sm);font-weight:var(--fw-medium);">${this._uploadedVideo ? SentinelHelpers.truncateText(this._uploadedVideo.name, 25) : 'Not uploaded'}</span>
                                </div>
                                <div style="display:flex;justify-content:space-between;padding:var(--sp-2) 0;border-bottom:1px solid var(--border-primary);">
                                    <span style="font-size:var(--fs-sm);color:var(--text-secondary);">Target Images</span>
                                    <span style="font-size:var(--fs-sm);font-weight:var(--fw-medium);">${this._targetImages.length} uploaded</span>
                                </div>
                                <div style="display:flex;justify-content:space-between;padding:var(--sp-2) 0;border-bottom:1px solid var(--border-primary);">
                                    <span style="font-size:var(--fs-sm);color:var(--text-secondary);">Detection Mode</span>
                                    <span style="font-size:var(--fs-sm);font-weight:var(--fw-medium);text-transform:capitalize;">${this._detectionMode}</span>
                                </div>
                                <div style="display:flex;justify-content:space-between;padding:var(--sp-2) 0;">
                                    <span style="font-size:var(--fs-sm);color:var(--text-secondary);">Threshold</span>
                                    <span style="font-size:var(--fs-sm);font-weight:var(--fw-medium);">${this._threshold}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        `;
    },

    handleVideoSelect(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('video/')) {
            this._uploadedVideo = { name: file.name, size: file.size, type: file.type };
            SentinelToast.success('Video Uploaded', `${file.name} is ready for processing.`);
            SentinelRouter.navigate(location.hash);
        }
    },

    handleVideoDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('video/')) {
            this._uploadedVideo = { name: file.name, size: file.size, type: file.type };
            SentinelToast.success('Video Uploaded', `${file.name} is ready for processing.`);
            SentinelRouter.navigate(location.hash);
        }
    },

    removeVideo() {
        this._uploadedVideo = null;
        SentinelRouter.navigate(location.hash);
    },

    handleTargetSelect(e) {
        Array.from(e.target.files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    this._targetImages.push({ name: file.name, data: ev.target.result });
                    this._updateTargetPreview();
                };
                reader.readAsDataURL(file);
            }
        });
    },

    handleTargetDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        Array.from(e.dataTransfer.files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    this._targetImages.push({ name: file.name, data: ev.target.result });
                    this._updateTargetPreview();
                };
                reader.readAsDataURL(file);
            }
        });
    },

    _updateTargetPreview() {
        const grid = document.getElementById('vp-target-preview');
        if (!grid) return;
        grid.innerHTML = this._targetImages.map((img, i) => `
            <div class="file-preview-item">
                <img src="${img.data}" alt="${SentinelHelpers.escapeHtml(img.name)}">
                <button class="file-preview-remove" onclick="VideoProcessing.removeTarget(${i})">
                    <i data-lucide="x" style="width:10px;height:10px;"></i>
                </button>
            </div>
        `).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    removeTarget(index) {
        this._targetImages.splice(index, 1);
        this._updateTargetPreview();
    },

    setMode(mode) {
        this._detectionMode = mode;
        SentinelRouter.navigate(location.hash);
    },

    setThreshold(value) {
        this._threshold = parseInt(value);
        const display = document.getElementById('vp-threshold-display');
        if (display) display.textContent = value + '%';

        const labels = document.querySelectorAll('.threshold-labels span');
        labels.forEach((l, i) => {
            l.classList.remove('active');
            if (i === 0 && value < 35) l.classList.add('active');
            if (i === 1 && value >= 35 && value <= 70) l.classList.add('active');
            if (i === 2 && value > 70) l.classList.add('active');
        });
    },

    startProcessing() {
        if (!this._uploadedVideo) {
            SentinelToast.error('No Video', 'Please upload a video file first.');
            return;
        }

        this._isProcessing = true;
        this._progress = 0;

        SentinelStore.addActivity({ type: 'system', message: `Video processing started: ${this._uploadedVideo.name}`, color: 'green' });
        SentinelToast.success('Processing Started', 'Video analysis is in progress.');

        // Navigate to Post Processing Live
        location.hash = '#/user/post-processing-live';
    },

    stopProcessing() {
        SentinelModal.confirm({
            title: 'Stop Processing',
            message: 'Are you sure you want to stop video processing? Current progress will be lost.',
            confirmLabel: 'Stop Processing',
            danger: true,
            onConfirm: () => {
                this._isProcessing = false;
                this._progress = 0;
                if (this._progressInterval) clearInterval(this._progressInterval);
                SentinelStore.addActivity({ type: 'system', message: 'Video processing stopped', color: 'red' });
                SentinelModal.close();
                SentinelToast.info('Processing Stopped', 'Video analysis has been terminated.');
                SentinelRouter.navigate(location.hash);
            }
        });
    },

    init() {}
};

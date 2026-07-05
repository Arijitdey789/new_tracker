/* ============================================================
   SENTINEL PRO — Post Processing Live View
   ============================================================ */

const PostProcLive = {
    _progress: 0,
    _interval: null,
    _logs: [],
    _startTime: null,

    render() {
        const isActive = VideoProcessing._isProcessing;

        return `
            <div class="panel-layout">
                ${UserSidebar.render('post-processing-live')}
                <main class="panel-content">
                    <div class="page-header">
                        <div>
                            <h1 class="page-title">Post Processing Live</h1>
                            <p class="page-subtitle">Real-time video analysis progress and updates</p>
                        </div>
                        <div class="page-actions">
                            ${isActive ? `
                                <span class="badge badge-green" style="padding:6px 12px;">
                                    <i data-lucide="loader" class="animate-spin" style="width:12px;height:12px;margin-right:4px;"></i>
                                    Processing
                                </span>
                                <button class="btn btn-red" onclick="VideoProcessing.stopProcessing()">
                                    <i data-lucide="square"></i> Stop Processing
                                </button>
                            ` : `
                                <button class="btn btn-ghost" onclick="location.hash='#/user/video-processing'">
                                    <i data-lucide="arrow-left"></i> Back to Setup
                                </button>
                            `}
                        </div>
                    </div>

                    ${isActive ? this._renderActiveView() : this._renderIdleView()}
                </main>
            </div>
        `;
    },

    _renderActiveView() {
        const eta = this._getETA();
        const videoName = VideoProcessing._uploadedVideo ? VideoProcessing._uploadedVideo.name : 'Unknown';

        return `
            <div class="processing-progress-card" style="margin-bottom:var(--sp-4);">
                <div class="progress-header">
                    <div>
                        <div class="progress-percentage" id="progress-value">${this._progress}%</div>
                        <div style="font-size:var(--fs-sm);color:var(--text-secondary);margin-top:4px;">Processing: ${SentinelHelpers.escapeHtml(videoName)}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="progress-eta" id="progress-eta">ETA: ${eta}</div>
                        <div style="font-size:var(--fs-xs);color:var(--text-tertiary);margin-top:2px;">Mode: ${VideoProcessing._detectionMode}</div>
                    </div>
                </div>
                <div class="progress-bar" style="height:10px;margin:var(--sp-4) 0;">
                    <div class="progress-bar-fill" id="progress-bar-fill" style="width:${this._progress}%"></div>
                </div>
                <div class="progress-stats">
                    <div class="progress-stat">
                        <div class="progress-stat-value" id="frames-processed">0</div>
                        <div class="progress-stat-label">Frames Processed</div>
                    </div>
                    <div class="progress-stat">
                        <div class="progress-stat-value" id="detections-found">0</div>
                        <div class="progress-stat-label">Detections Found</div>
                    </div>
                    <div class="progress-stat">
                        <div class="progress-stat-value" id="elapsed-time">0:00</div>
                        <div class="progress-stat-label">Elapsed Time</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i data-lucide="terminal" style="width:18px;height:18px;display:inline;vertical-align:middle;margin-right:6px;"></i>Live Analysis Log</h3>
                    <span class="badge badge-blue" id="log-count">${this._logs.length} entries</span>
                </div>
                <div class="analysis-log" id="analysis-log">
                    ${this._logs.map(l => `
                        <div class="log-entry ${l.type}">
                            <span class="log-timestamp">[${l.time}]</span>
                            <span class="log-message">${SentinelHelpers.escapeHtml(l.message)}</span>
                        </div>
                    `).join('')}
                    ${this._logs.length === 0 ? `
                        <div class="log-entry info">
                            <span class="log-timestamp">[${SentinelHelpers.formatTime(new Date())}]</span>
                            <span class="log-message">Initializing video processing pipeline...</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    _renderIdleView() {
        return `
            <div class="card">
                <div class="empty-state" style="padding:var(--sp-16);">
                    <i data-lucide="activity" style="width:48px;height:48px;"></i>
                    <p class="empty-state-title">No Active Processing</p>
                    <p class="empty-state-text">Upload a video and start processing from the Video Post Processing module to see live analysis here.</p>
                    <button class="btn btn-blue" onclick="location.hash='#/user/video-processing'" style="margin-top:var(--sp-4);">
                        <i data-lucide="film"></i> Go to Video Processing
                    </button>
                </div>
            </div>
        `;
    },

    _getETA() {
        if (this._progress <= 0) return 'Calculating...';
        if (this._progress >= 100) return 'Complete';

        const elapsed = this._startTime ? (Date.now() - this._startTime) / 1000 : 0;
        if (elapsed <= 0) return 'Calculating...';

        const totalEst = (elapsed / this._progress) * 100;
        const remaining = totalEst - elapsed;
        const mins = Math.floor(remaining / 60);
        const secs = Math.floor(remaining % 60);
        return `${mins}m ${secs}s remaining`;
    },

    _addLog(message, type = 'info') {
        this._logs.push({
            time: SentinelHelpers.formatTime(new Date()),
            message,
            type
        });

        const logEl = document.getElementById('analysis-log');
        if (logEl) {
            const entry = document.createElement('div');
            entry.className = `log-entry ${type}`;
            entry.innerHTML = `
                <span class="log-timestamp">[${SentinelHelpers.formatTime(new Date())}]</span>
                <span class="log-message">${SentinelHelpers.escapeHtml(message)}</span>
            `;
            logEl.appendChild(entry);
            logEl.scrollTop = logEl.scrollHeight;
        }

        const countEl = document.getElementById('log-count');
        if (countEl) countEl.textContent = this._logs.length + ' entries';
    },

    _simulateProgress() {
        if (this._interval) clearInterval(this._interval);
        this._startTime = Date.now();
        this._logs = [];

        this._addLog('Video processing pipeline initialized', 'info');
        this._addLog(`Detection mode: ${VideoProcessing._detectionMode}`, 'info');
        this._addLog(`Threshold: ${VideoProcessing._threshold}%`, 'info');

        this._interval = setInterval(() => {
            if (!VideoProcessing._isProcessing) {
                clearInterval(this._interval);
                return;
            }

            this._progress += Math.random() * 3 + 0.5;
            if (this._progress > 100) this._progress = 100;

            // Update UI
            const pVal = document.getElementById('progress-value');
            const pBar = document.getElementById('progress-bar-fill');
            const pEta = document.getElementById('progress-eta');
            const frames = document.getElementById('frames-processed');
            const detects = document.getElementById('detections-found');
            const elapsed = document.getElementById('elapsed-time');

            if (pVal) pVal.textContent = Math.round(this._progress) + '%';
            if (pBar) pBar.style.width = this._progress + '%';
            if (pEta) pEta.textContent = 'ETA: ' + this._getETA();
            if (frames) frames.textContent = Math.round(this._progress * 30);
            if (detects) detects.textContent = Math.floor(this._progress / 20);
            if (elapsed) {
                const secs = Math.floor((Date.now() - this._startTime) / 1000);
                const m = Math.floor(secs / 60);
                const s = secs % 60;
                elapsed.textContent = `${m}:${s.toString().padStart(2, '0')}`;
            }

            // Random log messages
            const r = Math.random();
            if (r < 0.15) this._addLog(`Processing frame batch ${Math.round(this._progress * 30)}-${Math.round(this._progress * 30) + 30}`, 'info');
            if (r > 0.85 && r < 0.92) this._addLog(`Potential match detected at frame ${Math.round(this._progress * 30)} (confidence: ${(60 + Math.random() * 35).toFixed(1)}%)`, 'success');
            if (r > 0.95) this._addLog(`Low quality frame skipped at position ${Math.round(this._progress * 30)}`, 'warning');

            // Complete
            if (this._progress >= 100) {
                clearInterval(this._interval);
                VideoProcessing._isProcessing = false;
                this._addLog('Video processing completed successfully', 'success');
                this._addLog('Generating evidence report...', 'info');

                // Add to evidence vault
                SentinelStore.addEvidence({
                    type: 'post',
                    cameraName: 'Post Processing',
                    cameraLocation: 'N/A',
                    detectionMode: VideoProcessing._detectionMode,
                    confidence: (70 + Math.random() * 25).toFixed(1) + '%',
                    duration: elapsed ? elapsed.textContent : '0:00',
                    title: `Analysis - ${VideoProcessing._uploadedVideo ? VideoProcessing._uploadedVideo.name : 'Unknown'}`
                });

                SentinelStore.addActivity({ type: 'system', message: 'Video processing completed', color: 'green' });

                setTimeout(() => {
                    this._addLog('Report generated and stored in Evidence Vault', 'success');
                    SentinelToast.success('Processing Complete', 'Video analysis finished. Report stored in Evidence Vault.');
                }, 1500);
            }
        }, 1000);
    },

    init() {
        if (VideoProcessing._isProcessing && !this._interval) {
            this._simulateProgress();
        }
    }
};

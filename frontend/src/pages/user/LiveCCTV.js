/* ============================================================
   SENTINEL PRO — Live CCTV Monitoring Dashboard (v3.0)
   
   Production-grade multi-camera monitoring with:
   - State Machine: NORMAL ↔ SINGLE_TRACKING ↔ MULTI_TRACKING ↔ MANUAL_FULLSCREEN
   - Layout Engine: 8:5 aspect ratio CSS Grid with auto-pagination
   - Tracking Mode: Auto-switch on WebSocket events with HUD overlays
   - Navigation Panel: Collapsible camera list with manual override
   - WebSocket Integration: Real-time tracking events with fallback simulation
   
   STATE DIAGRAM:
   ┌─────────┐  tracking_start(1)  ┌──────────────────┐
   │  NORMAL  ├───────────────────►│  SINGLE_TRACKING  │
   │  (Grid)  │◄───────────────────┤  (Full viewport)  │
   └────┬─────┘  tracking_stop(0)  └────────┬──────────┘
        │                                    │
        │ nav click          tracking_start  │ tracking_start(2+)
        ▼                         (2nd cam)  ▼
   ┌────────────────┐              ┌──────────────────┐
   │ MANUAL_FULLSCR  │              │  MULTI_TRACKING   │
   │ (Independent)   │              │  (Dynamic grid)   │
   └────────────────┘              └──────────────────┘
   
   Manual fullscreen runs independently — tracking events update
   background state, view reflects them only after manual exit.
   ============================================================ */

const LiveCCTV = {
    // ---- Session State ----
    _isLive: false,
    _fullscreenActive: false,
    
    // ---- State Machine ----
    // States: 'NORMAL', 'SINGLE_TRACKING', 'MULTI_TRACKING', 'MANUAL_FULLSCREEN'
    _currentState: 'NORMAL',
    _trackingCameras: new Map(),   // camera_id → { target_id, confidence, coordinates, timestamp }
    _manualFullscreenId: null,     // camera_id currently in manual fullscreen
    _cameraStatus: new Map(),      // camera_id → 'online' | 'offline'
    
    // ---- Config State (from original) ----
    _detectionMode: 'hybrid',
    _threshold: 50,
    _targetImages: [],
    _targetName: '',
    _savedStreamTab: 'recent',
    
    // ---- Layout Engine ----
    _currentPage: 0,
    _tilesPerPage: 6,
    _navPanelCollapsed: false,
    
    // ---- Intervals & Animation ----
    _clockInterval: null,
    _noiseIntervals: [],
    _matrixRainInterval: null,
    _alertInterval: null,
    
    // ---- Detection (legacy compat) ----
    _detectedStreamIds: new Set(),
    _activeStreamId: null,
    _focusedStreamId: null,

    /* ==========================================================
       RENDER — Main entry (config page)
       ========================================================== */
    render() {
        const streams = SentinelStore.getStreams();
        const settings = SentinelStore.getSettings();
        this._detectionMode = settings.defaultDetectionMode || 'hybrid';
        this._threshold = settings.defaultThreshold || 50;

        return `
            <div class="panel-layout">
                ${UserSidebar.render('live-cctv')}
                <main class="panel-content" style="display:flex;flex-direction:column;">
                    <div class="page-header">
                        <div>
                            <h1 class="page-title">Live CCTV</h1>
                            <p class="page-subtitle">Real-time surveillance and monitoring</p>
                        </div>
                        <div class="page-actions">
                            ${this._isLive ? `
                                <span class="badge badge-green" style="padding:6px 14px;font-size:var(--fs-xs);">
                                    <span class="feed-live-dot" style="margin-right:4px;background:white;"></span> LIVE SESSION ACTIVE
                                </span>
                            ` : ''}
                        </div>
                    </div>

                    <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:var(--sp-5);padding-bottom:var(--sp-6);">
                        ${this._renderConfig(streams)}
                    </div>
                </main>
            </div>
            ${this._fullscreenActive ? this._renderMonitoringDashboard(streams) : ''}
        `;
    },

    /* ==========================================================
       CONFIG PAGE — All 6 Sections + Saved Library
       (Preserved from original with minor adjustments)
       ========================================================== */
    _renderConfig(streams) {
        const savedStreams = SentinelStore.getSavedStreams();
        const alerts = SentinelStore.getAlerts().slice(0, 15);

        return `
            <!-- ====== SECTION 1: Add Stream ====== -->
            <div class="config-section">
                <div class="config-section-title">
                    <span class="section-number">1</span>
                    <i data-lucide="plus-circle"></i> Add Stream
                    <span class="badge badge-blue" style="margin-left:auto;">${streams.length} / 3000</span>
                </div>
                <div class="card">
                    <form id="stream-form" onsubmit="LiveCCTV.addStream(event)" style="display:flex;flex-direction:column;gap:var(--sp-3);padding:var(--sp-4);">
                        <div class="form-group">
                            <label class="form-label">Stream URL</label>
                            <input type="text" class="form-input" id="stream-url" placeholder="rtsp://192.168.1.100:554/stream">
                            <div class="form-error" id="stream-url-error"></div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">CCTV Camera Name</label>
                                <input type="text" class="form-input" id="stream-name" placeholder="e.g. Main Gate Cam">
                                <div class="form-error" id="stream-name-error"></div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Location</label>
                                <input type="text" class="form-input" id="stream-location" placeholder="e.g. Building A - Entrance">
                                <div class="form-error" id="stream-location-error"></div>
                            </div>
                        </div>
                        <button type="submit" class="btn btn-blue" style="align-self:flex-start;">
                            <i data-lucide="plus"></i> + Add Stream
                        </button>
                    </form>
                </div>

                ${streams.length > 0 ? `
                <div style="margin-top:var(--sp-4);">
                    <div style="font-size:var(--fs-sm);font-weight:var(--fw-semibold);color:var(--text-secondary);margin-bottom:var(--sp-3);display:flex;align-items:center;gap:var(--sp-2);">
                        <i data-lucide="layout-grid" style="width:16px;height:16px;"></i> Active Streams (${streams.length})
                    </div>
                    <div class="streams-preview-grid">
                        ${streams.map(s => this._renderStreamPreviewCard(s)).join('')}
                    </div>
                </div>
                ` : ''}
            </div>

            <!-- ====== SECTION 2: Target Person ====== -->
            <div class="config-section">
                <div class="config-section-title">
                    <span class="section-number">2</span>
                    <i data-lucide="user-search"></i> Target Person
                </div>
                <div class="card" style="padding:var(--sp-4);">
                    <div class="form-group" style="margin-bottom:var(--sp-3);">
                        <label class="form-label">Target Person Name (Optional)</label>
                        <input type="text" class="form-input" id="target-name" placeholder="Enter suspect / target person name" value="${SentinelHelpers.escapeHtml(this._targetName)}">
                    </div>
                    <div class="file-upload-zone" id="target-upload-zone"
                         onclick="document.getElementById('target-file-input').click()"
                         ondragover="event.preventDefault();this.classList.add('dragover')"
                         ondragleave="this.classList.remove('dragover')"
                         ondrop="LiveCCTV.handleImageDrop(event)">
                        <i data-lucide="upload"></i>
                        <div class="file-upload-text">
                            <span>Click to upload</span> or drag and drop
                        </div>
                        <div style="font-size:var(--fs-xs);color:var(--text-tertiary);">PNG, JPG — up to 10MB each — Multiple images supported</div>
                    </div>
                    <input type="file" id="target-file-input" accept="image/*" multiple style="display:none;" onchange="LiveCCTV.handleImageSelect(event)">
                    <div class="file-preview-grid" id="target-preview-grid">
                        ${this._targetImages.map((img, i) => `
                            <div class="file-preview-item">
                                <img src="${img.data}" alt="${SentinelHelpers.escapeHtml(img.name)}">
                                <button class="file-preview-remove" onclick="LiveCCTV.removeTargetImage(${i})">
                                    <i data-lucide="x" style="width:10px;height:10px;"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- ====== SECTION 3: Detection Mode ====== -->
            <div class="config-section">
                <div class="config-section-title">
                    <span class="section-number">3</span>
                    <i data-lucide="scan-face"></i> Detection Mode
                </div>
                <div class="card" style="padding:var(--sp-4);">
                    <div class="detection-modes">
                        <button class="detection-mode-btn ${this._detectionMode === 'face' ? 'active' : ''}" onclick="LiveCCTV.setDetectionMode('face')">
                            <i data-lucide="scan-face" style="width:18px;height:18px;"></i> Face
                        </button>
                        <button class="detection-mode-btn ${this._detectionMode === 'body' ? 'active' : ''}" onclick="LiveCCTV.setDetectionMode('body')">
                            <i data-lucide="person-standing" style="width:18px;height:18px;"></i> Body
                        </button>
                        <button class="detection-mode-btn ${this._detectionMode === 'hybrid' ? 'active' : ''}" onclick="LiveCCTV.setDetectionMode('hybrid')">
                            <i data-lucide="combine" style="width:18px;height:18px;"></i> Hybrid
                        </button>
                    </div>
                </div>
            </div>

            <!-- ====== SECTION 4: Threshold Adjustment ====== -->
            <div class="config-section">
                <div class="config-section-title">
                    <span class="section-number">4</span>
                    <i data-lucide="sliders-horizontal"></i> Threshold Adjustment
                </div>
                <div class="card" style="padding:var(--sp-4);">
                    <div class="threshold-slider-wrapper">
                        <div class="threshold-labels">
                            <span ${this._threshold < 35 ? 'class="active"' : ''}>Sensitive (0.1)</span>
                            <span ${this._threshold >= 35 && this._threshold <= 70 ? 'class="active"' : ''}>Balanced</span>
                            <span ${this._threshold > 70 ? 'class="active"' : ''}>Strict (0.9)</span>
                        </div>
                        <input type="range" class="threshold-slider" min="10" max="90" value="${this._threshold}" oninput="LiveCCTV.setThreshold(this.value)">
                        <div class="threshold-value" id="threshold-display">${this._threshold}%</div>
                    </div>
                    <div style="font-size:var(--fs-xs);color:var(--text-tertiary);margin-top:var(--sp-2);text-align:center;">
                        0.1 → Highly sensitive detection &nbsp;|&nbsp; 0.9 → Highly strict detection
                    </div>
                </div>
            </div>

            <!-- ====== SECTION 5: Start Live Session ====== -->
            <div class="config-section">
                <div class="config-section-title">
                    <span class="section-number">5</span>
                    <i data-lucide="play"></i> Start Live Session
                </div>
                <div class="card" style="padding:var(--sp-5);text-align:center;">
                    <p style="font-size:var(--fs-sm);color:var(--text-secondary);margin-bottom:var(--sp-4);">
                        Launch the fullscreen monitoring window to begin real-time surveillance across all added streams.
                    </p>
                    <button class="btn btn-red btn-lg" id="start-live-btn" onclick="LiveCCTV.startSession()" style="padding:var(--sp-3) var(--sp-8);font-size:var(--fs-md);">
                        <i data-lucide="play"></i> Start Live Session
                    </button>
                </div>
            </div>

            <!-- ====== SECTION 6: Detection Alerts ====== -->
            <div class="config-section">
                <div class="config-section-title">
                    <span class="section-number">6</span>
                    <i data-lucide="alert-triangle" style="color:var(--accent-red);"></i> Detection Alerts
                    <span class="badge badge-red" style="margin-left:auto;">${alerts.length}</span>
                </div>
                ${alerts.length > 0 ? `
                <div class="detection-alerts-list">
                    ${alerts.map(a => this._renderDetectionAlertCard(a)).join('')}
                </div>
                ` : `
                <div class="card">
                    <div class="empty-state" style="padding:var(--sp-6);">
                        <i data-lucide="shield-check"></i>
                        <p class="empty-state-title">No Detections Yet</p>
                        <p class="empty-state-text">Detection alerts will appear here when suspects are identified during live monitoring sessions.</p>
                    </div>
                </div>
                `}
            </div>

            <!-- ====== Saved Stream Library ====== -->
            <div class="config-section">
                <div class="config-section-title">
                    <i data-lucide="bookmark"></i> Saved Stream Library
                    <span class="badge badge-blue" style="margin-left:auto;">${savedStreams.length} saved</span>
                </div>
                <div class="card" style="padding:var(--sp-4);">
                    <div class="saved-library-tabs">
                        <button class="saved-library-tab ${this._savedStreamTab === 'recent' ? 'active' : ''}" onclick="LiveCCTV.setSavedTab('recent')">
                            <i data-lucide="clock" style="width:12px;height:12px;display:inline;vertical-align:middle;margin-right:4px;"></i>Recent
                        </button>
                        <button class="saved-library-tab ${this._savedStreamTab === 'favorites' ? 'active' : ''}" onclick="LiveCCTV.setSavedTab('favorites')">
                            <i data-lucide="star" style="width:12px;height:12px;display:inline;vertical-align:middle;margin-right:4px;"></i>Favorites
                        </button>
                        <button class="saved-library-tab ${this._savedStreamTab === 'all' ? 'active' : ''}" onclick="LiveCCTV.setSavedTab('all')">
                            <i data-lucide="list" style="width:12px;height:12px;display:inline;vertical-align:middle;margin-right:4px;"></i>All
                        </button>
                    </div>
                    ${this._renderSavedStreamList(savedStreams)}
                </div>
            </div>
        `;
    },

    /* ==========================================================
       STREAM PREVIEW CARD (config page thumbnail)
       ========================================================== */
    _renderStreamPreviewCard(stream) {
        return `
            <div class="stream-preview-card" id="preview-card-${stream.id}">
                <div class="stream-preview-thumb">
                    <canvas class="feed-noise-canvas" id="noise-${stream.id}" width="320" height="180"></canvas>
                    <div class="stream-preview-overlay">
                        <div>
                            <div class="stream-preview-name">${SentinelHelpers.escapeHtml(stream.name)}</div>
                            <div class="stream-preview-loc">${SentinelHelpers.escapeHtml(stream.location)}</div>
                        </div>
                        <div class="stream-preview-live">
                            <span class="stream-preview-live-dot"></span> READY
                        </div>
                    </div>
                </div>
                <div class="stream-preview-body">
                    <div class="stream-preview-info">
                        <div class="stream-preview-info-name">${SentinelHelpers.escapeHtml(stream.name)}</div>
                        <div class="stream-preview-info-loc">${SentinelHelpers.escapeHtml(stream.location)}</div>
                    </div>
                    <button class="btn btn-icon-sm btn-ghost" onclick="LiveCCTV.removeStream('${stream.id}')" title="Remove" style="color:var(--accent-red);">
                        <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                    </button>
                </div>
            </div>
        `;
    },

    /* ==========================================================
       DETECTION ALERT CARD (Section 6)
       ========================================================== */
    _renderDetectionAlertCard(alert) {
        return `
            <div class="detection-alert-card">
                <div class="detection-alert-snapshot">
                    <i data-lucide="user" style="width:24px;height:24px;color:var(--text-tertiary);"></i>
                    <div class="alert-detection-box" style="top:15%;left:25%;width:50%;height:60%;"></div>
                </div>
                <div class="detection-alert-body">
                    <div class="detection-alert-header">
                        <div class="detection-alert-cam">
                            <i data-lucide="video" style="width:12px;height:12px;display:inline;vertical-align:middle;margin-right:4px;"></i>
                            ${SentinelHelpers.escapeHtml(alert.camera || 'Unknown Camera')}
                        </div>
                        <div class="detection-alert-time">${SentinelHelpers.formatTime(alert.timestamp)}</div>
                    </div>
                    <div class="detection-alert-loc">
                        <i data-lucide="map-pin"></i>
                        ${SentinelHelpers.escapeHtml(alert.location || 'Unknown Location')}
                    </div>
                    <div class="detection-alert-summary">
                        ${SentinelHelpers.escapeHtml(alert.message || 'Potential suspect detected in frame.')}
                    </div>
                </div>
            </div>
        `;
    },

    /* ==========================================================
       SAVED STREAM LIBRARY
       ========================================================== */
    _renderSavedStreamList(allSaved) {
        let displayStreams = [];
        if (this._savedStreamTab === 'recent') {
            displayStreams = SentinelStore.getRecentStreams(10);
        } else if (this._savedStreamTab === 'favorites') {
            displayStreams = SentinelStore.getFavoriteStreams();
        } else {
            displayStreams = allSaved;
        }

        if (displayStreams.length === 0) {
            const emptyMsg = this._savedStreamTab === 'favorites'
                ? 'No favorite streams yet. Click the star icon to mark favorites.'
                : this._savedStreamTab === 'recent'
                ? 'No recent streams. Added streams are automatically saved here.'
                : 'No saved streams yet.';
            return `
                <div class="empty-state" style="padding:var(--sp-4);">
                    <i data-lucide="bookmark" style="width:20px;height:20px;"></i>
                    <p class="empty-state-text" style="margin-top:var(--sp-2);">${emptyMsg}</p>
                </div>
            `;
        }

        return `
            <div class="saved-streams-list" style="max-height:240px;">
                ${displayStreams.map(s => `
                    <div class="saved-stream-entry" onclick="LiveCCTV.loadSavedStream('${s.id}')">
                        <button class="saved-stream-favorite ${s.favorite ? 'active' : ''}" onclick="event.stopPropagation();LiveCCTV.toggleFavorite('${s.id}')" title="${s.favorite ? 'Remove from favorites' : 'Add to favorites'}">
                            <i data-lucide="${s.favorite ? 'star' : 'star'}" style="width:14px;height:14px;${s.favorite ? 'fill:currentColor;' : ''}"></i>
                        </button>
                        <i data-lucide="video" style="width:14px;height:14px;color:var(--text-tertiary);flex-shrink:0;"></i>
                        <div style="flex:1;min-width:0;">
                            <div class="saved-stream-name">${SentinelHelpers.escapeHtml(s.name || 'Unnamed')}</div>
                            <div class="saved-stream-url">${SentinelHelpers.escapeHtml(s.url)}</div>
                        </div>
                        <button class="btn btn-icon-sm btn-ghost" onclick="event.stopPropagation();LiveCCTV.deleteSavedStream('${s.id}')" style="color:var(--accent-red);">
                            <i data-lucide="x" style="width:12px;height:12px;"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    },

    /* ==========================================================
       MONITORING DASHBOARD — Full Viewport Overlay
       The main monitoring view with state machine, grid, tracking
       ========================================================== */
    _renderMonitoringDashboard(streams) {
        if (streams.length === 0) return '';
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString();
        const dateStr = now.toLocaleDateString();
        const isTracking = this._trackingCameras.size > 0;
        const stateLabel = this._getStateLabel();

        return `
            <div class="fs-overlay" id="fs-overlay">
                <!-- Matrix Rain Background Canvas -->
                <canvas class="fs-matrix-bg" id="fs-matrix-bg"></canvas>

                <!-- Left Navigation Panel -->
                <div class="fs-nav-panel ${this._navPanelCollapsed ? 'collapsed' : ''}" id="fs-nav-panel">
                    <div class="fs-nav-header">
                        <div class="fs-nav-title">
                            <i data-lucide="monitor"></i> CAMERAS
                        </div>
                        <span class="fs-nav-count">${streams.length}</span>
                        <button class="fs-nav-toggle" onclick="LiveCCTV.toggleNavPanel()" title="Collapse panel">
                            <i data-lucide="panel-left-close"></i>
                        </button>
                    </div>
                    <div class="fs-nav-list">
                        ${streams.map(s => {
                            const isTracking = this._trackingCameras.has(s.id);
                            const isOffline = this._cameraStatus.get(s.id) === 'offline';
                            const isActive = this._manualFullscreenId === s.id;
                            return `
                                <div class="fs-nav-cam ${isActive ? 'active' : ''} ${isTracking ? 'tracking' : ''} ${isOffline ? 'offline' : ''}"
                                     onclick="LiveCCTV.openManualFullscreen('${s.id}')" id="fs-nav-${s.id}">
                                    <div class="fs-nav-dot ${isTracking ? 'tracking' : (isOffline ? 'offline' : 'online')}"></div>
                                    <div class="fs-nav-cam-info">
                                        <div class="fs-nav-cam-name">${SentinelHelpers.escapeHtml(s.name)}</div>
                                        <div class="fs-nav-cam-loc">${SentinelHelpers.escapeHtml(s.location)}</div>
                                    </div>
                                    ${isTracking ? '<span class="fs-nav-tracking-icon">◉ TRK</span>' : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div class="fs-nav-footer">
                        <div class="ws-status-dot ${SentinelWS.isConnected() ? 'connected' : 'simulation'}"></div>
                        <span>${SentinelWS.isConnected() ? 'WS CONNECTED' : 'SIMULATION MODE'}</span>
                    </div>
                </div>

                <!-- Main Content Area -->
                <div class="fs-main-area">
                    <!-- Top HUD Bar -->
                    <div class="fs-hud-bar">
                        <div class="fs-hud-left">
                            ${this._navPanelCollapsed ? `
                                <button class="fs-panel-toggle-btn" onclick="LiveCCTV.toggleNavPanel()">
                                    <i data-lucide="panel-left-open"></i> NAV
                                </button>
                            ` : ''}
                            <div class="fs-hud-mode ${isTracking ? 'tracking' : 'normal'}" id="fs-hud-mode">
                                ${stateLabel}
                            </div>
                            <div>
                                <div class="fs-hud-cam-name" id="fs-hud-cam-name">SENTINEL PRO</div>
                                <div class="fs-hud-cam-loc" id="fs-hud-cam-loc">
                                    ${streams.length} camera${streams.length !== 1 ? 's' : ''} online
                                </div>
                            </div>
                        </div>
                        <div class="fs-hud-right">
                            <span class="fs-hud-clock" id="fs-clock">${timeStr} — ${dateStr}</span>
                            <div class="fs-hud-live">
                                <span class="fs-hud-live-dot"></span> LIVE
                            </div>
                        </div>
                    </div>

                    <!-- Dynamic Content Area (changes based on state) -->
                    ${this._renderStateContent(streams)}

                    <!-- Manual Fullscreen Overlay (if active) -->
                    ${this._currentState === 'MANUAL_FULLSCREEN' ? this._renderManualFullscreen(streams) : ''}

                    <!-- Bottom Control Bar -->
                    <div class="fs-bottom-bar">
                        <button class="fs-exit-btn" onclick="LiveCCTV.exitFullscreen()">
                            <i data-lucide="minimize-2"></i> EXIT MONITOR
                        </button>
                        <button class="fs-stop-btn" onclick="LiveCCTV.stopSession()">
                            <i data-lucide="square"></i> TERMINATE SESSION
                        </button>
                        <span class="fs-esc-hint">
                            MODE: ${this._detectionMode.toUpperCase()} | THRESHOLD: ${this._threshold}% | ESC TO EXIT
                        </span>
                    </div>
                </div>
            </div>
        `;
    },

    /* ==========================================================
       STATE CONTENT RENDERER — Renders based on current state
       ========================================================== */
    _renderStateContent(streams) {
        // If in manual fullscreen, show normal grid behind it
        const effectiveState = this._currentState === 'MANUAL_FULLSCREEN' 
            ? (this._trackingCameras.size > 1 ? 'MULTI_TRACKING' : 
               this._trackingCameras.size === 1 ? 'SINGLE_TRACKING' : 'NORMAL')
            : this._currentState;

        switch (effectiveState) {
            case 'SINGLE_TRACKING':
                return this._renderSingleTracking(streams);
            case 'MULTI_TRACKING':
                return this._renderMultiTracking(streams);
            case 'NORMAL':
            default:
                return this._renderNormalGrid(streams);
        }
    },

    /* ==========================================================
       NORMAL MODE — Paginated 8:5 Grid
       ========================================================== */
    _renderNormalGrid(streams) {
        // Compute pagination
        this._computeTilesPerPage();
        const totalPages = Math.max(1, Math.ceil(streams.length / this._tilesPerPage));
        if (this._currentPage >= totalPages) this._currentPage = totalPages - 1;
        if (this._currentPage < 0) this._currentPage = 0;

        const startIdx = this._currentPage * this._tilesPerPage;
        const pageStreams = streams.slice(startIdx, startIdx + this._tilesPerPage);

        return `
            <div class="fs-grid-container" id="fs-grid-container">
                <div class="fs-camera-grid" id="fs-camera-grid">
                    ${pageStreams.map(s => this._renderCameraTile(s)).join('')}
                </div>
                ${totalPages > 1 ? `
                    <div class="fs-pagination">
                        <button class="fs-page-btn" onclick="LiveCCTV.prevPage()" ${this._currentPage === 0 ? 'disabled' : ''}>
                            <i data-lucide="chevron-left"></i> PREV
                        </button>
                        <span class="fs-page-indicator">
                            PAGE <span class="current">${this._currentPage + 1}</span> / ${totalPages}
                        </span>
                        <button class="fs-page-btn" onclick="LiveCCTV.nextPage()" ${this._currentPage >= totalPages - 1 ? 'disabled' : ''}>
                            NEXT <i data-lucide="chevron-right"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    },

    /* ==========================================================
       CAMERA TILE — Individual 8:5 tile in grid
       ========================================================== */
    _renderCameraTile(stream) {
        const isTracking = this._trackingCameras.has(stream.id);
        const isOffline = this._cameraStatus.get(stream.id) === 'offline';
        const trackingData = isTracking ? this._trackingCameras.get(stream.id) : null;

        return `
            <div class="fs-camera-tile ${isTracking ? 'tracking' : ''} ${isOffline ? 'offline' : ''}"
                 onclick="LiveCCTV.openManualFullscreen('${stream.id}')" id="fs-tile-${stream.id}">
                <canvas class="fs-tile-canvas feed-noise-canvas" id="fs-canvas-${stream.id}" width="640" height="400"></canvas>
                <div class="fs-tile-placeholder">
                    <i data-lucide="video"></i>
                    <span class="fs-tile-placeholder-id">${SentinelHelpers.escapeHtml(stream.name)}</span>
                </div>
                ${isTracking ? `
                    <div class="fs-detection-box" style="top:20%;left:30%;width:35%;height:50%;"></div>
                    <div class="fs-hud-corners"><div class="fs-hud-corners-inner"></div></div>
                ` : ''}
                <div class="fs-tile-overlay">
                    <div>
                        <div class="fs-tile-name">${SentinelHelpers.escapeHtml(stream.name)}</div>
                        <div class="fs-tile-loc">${SentinelHelpers.escapeHtml(stream.location)}</div>
                    </div>
                    <div class="fs-tile-status ${isTracking ? 'tracking-active' : 'live'}">
                        <span class="fs-tile-status-dot"></span>
                        ${isTracking ? 'TRACKING' : (isOffline ? 'OFFLINE' : 'LIVE')}
                    </div>
                </div>
            </div>
        `;
    },

    /* ==========================================================
       SINGLE TRACKING — Full viewport single camera
       ========================================================== */
    _renderSingleTracking(streams) {
        const [cameraId, trackingData] = [...this._trackingCameras.entries()][0] || [];
        const stream = streams.find(s => s.id === cameraId);
        if (!stream) return this._renderNormalGrid(streams);

        const now = new Date();

        return `
            <div class="fs-tracking-container" id="fs-tracking-container">
                <div class="fs-tracking-single">
                    <div class="fs-tracking-tile" style="width:100%;height:100%;max-width:100%;max-height:100%;">
                        <canvas class="feed-noise-canvas" id="fs-track-canvas-${stream.id}" width="1280" height="800"></canvas>
                        <div class="fs-tile-placeholder">
                            <i data-lucide="video"></i>
                        </div>
                        
                        <!-- Detection bounding box -->
                        <div class="fs-detection-box" style="top:22%;left:32%;width:30%;height:48%;"></div>
                        
                        <!-- HUD corners -->
                        <div class="fs-hud-corners"><div class="fs-hud-corners-inner"></div></div>

                        <!-- HUD Overlay -->
                        <div class="fs-hud-overlay">
                            <div class="fs-hud-top">
                                <div class="fs-hud-target-badge">TARGET ACQUIRED</div>
                                <div class="fs-hud-target-id">ID: ${trackingData ? trackingData.target_id : 'UNKNOWN'}</div>
                            </div>
                            <div class="fs-hud-bottom">
                                <div>
                                    <div class="fs-hud-cam-label">${SentinelHelpers.escapeHtml(stream.name)}</div>
                                    <div class="fs-hud-location">${SentinelHelpers.escapeHtml(stream.location)}</div>
                                    <div class="fs-hud-timestamp" id="fs-track-time">${now.toLocaleTimeString()} — ${now.toLocaleDateString()}</div>
                                </div>
                                <div>
                                    ${trackingData && trackingData.coordinates ? `
                                        <div class="fs-hud-coords">
                                            X: ${trackingData.coordinates.x} Y: ${trackingData.coordinates.y}
                                        </div>
                                    ` : ''}
                                    ${trackingData && trackingData.confidence ? `
                                        <div class="fs-hud-confidence">CONF: ${trackingData.confidence}</div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /* ==========================================================
       MULTI TRACKING — Dynamic equal-size grid
       ========================================================== */
    _renderMultiTracking(streams) {
        const trackingEntries = [...this._trackingCameras.entries()];
        const trackingStreams = trackingEntries
            .map(([id, data]) => ({ stream: streams.find(s => s.id === id), data }))
            .filter(e => e.stream);
        
        const count = trackingStreams.length;
        if (count === 0) return this._renderNormalGrid(streams);

        const now = new Date();

        return `
            <div class="fs-tracking-container" id="fs-tracking-container">
                <div class="fs-tracking-grid" data-count="${Math.min(count, 9)}">
                    ${trackingStreams.map(({ stream, data }) => `
                        <div class="fs-tracking-tile" onclick="LiveCCTV.openManualFullscreen('${stream.id}')">
                            <canvas class="feed-noise-canvas" id="fs-track-canvas-${stream.id}" width="640" height="400"></canvas>
                            <div class="fs-tile-placeholder">
                                <i data-lucide="video"></i>
                            </div>
                            
                            <div class="fs-detection-box" style="top:20%;left:28%;width:35%;height:52%;"></div>
                            <div class="fs-hud-corners"><div class="fs-hud-corners-inner"></div></div>

                            <div class="fs-hud-overlay">
                                <div class="fs-hud-top">
                                    <div class="fs-hud-target-badge" style="font-size:9px;">TARGET ACQUIRED</div>
                                    <div class="fs-hud-target-id" style="font-size:9px;">ID: ${data.target_id || 'UNKNOWN'}</div>
                                </div>
                                <div class="fs-hud-bottom" style="padding:10px 12px;">
                                    <div>
                                        <div class="fs-hud-cam-label" style="font-size:11px;">${SentinelHelpers.escapeHtml(stream.name)}</div>
                                        <div class="fs-hud-location">${SentinelHelpers.escapeHtml(stream.location)}</div>
                                    </div>
                                    <div>
                                        ${data.confidence ? `<div class="fs-hud-confidence" style="font-size:9px;">CONF: ${data.confidence}</div>` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    /* ==========================================================
       MANUAL FULLSCREEN — Single camera override
       ========================================================== */
    _renderManualFullscreen(streams) {
        const stream = streams.find(s => s.id === this._manualFullscreenId);
        if (!stream) return '';

        const isTracking = this._trackingCameras.has(stream.id);
        const trackingData = isTracking ? this._trackingCameras.get(stream.id) : null;
        const now = new Date();

        return `
            <div class="fs-manual-fullscreen" id="fs-manual-fullscreen">
                <div class="fs-manual-feed">
                    <canvas class="feed-noise-canvas" id="fs-manual-canvas" width="1280" height="800"></canvas>
                    <div class="fs-tile-placeholder">
                        <i data-lucide="video"></i>
                    </div>

                    ${isTracking ? `
                        <div class="fs-detection-box" style="top:22%;left:30%;width:32%;height:50%;"></div>
                        <div class="fs-hud-corners"><div class="fs-hud-corners-inner"></div></div>
                        <div class="fs-hud-overlay">
                            <div class="fs-hud-top">
                                <div class="fs-hud-target-badge">TARGET ACQUIRED</div>
                                <div class="fs-hud-target-id">ID: ${trackingData ? trackingData.target_id : 'UNKNOWN'}</div>
                            </div>
                            <div class="fs-hud-bottom">
                                <div>
                                    <div class="fs-hud-cam-label">${SentinelHelpers.escapeHtml(stream.name)}</div>
                                    <div class="fs-hud-location">${SentinelHelpers.escapeHtml(stream.location)}</div>
                                    <div class="fs-hud-timestamp">${now.toLocaleTimeString()} — ${now.toLocaleDateString()}</div>
                                </div>
                                <div>
                                    ${trackingData && trackingData.coordinates ? `
                                        <div class="fs-hud-coords">X: ${trackingData.coordinates.x} Y: ${trackingData.coordinates.y}</div>
                                    ` : ''}
                                    ${trackingData && trackingData.confidence ? `
                                        <div class="fs-hud-confidence">CONF: ${trackingData.confidence}</div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div class="fs-manual-info">
                            <div>
                                <div class="fs-hud-cam-label">${SentinelHelpers.escapeHtml(stream.name)}</div>
                                <div class="fs-hud-location">${SentinelHelpers.escapeHtml(stream.location)}</div>
                                <div class="fs-hud-timestamp" id="fs-manual-time">${now.toLocaleTimeString()}</div>
                            </div>
                            <div class="feed-live-badge">
                                <span class="feed-live-dot"></span> LIVE
                            </div>
                        </div>
                    `}

                    <button class="fs-manual-close" onclick="LiveCCTV.closeManualFullscreen()">
                        <i data-lucide="x"></i> CLOSE [ESC]
                    </button>
                </div>
            </div>
        `;
    },

    /* ==========================================================
       STATE MACHINE — Core transition logic
       ========================================================== */
    _getStateLabel() {
        switch (this._currentState) {
            case 'NORMAL': return '● MONITORING';
            case 'SINGLE_TRACKING': return '◉ SINGLE TRACKING';
            case 'MULTI_TRACKING': return '◉ MULTI TRACKING';
            case 'MANUAL_FULLSCREEN': return '◎ MANUAL VIEW';
            default: return '● IDLE';
        }
    },

    /**
     * Transition the state machine based on tracking camera count
     * Called whenever tracking_start or tracking_stop is received
     */
    _updateStateMachine() {
        const trackingCount = this._trackingCameras.size;
        const wasState = this._currentState;

        // Manual fullscreen is independent — don't auto-change it
        if (this._currentState === 'MANUAL_FULLSCREEN') {
            // Just update the nav panel visually, don't change state
            this._updateNavPanel();
            return;
        }

        // Determine new state based on tracking count
        if (trackingCount === 0) {
            this._currentState = 'NORMAL';
        } else if (trackingCount === 1) {
            this._currentState = 'SINGLE_TRACKING';
        } else {
            this._currentState = 'MULTI_TRACKING';
        }

        // If state changed, re-render the monitoring view
        if (wasState !== this._currentState) {
            console.log(
                `%c[StateMachine]%c ${wasState} → ${this._currentState}`,
                'color: #ff0040; font-weight: bold;', 'color: #ffaa00;'
            );
            this._refreshDashboard();
        } else {
            // Even if state didn't change, update visuals
            this._updateNavPanel();
        }
    },

    /* ==========================================================
       WEBSOCKET EVENT HANDLERS
       ========================================================== */
    _onTrackingStart(data) {
        if (!this._isLive || !this._fullscreenActive) return;

        const { camera_id, target_id, confidence, coordinates, timestamp } = data;
        
        // Verify this camera exists in our streams
        const streams = SentinelStore.getStreams();
        const stream = streams.find(s => s.id === camera_id);
        if (!stream) return;

        // Add to tracking set
        this._trackingCameras.set(camera_id, {
            target_id: target_id || 'UNKNOWN',
            confidence: confidence || 'N/A',
            coordinates: coordinates || null,
            timestamp: timestamp || new Date().toISOString()
        });

        // Legacy compat
        this._detectedStreamIds.add(camera_id);

        // Create alert
        SentinelStore.addAlert({
            camera: stream.name,
            location: stream.location,
            message: `Target ${target_id || 'unknown'} acquired — Confidence: ${confidence || 'N/A'} — Mode: ${this._detectionMode.toUpperCase()}`,
            type: 'detection',
            confidence: confidence
        });

        // Auto-generate evidence
        SentinelStore.addEvidence({
            type: 'live',
            cameraName: stream.name,
            cameraLocation: stream.location,
            detectionMode: this._detectionMode,
            confidence: confidence || 'N/A',
            duration: Math.floor(Math.random() * 30 + 5) + 's',
            title: `Detection - ${stream.name}`,
            targetName: this._targetName || target_id || 'Unknown Suspect'
        });

        SentinelStore.addActivity({
            type: 'alert',
            message: `Target acquired on ${stream.name} (${confidence || 'N/A'})`,
            color: 'red'
        });

        // Update state machine
        this._updateStateMachine();
    },

    _onTrackingStop(data) {
        if (!this._isLive || !this._fullscreenActive) return;

        const { camera_id, target_id } = data;
        
        // Remove from tracking set
        this._trackingCameras.delete(camera_id);
        this._detectedStreamIds.delete(camera_id);

        // Log
        const streams = SentinelStore.getStreams();
        const stream = streams.find(s => s.id === camera_id);
        if (stream) {
            SentinelStore.addActivity({
                type: 'system',
                message: `Tracking ended on ${stream.name}`,
                color: 'amber'
            });
        }

        // Update state machine
        this._updateStateMachine();
    },

    _onCameraStatus(data) {
        const { camera_id, status } = data;
        this._cameraStatus.set(camera_id, status);
        
        // Update nav panel dot
        if (this._fullscreenActive) {
            this._updateNavPanel();
        }
    },

    /* ==========================================================
       UI UPDATES (without full re-render)
       ========================================================== */
    _refreshDashboard() {
        if (!this._fullscreenActive) return;
        
        // Full re-render of the dashboard
        SentinelRouter.navigate(location.hash);
    },

    _updateNavPanel() {
        // Update nav panel items without full re-render
        const streams = SentinelStore.getStreams();
        streams.forEach(s => {
            const navEl = document.getElementById(`fs-nav-${s.id}`);
            if (!navEl) return;

            const isTracking = this._trackingCameras.has(s.id);
            const isOffline = this._cameraStatus.get(s.id) === 'offline';
            const isActive = this._manualFullscreenId === s.id;

            navEl.className = `fs-nav-cam ${isActive ? 'active' : ''} ${isTracking ? 'tracking' : ''} ${isOffline ? 'offline' : ''}`;
            
            const dot = navEl.querySelector('.fs-nav-dot');
            if (dot) {
                dot.className = `fs-nav-dot ${isTracking ? 'tracking' : (isOffline ? 'offline' : 'online')}`;
            }
        });

        // Update HUD mode badge
        const hudMode = document.getElementById('fs-hud-mode');
        if (hudMode) {
            const isTracking = this._trackingCameras.size > 0;
            hudMode.className = `fs-hud-mode ${isTracking ? 'tracking' : 'normal'}`;
            hudMode.textContent = this._getStateLabel();
        }
    },

    /* ==========================================================
       PAGINATION CONTROLS
       ========================================================== */
    _computeTilesPerPage() {
        // Estimate tiles per page based on viewport and nav panel
        const container = document.getElementById('fs-grid-container');
        if (!container) {
            this._tilesPerPage = 6;
            return;
        }
        
        const containerWidth = container.clientWidth || window.innerWidth - (this._navPanelCollapsed ? 0 : 280);
        const containerHeight = container.clientHeight || window.innerHeight - 120;
        
        // Tile width based on CSS auto-fill (approx clamp(200px, 22vw, 400px))
        const tileWidth = Math.max(200, Math.min(containerWidth * 0.22, 400));
        const tileHeight = tileWidth / 1.6; // 8:5 ratio
        
        const cols = Math.max(1, Math.floor(containerWidth / (tileWidth + 10)));
        const rows = Math.max(1, Math.floor(containerHeight / (tileHeight + 10)));
        
        this._tilesPerPage = Math.max(1, cols * rows);
    },

    prevPage() {
        if (this._currentPage > 0) {
            this._currentPage--;
            this._refreshDashboard();
        }
    },

    nextPage() {
        const streams = SentinelStore.getStreams();
        const totalPages = Math.ceil(streams.length / this._tilesPerPage);
        if (this._currentPage < totalPages - 1) {
            this._currentPage++;
            this._refreshDashboard();
        }
    },

    /* ==========================================================
       NAV PANEL & MANUAL FULLSCREEN
       ========================================================== */
    toggleNavPanel() {
        this._navPanelCollapsed = !this._navPanelCollapsed;
        const panel = document.getElementById('fs-nav-panel');
        if (panel) {
            panel.classList.toggle('collapsed', this._navPanelCollapsed);
        }
        // Re-render to update toggle button in HUD bar
        this._refreshDashboard();
    },

    openManualFullscreen(cameraId) {
        this._manualFullscreenId = cameraId;
        this._currentState = 'MANUAL_FULLSCREEN';
        this._refreshDashboard();
    },

    closeManualFullscreen() {
        this._manualFullscreenId = null;
        
        // Revert to the appropriate state based on current tracking
        const trackingCount = this._trackingCameras.size;
        if (trackingCount === 0) {
            this._currentState = 'NORMAL';
        } else if (trackingCount === 1) {
            this._currentState = 'SINGLE_TRACKING';
        } else {
            this._currentState = 'MULTI_TRACKING';
        }
        
        this._refreshDashboard();
    },

    /* ==========================================================
       ACTIONS — Stream Management (preserved from original)
       ========================================================== */
    addStream(e) {
        e.preventDefault();

        const data = {
            url: document.getElementById('stream-url').value.trim(),
            name: document.getElementById('stream-name').value.trim(),
            location: document.getElementById('stream-location').value.trim()
        };

        // Clear errors
        ['url', 'name', 'location'].forEach(f => {
            const errEl = document.getElementById(`stream-${f}-error`);
            if (errEl) errEl.textContent = '';
        });

        const validation = SentinelValidators.validateStreamForm(data);
        if (!validation.isValid) {
            Object.entries(validation.errors).forEach(([field, msg]) => {
                const errEl = document.getElementById(`stream-${field}-error`);
                if (errEl) errEl.textContent = msg;
            });
            SentinelToast.error('Validation Error', 'Please fill in all required fields.');
            return;
        }

        const streams = SentinelStore.getStreams();
        if (streams.length >= 3000) {
            SentinelToast.error('Limit Reached', 'Maximum of 3,000 streams supported.');
            return;
        }

        SentinelStore.addStream(data);

        // Auto-save stream URL
        const settings = SentinelStore.getSettings();
        if (settings.autoSaveStreams) {
            SentinelStore.saveStreamUrl({ url: data.url, name: data.name, location: data.location });
        }

        SentinelStore.addActivity({ type: 'system', message: `Stream added: ${data.name}`, color: 'green' });
        SentinelToast.success('Stream Added', `${data.name} has been added successfully.`);
        SentinelRouter.navigate(location.hash);
    },

    removeStream(id) {
        SentinelStore.deleteStream(id);
        SentinelToast.info('Stream Removed', 'Camera stream has been removed.');
        SentinelRouter.navigate(location.hash);
    },

    loadSavedStream(id) {
        const saved = SentinelStore.getSavedStreams().find(s => s.id === id);
        if (saved) {
            const urlInput = document.getElementById('stream-url');
            const nameInput = document.getElementById('stream-name');
            const locInput = document.getElementById('stream-location');
            if (urlInput) urlInput.value = saved.url;
            if (nameInput) nameInput.value = saved.name || '';
            if (locInput) locInput.value = saved.location || '';
            SentinelToast.info('Stream Loaded', 'Saved stream URL has been filled in.');
        }
    },

    deleteSavedStream(id) {
        SentinelStore.deleteSavedStream(id);
        SentinelToast.info('Removed', 'Saved stream URL deleted.');
        SentinelRouter.navigate(location.hash);
    },

    toggleFavorite(id) {
        SentinelStore.toggleStreamFavorite(id);
        SentinelRouter.navigate(location.hash);
    },

    setSavedTab(tab) {
        this._savedStreamTab = tab;
        SentinelRouter.navigate(location.hash);
    },

    /* ==========================================================
       ACTIONS — Detection Mode & Threshold
       ========================================================== */
    setDetectionMode(mode) {
        this._detectionMode = mode;
        document.querySelectorAll('.detection-mode-btn').forEach(btn => {
            const btnText = btn.textContent.trim().toLowerCase();
            btn.classList.toggle('active', btnText.includes(mode));
        });
    },

    setThreshold(value) {
        this._threshold = parseInt(value);
        const display = document.getElementById('threshold-display');
        if (display) display.textContent = value + '%';

        const labels = document.querySelectorAll('.threshold-labels span');
        labels.forEach((l, i) => {
            l.classList.remove('active');
            if (i === 0 && value < 35) l.classList.add('active');
            if (i === 1 && value >= 35 && value <= 70) l.classList.add('active');
            if (i === 2 && value > 70) l.classList.add('active');
        });
    },

    /* ==========================================================
       ACTIONS — Image Upload (preserved from original)
       ========================================================== */
    handleImageSelect(e) {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            if (file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    this._targetImages.push({ name: file.name, data: ev.target.result });
                    this._updateImagePreview();
                };
                reader.readAsDataURL(file);
            } else if (file.size > 10 * 1024 * 1024) {
                SentinelToast.warning('File Too Large', `${file.name} exceeds 10MB limit.`);
            }
        });
    },

    handleImageDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        files.forEach(file => {
            if (file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    this._targetImages.push({ name: file.name, data: ev.target.result });
                    this._updateImagePreview();
                };
                reader.readAsDataURL(file);
            }
        });
    },

    _updateImagePreview() {
        const grid = document.getElementById('target-preview-grid');
        if (!grid) return;
        grid.innerHTML = this._targetImages.map((img, i) => `
            <div class="file-preview-item">
                <img src="${img.data}" alt="${SentinelHelpers.escapeHtml(img.name)}">
                <button class="file-preview-remove" onclick="LiveCCTV.removeTargetImage(${i})">
                    <i data-lucide="x" style="width:10px;height:10px;"></i>
                </button>
            </div>
        `).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    removeTargetImage(index) {
        this._targetImages.splice(index, 1);
        this._updateImagePreview();
    },

    /* ==========================================================
       ACTIONS — Live Session Control
       ========================================================== */
    startSession() {
        const streams = SentinelStore.getStreams();
        if (streams.length === 0) {
            SentinelToast.error('No Streams', 'Please add at least one CCTV stream before starting.');
            return;
        }

        // Save target name
        const nameInput = document.getElementById('target-name');
        if (nameInput) this._targetName = nameInput.value.trim();

        // Initialize session state
        this._isLive = true;
        this._fullscreenActive = true;
        this._currentState = 'NORMAL';
        this._currentPage = 0;
        this._trackingCameras.clear();
        this._manualFullscreenId = null;
        this._detectedStreamIds.clear();
        this._cameraStatus.clear();
        this._navPanelCollapsed = false;

        // Initialize all cameras as online
        streams.forEach(s => this._cameraStatus.set(s.id, 'online'));

        SentinelStore.addActivity({ type: 'system', message: 'Live monitoring session started', color: 'green' });
        SentinelToast.success('Session Started', 'Monitoring dashboard activated.');
        SentinelRouter.navigate(location.hash);

        // Connect WebSocket and start receiving events
        this._initWebSocket();
    },

    stopSession() {
        SentinelModal.confirm({
            title: 'Terminate Session',
            message: 'Are you sure you want to terminate the live monitoring session? All streams and tracking will stop.',
            confirmLabel: 'Terminate',
            danger: true,
            onConfirm: () => {
                LiveCCTV._cleanupSession();
                SentinelStore.addActivity({ type: 'system', message: 'Live monitoring session terminated', color: 'red' });
                SentinelModal.close();
                SentinelToast.info('Session Terminated', 'Live monitoring has been shut down.');
                SentinelRouter.navigate('#/user/live-cctv');
            }
        });
    },

    exitFullscreen() {
        this._cleanupSession();
        SentinelStore.addActivity({ type: 'system', message: 'Exited monitoring dashboard', color: 'amber' });
        SentinelToast.info('Dashboard Closed', 'Returned to configuration page.');
        SentinelRouter.navigate('#/user/live-cctv');
    },

    _cleanupSession() {
        this._isLive = false;
        this._fullscreenActive = false;
        this._currentState = 'NORMAL';
        this._manualFullscreenId = null;
        this._trackingCameras.clear();
        this._detectedStreamIds.clear();
        this._cameraStatus.clear();
        this._currentPage = 0;

        // Stop WebSocket
        SentinelWS.stopAll();

        // Clear intervals
        if (this._clockInterval) {
            clearInterval(this._clockInterval);
            this._clockInterval = null;
        }
        if (this._matrixRainInterval) {
            cancelAnimationFrame(this._matrixRainInterval);
            this._matrixRainInterval = null;
        }
        this._noiseIntervals.forEach(id => cancelAnimationFrame(id));
        this._noiseIntervals = [];
    },

    switchStream(id) {
        this._focusedStreamId = id;
        this._activeStreamId = id;
        if (this._fullscreenActive) {
            SentinelRouter.navigate(location.hash);
        }
    },

    /* ==========================================================
       WEBSOCKET INITIALIZATION
       ========================================================== */
    _initWebSocket() {
        // Register event handlers
        SentinelWS.on('tracking_start', (data) => this._onTrackingStart(data));
        SentinelWS.on('tracking_stop', (data) => this._onTrackingStop(data));
        SentinelWS.on('camera_status', (data) => this._onCameraStatus(data));
        SentinelWS.on('connection', (data) => {
            console.log('[LiveCCTV] WS connection:', data.status);
        });

        // Initialize connection (will fallback to simulation if no backend)
        SentinelWS.init();

        // Start simulation after a short delay if not connected
        setTimeout(() => {
            if (!SentinelWS.isConnected() && !SentinelWS.isSimulating()) {
                SentinelWS.startSimulation();
            }
        }, 3000);
    },

    /* ==========================================================
       MATRIX RAIN BACKGROUND EFFECT
       ========================================================== */
    _initMatrixRain() {
        const canvas = document.getElementById('fs-matrix-bg');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const columns = Math.floor(canvas.width / 14);
        const drops = new Array(columns).fill(1);
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+-=[]{}|;:,.<>?アイウエオカキクケコサシスセソタチツテトナニヌネノ';

        const drawMatrix = () => {
            if (!this._fullscreenActive) return;

            ctx.fillStyle = 'rgba(10, 14, 10, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#00ff41';
            ctx.font = '12px monospace';

            for (let i = 0; i < drops.length; i++) {
                const char = chars[Math.floor(Math.random() * chars.length)];
                ctx.fillText(char, i * 14, drops[i] * 14);

                if (drops[i] * 14 > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }

            this._matrixRainInterval = requestAnimationFrame(drawMatrix);
        };

        drawMatrix();
    },

    /* ==========================================================
       CANVAS NOISE RENDERING — simulates CCTV static
       ========================================================== */
    _initNoiseCanvases() {
        const canvases = document.querySelectorAll('.feed-noise-canvas');
        canvases.forEach(canvas => {
            if (!canvas || !canvas.getContext) return;
            const ctx = canvas.getContext('2d');
            const w = canvas.width;
            const h = canvas.height;

            const drawNoise = () => {
                const imageData = ctx.createImageData(w, h);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const val = Math.random() * 30 + 5;
                    data[i] = val;                           // R
                    data[i + 1] = val + Math.random() * 8;   // G (slight green tint)
                    data[i + 2] = val + Math.random() * 3;   // B
                    data[i + 3] = 255;                       // A
                }
                ctx.putImageData(imageData, 0, 0);

                // Scanning line effect (green)
                ctx.fillStyle = 'rgba(0, 255, 65, 0.03)';
                const lineY = (Date.now() / 25) % h;
                ctx.fillRect(0, lineY, w, 3);

                // Slight green overlay
                ctx.fillStyle = 'rgba(0, 255, 65, 0.02)';
                ctx.fillRect(0, 0, w, h);
            };

            const animate = () => {
                if (!this._fullscreenActive && !document.getElementById(canvas.id)) return;
                drawNoise();
                const id = requestAnimationFrame(animate);
                this._noiseIntervals.push(id);
            };

            drawNoise();
            if (this._fullscreenActive || this._isLive) {
                const id = requestAnimationFrame(animate);
                this._noiseIntervals.push(id);
            }
        });
    },

    _startClock() {
        if (this._clockInterval) clearInterval(this._clockInterval);
        this._clockInterval = setInterval(() => {
            const now = new Date();
            const clockEl = document.getElementById('fs-clock');
            const trackTimeEl = document.getElementById('fs-track-time');
            const manualTimeEl = document.getElementById('fs-manual-time');
            
            const timeStr = now.toLocaleTimeString() + ' — ' + now.toLocaleDateString();
            if (clockEl) clockEl.textContent = timeStr;
            if (trackTimeEl) trackTimeEl.textContent = timeStr;
            if (manualTimeEl) manualTimeEl.textContent = now.toLocaleTimeString();
        }, 1000);
    },

    /* ==========================================================
       KEYBOARD NAVIGATION
       ========================================================== */
    _handleKeyDown(e) {
        if (!this._fullscreenActive) return;

        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                if (this._currentState === 'MANUAL_FULLSCREEN') {
                    this.closeManualFullscreen();
                } else {
                    this.exitFullscreen();
                }
                break;
            case 'ArrowLeft':
                if (this._currentState === 'NORMAL') {
                    e.preventDefault();
                    this.prevPage();
                }
                break;
            case 'ArrowRight':
                if (this._currentState === 'NORMAL') {
                    e.preventDefault();
                    this.nextPage();
                }
                break;
        }
    },

    /* ==========================================================
       INIT — Called by router after render
       ========================================================== */
    init() {
        // Keyboard handler
        this._escHandler = (e) => this._handleKeyDown(e);
        document.addEventListener('keydown', this._escHandler);

        // Initialize noise canvases
        setTimeout(() => {
            this._initNoiseCanvases();
            if (this._fullscreenActive) {
                this._startClock();
                this._initMatrixRain();
            }
        }, 100);

        // Handle window resize for pagination recalculation
        this._resizeHandler = () => {
            if (this._fullscreenActive && this._currentState === 'NORMAL') {
                this._computeTilesPerPage();
            }
        };
        window.addEventListener('resize', this._resizeHandler);
    }
};

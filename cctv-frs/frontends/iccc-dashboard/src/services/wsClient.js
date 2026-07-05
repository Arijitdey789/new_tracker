/* ============================================================
   SENTINEL PRO — WebSocket Client (Real-time Tracking Events)
   ============================================================
   
   Connects to the async backend WebSocket server to receive:
   - tracking_start  → camera begins tracking a target
   - tracking_stop   → camera stops tracking
   - camera_status   → camera online/offline status changes
   
   Features:
   - Auto-reconnect with exponential backoff
   - Fallback simulation mode when no backend is available
   - Event dispatch to LiveCCTV state machine
   ============================================================ */

const SentinelWS = {
    // ---- Configuration ----
    // Connect to the BFF WebSocket relay endpoint (iccc-bff → event queue → dashboard)
    // Falls back to SentinelEndpoints.WS_EVENTS_URL if defined in config/endpoints.js
    _wsUrl: (typeof SentinelEndpoints !== 'undefined' && SentinelEndpoints.WS_EVENTS_URL)
            || 'ws://localhost:8000/ws/events',
    _socket: null,
    _connected: false,
    _reconnectAttempts: 0,
    _maxReconnectAttempts: 15,
    _baseDelay: 1000,        // 1 second initial backoff
    _maxDelay: 30000,        // 30 second max backoff
    _reconnectTimer: null,
    _simulationMode: false,
    _simulationIntervals: [],
    _eventListeners: {},      // event name → [callbacks]

    /* ==========================================================
       PUBLIC API
       ========================================================== */

    /**
     * Initialize WebSocket connection or fallback to simulation
     */
    init() {
        this._tryConnect();
    },

    /**
     * Register an event listener
     * @param {string} eventType - 'tracking_start', 'tracking_stop', 'camera_status'
     * @param {Function} callback - Handler function receiving the event data
     */
    on(eventType, callback) {
        if (!this._eventListeners[eventType]) {
            this._eventListeners[eventType] = [];
        }
        this._eventListeners[eventType].push(callback);
    },

    /**
     * Remove an event listener
     */
    off(eventType, callback) {
        if (this._eventListeners[eventType]) {
            this._eventListeners[eventType] = this._eventListeners[eventType]
                .filter(cb => cb !== callback);
        }
    },

    /**
     * Check if connected to real backend
     */
    isConnected() {
        return this._connected;
    },

    /**
     * Check if running in simulation mode
     */
    isSimulating() {
        return this._simulationMode;
    },

    /**
     * Send a command to the backend (e.g., request tracking)
     */
    send(data) {
        if (this._socket && this._socket.readyState === WebSocket.OPEN) {
            this._socket.send(JSON.stringify(data));
            return true;
        }
        return false;
    },

    /**
     * Start local simulation mode (no backend needed)
     * Generates random tracking_start / tracking_stop events
     */
    startSimulation() {
        if (this._simulationMode) return;
        this._simulationMode = true;
        this._stopReconnect();
        console.log(
            '%c[SentinelWS]%c Simulation mode activated — generating synthetic tracking events',
            'color: #00ff41; font-weight: bold;', 'color: #9ca3af;'
        );
        this._runSimulation();
    },

    /**
     * Stop simulation and any active connection
     */
    stopAll() {
        this._simulationMode = false;
        this._stopReconnect();
        this._clearSimulation();
        if (this._socket) {
            this._socket.close();
            this._socket = null;
        }
        this._connected = false;
    },

    /**
     * Destroy the client completely
     */
    destroy() {
        this.stopAll();
        this._eventListeners = {};
    },

    /* ==========================================================
       INTERNAL — WebSocket Connection
       ========================================================== */

    _tryConnect() {
        try {
            this._socket = new WebSocket(this._wsUrl);

            this._socket.onopen = () => {
                this._connected = true;
                this._reconnectAttempts = 0;
                this._simulationMode = false;
                this._clearSimulation();

                console.log(
                    '%c[SentinelWS]%c Connected to backend at %s',
                    'color: #00ff41; font-weight: bold;', 'color: #22c55e;', this._wsUrl
                );

                this._dispatch('connection', { status: 'connected' });
            };

            this._socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this._handleMessage(data);
                } catch (e) {
                    console.warn('[SentinelWS] Invalid message:', event.data);
                }
            };

            this._socket.onclose = (event) => {
                this._connected = false;
                console.log(
                    '%c[SentinelWS]%c Connection closed (code: %d)',
                    'color: #ffaa00; font-weight: bold;', 'color: #9ca3af;', event.code
                );
                this._dispatch('connection', { status: 'disconnected' });
                this._scheduleReconnect();
            };

            this._socket.onerror = (error) => {
                // Silently handle — onclose will fire next and handle reconnect
                this._connected = false;
            };

        } catch (e) {
            // WebSocket constructor failed — go to simulation after retries
            console.warn('[SentinelWS] Connection failed:', e.message);
            this._scheduleReconnect();
        }
    },

    _scheduleReconnect() {
        if (this._reconnectAttempts >= this._maxReconnectAttempts) {
            console.log(
                '%c[SentinelWS]%c Max reconnect attempts reached — switching to simulation mode',
                'color: #ff0040; font-weight: bold;', 'color: #9ca3af;'
            );
            this.startSimulation();
            return;
        }

        // Exponential backoff: delay = min(baseDelay * 2^attempts, maxDelay)
        const delay = Math.min(
            this._baseDelay * Math.pow(2, this._reconnectAttempts),
            this._maxDelay
        );
        this._reconnectAttempts++;

        console.log(
            '%c[SentinelWS]%c Reconnecting in %dms (attempt %d/%d)',
            'color: #ffaa00; font-weight: bold;', 'color: #9ca3af;',
            delay, this._reconnectAttempts, this._maxReconnectAttempts
        );

        this._reconnectTimer = setTimeout(() => {
            this._tryConnect();
        }, delay);
    },

    _stopReconnect() {
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
    },

    /* ==========================================================
       INTERNAL — Message Handling
       ========================================================== */

    _handleMessage(data) {
        const { type } = data;

        switch (type) {
            case 'tracking_start':
            case 'tracking_stop':
            case 'camera_status':
                this._dispatch(type, data);
                break;
            case 'ping':
                // Respond to server heartbeat
                this.send({ type: 'pong' });
                break;
            default:
                console.log('[SentinelWS] Unknown event type:', type);
        }
    },

    _dispatch(eventType, data) {
        const listeners = this._eventListeners[eventType];
        if (listeners) {
            listeners.forEach(cb => {
                try {
                    cb(data);
                } catch (e) {
                    console.error('[SentinelWS] Listener error:', e);
                }
            });
        }
    },

    /* ==========================================================
       INTERNAL — Simulation Mode
       Generates synthetic tracking events for demo/testing
       ========================================================== */

    _runSimulation() {
        const streams = SentinelStore.getStreams();
        if (streams.length === 0) return;

        // Track which cameras are currently "tracking" in simulation
        const activeTracking = new Set();

        // Random tracking event generator
        const generateEvent = () => {
            if (!this._simulationMode) return;

            const randomStream = streams[Math.floor(Math.random() * streams.length)];
            const cameraId = randomStream.id;

            if (activeTracking.has(cameraId)) {
                // Stop tracking this camera
                activeTracking.delete(cameraId);
                this._dispatch('tracking_stop', {
                    type: 'tracking_stop',
                    camera_id: cameraId,
                    target_id: 'TGT-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
                    timestamp: new Date().toISOString(),
                    simulated: true
                });
            } else {
                // Start tracking this camera
                activeTracking.add(cameraId);
                const targetId = 'TGT-' + Math.random().toString(36).substr(2, 6).toUpperCase();
                this._dispatch('tracking_start', {
                    type: 'tracking_start',
                    camera_id: cameraId,
                    target_id: targetId,
                    confidence: (60 + Math.floor(Math.random() * 35)) + '%',
                    coordinates: {
                        x: Math.floor(Math.random() * 1920),
                        y: Math.floor(Math.random() * 1080)
                    },
                    timestamp: new Date().toISOString(),
                    simulated: true
                });

                // Auto-stop after 6-15 seconds
                const stopDelay = 6000 + Math.floor(Math.random() * 9000);
                const stopTimer = setTimeout(() => {
                    if (!this._simulationMode) return;
                    if (activeTracking.has(cameraId)) {
                        activeTracking.delete(cameraId);
                        this._dispatch('tracking_stop', {
                            type: 'tracking_stop',
                            camera_id: cameraId,
                            target_id: targetId,
                            timestamp: new Date().toISOString(),
                            simulated: true
                        });
                    }
                }, stopDelay);
                this._simulationIntervals.push(stopTimer);
            }
        };

        // Generate initial event after short delay
        const initialTimer = setTimeout(() => {
            generateEvent();
        }, 2000);
        this._simulationIntervals.push(initialTimer);

        // Generate events periodically (every 8-18 seconds)
        const scheduleNext = () => {
            if (!this._simulationMode) return;
            const delay = 8000 + Math.floor(Math.random() * 10000);
            const timer = setTimeout(() => {
                generateEvent();
                scheduleNext();
            }, delay);
            this._simulationIntervals.push(timer);
        };
        scheduleNext();

        // Also generate camera status events occasionally
        const statusTimer = setInterval(() => {
            if (!this._simulationMode) return;
            const randomStream = streams[Math.floor(Math.random() * streams.length)];
            // 90% chance online, 10% chance brief offline
            const status = Math.random() > 0.1 ? 'online' : 'offline';
            this._dispatch('camera_status', {
                type: 'camera_status',
                camera_id: randomStream.id,
                status: status,
                timestamp: new Date().toISOString(),
                simulated: true
            });

            // If went offline, come back online after 3-8 seconds
            if (status === 'offline') {
                const recoveryTimer = setTimeout(() => {
                    if (!this._simulationMode) return;
                    this._dispatch('camera_status', {
                        type: 'camera_status',
                        camera_id: randomStream.id,
                        status: 'online',
                        timestamp: new Date().toISOString(),
                        simulated: true
                    });
                }, 3000 + Math.floor(Math.random() * 5000));
                this._simulationIntervals.push(recoveryTimer);
            }
        }, 15000);
        this._simulationIntervals.push(statusTimer);
    },

    _clearSimulation() {
        this._simulationIntervals.forEach(id => {
            clearTimeout(id);
            clearInterval(id);
        });
        this._simulationIntervals = [];
    }
};

/* ============================================================
   SENTINEL PRO — Async WebSocket Backend Server
   
   Node.js async WebSocket server for real-time tracking events.
   Cross-platform compatible (Windows, Linux, macOS).
   
   Features:
   - WebSocket server pushing tracking_start/tracking_stop events
   - Independent async camera handlers (one failure doesn't block others)
   - Simulation mode for demo/testing without real cameras
   - Heartbeat/ping to detect dead connections
   - Cross-platform path handling
   
   USAGE:
     node src/utils/server.js
     node src/utils/server.js --port 8765
     node src/utils/server.js --simulate --cameras 12
   
   EVENT SCHEMA:
     { type: "tracking_start", camera_id, target_id, confidence, coordinates, timestamp }
     { type: "tracking_stop",  camera_id, target_id, timestamp }
     { type: "camera_status",  camera_id, status: "online"|"offline", timestamp }
   ============================================================ */

const http = require('http');
const path = require('path');
const fs = require('fs');

// ---- Configuration ----
const CONFIG = {
    port: parseInt(process.argv.find((a, i) => process.argv[i - 1] === '--port') || '8765'),
    simulate: process.argv.includes('--simulate') || true, // Default to simulation mode
    cameraCount: parseInt(process.argv.find((a, i) => process.argv[i - 1] === '--cameras') || '8'),
    heartbeatInterval: 30000,    // 30s heartbeat
    trackingMinDuration: 5000,   // Min tracking duration (ms)
    trackingMaxDuration: 20000,  // Max tracking duration (ms)
    eventMinInterval: 6000,      // Min time between events
    eventMaxInterval: 18000,     // Max time between events
    offlineChance: 0.05,         // 5% chance of camera going offline
    offlineRecovery: 5000,       // Recovery time from offline (ms)
};

// ---- Try to load 'ws' module, provide instructions if missing ----
let WebSocket;
let WebSocketServer;
try {
    const ws = require('ws');
    WebSocketServer = ws.WebSocketServer || ws.Server;
    WebSocket = ws;
} catch (e) {
    console.log('\n' + '='.repeat(60));
    console.log('  SENTINEL PRO — WebSocket Server');
    console.log('='.repeat(60));
    console.log('\n  The "ws" package is required but not installed.');
    console.log('  Install it with:\n');
    console.log('    npm install ws\n');
    console.log('  Then run this server again:\n');
    console.log('    node src/utils/server.js\n');
    console.log('='.repeat(60) + '\n');
    process.exit(1);
}

// ---- Simulated Camera Registry ----
class CameraSimulator {
    constructor(id, name, location) {
        this.id = id;
        this.name = name;
        this.location = location;
        this.status = 'online';       // 'online' | 'offline'
        this.isTracking = false;
        this.currentTargetId = null;
        this.timer = null;
    }

    /**
     * Generate a random target ID
     */
    static generateTargetId() {
        return 'TGT-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    /**
     * Generate random coordinates
     */
    static generateCoordinates() {
        return {
            x: Math.floor(Math.random() * 1920),
            y: Math.floor(Math.random() * 1080)
        };
    }

    /**
     * Generate random confidence value
     */
    static generateConfidence() {
        return (60 + Math.floor(Math.random() * 35)) + '%';
    }
}

// ---- Server ----
class SentinelServer {
    constructor() {
        this.clients = new Set();
        this.cameras = [];
        this.timers = [];
        this.heartbeatTimer = null;
        this.wss = null;
        this.httpServer = null;
    }

    /**
     * Start the server
     */
    start() {
        // Create HTTP server (can serve static files too)
        this.httpServer = http.createServer((req, res) => {
            // Simple health check endpoint
            if (req.url === '/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'ok',
                    cameras: this.cameras.length,
                    clients: this.clients.size,
                    uptime: process.uptime()
                }));
                return;
            }

            // API: List cameras
            if (req.url === '/api/cameras') {
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify(this.cameras.map(c => ({
                    id: c.id,
                    name: c.name,
                    location: c.location,
                    status: c.status,
                    isTracking: c.isTracking
                }))));
                return;
            }

            // Default response
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('SENTINEL PRO WebSocket Server\nConnect via ws://localhost:' + CONFIG.port);
        });

        // Create WebSocket server
        this.wss = new WebSocketServer({ server: this.httpServer });

        this.wss.on('connection', (ws, req) => {
            this.clients.add(ws);
            const clientIp = req.socket.remoteAddress;
            this._log(`Client connected from ${clientIp} (${this.clients.size} total)`);

            // Send initial camera status to new client
            this.cameras.forEach(cam => {
                this._sendTo(ws, {
                    type: 'camera_status',
                    camera_id: cam.id,
                    status: cam.status,
                    timestamp: new Date().toISOString()
                });

                // If camera is currently tracking, send tracking_start
                if (cam.isTracking) {
                    this._sendTo(ws, {
                        type: 'tracking_start',
                        camera_id: cam.id,
                        target_id: cam.currentTargetId,
                        confidence: CameraSimulator.generateConfidence(),
                        coordinates: CameraSimulator.generateCoordinates(),
                        timestamp: new Date().toISOString()
                    });
                }
            });

            // Handle client messages
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this._handleClientMessage(ws, data);
                } catch (e) {
                    this._log(`Invalid message from client: ${message}`);
                }
            });

            // Handle client disconnect
            ws.on('close', () => {
                this.clients.delete(ws);
                this._log(`Client disconnected (${this.clients.size} remaining)`);
            });

            ws.on('error', (err) => {
                this._log(`Client error: ${err.message}`);
                this.clients.delete(ws);
            });
        });

        // Start listening
        this.httpServer.listen(CONFIG.port, () => {
            this._printBanner();
            
            // Initialize cameras
            if (CONFIG.simulate) {
                this._initSimulatedCameras();
                this._startSimulation();
            }

            // Start heartbeat
            this._startHeartbeat();
        });
    }

    /**
     * Handle incoming client messages
     */
    _handleClientMessage(ws, data) {
        switch (data.type) {
            case 'pong':
                // Client responded to heartbeat
                ws.isAlive = true;
                break;
            case 'trigger_tracking':
                // Manual tracking trigger (for testing)
                if (data.camera_id) {
                    const cam = this.cameras.find(c => c.id === data.camera_id);
                    if (cam && !cam.isTracking) {
                        this._startTracking(cam);
                    }
                }
                break;
            case 'stop_tracking':
                // Manual tracking stop (for testing)
                if (data.camera_id) {
                    const cam = this.cameras.find(c => c.id === data.camera_id);
                    if (cam && cam.isTracking) {
                        this._stopTracking(cam);
                    }
                }
                break;
            default:
                this._log(`Unknown message type: ${data.type}`);
        }
    }

    /**
     * Initialize simulated cameras
     */
    _initSimulatedCameras() {
        const cameraNames = [
            { name: 'Main Entrance', location: 'Building A - Front Gate' },
            { name: 'Parking Lot A', location: 'Building A - East Side' },
            { name: 'Lobby Camera', location: 'Building A - Reception' },
            { name: 'Corridor B2', location: 'Building B - 2nd Floor' },
            { name: 'Server Room', location: 'Building C - Basement' },
            { name: 'Emergency Exit', location: 'Building A - West Wing' },
            { name: 'Rooftop', location: 'Building B - Roof Access' },
            { name: 'Loading Dock', location: 'Building C - Rear' },
            { name: 'Stairwell North', location: 'Building A - North' },
            { name: 'Conference Room', location: 'Building B - 3rd Floor' },
            { name: 'Cafeteria', location: 'Building A - Ground Floor' },
            { name: 'Storage Area', location: 'Building C - 1st Floor' },
            { name: 'Side Gate', location: 'Perimeter - South' },
            { name: 'Guard Post', location: 'Perimeter - Main Entry' },
            { name: 'Elevator Bay', location: 'Building B - All Floors' },
            { name: 'Lab Wing', location: 'Building C - 2nd Floor' },
        ];

        const count = Math.min(CONFIG.cameraCount, cameraNames.length);
        for (let i = 0; i < count; i++) {
            const camInfo = cameraNames[i];
            this.cameras.push(new CameraSimulator(
                `cam_${String(i + 1).padStart(2, '0')}`,
                camInfo.name,
                camInfo.location
            ));
        }

        this._log(`Initialized ${count} simulated cameras`);
    }

    /**
     * Start the simulation loop — each camera runs independently
     */
    _startSimulation() {
        this._log('Starting tracking event simulation...');

        // Each camera gets its own async event loop
        this.cameras.forEach(cam => {
            this._runCameraLoop(cam);
        });

        // Periodic status events (camera offline/online)
        const statusTimer = setInterval(() => {
            const cam = this.cameras[Math.floor(Math.random() * this.cameras.length)];
            if (Math.random() < CONFIG.offlineChance && cam.status === 'online' && !cam.isTracking) {
                this._setCameraOffline(cam);
            }
        }, 10000);
        this.timers.push(statusTimer);
    }

    /**
     * Independent async loop for each camera
     * Generates tracking events at random intervals
     */
    _runCameraLoop(cam) {
        const scheduleNext = () => {
            const delay = CONFIG.eventMinInterval + 
                Math.floor(Math.random() * (CONFIG.eventMaxInterval - CONFIG.eventMinInterval));
            
            const timer = setTimeout(() => {
                if (cam.status === 'offline') {
                    scheduleNext();
                    return;
                }

                if (!cam.isTracking && Math.random() > 0.4) {
                    this._startTracking(cam);
                }

                scheduleNext();
            }, delay);
            this.timers.push(timer);
        };

        // Stagger camera start times so events don't all fire at once
        const initialDelay = Math.floor(Math.random() * 10000) + 2000;
        const timer = setTimeout(scheduleNext, initialDelay);
        this.timers.push(timer);
    }

    /**
     * Start tracking on a camera
     */
    _startTracking(cam) {
        if (cam.isTracking || cam.status === 'offline') return;

        cam.isTracking = true;
        cam.currentTargetId = CameraSimulator.generateTargetId();

        const event = {
            type: 'tracking_start',
            camera_id: cam.id,
            target_id: cam.currentTargetId,
            confidence: CameraSimulator.generateConfidence(),
            coordinates: CameraSimulator.generateCoordinates(),
            timestamp: new Date().toISOString()
        };

        this._broadcast(event);
        this._log(`🔴 TRACKING START: ${cam.name} → ${cam.currentTargetId}`);

        // Auto-stop after random duration
        const duration = CONFIG.trackingMinDuration +
            Math.floor(Math.random() * (CONFIG.trackingMaxDuration - CONFIG.trackingMinDuration));
        
        cam.timer = setTimeout(() => {
            this._stopTracking(cam);
        }, duration);
        this.timers.push(cam.timer);
    }

    /**
     * Stop tracking on a camera
     */
    _stopTracking(cam) {
        if (!cam.isTracking) return;

        const event = {
            type: 'tracking_stop',
            camera_id: cam.id,
            target_id: cam.currentTargetId,
            timestamp: new Date().toISOString()
        };

        cam.isTracking = false;
        cam.currentTargetId = null;

        if (cam.timer) {
            clearTimeout(cam.timer);
            cam.timer = null;
        }

        this._broadcast(event);
        this._log(`🟢 TRACKING STOP: ${cam.name}`);
    }

    /**
     * Set camera offline temporarily
     */
    _setCameraOffline(cam) {
        cam.status = 'offline';
        this._broadcast({
            type: 'camera_status',
            camera_id: cam.id,
            status: 'offline',
            timestamp: new Date().toISOString()
        });
        this._log(`⚠️  CAMERA OFFLINE: ${cam.name}`);

        // Auto-recover
        const recovery = CONFIG.offlineRecovery + Math.floor(Math.random() * 5000);
        const timer = setTimeout(() => {
            cam.status = 'online';
            this._broadcast({
                type: 'camera_status',
                camera_id: cam.id,
                status: 'online',
                timestamp: new Date().toISOString()
            });
            this._log(`✅ CAMERA ONLINE: ${cam.name}`);
        }, recovery);
        this.timers.push(timer);
    }

    /**
     * Broadcast message to all connected clients
     */
    _broadcast(data) {
        const message = JSON.stringify(data);
        this.clients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
                client.send(message);
            }
        });
    }

    /**
     * Send message to a specific client
     */
    _sendTo(ws, data) {
        if (ws.readyState === 1) {
            ws.send(JSON.stringify(data));
        }
    }

    /**
     * Heartbeat to detect dead connections
     */
    _startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            this.clients.forEach(ws => {
                if (ws.isAlive === false) {
                    this._log('Terminating dead connection');
                    this.clients.delete(ws);
                    return ws.terminate();
                }
                ws.isAlive = false;
                this._sendTo(ws, { type: 'ping' });
            });
        }, CONFIG.heartbeatInterval);
    }

    /**
     * Logging with timestamp
     */
    _log(message) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`  [${timestamp}] ${message}`);
    }

    /**
     * Print startup banner
     */
    _printBanner() {
        console.log('');
        console.log('  ╔══════════════════════════════════════════════╗');
        console.log('  ║   SENTINEL PRO — WebSocket Server           ║');
        console.log('  ║   Real-time Tracking Event Engine            ║');
        console.log('  ╠══════════════════════════════════════════════╣');
        console.log(`  ║   Port:     ${CONFIG.port}                            ║`);
        console.log(`  ║   Cameras:  ${this.cameras.length}                              ║`);
        console.log(`  ║   Mode:     ${CONFIG.simulate ? 'Simulation' : 'Live'}                       ║`);
        console.log(`  ║   OS:       ${process.platform}                         ║`);
        console.log('  ╠══════════════════════════════════════════════╣');
        console.log(`  ║   WS URL:   ws://localhost:${CONFIG.port}              ║`);
        console.log(`  ║   Health:   http://localhost:${CONFIG.port}/health      ║`);
        console.log(`  ║   API:      http://localhost:${CONFIG.port}/api/cameras ║`);
        console.log('  ╚══════════════════════════════════════════════╝');
        console.log('');
        console.log('  Press Ctrl+C to stop the server.\n');
    }

    /**
     * Graceful shutdown
     */
    shutdown() {
        this._log('Shutting down...');
        
        // Clear all timers
        this.timers.forEach(t => {
            clearTimeout(t);
            clearInterval(t);
        });
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

        // Close all client connections
        this.clients.forEach(ws => ws.close());

        // Close servers
        if (this.wss) this.wss.close();
        if (this.httpServer) this.httpServer.close();

        this._log('Server stopped.');
        process.exit(0);
    }
}

// ---- Start Server ----
const server = new SentinelServer();

// Graceful shutdown handlers (cross-platform)
process.on('SIGINT', () => server.shutdown());
process.on('SIGTERM', () => server.shutdown());

// Windows-specific graceful shutdown
if (process.platform === 'win32') {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.on('SIGINT', () => process.emit('SIGINT'));
}

server.start();

/* ============================================================
   SENTINEL PRO — Environment-Specific Endpoint Configuration
   ============================================================
   
   Central configuration for all backend endpoints.
   The ICCC Dashboard frontend communicates ONLY with the
   iccc-bff service. All other services are internal.
   
   To override for production, replace this file at deploy time
   or inject via environment-specific config volume.
   ============================================================ */

const SentinelEndpoints = {
    // BFF base URL — the only backend the dashboard talks to
    BFF_BASE_URL: '',

    // WebSocket endpoint for real-time match events (via BFF)
    WS_EVENTS_URL: (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/ws/events',

    // WebSocket endpoint for the Node.js simulation server (dev/demo only)
    WS_SIMULATION_URL: (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.hostname + ':8765',

    // MJPEG live feed endpoint (proxied via BFF)
    MJPEG_FEED_URL: '/api/v1/feed/stream',
};

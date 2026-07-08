/* ============================================================
   SENTINEL PRO — Centralized API Client for ICCC BFF
   ============================================================
   
   All HTTP requests from the ICCC Dashboard frontend go through
   this module. It communicates exclusively with the iccc-bff
   backend service — never directly with core domain services.
   
   The BFF endpoint is configured via config/endpoints.js.
   ============================================================ */

const SentinelAPI = {
    _baseUrl: (typeof SentinelEndpoints !== 'undefined' && SentinelEndpoints.BFF_BASE_URL) !== undefined
              ? SentinelEndpoints.BFF_BASE_URL : '',

    /**
     * Generic fetch wrapper with auth headers and error handling.
     */
    async _request(method, path, body = null) {
        const headers = { 'Accept': 'application/json' };
        const session = typeof SentinelAuth !== 'undefined' ? SentinelAuth.getSession() : null;

        if (session && session.token) {
            headers['Authorization'] = `Bearer ${session.token}`;
        }

        const options = { method, headers };

        if (body) {
            if (body instanceof FormData) {
                options.body = body;
            } else {
                headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(body);
            }
        }

        try {
            const response = await fetch(`${this._baseUrl}${path}`, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`[SentinelAPI] ${method} ${path} failed:`, error.message);
            throw error;
        }
    },

    /* ==========================================================
       Watchlist / Target Enrollment (proxied via BFF)
       ========================================================== */

    async enrollTarget(formData) {
        return this._request('POST', '/api/v1/watchlist/enroll', formData);
    },

    async getTargets() {
        return this._request('GET', '/api/v1/watchlist/targets');
    },

    async removeTarget(targetId) {
        return this._request('DELETE', `/api/v1/watchlist/targets/${targetId}`);
    },

    /* ==========================================================
       Edge Inference / Camera Control
       Backend router: /api/v1/feed/* (edge-inference router prefix)
       NOTE: source is passed as a query param, not a JSON body.
       ========================================================== */

    /**
     * Start the camera capture pipeline.
     * @param {string} source - RTSP URL, webcam index ("0"), or file path.
     * @param {string} cameraId - Camera identifier
     */
    async startCamera(source, cameraId = "cam-0") {
        const url = `/api/v1/feed/start?source=${encodeURIComponent(source)}&camera_id=${encodeURIComponent(cameraId)}`;
        return this._request('POST', url);
    },

    /**
     * Stop the camera capture pipeline.
     */
    async stopCamera(cameraId = "cam-0") {
        return this._request('POST', `/api/v1/feed/stop?camera_id=${encodeURIComponent(cameraId)}`);
    },

    /**
     * Set the match similarity threshold (0.0 – 1.0).
     * @param {number} threshold - Value between 0.0 and 1.0.
     */
    async setThreshold(threshold, cameraId = "cam-0") {
        const url = `/api/v1/feed/threshold?value=${encodeURIComponent(threshold)}&camera_id=${encodeURIComponent(cameraId)}`;
        return this._request('POST', url);
    },

    /**
     * Get the current pipeline status.
     */
    async getFeedStatus(cameraId = "cam-0") {
        return this._request('GET', `/api/v1/feed/status?camera_id=${encodeURIComponent(cameraId)}`);
    },

    /**
     * Returns the full URL for the MJPEG live stream img src.
     * Must be called after startCamera() succeeds.
     */
    getMjpegFeedUrl(cameraId = "cam-0") {
        return `${this._baseUrl}/api/v1/feed/stream?camera_id=${encodeURIComponent(cameraId)}`;
    },

    /* ==========================================================
       Dashboard State
       ========================================================== */

    async getSystemStatus() {
        return this._request('GET', '/api/v1/feed/status');
    }
};

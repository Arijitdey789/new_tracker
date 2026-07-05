/* ============================================================
   SENTINEL PRO — Data Store (localStorage Persistence)
   ============================================================ */

const SentinelStore = {
    _prefix: 'sentinel_',

    /**
     * Get item from localStorage
     */
    _get(key) {
        try {
            const data = localStorage.getItem(this._prefix + key);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    },

    /**
     * Set item in localStorage
     */
    _set(key, value) {
        try {
            localStorage.setItem(this._prefix + key, JSON.stringify(value));
        } catch (e) {
            console.error('Storage error:', e);
        }
    },

    /**
     * Remove item
     */
    _remove(key) {
        localStorage.removeItem(this._prefix + key);
    },

    // ---- Users ----

    getUsers() {
        return this._get('users') || [];
    },

    addUser(user) {
        const users = this.getUsers();
        user.id = SentinelHelpers.generateId();
        user.createdAt = new Date().toISOString();
        user.status = 'active';
        users.push(user);
        this._set('users', users);
        return user;
    },

    updateUser(id, updates) {
        const users = this.getUsers();
        const idx = users.findIndex(u => u.id === id);
        if (idx !== -1) {
            users[idx] = { ...users[idx], ...updates };
            this._set('users', users);
            return users[idx];
        }
        return null;
    },

    deleteUser(id) {
        const users = this.getUsers().filter(u => u.id !== id);
        this._set('users', users);
    },

    getUserByEmail(email) {
        return this.getUsers().find(u => u.email === email);
    },

    // ---- Streams ----

    getStreams() {
        return this._get('streams') || [];
    },

    addStream(stream) {
        const streams = this.getStreams();
        stream.id = SentinelHelpers.generateId();
        stream.createdAt = new Date().toISOString();
        stream.status = 'active';
        streams.push(stream);
        this._set('streams', streams);
        return stream;
    },

    deleteStream(id) {
        const streams = this.getStreams().filter(s => s.id !== id);
        this._set('streams', streams);
    },

    // ---- Saved Stream URLs ----

    getSavedStreams() {
        return this._get('saved_streams') || [];
    },

    saveStreamUrl(stream) {
        const saved = this.getSavedStreams();
        const existing = saved.find(s => s.url === stream.url);
        if (!existing) {
            stream.id = SentinelHelpers.generateId();
            stream.savedAt = new Date().toISOString();
            saved.push(stream);
            this._set('saved_streams', saved);
        }
        return stream;
    },

    deleteSavedStream(id) {
        const saved = this.getSavedStreams().filter(s => s.id !== id);
        this._set('saved_streams', saved);
    },

    // ---- Evidence Vault ----

    getEvidence() {
        return this._get('evidence') || [];
    },

    addEvidence(evidence) {
        const items = this.getEvidence();
        evidence.id = SentinelHelpers.generateId();
        evidence.createdAt = new Date().toISOString();
        items.push(evidence);
        this._set('evidence', items);
        return evidence;
    },

    deleteEvidence(id) {
        const items = this.getEvidence().filter(e => e.id !== id);
        this._set('evidence', items);
    },

    resetEvidence() {
        this._set('evidence', []);
    },

    // ---- Detection Alerts ----

    getAlerts() {
        return this._get('alerts') || [];
    },

    addAlert(alert) {
        const alerts = this.getAlerts();
        alert.id = SentinelHelpers.generateId();
        alert.timestamp = new Date().toISOString();
        alerts.unshift(alert); // Most recent first
        // Keep last 100 alerts
        if (alerts.length > 100) alerts.length = 100;
        this._set('alerts', alerts);
        return alert;
    },

    clearAlerts() {
        this._set('alerts', []);
    },

    // ---- Activity Log ----

    getActivityLog() {
        return this._get('activity_log') || [];
    },

    addActivity(activity) {
        const log = this.getActivityLog();
        activity.id = SentinelHelpers.generateId();
        activity.timestamp = new Date().toISOString();
        log.unshift(activity);
        if (log.length > 200) log.length = 200;
        this._set('activity_log', log);
        return activity;
    },

    // ---- Settings ----

    getSettings() {
        return this._get('settings') || {
            theme: 'dark',
            notifications: true,
            autoSaveStreams: true,
            defaultDetectionMode: 'hybrid',
            defaultThreshold: 50,
            systemName: 'SENTINEL PRO',
            version: '1.0.0'
        };
    },

    updateSettings(updates) {
        const settings = { ...this.getSettings(), ...updates };
        this._set('settings', settings);
        return settings;
    },

    // ---- Stream Favorites & Grouping ----

    toggleStreamFavorite(id) {
        const saved = this.getSavedStreams();
        const stream = saved.find(s => s.id === id);
        if (stream) {
            stream.favorite = !stream.favorite;
            this._set('saved_streams', saved);
        }
    },

    getFavoriteStreams() {
        return this.getSavedStreams().filter(s => s.favorite);
    },

    getRecentStreams(limit = 10) {
        return this.getSavedStreams()
            .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
            .slice(0, limit);
    },

    getStreamsByGroup() {
        const streams = this.getSavedStreams();
        const groups = {};
        streams.forEach(s => {
            const group = s.location || 'Ungrouped';
            if (!groups[group]) groups[group] = [];
            groups[group].push(s);
        });
        return groups;
    },

    // ---- Stats ----

    getStats() {
        const users = this.getUsers();
        const streams = this.getStreams();
        const evidence = this.getEvidence();
        const alerts = this.getAlerts();

        return {
            totalUsers: users.length,
            activeUsers: users.filter(u => u.status === 'active').length,
            totalStreams: streams.length,
            totalEvidence: evidence.length,
            totalAlerts: alerts.length,
            todayAlerts: alerts.filter(a => {
                const today = new Date().toDateString();
                return new Date(a.timestamp).toDateString() === today;
            }).length
        };
    },

    // ---- Initialize Default Data ----

    initializeDefaultData() {
        // Only initialize if no users exist
        if (this.getUsers().length === 0) {
            // Add some sample activity
            this.addActivity({ type: 'system', message: 'System initialized', color: 'blue' });
            this.addActivity({ type: 'system', message: 'Default admin account created', color: 'green' });
        }
    }
};

// Initialize on load
SentinelStore.initializeDefaultData();

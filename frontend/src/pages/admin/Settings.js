/* ============================================================
   SENTINEL PRO — Settings Page (Admin)
   ============================================================ */

const SettingsPage = {
    render() {
        const settings = SentinelStore.getSettings();
        const currentTheme = SentinelTheme.get();

        return `
            <div class="panel-layout">
                ${AdminSidebar.render('settings')}
                <main class="panel-content">
                    <div class="page-header">
                        <div>
                            <h1 class="page-title">Settings</h1>
                            <p class="page-subtitle">System configuration and preferences</p>
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-4);">

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title"><i data-lucide="palette" style="width:18px;height:18px;display:inline;vertical-align:middle;margin-right:8px;"></i>Appearance</h3>
                            </div>
                            <div style="display:flex;flex-direction:column;gap:var(--sp-4);">
                                <div style="display:flex;align-items:center;justify-content:space-between;">
                                    <div>
                                        <div style="font-size:var(--fs-sm);font-weight:var(--fw-medium);color:var(--text-primary);">Theme Mode</div>
                                        <div style="font-size:var(--fs-xs);color:var(--text-tertiary);">Switch between dark and light mode</div>
                                    </div>
                                    <div style="display:flex;gap:var(--sp-2);">
                                        <button class="btn btn-sm ${currentTheme === 'dark' ? 'btn-blue' : 'btn-ghost'}" onclick="SettingsPage.setTheme('dark')">
                                            <i data-lucide="moon" style="width:14px;height:14px;"></i> Dark
                                        </button>
                                        <button class="btn btn-sm ${currentTheme === 'light' ? 'btn-blue' : 'btn-ghost'}" onclick="SettingsPage.setTheme('light')">
                                            <i data-lucide="sun" style="width:14px;height:14px;"></i> Light
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title"><i data-lucide="bell" style="width:18px;height:18px;display:inline;vertical-align:middle;margin-right:8px;"></i>Notifications</h3>
                            </div>
                            <div style="display:flex;flex-direction:column;gap:var(--sp-4);">
                                <div style="display:flex;align-items:center;justify-content:space-between;">
                                    <div>
                                        <div style="font-size:var(--fs-sm);font-weight:var(--fw-medium);color:var(--text-primary);">Detection Alerts</div>
                                        <div style="font-size:var(--fs-xs);color:var(--text-tertiary);">Show toast notifications on detection</div>
                                    </div>
                                    <label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;">
                                        <input type="checkbox" ${settings.notifications ? 'checked' : ''} onchange="SettingsPage.updateSetting('notifications', this.checked)" style="opacity:0;width:0;height:0;">
                                        <span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:${settings.notifications ? 'var(--accent-blue)' : 'var(--bg-tertiary)'};border-radius:24px;transition:0.3s;"></span>
                                        <span style="position:absolute;content:'';height:18px;width:18px;left:${settings.notifications ? '22px' : '3px'};bottom:3px;background:white;border-radius:50%;transition:0.3s;"></span>
                                    </label>
                                </div>
                                <div style="display:flex;align-items:center;justify-content:space-between;">
                                    <div>
                                        <div style="font-size:var(--fs-sm);font-weight:var(--fw-medium);color:var(--text-primary);">Auto-Save Streams</div>
                                        <div style="font-size:var(--fs-xs);color:var(--text-tertiary);">Automatically save stream URLs</div>
                                    </div>
                                    <label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;">
                                        <input type="checkbox" ${settings.autoSaveStreams ? 'checked' : ''} onchange="SettingsPage.updateSetting('autoSaveStreams', this.checked)" style="opacity:0;width:0;height:0;">
                                        <span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:${settings.autoSaveStreams ? 'var(--accent-blue)' : 'var(--bg-tertiary)'};border-radius:24px;transition:0.3s;"></span>
                                        <span style="position:absolute;content:'';height:18px;width:18px;left:${settings.autoSaveStreams ? '22px' : '3px'};bottom:3px;background:white;border-radius:50%;transition:0.3s;"></span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title"><i data-lucide="scan-face" style="width:18px;height:18px;display:inline;vertical-align:middle;margin-right:8px;"></i>Detection Defaults</h3>
                            </div>
                            <div style="display:flex;flex-direction:column;gap:var(--sp-4);">
                                <div class="form-group">
                                    <label class="form-label">Default Detection Mode</label>
                                    <select class="form-select" id="settings-detection-mode" onchange="SettingsPage.updateSetting('defaultDetectionMode', this.value)">
                                        <option value="face" ${settings.defaultDetectionMode === 'face' ? 'selected' : ''}>Face</option>
                                        <option value="body" ${settings.defaultDetectionMode === 'body' ? 'selected' : ''}>Body</option>
                                        <option value="hybrid" ${settings.defaultDetectionMode === 'hybrid' ? 'selected' : ''}>Hybrid</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Default Threshold (${settings.defaultThreshold}%)</label>
                                    <input type="range" class="threshold-slider" min="10" max="100" value="${settings.defaultThreshold}" oninput="SettingsPage.updateThreshold(this.value)">
                                    <div class="threshold-labels">
                                        <span ${settings.defaultThreshold < 35 ? 'class="active"' : ''}>Low</span>
                                        <span ${settings.defaultThreshold >= 35 && settings.defaultThreshold <= 70 ? 'class="active"' : ''}>Medium</span>
                                        <span ${settings.defaultThreshold > 70 ? 'class="active"' : ''}>High</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title"><i data-lucide="database" style="width:18px;height:18px;display:inline;vertical-align:middle;margin-right:8px;"></i>Data Management</h3>
                            </div>
                            <div style="display:flex;flex-direction:column;gap:var(--sp-3);">
                                <button class="btn btn-ghost" style="justify-content:flex-start;" onclick="SettingsPage.exportAllData()">
                                    <i data-lucide="download"></i>
                                    Export All Data (JSON)
                                </button>
                                <button class="btn btn-ghost" style="justify-content:flex-start;" onclick="SettingsPage.clearEvidence()">
                                    <i data-lucide="trash-2"></i>
                                    Clear Evidence Vault
                                </button>
                                <button class="btn btn-ghost" style="justify-content:flex-start;" onclick="SettingsPage.clearStreams()">
                                    <i data-lucide="video-off"></i>
                                    Clear All Streams
                                </button>
                                <div class="divider"></div>
                                <button class="btn btn-outline-red" style="justify-content:flex-start;" onclick="SettingsPage.factoryReset()">
                                    <i data-lucide="alert-triangle"></i>
                                    Factory Reset
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="card" style="margin-top:var(--sp-4);">
                        <div class="card-header">
                            <h3 class="card-title"><i data-lucide="info" style="width:18px;height:18px;display:inline;vertical-align:middle;margin-right:8px;"></i>About</h3>
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--sp-4);">
                            <div>
                                <div style="font-size:var(--fs-xs);color:var(--text-tertiary);margin-bottom:2px;">Application</div>
                                <div style="font-size:var(--fs-sm);font-weight:var(--fw-medium);color:var(--text-primary);">${settings.systemName}</div>
                            </div>
                            <div>
                                <div style="font-size:var(--fs-xs);color:var(--text-tertiary);margin-bottom:2px;">Version</div>
                                <div style="font-size:var(--fs-sm);font-weight:var(--fw-medium);color:var(--text-primary);">${settings.version}</div>
                            </div>
                            <div>
                                <div style="font-size:var(--fs-xs);color:var(--text-tertiary);margin-bottom:2px;">Platform</div>
                                <div style="font-size:var(--fs-sm);font-weight:var(--fw-medium);color:var(--text-primary);">Web Application</div>
                            </div>
                            <div>
                                <div style="font-size:var(--fs-xs);color:var(--text-tertiary);margin-bottom:2px;">License</div>
                                <div style="font-size:var(--fs-sm);font-weight:var(--fw-medium);color:var(--text-primary);">Enterprise</div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        `;
    },

    setTheme(theme) {
        SentinelTheme.apply(theme);
        SentinelStore.updateSettings({ theme });
        SentinelRouter.navigate(location.hash);
    },

    updateSetting(key, value) {
        SentinelStore.updateSettings({ [key]: value });
        SentinelToast.success('Setting Updated', `${key} has been updated.`);
    },

    updateThreshold(value) {
        SentinelStore.updateSettings({ defaultThreshold: parseInt(value) });
        // Update label
        const label = document.querySelector('.form-label[for]') || document.querySelector(`label.form-label:last-of-type`);
        // Re-render just the threshold section via full page refresh would be too heavy
        // Instead update inline
    },

    exportAllData() {
        const data = {
            users: SentinelStore.getUsers(),
            streams: SentinelStore.getStreams(),
            evidence: SentinelStore.getEvidence(),
            alerts: SentinelStore.getAlerts(),
            activityLog: SentinelStore.getActivityLog(),
            settings: SentinelStore.getSettings(),
            exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sentinel_backup_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);

        SentinelToast.success('Export Complete', 'All system data exported as JSON.');
    },

    clearEvidence() {
        SentinelModal.confirm({
            title: 'Clear Evidence Vault',
            message: 'This will permanently delete all evidence files and reports. Continue?',
            confirmLabel: 'Clear Evidence',
            danger: true,
            onConfirm: () => {
                SentinelStore.resetEvidence();
                SentinelModal.close();
                SentinelToast.success('Evidence Cleared', 'All evidence files have been removed.');
            }
        });
    },

    clearStreams() {
        SentinelModal.confirm({
            title: 'Clear All Streams',
            message: 'This will remove all configured camera streams. Continue?',
            confirmLabel: 'Clear Streams',
            danger: true,
            onConfirm: () => {
                SentinelStore._set('streams', []);
                SentinelStore._set('saved_streams', []);
                SentinelModal.close();
                SentinelToast.success('Streams Cleared', 'All stream configurations removed.');
            }
        });
    },

    factoryReset() {
        SentinelModal.confirm({
            title: 'Factory Reset',
            message: 'WARNING: This will delete ALL data including users, streams, evidence, and settings. This action is irreversible.',
            confirmLabel: 'Reset Everything',
            danger: true,
            onConfirm: () => {
                // Clear all sentinel_ prefixed items
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('sentinel_')) {
                        localStorage.removeItem(key);
                    }
                });
                localStorage.removeItem('sentinel_session');
                SentinelModal.close();
                SentinelToast.info('Factory Reset', 'All data has been cleared.');
                setTimeout(() => { location.hash = '#/'; location.reload(); }, 1000);
            }
        });
    },

    init() {}
};

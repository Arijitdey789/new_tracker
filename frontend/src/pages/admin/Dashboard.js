/* ============================================================
   SENTINEL PRO — Admin Dashboard
   ============================================================ */

const AdminDashboard = {
    render() {
        const stats = SentinelStore.getStats();
        const activities = SentinelStore.getActivityLog().slice(0, 8);

        return `
            <div class="panel-layout">
                ${AdminSidebar.render('dashboard')}
                <main class="panel-content">
                    <div class="page-header">
                        <div>
                            <h1 class="page-title">Dashboard</h1>
                            <p class="page-subtitle">System overview and key performance indicators</p>
                        </div>
                        <div class="page-actions">
                            <span class="badge badge-green"><i data-lucide="wifi" style="width:12px;height:12px;"></i> System Online</span>
                        </div>
                    </div>

                    <div class="kpi-grid">
                        <div class="kpi-card">
                            <div class="kpi-header">
                                <div class="kpi-icon blue">
                                    <i data-lucide="users"></i>
                                </div>
                                <div class="kpi-trend up">
                                    <i data-lucide="trending-up" style="width:14px;height:14px;"></i> Active
                                </div>
                            </div>
                            <div class="kpi-value">${stats.totalUsers}</div>
                            <div class="kpi-label">Total Users</div>
                        </div>

                        <div class="kpi-card">
                            <div class="kpi-header">
                                <div class="kpi-icon green">
                                    <i data-lucide="video"></i>
                                </div>
                                <div class="kpi-trend up">
                                    <i data-lucide="trending-up" style="width:14px;height:14px;"></i> Live
                                </div>
                            </div>
                            <div class="kpi-value">${stats.totalStreams}</div>
                            <div class="kpi-label">Active Streams</div>
                        </div>

                        <div class="kpi-card">
                            <div class="kpi-header">
                                <div class="kpi-icon amber">
                                    <i data-lucide="bell-ring"></i>
                                </div>
                                <span class="badge badge-amber">${stats.todayAlerts} Today</span>
                            </div>
                            <div class="kpi-value">${stats.totalAlerts}</div>
                            <div class="kpi-label">Total Detections</div>
                        </div>

                        <div class="kpi-card">
                            <div class="kpi-header">
                                <div class="kpi-icon purple">
                                    <i data-lucide="archive"></i>
                                </div>
                            </div>
                            <div class="kpi-value">${stats.totalEvidence}</div>
                            <div class="kpi-label">Evidence Files</div>
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-4);">
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Detection Trends</h3>
                                <span class="badge badge-blue">Last 7 Days</span>
                            </div>
                            <canvas id="trend-chart" style="width:100%;height:200px;"></canvas>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Recent Activity</h3>
                                <button class="btn btn-ghost btn-sm" onclick="location.hash='#/admin/history'">
                                    View All <i data-lucide="arrow-right" style="width:14px;height:14px;"></i>
                                </button>
                            </div>
                            <div class="activity-feed">
                                ${activities.length > 0 ? activities.map(a => `
                                    <div class="activity-item">
                                        <div class="activity-dot ${a.color || 'blue'}"></div>
                                        <div class="activity-text">${SentinelHelpers.escapeHtml(a.message)}</div>
                                        <div class="activity-time">${SentinelHelpers.timeAgo(a.timestamp)}</div>
                                    </div>
                                `).join('') : `
                                    <div class="empty-state" style="padding:var(--sp-8)">
                                        <i data-lucide="inbox" style="width:32px;height:32px;"></i>
                                        <p class="empty-state-text">No recent activity</p>
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-4);margin-top:var(--sp-4);">
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Quick Actions</h3>
                            </div>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3)">
                                <button class="btn btn-ghost" onclick="location.hash='#/admin/users'" style="height:60px;flex-direction:column;gap:4px;font-size:var(--fs-sm);">
                                    <i data-lucide="user-plus" style="width:20px;height:20px;"></i>
                                    Add User
                                </button>
                                <button class="btn btn-ghost" onclick="location.hash='#/admin/reports'" style="height:60px;flex-direction:column;gap:4px;font-size:var(--fs-sm);">
                                    <i data-lucide="bar-chart-3" style="width:20px;height:20px;"></i>
                                    View Reports
                                </button>
                                <button class="btn btn-ghost" onclick="location.hash='#/admin/history'" style="height:60px;flex-direction:column;gap:4px;font-size:var(--fs-sm);">
                                    <i data-lucide="clock" style="width:20px;height:20px;"></i>
                                    History
                                </button>
                                <button class="btn btn-ghost" onclick="location.hash='#/admin/settings'" style="height:60px;flex-direction:column;gap:4px;font-size:var(--fs-sm);">
                                    <i data-lucide="settings" style="width:20px;height:20px;"></i>
                                    Settings
                                </button>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">System Status</h3>
                                <span class="badge badge-green">Operational</span>
                            </div>
                            <div style="display:flex;flex-direction:column;gap:var(--sp-3)">
                                <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--sp-2) 0;">
                                    <div style="display:flex;align-items:center;gap:var(--sp-2);">
                                        <span class="status-dot online"></span>
                                        <span style="font-size:var(--fs-sm);color:var(--text-secondary);">AI Detection Engine</span>
                                    </div>
                                    <span class="badge badge-green">Active</span>
                                </div>
                                <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--sp-2) 0;">
                                    <div style="display:flex;align-items:center;gap:var(--sp-2);">
                                        <span class="status-dot online"></span>
                                        <span style="font-size:var(--fs-sm);color:var(--text-secondary);">Stream Manager</span>
                                    </div>
                                    <span class="badge badge-green">Active</span>
                                </div>
                                <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--sp-2) 0;">
                                    <div style="display:flex;align-items:center;gap:var(--sp-2);">
                                        <span class="status-dot online"></span>
                                        <span style="font-size:var(--fs-sm);color:var(--text-secondary);">Evidence Storage</span>
                                    </div>
                                    <span class="badge badge-green">Active</span>
                                </div>
                                <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--sp-2) 0;">
                                    <div style="display:flex;align-items:center;gap:var(--sp-2);">
                                        <span class="status-dot online"></span>
                                        <span style="font-size:var(--fs-sm);color:var(--text-secondary);">Report Generator</span>
                                    </div>
                                    <span class="badge badge-green">Active</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        `;
    },

    init() {
        // Render chart
        setTimeout(() => {
            const canvas = document.getElementById('trend-chart');
            if (canvas) {
                const data = [12, 19, 8, 25, 15, 22, 18];
                const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                SentinelHelpers.renderBarChart(canvas, data, labels, '#3b82f6');
            }
        }, 100);
    }
};

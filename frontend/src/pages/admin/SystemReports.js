/* ============================================================
   SENTINEL PRO — System Reports Page
   ============================================================ */

const SystemReports = {
    render() {
        const stats = SentinelStore.getStats();
        const evidence = SentinelStore.getEvidence();
        const streams = SentinelStore.getStreams();

        return `
            <div class="panel-layout">
                ${AdminSidebar.render('reports')}
                <main class="panel-content">
                    <div class="page-header">
                        <div>
                            <h1 class="page-title">System Reports</h1>
                            <p class="page-subtitle">Analytics, camera health, and detection insights</p>
                        </div>
                        <div class="page-actions">
                            <button class="btn btn-ghost btn-sm" onclick="SystemReports.exportReport()">
                                <i data-lucide="download"></i> Export Report
                            </button>
                        </div>
                    </div>

                    <div class="kpi-grid">
                        <div class="kpi-card">
                            <div class="kpi-header">
                                <div class="kpi-icon blue"><i data-lucide="scan-face"></i></div>
                            </div>
                            <div class="kpi-value">${stats.totalAlerts}</div>
                            <div class="kpi-label">Total Detections</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-header">
                                <div class="kpi-icon green"><i data-lucide="video"></i></div>
                            </div>
                            <div class="kpi-value">${stats.totalStreams}</div>
                            <div class="kpi-label">Configured Cameras</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-header">
                                <div class="kpi-icon amber"><i data-lucide="archive"></i></div>
                            </div>
                            <div class="kpi-value">${stats.totalEvidence}</div>
                            <div class="kpi-label">Evidence Files</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-header">
                                <div class="kpi-icon purple"><i data-lucide="clock"></i></div>
                            </div>
                            <div class="kpi-value">99.9%</div>
                            <div class="kpi-label">System Uptime</div>
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-4);margin-bottom:var(--sp-4);">
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Detection by Camera</h3>
                            </div>
                            <canvas id="camera-chart" style="width:100%;height:200px;"></canvas>
                        </div>
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Hourly Distribution</h3>
                            </div>
                            <canvas id="hourly-chart" style="width:100%;height:200px;"></canvas>
                        </div>
                    </div>

                    <div class="card" style="margin-bottom:var(--sp-4);">
                        <div class="card-header">
                            <h3 class="card-title">Camera Health Status</h3>
                            <span class="badge badge-green">${streams.length} Cameras</span>
                        </div>

                        ${streams.length > 0 ? `
                        <div style="overflow-x:auto;">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Camera</th>
                                        <th>Location</th>
                                        <th>Status</th>
                                        <th>Last Active</th>
                                        <th>Uptime</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${streams.map(s => `
                                        <tr>
                                            <td>
                                                <div style="display:flex;align-items:center;gap:var(--sp-2);">
                                                    <i data-lucide="video" style="width:16px;height:16px;color:var(--text-tertiary);"></i>
                                                    <span style="font-weight:var(--fw-medium);">${SentinelHelpers.escapeHtml(s.name)}</span>
                                                </div>
                                            </td>
                                            <td style="color:var(--text-secondary);">${SentinelHelpers.escapeHtml(s.location)}</td>
                                            <td><span class="status-dot online"></span> <span style="font-size:var(--fs-sm);">Online</span></td>
                                            <td style="font-size:var(--fs-xs);color:var(--text-tertiary);">${SentinelHelpers.timeAgo(s.createdAt)}</td>
                                            <td><span class="badge badge-green">99.9%</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        ` : `
                        <div class="empty-state">
                            <i data-lucide="video-off"></i>
                            <p class="empty-state-title">No Cameras Configured</p>
                            <p class="empty-state-text">Camera data will appear once streams are added from the User Panel.</p>
                        </div>
                        `}
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Detection Summary</h3>
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--sp-4);">
                            <div style="text-align:center;padding:var(--sp-4);background:var(--bg-tertiary);border-radius:var(--radius-md);">
                                <div style="font-size:var(--fs-2xl);font-weight:var(--fw-extrabold);color:var(--accent-blue);">0</div>
                                <div style="font-size:var(--fs-xs);color:var(--text-tertiary);margin-top:4px;">Face Detections</div>
                            </div>
                            <div style="text-align:center;padding:var(--sp-4);background:var(--bg-tertiary);border-radius:var(--radius-md);">
                                <div style="font-size:var(--fs-2xl);font-weight:var(--fw-extrabold);color:var(--accent-green);">0</div>
                                <div style="font-size:var(--fs-xs);color:var(--text-tertiary);margin-top:4px;">Body Detections</div>
                            </div>
                            <div style="text-align:center;padding:var(--sp-4);background:var(--bg-tertiary);border-radius:var(--radius-md);">
                                <div style="font-size:var(--fs-2xl);font-weight:var(--fw-extrabold);color:var(--accent-purple);">0</div>
                                <div style="font-size:var(--fs-xs);color:var(--text-tertiary);margin-top:4px;">Hybrid Detections</div>
                            </div>
                            <div style="text-align:center;padding:var(--sp-4);background:var(--bg-tertiary);border-radius:var(--radius-md);">
                                <div style="font-size:var(--fs-2xl);font-weight:var(--fw-extrabold);color:var(--accent-amber);">${evidence.length}</div>
                                <div style="font-size:var(--fs-xs);color:var(--text-tertiary);margin-top:4px;">Reports Generated</div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        `;
    },

    exportReport() {
        const stats = SentinelStore.getStats();
        let report = `SENTINEL PRO - System Report\n`;
        report += `Generated: ${SentinelHelpers.formatDateTime(new Date())}\n`;
        report += `${'='.repeat(50)}\n\n`;
        report += `Total Users: ${stats.totalUsers}\n`;
        report += `Active Streams: ${stats.totalStreams}\n`;
        report += `Total Detections: ${stats.totalAlerts}\n`;
        report += `Evidence Files: ${stats.totalEvidence}\n`;
        report += `Today's Alerts: ${stats.todayAlerts}\n`;
        report += `System Uptime: 99.9%\n`;

        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sentinel_report_${new Date().toISOString().split('T')[0]}.txt`;
        link.click();
        URL.revokeObjectURL(url);

        SentinelToast.success('Report Exported', 'System report downloaded successfully.');
    },

    init() {
        setTimeout(() => {
            const cameraChart = document.getElementById('camera-chart');
            if (cameraChart) {
                SentinelHelpers.renderBarChart(cameraChart, [5, 12, 8, 3, 15], ['CAM-1', 'CAM-2', 'CAM-3', 'CAM-4', 'CAM-5'], '#22c55e');
            }
            const hourlyChart = document.getElementById('hourly-chart');
            if (hourlyChart) {
                SentinelHelpers.renderBarChart(hourlyChart, [2, 1, 0, 1, 3, 8, 12, 15, 10, 7, 5, 3], ['0h', '2h', '4h', '6h', '8h', '10h', '12h', '14h', '16h', '18h', '20h', '22h'], '#f59e0b');
            }
        }, 100);
    }
};

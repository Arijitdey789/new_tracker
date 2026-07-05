/* ============================================================
   SENTINEL PRO — Evidence Vault Module
   ============================================================ */

const EvidenceVault = {
    _activeTab: 'live',
    _searchTerm: '',

    render() {
        const allEvidence = SentinelStore.getEvidence();
        const liveEvidence = allEvidence.filter(e => e.type === 'live');
        const postEvidence = allEvidence.filter(e => e.type === 'post');

        const currentEvidence = this._activeTab === 'live' ? liveEvidence : postEvidence;
        const filtered = this._searchTerm
            ? currentEvidence.filter(e => (e.title || '').toLowerCase().includes(this._searchTerm.toLowerCase()))
            : currentEvidence;

        return `
            <div class="panel-layout">
                ${UserSidebar.render('evidence-vault')}
                <main class="panel-content">
                    <div class="page-header">
                        <div>
                            <h1 class="page-title">Evidence Vault</h1>
                            <p class="page-subtitle">Stored evidence clips and generated reports</p>
                        </div>
                        <div class="page-actions">
                            <button class="btn btn-outline-red btn-sm" onclick="EvidenceVault.resetAll()">
                                <i data-lucide="trash-2"></i> Reset All
                            </button>
                        </div>
                    </div>

                    <div class="tabs">
                        <button class="tab ${this._activeTab === 'live' ? 'active' : ''}" onclick="EvidenceVault.switchTab('live')">
                            <i data-lucide="video" style="width:16px;height:16px;"></i>
                            Live CCTV Reports
                            <span class="badge badge-blue">${liveEvidence.length}</span>
                        </button>
                        <button class="tab ${this._activeTab === 'post' ? 'active' : ''}" onclick="EvidenceVault.switchTab('post')">
                            <i data-lucide="film" style="width:16px;height:16px;"></i>
                            Video Post Processing Reports
                            <span class="badge badge-blue">${postEvidence.length}</span>
                        </button>
                    </div>

                    <div class="card" style="margin-bottom:var(--sp-4);padding:var(--sp-3) var(--sp-4);">
                        <div class="search-input-wrapper">
                            <i data-lucide="search"></i>
                            <input type="text" class="form-input" placeholder="Search evidence..." id="evidence-search" value="${this._searchTerm}" oninput="EvidenceVault.handleSearch(this.value)">
                        </div>
                    </div>

                    ${filtered.length > 0 ? `
                    <div class="evidence-grid" id="evidence-grid">
                        ${filtered.map(e => this._renderEvidenceCard(e)).join('')}
                    </div>
                    ` : `
                    <div class="card">
                        <div class="empty-state">
                            <i data-lucide="archive"></i>
                            <p class="empty-state-title">No Evidence Found</p>
                            <p class="empty-state-text">${this._activeTab === 'live' ? 'Evidence from live CCTV detections will appear here.' : 'Evidence from video post processing will appear here.'}</p>
                        </div>
                    </div>
                    `}
                </main>
            </div>
        `;
    },

    _renderEvidenceCard(e) {
        const typeBadge = e.type === 'live'
            ? '<span class="badge badge-red">LIVE</span>'
            : '<span class="badge badge-blue">POST</span>';

        return `
            <div class="evidence-card">
                <div class="evidence-thumbnail">
                    <i data-lucide="play-circle"></i>
                    <div class="evidence-duration">${e.duration || '0:00'}</div>
                    <div class="evidence-type-badge">${typeBadge}</div>
                </div>
                <div class="evidence-body">
                    <div class="evidence-title">${SentinelHelpers.escapeHtml(e.title || 'Detection Event')}</div>
                    <div class="evidence-meta">
                        <span class="evidence-meta-item">
                            <i data-lucide="video"></i>
                            ${SentinelHelpers.escapeHtml(e.cameraName || 'Unknown')}
                        </span>
                        <span class="evidence-meta-item">
                            <i data-lucide="map-pin"></i>
                            ${SentinelHelpers.escapeHtml(e.cameraLocation || 'N/A')}
                        </span>
                        <span class="evidence-meta-item">
                            <i data-lucide="clock"></i>
                            ${SentinelHelpers.formatDate(e.createdAt)}
                        </span>
                    </div>
                    <div style="font-size:var(--fs-xs);color:var(--text-tertiary);margin-bottom:var(--sp-2);">
                        Mode: ${e.detectionMode || 'N/A'} | Confidence: ${e.confidence || 'N/A'}
                    </div>
                    <div class="evidence-actions">
                        <button class="btn btn-sm btn-ghost" onclick="EvidenceVault.viewEvidence('${e.id}')">
                            <i data-lucide="eye" style="width:14px;height:14px;"></i> View
                        </button>
                        <button class="btn btn-sm btn-blue" onclick="EvidenceVault.downloadReport('${e.id}')">
                            <i data-lucide="download" style="width:14px;height:14px;"></i> Download
                        </button>
                        <button class="btn btn-sm btn-ghost" onclick="EvidenceVault.printReport('${e.id}')">
                            <i data-lucide="printer" style="width:14px;height:14px;"></i>
                        </button>
                        <button class="btn btn-icon-sm btn-ghost" onclick="EvidenceVault.deleteEvidence('${e.id}')" style="color:var(--accent-red);">
                            <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    switchTab(tab) {
        this._activeTab = tab;
        this._searchTerm = '';
        SentinelRouter.navigate(location.hash);
    },

    handleSearch(value) {
        this._searchTerm = value;
        SentinelRouter.navigate(location.hash);
    },

    viewEvidence(id) {
        const e = SentinelStore.getEvidence().find(ev => ev.id === id);
        if (!e) return;

        SentinelModal.show({
            title: 'Evidence Report',
            size: 'lg',
            content: `
                <div style="display:flex;flex-direction:column;gap:var(--sp-4);">
                    <div style="aspect-ratio:16/9;background:var(--bg-tertiary);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;">
                        <i data-lucide="play-circle" style="width:48px;height:48px;color:var(--text-tertiary);"></i>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);">
                        <div>
                            <div style="font-size:var(--fs-xs);color:var(--text-tertiary);">Title</div>
                            <div style="font-size:var(--fs-sm);font-weight:var(--fw-medium);">${SentinelHelpers.escapeHtml(e.title || 'Detection Event')}</div>
                        </div>
                        <div>
                            <div style="font-size:var(--fs-xs);color:var(--text-tertiary);">Camera</div>
                            <div style="font-size:var(--fs-sm);font-weight:var(--fw-medium);">${SentinelHelpers.escapeHtml(e.cameraName || 'N/A')}</div>
                        </div>
                        <div>
                            <div style="font-size:var(--fs-xs);color:var(--text-tertiary);">Location</div>
                            <div style="font-size:var(--fs-sm);font-weight:var(--fw-medium);">${SentinelHelpers.escapeHtml(e.cameraLocation || 'N/A')}</div>
                        </div>
                        <div>
                            <div style="font-size:var(--fs-xs);color:var(--text-tertiary);">Detection Mode</div>
                            <div style="font-size:var(--fs-sm);font-weight:var(--fw-medium);">${e.detectionMode || 'N/A'}</div>
                        </div>
                        <div>
                            <div style="font-size:var(--fs-xs);color:var(--text-tertiary);">Confidence</div>
                            <div style="font-size:var(--fs-sm);font-weight:var(--fw-medium);">${e.confidence || 'N/A'}</div>
                        </div>
                        <div>
                            <div style="font-size:var(--fs-xs);color:var(--text-tertiary);">Timestamp</div>
                            <div style="font-size:var(--fs-sm);font-weight:var(--fw-medium);">${SentinelHelpers.formatDateTime(e.createdAt)}</div>
                        </div>
                    </div>
                </div>
            `,
            actions: [
                { label: 'Close', class: 'btn btn-ghost', onClick: 'SentinelModal.close()' },
                { label: 'Download PDF', class: 'btn btn-blue', onClick: `EvidenceVault.downloadReport('${id}')` }
            ]
        });
    },

    downloadReport(id) {
        const e = SentinelStore.getEvidence().find(ev => ev.id === id);
        if (!e) return;

        // Generate a simple text report (in production this would be a proper PDF)
        let report = `SENTINEL PRO - EVIDENCE REPORT\n`;
        report += `${'='.repeat(50)}\n\n`;
        report += `Report ID: ${e.id}\n`;
        report += `Generated: ${SentinelHelpers.formatDateTime(new Date())}\n\n`;
        report += `--- EVENT DETAILS ---\n`;
        report += `Title: ${e.title || 'Detection Event'}\n`;
        report += `Type: ${e.type === 'live' ? 'Live CCTV Detection' : 'Video Post Processing'}\n`;
        report += `Camera: ${e.cameraName || 'N/A'}\n`;
        report += `Location: ${e.cameraLocation || 'N/A'}\n`;
        report += `Detection Mode: ${e.detectionMode || 'N/A'}\n`;
        report += `Confidence: ${e.confidence || 'N/A'}\n`;
        report += `Duration: ${e.duration || 'N/A'}\n`;
        report += `Event Time: ${SentinelHelpers.formatDateTime(e.createdAt)}\n\n`;
        report += `--- END OF REPORT ---\n`;

        const blob = new Blob([report], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `evidence_report_${e.id}.pdf`;
        link.click();
        URL.revokeObjectURL(url);

        SentinelToast.success('Report Downloaded', 'Evidence report has been saved.');
    },

    printReport(id) {
        const e = SentinelStore.getEvidence().find(ev => ev.id === id);
        if (!e) return;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html><head><title>Evidence Report - ${e.id}</title>
            <style>body{font-family:Arial,sans-serif;padding:40px;} h1{color:#1a2235;} table{width:100%;border-collapse:collapse;margin-top:20px;} td{padding:8px;border-bottom:1px solid #eee;} td:first-child{font-weight:bold;color:#666;width:150px;}</style>
            </head><body>
            <h1>SENTINEL PRO - Evidence Report</h1>
            <p>Report ID: ${e.id}</p>
            <p>Generated: ${SentinelHelpers.formatDateTime(new Date())}</p>
            <table>
                <tr><td>Title</td><td>${e.title || 'Detection Event'}</td></tr>
                <tr><td>Type</td><td>${e.type === 'live' ? 'Live CCTV' : 'Video Post Processing'}</td></tr>
                <tr><td>Camera</td><td>${e.cameraName || 'N/A'}</td></tr>
                <tr><td>Location</td><td>${e.cameraLocation || 'N/A'}</td></tr>
                <tr><td>Detection Mode</td><td>${e.detectionMode || 'N/A'}</td></tr>
                <tr><td>Confidence</td><td>${e.confidence || 'N/A'}</td></tr>
                <tr><td>Event Time</td><td>${SentinelHelpers.formatDateTime(e.createdAt)}</td></tr>
            </table>
            </body></html>
        `);
        printWindow.document.close();
        printWindow.print();
    },

    deleteEvidence(id) {
        SentinelModal.confirm({
            title: 'Delete Evidence',
            message: 'Are you sure you want to permanently delete this evidence file? This cannot be undone.',
            confirmLabel: 'Delete',
            danger: true,
            onConfirm: () => {
                SentinelStore.deleteEvidence(id);
                SentinelModal.close();
                SentinelToast.success('Evidence Deleted', 'Evidence file has been removed.');
                SentinelRouter.navigate(location.hash);
            }
        });
    },

    resetAll() {
        SentinelModal.confirm({
            title: 'Reset Evidence Vault',
            message: 'WARNING: This will permanently delete ALL evidence files and reports. This action cannot be undone.',
            confirmLabel: 'Reset All',
            danger: true,
            onConfirm: () => {
                SentinelStore.resetEvidence();
                SentinelModal.close();
                SentinelToast.success('Vault Reset', 'All evidence files have been removed.');
                SentinelRouter.navigate(location.hash);
            }
        });
    },

    init() {}
};

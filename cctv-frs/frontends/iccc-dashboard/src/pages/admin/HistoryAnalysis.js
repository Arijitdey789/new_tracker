/* ============================================================
   SENTINEL PRO — History Analysis Page
   ============================================================ */

const HistoryAnalysis = {
    _currentPage: 1,
    _perPage: 12,
    _filter: '',

    render() {
        const activities = SentinelStore.getActivityLog();

        return `
            <div class="panel-layout">
                ${AdminSidebar.render('history')}
                <main class="panel-content">
                    <div class="page-header">
                        <div>
                            <h1 class="page-title">History Analysis</h1>
                            <p class="page-subtitle">Complete audit trail and event log</p>
                        </div>
                        <div class="page-actions">
                            <button class="btn btn-ghost btn-sm" onclick="HistoryAnalysis.exportCSV()">
                                <i data-lucide="download"></i> Export CSV
                            </button>
                            <button class="btn btn-outline-red btn-sm" onclick="HistoryAnalysis.clearHistory()">
                                <i data-lucide="trash-2"></i> Clear All
                            </button>
                        </div>
                    </div>

                    <div class="card" style="margin-bottom:var(--sp-4)">
                        <div style="display:flex;align-items:center;gap:var(--sp-4);flex-wrap:wrap;">
                            <div class="search-input-wrapper" style="flex:1;min-width:200px;">
                                <i data-lucide="search"></i>
                                <input type="text" class="form-input" placeholder="Search events..." id="history-search" oninput="HistoryAnalysis.handleSearch(this.value)">
                            </div>
                            <div class="form-group" style="min-width:150px;">
                                <select class="form-select" id="history-type-filter" onchange="HistoryAnalysis.handleFilter()">
                                    <option value="">All Types</option>
                                    <option value="auth">Authentication</option>
                                    <option value="system">System</option>
                                    <option value="detection">Detection</option>
                                    <option value="user">User</option>
                                </select>
                            </div>
                            <div class="form-group" style="min-width:140px;">
                                <input type="date" class="form-input" id="history-date-from" onchange="HistoryAnalysis.handleFilter()" style="font-size:var(--fs-sm);">
                            </div>
                            <span style="color:var(--text-tertiary);font-size:var(--fs-sm);">to</span>
                            <div class="form-group" style="min-width:140px;">
                                <input type="date" class="form-input" id="history-date-to" onchange="HistoryAnalysis.handleFilter()" style="font-size:var(--fs-sm);">
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div style="overflow-x:auto;">
                            <table class="data-table" id="history-table">
                                <thead>
                                    <tr>
                                        <th>Timestamp</th>
                                        <th>Type</th>
                                        <th>Event</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody id="history-table-body">
                                    ${this._renderRows(activities)}
                                </tbody>
                            </table>
                        </div>

                        ${activities.length === 0 ? `
                            <div class="empty-state">
                                <i data-lucide="clock"></i>
                                <p class="empty-state-title">No Events Recorded</p>
                                <p class="empty-state-text">System events and activity logs will appear here.</p>
                            </div>
                        ` : ''}

                        <div id="history-pagination" style="margin-top:var(--sp-4)">
                            ${this._renderPagination(activities.length)}
                        </div>
                    </div>
                </main>
            </div>
        `;
    },

    _renderRows(activities) {
        const start = (this._currentPage - 1) * this._perPage;
        const paged = activities.slice(start, start + this._perPage);

        return paged.map(a => {
            const typeColors = { auth: 'blue', system: 'green', detection: 'red', user: 'amber' };
            const color = typeColors[a.type] || 'blue';

            return `
                <tr>
                    <td style="white-space:nowrap;">${SentinelHelpers.formatDateTime(a.timestamp)}</td>
                    <td><span class="badge badge-${color}">${(a.type || 'system').toUpperCase()}</span></td>
                    <td>${SentinelHelpers.escapeHtml(a.message)}</td>
                    <td><span class="status-dot online"></span></td>
                </tr>
            `;
        }).join('');
    },

    _renderPagination(total) {
        const pages = Math.ceil(total / this._perPage);
        if (pages <= 1) return '';

        let html = '<div class="pagination">';
        html += `<button class="pagination-btn" ${this._currentPage <= 1 ? 'disabled' : ''} onclick="HistoryAnalysis.goToPage(${this._currentPage - 1})"><i data-lucide="chevron-left" style="width:14px;height:14px;"></i></button>`;

        for (let i = 1; i <= pages; i++) {
            if (i === 1 || i === pages || (i >= this._currentPage - 1 && i <= this._currentPage + 1)) {
                html += `<button class="pagination-btn ${i === this._currentPage ? 'active' : ''}" onclick="HistoryAnalysis.goToPage(${i})">${i}</button>`;
            } else if (i === this._currentPage - 2 || i === this._currentPage + 2) {
                html += '<span style="color:var(--text-tertiary);padding:0 4px;">...</span>';
            }
        }

        html += `<button class="pagination-btn" ${this._currentPage >= pages ? 'disabled' : ''} onclick="HistoryAnalysis.goToPage(${this._currentPage + 1})"><i data-lucide="chevron-right" style="width:14px;height:14px;"></i></button>`;
        html += '</div>';
        return html;
    },

    goToPage(page) {
        this._currentPage = page;
        this._refreshTable();
    },

    handleSearch(value) {
        this._filter = value.toLowerCase();
        this._currentPage = 1;
        this._refreshTable();
    },

    handleFilter() {
        this._currentPage = 1;
        this._refreshTable();
    },

    _getFilteredActivities() {
        let activities = SentinelStore.getActivityLog();
        const typeFilter = document.getElementById('history-type-filter');
        const dateFrom = document.getElementById('history-date-from');
        const dateTo = document.getElementById('history-date-to');

        if (this._filter) {
            activities = activities.filter(a => a.message.toLowerCase().includes(this._filter));
        }

        if (typeFilter && typeFilter.value) {
            activities = activities.filter(a => a.type === typeFilter.value);
        }

        if (dateFrom && dateFrom.value) {
            activities = activities.filter(a => new Date(a.timestamp) >= new Date(dateFrom.value));
        }

        if (dateTo && dateTo.value) {
            const to = new Date(dateTo.value);
            to.setHours(23, 59, 59);
            activities = activities.filter(a => new Date(a.timestamp) <= to);
        }

        return activities;
    },

    _refreshTable() {
        const activities = this._getFilteredActivities();
        const tbody = document.getElementById('history-table-body');
        const pagination = document.getElementById('history-pagination');

        if (tbody) tbody.innerHTML = this._renderRows(activities);
        if (pagination) pagination.innerHTML = this._renderPagination(activities.length);

        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    exportCSV() {
        const activities = this._getFilteredActivities();
        let csv = 'Timestamp,Type,Event\n';
        activities.forEach(a => {
            csv += `"${SentinelHelpers.formatDateTime(a.timestamp)}","${a.type}","${a.message}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sentinel_history_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);

        SentinelToast.success('Export Complete', 'History data exported as CSV file.');
    },

    clearHistory() {
        SentinelModal.confirm({
            title: 'Clear History',
            message: 'Are you sure you want to clear all history records? This action cannot be undone.',
            confirmLabel: 'Clear All',
            danger: true,
            onConfirm: () => {
                SentinelStore._set('activity_log', []);
                SentinelModal.close();
                SentinelToast.success('History Cleared', 'All history records have been removed.');
                SentinelRouter.navigate(location.hash);
            }
        });
    },

    init() {}
};

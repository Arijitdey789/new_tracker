/* ============================================================
   SENTINEL PRO — Admin Sidebar Navigation
   ============================================================ */

const AdminSidebar = {
    _open: false,

    render(activePage) {
        const user = SentinelAuth.getCurrentUser();
        const initials = SentinelHelpers.getInitials(user ? user.fullName : 'A');

        return `
            <div class="sidebar-overlay" id="sidebar-overlay" onclick="AdminSidebar.closeMobile()"></div>

            <div class="mobile-header" id="admin-mobile-header">
                <div class="nav-brand" style="cursor:pointer" onclick="location.hash='#/admin/dashboard'">
                    <div class="nav-logo" style="width:32px;height:32px;font-size:14px;">S</div>
                    <span class="nav-brand-text" style="font-size:14px;">SENTINEL <span>PRO</span></span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    ${SentinelTheme.createToggleButton()}
                    <button class="mobile-menu-btn" onclick="AdminSidebar.toggleMobile()" style="display:flex">
                        <i data-lucide="menu"></i>
                    </button>
                </div>
            </div>

            <aside class="sidebar" id="admin-sidebar">
                <div class="sidebar-header">
                    <div class="sidebar-logo">S</div>
                    <div class="sidebar-brand">
                        <span class="sidebar-brand-name">SENTINEL PRO</span>
                        <span class="sidebar-brand-role">Admin Panel</span>
                    </div>
                    ${SentinelTheme.createToggleButton()}
                </div>

                <nav class="sidebar-nav">
                    <div class="sidebar-section-label">Main Menu</div>

                    <a class="sidebar-link ${activePage === 'dashboard' ? 'active' : ''}" onclick="location.hash='#/admin/dashboard'; AdminSidebar.closeMobile();">
                        <i data-lucide="layout-dashboard"></i>
                        <span>Dashboard</span>
                    </a>

                    <a class="sidebar-link ${activePage === 'history' ? 'active' : ''}" onclick="location.hash='#/admin/history'; AdminSidebar.closeMobile();">
                        <i data-lucide="clock"></i>
                        <span>History Analysis</span>
                    </a>

                    <a class="sidebar-link ${activePage === 'users' ? 'active' : ''}" onclick="location.hash='#/admin/users'; AdminSidebar.closeMobile();">
                        <i data-lucide="users"></i>
                        <span>Manage Users</span>
                    </a>

                    <a class="sidebar-link ${activePage === 'add-user' ? 'active' : ''}" onclick="location.hash='#/admin/users'; setTimeout(() => ManageUsers.showAddModal(), 200); AdminSidebar.closeMobile();">
                        <i data-lucide="user-plus"></i>
                        <span>Add User</span>
                    </a>

                    <a class="sidebar-link ${activePage === 'reports' ? 'active' : ''}" onclick="location.hash='#/admin/reports'; AdminSidebar.closeMobile();">
                        <i data-lucide="bar-chart-3"></i>
                        <span>System Reports</span>
                    </a>

                    <div class="sidebar-section-label">System</div>

                    <a class="sidebar-link ${activePage === 'settings' ? 'active' : ''}" onclick="location.hash='#/admin/settings'; AdminSidebar.closeMobile();">
                        <i data-lucide="settings"></i>
                        <span>Settings</span>
                    </a>
                </nav>

                <div class="sidebar-footer">
                    <div class="sidebar-user">
                        <div class="sidebar-avatar">${initials}</div>
                        <div class="sidebar-user-info">
                            <div class="sidebar-user-name">${user ? SentinelHelpers.escapeHtml(user.fullName) : 'Administrator'}</div>
                            <div class="sidebar-user-email">${user ? SentinelHelpers.escapeHtml(user.email) : 'admin@sentinelpro.com'}</div>
                        </div>
                    </div>
                    <button class="btn btn-red sidebar-logout" onclick="AdminSidebar.handleLogout()">
                        <i data-lucide="log-out"></i>
                        Logout
                    </button>
                </div>
            </aside>
        `;
    },

    toggleMobile() {
        this._open = !this._open;
        const sidebar = document.getElementById('admin-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.toggle('open', this._open);
        if (overlay) overlay.classList.toggle('open', this._open);
    },

    closeMobile() {
        this._open = false;
        const sidebar = document.getElementById('admin-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    },

    handleLogout() {
        SentinelModal.confirm({
            title: 'Logout',
            message: 'Are you sure you want to logout from the admin panel?',
            confirmLabel: 'Logout',
            danger: true,
            onConfirm: () => {
                SentinelModal.close();
                SentinelAuth.logout();
                location.hash = '#/';
                SentinelToast.info('Logged Out', 'You have been logged out successfully.');
            }
        });
    }
};

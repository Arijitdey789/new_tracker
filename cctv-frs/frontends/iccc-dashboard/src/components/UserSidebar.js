/* ============================================================
   SENTINEL PRO — User Sidebar Navigation
   ============================================================ */

const UserSidebar = {
    _open: false,

    render(activePage) {
        const user = SentinelAuth.getCurrentUser();
        const initials = SentinelHelpers.getInitials(user ? user.fullName : 'U');

        return `
            <div class="sidebar-overlay" id="sidebar-overlay" onclick="UserSidebar.closeMobile()"></div>

            <div class="mobile-header" id="user-mobile-header">
                <div class="nav-brand" style="cursor:pointer" onclick="location.hash='#/user/live-cctv'">
                    <div class="nav-logo" style="width:32px;height:32px;font-size:14px;">S</div>
                    <span class="nav-brand-text" style="font-size:14px;">SENTINEL <span>PRO</span></span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    ${SentinelTheme.createToggleButton()}
                    <button class="mobile-menu-btn" onclick="UserSidebar.toggleMobile()" style="display:flex">
                        <i data-lucide="menu"></i>
                    </button>
                </div>
            </div>

            <aside class="sidebar" id="user-sidebar">
                <div class="sidebar-header">
                    <div class="sidebar-logo">S</div>
                    <div class="sidebar-brand">
                        <span class="sidebar-brand-name">SENTINEL PRO</span>
                        <span class="sidebar-brand-role">User Panel</span>
                    </div>
                    ${SentinelTheme.createToggleButton()}
                </div>

                <nav class="sidebar-nav">
                    <div class="sidebar-section-label">Modules</div>

                    <a class="sidebar-link ${activePage === 'live-cctv' ? 'active' : ''}" onclick="location.hash='#/user/live-cctv'; UserSidebar.closeMobile();">
                        <i data-lucide="video"></i>
                        <span>Live CCTV</span>
                    </a>

                    <a class="sidebar-link ${activePage === 'evidence-vault' ? 'active' : ''}" onclick="location.hash='#/user/evidence-vault'; UserSidebar.closeMobile();">
                        <i data-lucide="archive"></i>
                        <span>Evidence Vault</span>
                    </a>

                    <a class="sidebar-link ${activePage === 'video-processing' ? 'active' : ''}" onclick="location.hash='#/user/video-processing'; UserSidebar.closeMobile();">
                        <i data-lucide="film"></i>
                        <span>Video Post Processing</span>
                    </a>

                    <a class="sidebar-link ${activePage === 'post-processing-live' ? 'active' : ''}" onclick="location.hash='#/user/post-processing-live'; UserSidebar.closeMobile();">
                        <i data-lucide="activity"></i>
                        <span>Post Processing Live</span>
                    </a>

                    <div class="sidebar-section-label">Account</div>

                    <a class="sidebar-link ${activePage === 'profile' ? 'active' : ''}" onclick="location.hash='#/user/profile'; UserSidebar.closeMobile();">
                        <i data-lucide="user-circle"></i>
                        <span>My Profile</span>
                    </a>
                </nav>

                <div class="sidebar-footer">
                    <div class="sidebar-user">
                        <div class="sidebar-avatar">${initials}</div>
                        <div class="sidebar-user-info">
                            <div class="sidebar-user-name">${user ? SentinelHelpers.escapeHtml(user.fullName) : 'User'}</div>
                            <div class="sidebar-user-email">${user ? SentinelHelpers.escapeHtml(user.email) : ''}</div>
                        </div>
                    </div>
                    <button class="btn btn-red sidebar-logout" onclick="UserSidebar.handleLogout()">
                        <i data-lucide="log-out"></i>
                        Logout
                    </button>
                </div>
            </aside>
        `;
    },

    toggleMobile() {
        this._open = !this._open;
        const sidebar = document.getElementById('user-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.toggle('open', this._open);
        if (overlay) overlay.classList.toggle('open', this._open);
    },

    closeMobile() {
        this._open = false;
        const sidebar = document.getElementById('user-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    },

    handleLogout() {
        SentinelModal.confirm({
            title: 'Logout',
            message: 'Are you sure you want to logout? Any unsaved progress will be lost.',
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

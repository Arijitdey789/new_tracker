/* ============================================================
   SENTINEL PRO — Hash-Based SPA Router
   ============================================================ */

const SentinelRouter = {
    _routes: {},
    _currentRoute: null,

    /**
     * Define routes
     */
    init() {
        this._routes = {
            '#/': { render: () => HomePage.render(), init: () => HomePage.init(), public: true },
            '#/admin-login': { render: () => LoginPage.render('admin'), init: () => LoginPage.init(), public: true },
            '#/user-login': { render: () => LoginPage.render('user'), init: () => LoginPage.init(), public: true },
            '#/contact': { render: () => ContactPage.render(), init: () => ContactPage.init(), public: true },

            '#/admin/dashboard': { render: () => AdminDashboard.render(), init: () => AdminDashboard.init(), role: 'admin' },
            '#/admin/history': { render: () => HistoryAnalysis.render(), init: () => HistoryAnalysis.init(), role: 'admin' },
            '#/admin/users': { render: () => ManageUsers.render(), init: () => ManageUsers.init(), role: 'admin' },
            '#/admin/reports': { render: () => SystemReports.render(), init: () => SystemReports.init(), role: 'admin' },
            '#/admin/settings': { render: () => SettingsPage.render(), init: () => SettingsPage.init(), role: 'admin' },

            '#/user/live-cctv': { render: () => LiveCCTV.render(), init: () => LiveCCTV.init(), role: 'user' },
            '#/user/evidence-vault': { render: () => EvidenceVault.render(), init: () => EvidenceVault.init(), role: 'user' },
            '#/user/video-processing': { render: () => VideoProcessing.render(), init: () => VideoProcessing.init(), role: 'user' },
            '#/user/post-processing-live': { render: () => PostProcLive.render(), init: () => PostProcLive.init(), role: 'user' },
            '#/user/profile': { render: () => UserProfile.render(), init: () => UserProfile.init(), role: 'user' }
        };

        // Listen for hash changes
        window.addEventListener('hashchange', () => this.navigate(location.hash));

        // Initial navigation
        if (!location.hash || location.hash === '#') {
            location.hash = '#/';
        } else {
            this.navigate(location.hash);
        }
    },

    /**
     * Navigate to route
     */
    navigate(hash) {
        // Normalize hash
        if (!hash || hash === '#' || hash === '') hash = '#/';

        const route = this._routes[hash];

        if (!route) {
            // 404 — redirect to home
            location.hash = '#/';
            return;
        }

        // Auth guard
        if (route.role) {
            const session = SentinelAuth.getSession();
            if (!session) {
                // Redirect to appropriate login
                location.hash = route.role === 'admin' ? '#/admin-login' : '#/user-login';
                SentinelToast.warning('Access Denied', 'Please login to access this page.');
                return;
            }

            if (session.role !== route.role) {
                // Wrong role
                location.hash = '#/';
                SentinelToast.warning('Access Denied', 'You do not have permission to access this page.');
                return;
            }
        }

        // If logged in and trying to access login page, redirect
        if (hash === '#/admin-login' && SentinelAuth.isAdmin()) {
            location.hash = '#/admin/dashboard';
            return;
        }
        if (hash === '#/user-login' && SentinelAuth.isUser()) {
            location.hash = '#/user/live-cctv';
            return;
        }

        this._currentRoute = hash;

        // Render page
        const app = document.getElementById('app');
        if (app) {
            // Page transition
            app.className = 'page-enter';
            app.innerHTML = route.render();

            // Trigger reflow
            app.offsetHeight;

            // Animate in
            app.className = 'page-active';

            // Re-render Lucide icons
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }

            // Scroll to top
            window.scrollTo(0, 0);

            // Run page init
            if (route.init) {
                setTimeout(() => route.init(), 50);
            }
        }
    },

    /**
     * Get current route
     */
    getCurrentRoute() {
        return this._currentRoute;
    }
};

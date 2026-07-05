/* ============================================================
   SENTINEL PRO — Landing Page Navbar
   ============================================================ */

const Navbar = {
    _mobileOpen: false,

    render() {
        return `
            <nav class="landing-nav" id="landing-nav">
                <div class="nav-brand" onclick="location.hash='#/'" style="cursor:pointer">
                    <div class="nav-logo">S</div>
                    <span class="nav-brand-text">SENTINEL <span>PRO</span></span>
                </div>

                <div class="nav-links" id="nav-links">
                    <a class="nav-link" onclick="location.hash='#/'">
                        <i data-lucide="home"></i> Home
                    </a>
                    <a class="nav-link" onclick="location.hash='#/admin-login'">
                        <i data-lucide="shield"></i> Admin Panel
                    </a>
                    <a class="nav-link" onclick="location.hash='#/user-login'">
                        <i data-lucide="user"></i> User Panel
                    </a>
                    <a class="nav-link" onclick="location.hash='#/contact'">
                        <i data-lucide="mail"></i> Contact Us
                    </a>
                </div>

                <div class="nav-actions">
                    ${SentinelTheme.createToggleButton()}
                    <button class="mobile-menu-btn" onclick="Navbar.toggleMobile()" id="mobile-menu-btn">
                        <i data-lucide="menu"></i>
                    </button>
                </div>
            </nav>

            <div class="mobile-menu" id="mobile-menu">
                <a class="nav-link" onclick="location.hash='#/'; Navbar.toggleMobile();">
                    <i data-lucide="home"></i> Home
                </a>
                <a class="nav-link" onclick="location.hash='#/admin-login'; Navbar.toggleMobile();">
                    <i data-lucide="shield"></i> Admin Panel
                </a>
                <a class="nav-link" onclick="location.hash='#/user-login'; Navbar.toggleMobile();">
                    <i data-lucide="user"></i> User Panel
                </a>
                <a class="nav-link" onclick="location.hash='#/contact'; Navbar.toggleMobile();">
                    <i data-lucide="mail"></i> Contact Us
                </a>
            </div>
        `;
    },

    /**
     * Toggle mobile menu
     */
    toggleMobile() {
        this._mobileOpen = !this._mobileOpen;
        const menu = document.getElementById('mobile-menu');
        const btn = document.getElementById('mobile-menu-btn');
        if (menu) {
            menu.classList.toggle('open', this._mobileOpen);
        }
        if (btn) {
            btn.innerHTML = this._mobileOpen
                ? '<i data-lucide="x"></i>'
                : '<i data-lucide="menu"></i>';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    },

    /**
     * Initialize scroll listener for nav background
     */
    initScroll() {
        const nav = document.getElementById('landing-nav');
        if (!nav) return;

        const handleScroll = () => {
            if (window.scrollY > 20) {
                nav.classList.add('scrolled');
            } else {
                nav.classList.remove('scrolled');
            }
        };

        window.addEventListener('scroll', handleScroll);
        handleScroll();
    }
};

/* ============================================================
   SENTINEL PRO — Theme Manager
   ============================================================ */

const SentinelTheme = {
    _storageKey: 'sentinel_theme',

    /**
     * Initialize theme
     */
    init() {
        const saved = localStorage.getItem(this._storageKey);
        const theme = saved || 'dark';
        this.apply(theme);
    },

    /**
     * Apply theme
     */
    apply(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(this._storageKey, theme);
        this._updateToggleIcon();
    },

    /**
     * Get current theme
     */
    get() {
        return document.documentElement.getAttribute('data-theme') || 'dark';
    },

    /**
     * Toggle theme
     */
    toggle() {
        const current = this.get();
        const next = current === 'dark' ? 'light' : 'dark';
        this.apply(next);
        return next;
    },

    /**
     * Update toggle button icon
     */
    _updateToggleIcon() {
        const toggles = document.querySelectorAll('.theme-toggle');
        const isDark = this.get() === 'dark';

        toggles.forEach(toggle => {
            toggle.innerHTML = isDark
                ? '<i data-lucide="sun"></i>'
                : '<i data-lucide="moon"></i>';
            toggle.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
        });

        // Re-render Lucide icons
        if (typeof lucide !== 'undefined') {
            setTimeout(() => lucide.createIcons(), 10);
        }
    },

    /**
     * Create theme toggle button HTML
     */
    createToggleButton() {
        const isDark = this.get() === 'dark';
        return `
            <button class="theme-toggle" onclick="SentinelTheme.toggle()" title="${isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}">
                <i data-lucide="${isDark ? 'sun' : 'moon'}"></i>
            </button>
        `;
    }
};

// Initialize theme on load
SentinelTheme.init();

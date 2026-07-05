/* ============================================================
   SENTINEL PRO — Toast Notification System
   ============================================================ */

const SentinelToast = {
    _container: null,

    /**
     * Ensure container exists
     */
    _ensureContainer() {
        if (!this._container) {
            this._container = document.createElement('div');
            this._container.className = 'toast-container';
            this._container.id = 'toast-container';
            document.body.appendChild(this._container);
        }
        return this._container;
    },

    /**
     * Show toast
     * @param {string} type - success, error, warning, info
     * @param {string} title - Toast title
     * @param {string} message - Toast message
     * @param {number} duration - Auto-dismiss duration in ms (default 4000)
     */
    show(type, title, message, duration = 4000) {
        const container = this._ensureContainer();
        const id = 'toast-' + Date.now();

        const iconMap = {
            success: 'check-circle',
            error: 'x-circle',
            warning: 'alert-triangle',
            info: 'info'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.id = id;
        toast.innerHTML = `
            <i data-lucide="${iconMap[type] || 'info'}" class="toast-icon"></i>
            <div class="toast-content">
                <div class="toast-title">${SentinelHelpers.escapeHtml(title)}</div>
                <div class="toast-message">${SentinelHelpers.escapeHtml(message)}</div>
            </div>
            <button class="toast-close" onclick="SentinelToast.dismiss('${id}')">
                <i data-lucide="x"></i>
            </button>
            <div class="toast-progress" style="animation-duration: ${duration}ms"></div>
        `;

        container.appendChild(toast);

        // Re-render icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Auto dismiss
        setTimeout(() => {
            this.dismiss(id);
        }, duration);

        return id;
    },

    /**
     * Dismiss toast
     */
    dismiss(id) {
        const toast = document.getElementById(id);
        if (toast) {
            toast.classList.add('toast-exit');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }
    },

    /**
     * Shorthand methods
     */
    success(title, message, duration) {
        return this.show('success', title, message, duration);
    },

    error(title, message, duration) {
        return this.show('error', title, message, duration);
    },

    warning(title, message, duration) {
        return this.show('warning', title, message, duration);
    },

    info(title, message, duration) {
        return this.show('info', title, message, duration);
    }
};

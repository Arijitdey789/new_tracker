/* ============================================================
   SENTINEL PRO — Modal Dialog System
   ============================================================ */

const SentinelModal = {
    _activeModal: null,

    /**
     * Show modal
     * @param {object} options - Modal options
     * @param {string} options.title - Modal title
     * @param {string} options.content - Modal body HTML
     * @param {string} options.size - 'sm', 'md', 'lg' (default 'md')
     * @param {Array} options.actions - Array of {label, class, onClick}
     * @param {Function} options.onClose - Callback on close
     */
    show(options) {
        this.close(); // Close any existing modal

        const sizeMap = {
            sm: '380px',
            md: '520px',
            lg: '700px'
        };

        const maxWidth = sizeMap[options.size || 'md'];

        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.id = 'modal-backdrop';
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                this.close();
                if (options.onClose) options.onClose();
            }
        });

        const actionsHtml = (options.actions || []).map(action =>
            `<button class="btn ${action.class || 'btn-ghost'}" onclick="${action.onClick || ''}">${action.label}</button>`
        ).join('');

        backdrop.innerHTML = `
            <div class="modal" style="max-width: ${maxWidth}">
                <div class="modal-header">
                    <h3 class="modal-title">${options.title || ''}</h3>
                    <button class="modal-close" onclick="SentinelModal.close()">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="modal-body">
                    ${options.content || ''}
                </div>
                ${actionsHtml ? `<div class="modal-footer">${actionsHtml}</div>` : ''}
            </div>
        `;

        document.body.appendChild(backdrop);
        this._activeModal = backdrop;

        // Re-render icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Trap focus
        document.addEventListener('keydown', this._handleEsc);

        return backdrop;
    },

    /**
     * Show confirmation dialog
     */
    confirm(options) {
        const iconType = options.danger ? 'danger' : 'warning';
        const iconName = options.danger ? 'alert-triangle' : 'alert-circle';

        return this.show({
            title: options.title || 'Confirm Action',
            content: `
                <div class="confirm-icon ${iconType}">
                    <i data-lucide="${iconName}"></i>
                </div>
                <p class="confirm-text">${options.message || 'Are you sure you want to proceed?'}</p>
            `,
            size: 'sm',
            actions: [
                {
                    label: 'Cancel',
                    class: 'btn btn-ghost',
                    onClick: 'SentinelModal.close()'
                },
                {
                    label: options.confirmLabel || 'Confirm',
                    class: `btn ${options.danger ? 'btn-red' : 'btn-blue'}`,
                    onClick: `(${options.onConfirm.toString()})()`
                }
            ]
        });
    },

    /**
     * Close modal
     */
    close() {
        if (this._activeModal) {
            this._activeModal.remove();
            this._activeModal = null;
        }
        const existing = document.getElementById('modal-backdrop');
        if (existing) existing.remove();
        document.removeEventListener('keydown', this._handleEsc);
    },

    /**
     * Handle Escape key
     */
    _handleEsc(e) {
        if (e.key === 'Escape') {
            SentinelModal.close();
        }
    }
};

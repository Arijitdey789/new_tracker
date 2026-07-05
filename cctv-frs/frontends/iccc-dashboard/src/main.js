/* ============================================================
   SENTINEL PRO — Main Application Entry Point
   ============================================================ */

(function() {
    'use strict';

    // Wait for DOM and all scripts to be ready
    document.addEventListener('DOMContentLoaded', function() {
        // Initialize theme
        SentinelTheme.init();

        // Initialize store defaults
        SentinelStore.initializeDefaultData();

        // Initialize router (this triggers first render)
        SentinelRouter.init();

        // Log startup
        console.log(
            '%cSENTINEL PRO%c v1.0.0 — Enterprise Surveillance Platform',
            'background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 8px 16px; border-radius: 4px; font-weight: bold; font-size: 14px;',
            'color: #9ca3af; padding: 8px; font-size: 12px;'
        );
    });
})();

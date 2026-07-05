/* ============================================================
   SENTINEL PRO — Authentication System
   ============================================================ */

const SentinelAuth = {
    _sessionKey: 'sentinel_session',

    // Default admin credentials
    ADMIN_ID: 'Admin',
    ADMIN_PASSWORD: 'Admin@123',

    /**
     * Get current session
     */
    getSession() {
        try {
            const session = localStorage.getItem(this._sessionKey);
            return session ? JSON.parse(session) : null;
        } catch {
            return null;
        }
    },

    /**
     * Check if user is logged in
     */
    isLoggedIn() {
        return this.getSession() !== null;
    },

    /**
     * Get current user role
     */
    getRole() {
        const session = this.getSession();
        return session ? session.role : null;
    },

    /**
     * Check if admin
     */
    isAdmin() {
        return this.getRole() === 'admin';
    },

    /**
     * Check if user
     */
    isUser() {
        return this.getRole() === 'user';
    },

    /**
     * Get current user info
     */
    getCurrentUser() {
        const session = this.getSession();
        return session ? session.user : null;
    },

    /**
     * Admin login
     */
    adminLogin(id, password) {
        if (id === this.ADMIN_ID && password === this.ADMIN_PASSWORD) {
            const session = {
                role: 'admin',
                user: {
                    id: 'admin',
                    fullName: 'Administrator',
                    email: 'admin@sentinelpro.com',
                    designation: 'System Administrator'
                },
                loginTime: new Date().toISOString()
            };
            localStorage.setItem(this._sessionKey, JSON.stringify(session));
            SentinelStore.addActivity({ type: 'auth', message: 'Admin logged in', color: 'green' });
            return { success: true, session };
        }
        return { success: false, error: 'Invalid administrator credentials' };
    },

    /**
     * User login
     */
    userLogin(email, password) {
        const user = SentinelStore.getUserByEmail(email);

        if (!user) {
            return { success: false, error: 'No account found with this email address' };
        }

        if (user.status === 'inactive') {
            return { success: false, error: 'This account has been deactivated. Contact your administrator.' };
        }

        if (user.password !== password) {
            return { success: false, error: 'Incorrect password. Please try again.' };
        }

        const session = {
            role: 'user',
            user: {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                mobile: user.mobile,
                countryCode: user.countryCode,
                designation: user.designation
            },
            loginTime: new Date().toISOString()
        };
        localStorage.setItem(this._sessionKey, JSON.stringify(session));
        SentinelStore.addActivity({ type: 'auth', message: `${user.fullName} logged in`, color: 'green' });
        return { success: true, session };
    },

    /**
     * Change user password
     */
    changePassword(currentPassword, newPassword) {
        const session = this.getSession();
        if (!session || session.role !== 'user') {
            return { success: false, error: 'Not authenticated' };
        }

        const user = SentinelStore.getUserByEmail(session.user.email);
        if (!user) {
            return { success: false, error: 'User not found' };
        }

        if (user.password !== currentPassword) {
            return { success: false, error: 'Current password is incorrect' };
        }

        SentinelStore.updateUser(user.id, { password: newPassword });
        SentinelStore.addActivity({ type: 'auth', message: `${user.fullName} changed password`, color: 'blue' });
        return { success: true };
    },

    /**
     * Logout
     */
    logout() {
        const session = this.getSession();
        if (session) {
            const name = session.user ? session.user.fullName : 'Unknown';
            SentinelStore.addActivity({ type: 'auth', message: `${name} logged out`, color: 'amber' });
        }
        localStorage.removeItem(this._sessionKey);
    },

    /**
     * Check route access
     */
    canAccess(route) {
        if (route.startsWith('#/admin')) {
            return this.isAdmin();
        }
        if (route.startsWith('#/user')) {
            return this.isUser();
        }
        return true; // Public routes
    }
};

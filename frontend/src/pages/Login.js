/* ============================================================
   SENTINEL PRO — Login Page
   ============================================================ */

const LoginPage = {
    render(type) {
        const isAdmin = type === 'admin';
        const title = isAdmin ? 'Admin Login' : 'User Login';
        const subtitle = isAdmin ? 'Access the administrator dashboard' : 'Access your surveillance workspace';
        const idLabel = isAdmin ? 'Admin ID' : 'Email Address';
        const idPlaceholder = isAdmin ? 'Enter Admin ID' : 'Enter your email address';
        const idIcon = isAdmin ? 'shield' : 'mail';
        const idType = isAdmin ? 'text' : 'email';

        return `
            <div class="auth-page">
                <a class="auth-back" onclick="location.hash='#/'">
                    <i data-lucide="arrow-left" style="width:16px;height:16px;"></i>
                    Back to Home
                </a>

                <div class="auth-card">
                    <div class="auth-header">
                        <div class="auth-logo">S</div>
                        <h1 class="auth-title">${title}</h1>
                        <p class="auth-subtitle">${subtitle}</p>
                    </div>

                    <form class="auth-form" id="login-form" onsubmit="LoginPage.handleSubmit(event, '${type}')">
                        <div class="form-group">
                            <label class="form-label" for="login-id">${idLabel}</label>
                            <div class="auth-input-wrapper">
                                <i data-lucide="${idIcon}" class="auth-input-icon"></i>
                                <input type="${idType}" id="login-id" class="form-input" placeholder="${idPlaceholder}" autocomplete="username" required>
                            </div>
                            <div class="form-error" id="login-id-error"></div>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="login-password">Password</label>
                            <div class="auth-input-wrapper">
                                <i data-lucide="lock" class="auth-input-icon"></i>
                                <input type="password" id="login-password" class="form-input" placeholder="Enter your password" autocomplete="current-password" required>
                                <button type="button" class="password-toggle" onclick="LoginPage.togglePassword()">
                                    <i data-lucide="eye" id="password-toggle-icon"></i>
                                </button>
                            </div>
                            <div class="form-error" id="login-password-error"></div>
                        </div>

                        <div class="auth-remember">
                            <label>
                                <input type="checkbox" id="remember-me"> Remember me
                            </label>
                        </div>

                        <button type="submit" class="btn btn-blue auth-submit" id="login-submit-btn">
                            <i data-lucide="log-in"></i>
                            Sign In
                        </button>
                    </form>

                    ${!isAdmin ? `
                    <div class="auth-footer">
                        <p class="auth-footer-text">
                            Don't have an account? Contact your <span class="auth-footer-link" onclick="location.hash='#/admin-login'">administrator</span>.
                        </p>
                    </div>
                    ` : `
                    <div class="auth-footer">
                        <p class="auth-footer-text">
                            Looking for the <span class="auth-footer-link" onclick="location.hash='#/user-login'">User Panel</span>?
                        </p>
                    </div>
                    `}
                </div>
            </div>
        `;
    },

    togglePassword() {
        const input = document.getElementById('login-password');
        const icon = document.getElementById('password-toggle-icon');
        if (input.type === 'password') {
            input.type = 'text';
            icon.setAttribute('data-lucide', 'eye-off');
        } else {
            input.type = 'password';
            icon.setAttribute('data-lucide', 'eye');
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    handleSubmit(e, type) {
        e.preventDefault();

        const id = document.getElementById('login-id').value.trim();
        const password = document.getElementById('login-password').value;
        const idError = document.getElementById('login-id-error');
        const passError = document.getElementById('login-password-error');

        // Clear errors
        idError.textContent = '';
        passError.textContent = '';
        document.getElementById('login-id').classList.remove('error');
        document.getElementById('login-password').classList.remove('error');

        // Validate
        if (!id) {
            idError.textContent = type === 'admin' ? 'Admin ID is required' : 'Email address is required';
            document.getElementById('login-id').classList.add('error');
            return;
        }

        if (type === 'user' && !SentinelValidators.isValidEmail(id)) {
            idError.textContent = 'Please enter a valid email address';
            document.getElementById('login-id').classList.add('error');
            return;
        }

        if (!password) {
            passError.textContent = 'Password is required';
            document.getElementById('login-password').classList.add('error');
            return;
        }

        // Attempt login
        const btn = document.getElementById('login-submit-btn');
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" class="animate-spin"></i> Signing in...';
        if (typeof lucide !== 'undefined') lucide.createIcons();

        setTimeout(() => {
            let result;
            if (type === 'admin') {
                result = SentinelAuth.adminLogin(id, password);
            } else {
                result = SentinelAuth.userLogin(id, password);
            }

            if (result.success) {
                SentinelToast.success('Welcome!', `Logged in as ${result.session.user.fullName}`);
                if (type === 'admin') {
                    location.hash = '#/admin/dashboard';
                } else {
                    location.hash = '#/user/live-cctv';
                }
            } else {
                SentinelToast.error('Login Failed', result.error);
                btn.disabled = false;
                btn.innerHTML = '<i data-lucide="log-in"></i> Sign In';
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        }, 800); // Simulate brief loading
    },

    init() {
        // Focus first input
        const firstInput = document.getElementById('login-id');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 300);
        }
    }
};

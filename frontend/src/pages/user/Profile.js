/* ============================================================
   SENTINEL PRO — User Profile Page
   ============================================================ */

const UserProfile = {
    render() {
        const user = SentinelAuth.getCurrentUser();
        if (!user) return '<div>Not authenticated</div>';

        const initials = SentinelHelpers.getInitials(user.fullName);

        return `
            <div class="panel-layout">
                ${UserSidebar.render('profile')}
                <main class="panel-content">
                    <div class="page-header">
                        <div>
                            <h1 class="page-title">My Profile</h1>
                            <p class="page-subtitle">View and manage your account information</p>
                        </div>
                    </div>

                    <div class="profile-layout">
                        <!-- Profile Card -->
                        <div class="card profile-card">
                            <div class="profile-avatar-lg">${initials}</div>
                            <div class="profile-name">${SentinelHelpers.escapeHtml(user.fullName)}</div>
                            <div class="profile-email">${SentinelHelpers.escapeHtml(user.email)}</div>
                            <span class="badge badge-green" style="margin-top:var(--sp-3);">Active</span>

                            <div class="profile-details">
                                <div class="profile-detail-item">
                                    <i data-lucide="user"></i>
                                    <div>
                                        <div class="profile-detail-label">Full Name</div>
                                        <div class="profile-detail-value">${SentinelHelpers.escapeHtml(user.fullName)}</div>
                                    </div>
                                </div>
                                <div class="profile-detail-item">
                                    <i data-lucide="mail"></i>
                                    <div>
                                        <div class="profile-detail-label">Email (User ID)</div>
                                        <div class="profile-detail-value">${SentinelHelpers.escapeHtml(user.email)}</div>
                                    </div>
                                </div>
                                <div class="profile-detail-item">
                                    <i data-lucide="phone"></i>
                                    <div>
                                        <div class="profile-detail-label">Mobile</div>
                                        <div class="profile-detail-value">${user.countryCode || ''} ${SentinelHelpers.escapeHtml(user.mobile || 'Not set')}</div>
                                    </div>
                                </div>
                                <div class="profile-detail-item">
                                    <i data-lucide="briefcase"></i>
                                    <div>
                                        <div class="profile-detail-label">Designation</div>
                                        <div class="profile-detail-value">${SentinelHelpers.escapeHtml(user.designation || 'Not set')}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Change Password -->
                        <div>
                            <div class="card">
                                <div class="card-header">
                                    <h3 class="card-title"><i data-lucide="lock" style="width:18px;height:18px;display:inline;vertical-align:middle;margin-right:6px;"></i>Change Password</h3>
                                </div>
                                <form id="change-password-form" onsubmit="UserProfile.handleChangePassword(event)" style="display:flex;flex-direction:column;gap:var(--sp-4);">
                                    <div class="form-group">
                                        <label class="form-label" for="current-password">Current Password</label>
                                        <input type="password" class="form-input" id="current-password" placeholder="Enter current password">
                                        <div class="form-error" id="err-currentPassword"></div>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label" for="new-password">New Password</label>
                                        <input type="password" class="form-input" id="new-password" placeholder="Enter new password" oninput="UserProfile.updateStrength(this.value)">
                                        <div class="form-error" id="err-newPassword"></div>
                                        <div id="profile-password-strength" style="margin-top:4px;"></div>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label" for="confirm-password">Confirm New Password</label>
                                        <input type="password" class="form-input" id="confirm-password" placeholder="Confirm new password">
                                        <div class="form-error" id="err-confirmPassword"></div>
                                    </div>
                                    <button type="submit" class="btn btn-blue" style="align-self:flex-start;">
                                        <i data-lucide="check"></i> Update Password
                                    </button>
                                </form>
                            </div>

                            <div class="card" style="margin-top:var(--sp-4);">
                                <div class="card-header">
                                    <h3 class="card-title"><i data-lucide="info" style="width:18px;height:18px;display:inline;vertical-align:middle;margin-right:6px;"></i>Account Information</h3>
                                </div>
                                <div style="display:flex;flex-direction:column;gap:var(--sp-3);">
                                    <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);">
                                        <span style="color:var(--text-secondary);">Account Status</span>
                                        <span class="badge badge-green">Active</span>
                                    </div>
                                    <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);">
                                        <span style="color:var(--text-secondary);">Role</span>
                                        <span style="font-weight:var(--fw-medium);">User</span>
                                    </div>
                                    <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);">
                                        <span style="color:var(--text-secondary);">Name Editable</span>
                                        <span style="font-weight:var(--fw-medium);color:var(--text-tertiary);">Admin Only</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        `;
    },

    updateStrength(value) {
        const str = SentinelValidators.getPasswordStrength(value);
        const el = document.getElementById('profile-password-strength');
        if (el && value) {
            el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;">
                <div style="flex:1;height:3px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;">
                    <div style="width:${str.level * 20}%;height:100%;background:${str.color};transition:width 0.3s;"></div>
                </div>
                <span style="font-size:11px;color:${str.color};font-weight:600;">${str.label}</span>
            </div>`;
        } else if (el) {
            el.innerHTML = '';
        }
    },

    handleChangePassword(e) {
        e.preventDefault();

        const data = {
            currentPassword: document.getElementById('current-password').value,
            newPassword: document.getElementById('new-password').value,
            confirmPassword: document.getElementById('confirm-password').value
        };

        // Clear errors
        ['currentPassword', 'newPassword', 'confirmPassword'].forEach(f => {
            const el = document.getElementById(`err-${f}`);
            if (el) el.textContent = '';
        });

        const validation = SentinelValidators.validateChangePassword(data);
        if (!validation.isValid) {
            Object.entries(validation.errors).forEach(([field, msg]) => {
                const el = document.getElementById(`err-${field}`);
                if (el) el.textContent = msg;
            });
            SentinelToast.error('Validation Error', 'Please fix the highlighted errors.');
            return;
        }

        const result = SentinelAuth.changePassword(data.currentPassword, data.newPassword);
        if (result.success) {
            SentinelToast.success('Password Updated', 'Your password has been changed successfully.');
            document.getElementById('change-password-form').reset();
            document.getElementById('profile-password-strength').innerHTML = '';
        } else {
            SentinelToast.error('Error', result.error);
            document.getElementById('err-currentPassword').textContent = result.error;
        }
    },

    init() {}
};

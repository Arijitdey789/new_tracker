/* ============================================================
   SENTINEL PRO — Manage Users Page (Admin)
   ============================================================ */

const ManageUsers = {
    _searchTerm: '',

    render() {
        const users = this._getFilteredUsers();

        return `
            <div class="panel-layout">
                ${AdminSidebar.render('users')}
                <main class="panel-content">
                    <div class="page-header">
                        <div>
                            <h1 class="page-title">Manage Users</h1>
                            <p class="page-subtitle">Create, manage, and monitor user accounts</p>
                        </div>
                        <div class="page-actions">
                            <button class="btn btn-blue" id="add-user-btn" onclick="ManageUsers.showAddModal()">
                                <i data-lucide="user-plus"></i>
                                Add New User
                            </button>
                        </div>
                    </div>

                    <div class="card" style="margin-bottom:var(--sp-4)">
                        <div style="display:flex;align-items:center;gap:var(--sp-4);flex-wrap:wrap;">
                            <div class="search-input-wrapper" style="flex:1;min-width:200px;">
                                <i data-lucide="search"></i>
                                <input type="text" class="form-input" placeholder="Search by name, email, or designation..." id="user-search" oninput="ManageUsers.handleSearch(this.value)">
                            </div>
                            <span style="font-size:var(--fs-sm);color:var(--text-tertiary);">${users.length} user(s) found</span>
                        </div>
                    </div>

                    <div class="card">
                        <div style="overflow-x:auto;">
                            <table class="data-table" id="users-table">
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Email / User ID</th>
                                        <th>Mobile</th>
                                        <th>Designation</th>
                                        <th>Status</th>
                                        <th>Created</th>
                                        <th style="text-align:right;">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="users-table-body">
                                    ${this._renderUserRows(users)}
                                </tbody>
                            </table>
                        </div>

                        ${users.length === 0 ? `
                            <div class="empty-state">
                                <i data-lucide="users"></i>
                                <p class="empty-state-title">No Users Found</p>
                                <p class="empty-state-text">Click "Add New User" to create the first user account.</p>
                            </div>
                        ` : ''}
                    </div>
                </main>
            </div>
        `;
    },

    _getFilteredUsers() {
        let users = SentinelStore.getUsers();
        if (this._searchTerm) {
            const term = this._searchTerm.toLowerCase();
            users = users.filter(u =>
                u.fullName.toLowerCase().includes(term) ||
                u.email.toLowerCase().includes(term) ||
                u.designation.toLowerCase().includes(term)
            );
        }
        return users;
    },

    _renderUserRows(users) {
        return users.map(u => `
            <tr>
                <td>
                    <div style="display:flex;align-items:center;gap:var(--sp-3);">
                        <div class="sidebar-avatar" style="width:32px;height:32px;font-size:var(--fs-xs);">${SentinelHelpers.getInitials(u.fullName)}</div>
                        <span style="font-weight:var(--fw-medium);">${SentinelHelpers.escapeHtml(u.fullName)}</span>
                    </div>
                </td>
                <td style="color:var(--text-secondary);">${SentinelHelpers.escapeHtml(u.email)}</td>
                <td style="white-space:nowrap;">${u.countryCode || ''} ${SentinelHelpers.escapeHtml(u.mobile || '')}</td>
                <td>${SentinelHelpers.escapeHtml(u.designation)}</td>
                <td>
                    <span class="badge badge-${u.status === 'active' ? 'green' : 'red'}">
                        ${u.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td style="white-space:nowrap;color:var(--text-tertiary);font-size:var(--fs-xs);">${SentinelHelpers.formatDate(u.createdAt)}</td>
                <td style="text-align:right;">
                    <div style="display:flex;gap:var(--sp-1);justify-content:flex-end;">
                        <button class="btn btn-icon-sm btn-ghost" onclick="ManageUsers.showEditModal('${u.id}')" title="Edit">
                            <i data-lucide="pencil" style="width:14px;height:14px;"></i>
                        </button>
                        <button class="btn btn-icon-sm btn-ghost" onclick="ManageUsers.toggleStatus('${u.id}')" title="${u.status === 'active' ? 'Deactivate' : 'Activate'}">
                            <i data-lucide="${u.status === 'active' ? 'user-x' : 'user-check'}" style="width:14px;height:14px;"></i>
                        </button>
                        <button class="btn btn-icon-sm btn-ghost" onclick="ManageUsers.confirmDelete('${u.id}')" title="Delete" style="color:var(--accent-red);">
                            <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    handleSearch(value) {
        this._searchTerm = value;
        const users = this._getFilteredUsers();
        const tbody = document.getElementById('users-table-body');
        if (tbody) tbody.innerHTML = this._renderUserRows(users);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    showAddModal() {
        const countryCodes = SentinelHelpers.getCountryCodes();
        const ccOptions = countryCodes.map(c => `<option value="${c.code}" ${c.code === '+91' ? 'selected' : ''}>${c.code} (${c.country})</option>`).join('');

        SentinelModal.show({
            title: 'Add New User',
            size: 'lg',
            content: `
                <form id="add-user-form" onsubmit="ManageUsers.handleAddUser(event)">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Full Name *</label>
                            <input type="text" class="form-input" id="user-fullname" placeholder="Enter full name">
                            <div class="form-error" id="err-fullName"></div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Email Address (User ID) *</label>
                            <input type="email" class="form-input" id="user-email" placeholder="user@example.com">
                            <div class="form-error" id="err-email"></div>
                        </div>
                    </div>
                    <div class="form-row" style="margin-top:var(--sp-4)">
                        <div class="form-group">
                            <label class="form-label">Initial Password *</label>
                            <input type="password" class="form-input" id="user-password" placeholder="Set initial password">
                            <div class="form-error" id="err-password"></div>
                            <div id="password-strength" style="margin-top:4px;"></div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Current Designation *</label>
                            <input type="text" class="form-input" id="user-designation" placeholder="e.g. Security Analyst">
                            <div class="form-error" id="err-designation"></div>
                        </div>
                    </div>
                    <div class="form-row" style="margin-top:var(--sp-4)">
                        <div class="form-group">
                            <label class="form-label">Country Code *</label>
                            <select class="form-select" id="user-countrycode" onchange="ManageUsers.onCountryCodeChange()">
                                ${ccOptions}
                            </select>
                            <div class="form-error" id="err-countryCode"></div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Mobile Number *</label>
                            <input type="tel" class="form-input" id="user-mobile" placeholder="Enter valid number" maxlength="10" oninput="this.value=this.value.replace(/\\D/g,'')">
                            <div class="form-error" id="err-mobile"></div>
                        </div>
                    </div>
                </form>
            `,
            actions: [
                { label: 'Cancel', class: 'btn btn-ghost', onClick: 'SentinelModal.close()' },
                { label: 'Create User', class: 'btn btn-blue', onClick: 'ManageUsers.handleAddUser(event)' }
            ]
        });

        // Password strength listener
        setTimeout(() => {
            const passInput = document.getElementById('user-password');
            if (passInput) {
                passInput.addEventListener('input', (e) => {
                    const str = SentinelValidators.getPasswordStrength(e.target.value);
                    const el = document.getElementById('password-strength');
                    if (el && e.target.value) {
                        el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;">
                            <div style="flex:1;height:3px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;">
                                <div style="width:${str.level * 20}%;height:100%;background:${str.color};transition:width 0.3s;"></div>
                            </div>
                            <span style="font-size:11px;color:${str.color};font-weight:600;">${str.label}</span>
                        </div>`;
                    } else if (el) {
                        el.innerHTML = '';
                    }
                });
            }
            // Set initial maxlength based on default country code (India)
            ManageUsers.onCountryCodeChange();
        }, 100);
    },

    onCountryCodeChange() {
        const ccSelect = document.getElementById('user-countrycode');
        const mobileInput = document.getElementById('user-mobile');
        if (ccSelect && mobileInput) {
            const digits = SentinelHelpers.getMobileDigitsForCountry(ccSelect.value);
            mobileInput.maxLength = digits;
            mobileInput.placeholder = `Enter valid number (${digits} digits)`;
            // Trim existing value if longer than new max
            if (mobileInput.value.length > digits) {
                mobileInput.value = mobileInput.value.slice(0, digits);
            }
        }
    },

    handleAddUser(e) {
        if (e) e.preventDefault();

        const data = {
            fullName: document.getElementById('user-fullname').value.trim(),
            email: document.getElementById('user-email').value.trim(),
            password: document.getElementById('user-password').value,
            designation: document.getElementById('user-designation').value.trim(),
            countryCode: document.getElementById('user-countrycode').value,
            mobile: document.getElementById('user-mobile').value.trim()
        };

        // Clear errors
        ['fullName', 'email', 'password', 'designation', 'countryCode', 'mobile'].forEach(f => {
            const el = document.getElementById(`err-${f}`);
            if (el) el.textContent = '';
        });

        const validation = SentinelValidators.validateUserForm(data);

        if (!validation.isValid) {
            Object.entries(validation.errors).forEach(([field, msg]) => {
                const el = document.getElementById(`err-${field}`);
                if (el) el.textContent = msg;
            });
            SentinelToast.error('Validation Error', 'Please fix the highlighted errors.');
            return;
        }

        // Check duplicate email
        if (SentinelStore.getUserByEmail(data.email)) {
            document.getElementById('err-email').textContent = 'A user with this email already exists';
            SentinelToast.error('Duplicate Email', 'This email address is already registered.');
            return;
        }

        SentinelStore.addUser(data);
        SentinelStore.addActivity({ type: 'user', message: `New user created: ${data.fullName}`, color: 'green' });
        SentinelModal.close();
        SentinelToast.success('User Created', `${data.fullName} has been added successfully.`);
        SentinelRouter.navigate(location.hash);
    },

    showEditModal(userId) {
        const user = SentinelStore.getUsers().find(u => u.id === userId);
        if (!user) return;

        const countryCodes = SentinelHelpers.getCountryCodes();
        const ccOptions = countryCodes.map(c =>
            `<option value="${c.code}" ${c.code === user.countryCode ? 'selected' : ''}>${c.code} (${c.country})</option>`
        ).join('');

        SentinelModal.show({
            title: 'Edit User',
            size: 'lg',
            content: `
                <form id="edit-user-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Full Name (Set by Admin)</label>
                            <input type="text" class="form-input" id="edit-fullname" value="${SentinelHelpers.escapeHtml(user.fullName)}" placeholder="Full name">
                            <div class="form-error" id="edit-err-fullName"></div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Email (User ID) - Cannot be changed</label>
                            <input type="email" class="form-input" value="${SentinelHelpers.escapeHtml(user.email)}" disabled style="opacity:0.6;">
                        </div>
                    </div>
                    <div class="form-row" style="margin-top:var(--sp-4)">
                        <div class="form-group">
                            <label class="form-label">Designation</label>
                            <input type="text" class="form-input" id="edit-designation" value="${SentinelHelpers.escapeHtml(user.designation)}" placeholder="Designation">
                            <div class="form-error" id="edit-err-designation"></div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Reset Password (leave blank to keep)</label>
                            <input type="password" class="form-input" id="edit-password" placeholder="New password (optional)">
                        </div>
                    </div>
                    <div class="form-row" style="margin-top:var(--sp-4)">
                        <div class="form-group">
                            <label class="form-label">Country Code</label>
                            <select class="form-select" id="edit-countrycode" onchange="ManageUsers.onEditCountryCodeChange()">
                                ${ccOptions}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Mobile Number</label>
                            <input type="tel" class="form-input" id="edit-mobile" value="${user.mobile || ''}" maxlength="10" oninput="this.value=this.value.replace(/\\D/g,'')">
                            <div class="form-error" id="edit-err-mobile"></div>
                        </div>
                    </div>
                </form>
            `,
            actions: [
                { label: 'Cancel', class: 'btn btn-ghost', onClick: 'SentinelModal.close()' },
                { label: 'Save Changes', class: 'btn btn-blue', onClick: `ManageUsers.handleEditUser('${userId}')` }
            ]
        });

        // Set initial maxlength based on user's country code
        setTimeout(() => {
            ManageUsers.onEditCountryCodeChange();
        }, 100);
    },

    onEditCountryCodeChange() {
        const ccSelect = document.getElementById('edit-countrycode');
        const mobileInput = document.getElementById('edit-mobile');
        if (ccSelect && mobileInput) {
            const digits = SentinelHelpers.getMobileDigitsForCountry(ccSelect.value);
            mobileInput.maxLength = digits;
            mobileInput.placeholder = `Enter valid number (${digits} digits)`;
            if (mobileInput.value.length > digits) {
                mobileInput.value = mobileInput.value.slice(0, digits);
            }
        }
    },

    handleEditUser(userId) {
        const updates = {
            fullName: document.getElementById('edit-fullname').value.trim(),
            designation: document.getElementById('edit-designation').value.trim(),
            countryCode: document.getElementById('edit-countrycode').value,
            mobile: document.getElementById('edit-mobile').value.trim()
        };

        const newPass = document.getElementById('edit-password').value;
        if (newPass) updates.password = newPass;

        if (!updates.fullName) {
            document.getElementById('edit-err-fullName').textContent = 'Name is required';
            return;
        }
        if (updates.mobile && !SentinelValidators.isValidMobile(updates.mobile, updates.countryCode)) {
            const expectedLen = SentinelHelpers.getMobileDigitsForCountry(updates.countryCode);
            document.getElementById('edit-err-mobile').textContent = `Must be exactly ${expectedLen} digits`;
            return;
        }

        SentinelStore.updateUser(userId, updates);
        SentinelStore.addActivity({ type: 'user', message: `User updated: ${updates.fullName}`, color: 'blue' });
        SentinelModal.close();
        SentinelToast.success('User Updated', 'User details have been saved.');
        SentinelRouter.navigate(location.hash);
    },

    toggleStatus(userId) {
        const user = SentinelStore.getUsers().find(u => u.id === userId);
        if (!user) return;

        const newStatus = user.status === 'active' ? 'inactive' : 'active';
        SentinelStore.updateUser(userId, { status: newStatus });
        SentinelStore.addActivity({
            type: 'user',
            message: `User ${newStatus === 'active' ? 'activated' : 'deactivated'}: ${user.fullName}`,
            color: newStatus === 'active' ? 'green' : 'red'
        });
        SentinelToast.info('Status Changed', `${user.fullName} is now ${newStatus}.`);
        SentinelRouter.navigate(location.hash);
    },

    confirmDelete(userId) {
        const user = SentinelStore.getUsers().find(u => u.id === userId);
        if (!user) return;

        SentinelModal.confirm({
            title: 'Delete User',
            message: `Are you sure you want to permanently delete the user "${user.fullName}"? This action cannot be undone.`,
            confirmLabel: 'Delete User',
            danger: true,
            onConfirm: () => {
                SentinelStore.deleteUser(userId);
                SentinelStore.addActivity({ type: 'user', message: `User deleted: ${user.fullName}`, color: 'red' });
                SentinelModal.close();
                SentinelToast.success('User Deleted', `${user.fullName} has been removed.`);
                SentinelRouter.navigate(location.hash);
            }
        });
    },

    init() {}
};

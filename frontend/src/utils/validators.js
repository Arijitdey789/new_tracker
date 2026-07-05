/* ============================================================
   SENTINEL PRO — Input Validators
   ============================================================ */

const SentinelValidators = {
    /**
     * Validate email address
     */
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    /**
     * Validate mobile number based on country code digit length
     */
    isValidMobile(number, countryCode) {
        if (!number) return false;
        const digits = number.replace(/\D/g, '');
        const expectedLength = countryCode
            ? SentinelHelpers.getMobileDigitsForCountry(countryCode)
            : 10;
        return digits.length === expectedLength;
    },

    /**
     * Validate password (min 6 chars)
     */
    isValidPassword(password) {
        return password && password.length >= 6;
    },

    /**
     * Validate required field
     */
    isRequired(value) {
        return value !== null && value !== undefined && value.toString().trim().length > 0;
    },

    /**
     * Validate URL format
     */
    isValidUrl(url) {
        try {
            // Allow rtsp:// and other protocols
            if (url.match(/^(rtsp|rtmp|http|https):\/\/.+/i)) return true;
            new URL(url);
            return true;
        } catch {
            return false;
        }
    },

    /**
     * Validate user creation form
     */
    validateUserForm(data) {
        const errors = {};

        if (!this.isRequired(data.fullName)) {
            errors.fullName = 'Full Name is required';
        }

        if (!this.isRequired(data.email)) {
            errors.email = 'Email Address is required';
        } else if (!this.isValidEmail(data.email)) {
            errors.email = 'Please enter a valid email address';
        }

        if (!this.isRequired(data.password)) {
            errors.password = 'Password is required';
        } else if (!this.isValidPassword(data.password)) {
            errors.password = 'Password must be at least 6 characters';
        }

        if (!this.isRequired(data.mobile)) {
            errors.mobile = 'Mobile number is required';
        } else if (!this.isValidMobile(data.mobile, data.countryCode)) {
            const expectedLen = SentinelHelpers.getMobileDigitsForCountry(data.countryCode);
            errors.mobile = `Mobile number must be exactly ${expectedLen} digits for this country`;
        }

        if (!this.isRequired(data.countryCode)) {
            errors.countryCode = 'Country code is required';
        }

        if (!this.isRequired(data.designation)) {
            errors.designation = 'Designation is required';
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    },

    /**
     * Validate stream form
     */
    validateStreamForm(data) {
        const errors = {};

        if (!this.isRequired(data.url)) {
            errors.url = 'Stream URL is required';
        } else if (!this.isValidUrl(data.url)) {
            errors.url = 'Please enter a valid stream URL';
        }

        if (!this.isRequired(data.name)) {
            errors.name = 'Camera Name is required';
        }

        if (!this.isRequired(data.location)) {
            errors.location = 'Location is required';
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    },

    /**
     * Validate change password form
     */
    validateChangePassword(data) {
        const errors = {};

        if (!this.isRequired(data.currentPassword)) {
            errors.currentPassword = 'Current password is required';
        }

        if (!this.isRequired(data.newPassword)) {
            errors.newPassword = 'New password is required';
        } else if (!this.isValidPassword(data.newPassword)) {
            errors.newPassword = 'Password must be at least 6 characters';
        }

        if (!this.isRequired(data.confirmPassword)) {
            errors.confirmPassword = 'Please confirm your new password';
        } else if (data.newPassword !== data.confirmPassword) {
            errors.confirmPassword = 'Passwords do not match';
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    },

    /**
     * Validate contact form
     */
    validateContactForm(data) {
        const errors = {};

        if (!this.isRequired(data.name)) {
            errors.name = 'Name is required';
        }

        if (!this.isRequired(data.email)) {
            errors.email = 'Email is required';
        } else if (!this.isValidEmail(data.email)) {
            errors.email = 'Please enter a valid email address';
        }

        if (!this.isRequired(data.subject)) {
            errors.subject = 'Subject is required';
        }

        if (!this.isRequired(data.message)) {
            errors.message = 'Message is required';
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    },

    /**
     * Get password strength
     */
    getPasswordStrength(password) {
        if (!password) return { level: 0, label: '', color: '' };

        let strength = 0;
        if (password.length >= 6) strength++;
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;

        if (strength <= 2) return { level: strength, label: 'Weak', color: 'var(--accent-red)' };
        if (strength <= 3) return { level: strength, label: 'Fair', color: 'var(--accent-amber)' };
        if (strength <= 4) return { level: strength, label: 'Good', color: 'var(--accent-blue)' };
        return { level: strength, label: 'Strong', color: 'var(--accent-green)' };
    }
};

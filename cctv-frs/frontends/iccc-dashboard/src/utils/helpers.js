/* ============================================================
   SENTINEL PRO — Helper Utilities
   ============================================================ */

const SentinelHelpers = {
    /**
     * Generate a unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    /**
     * Format date to locale string
     */
    formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    /**
     * Format datetime
     */
    formatDateTime(date) {
        return new Date(date).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    },

    /**
     * Format time only
     */
    formatTime(date) {
        return new Date(date).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    },

    /**
     * Get relative time string
     */
    timeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        const intervals = [
            { label: 'year', seconds: 31536000 },
            { label: 'month', seconds: 2592000 },
            { label: 'week', seconds: 604800 },
            { label: 'day', seconds: 86400 },
            { label: 'hour', seconds: 3600 },
            { label: 'minute', seconds: 60 },
            { label: 'second', seconds: 1 }
        ];

        for (const interval of intervals) {
            const count = Math.floor(seconds / interval.seconds);
            if (count >= 1) {
                return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
            }
        }
        return 'Just now';
    },

    /**
     * Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Escape HTML
     */
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /**
     * Get user initials from name
     */
    getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    },

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * Truncate text
     */
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substr(0, maxLength) + '...';
    },

    /**
     * Generate country code options
     */
    getCountryCodes() {
        return [
            { code: '+1', country: 'US / Canada' },
            { code: '+7', country: 'Russia' },
            { code: '+20', country: 'Egypt' },
            { code: '+27', country: 'South Africa' },
            { code: '+30', country: 'Greece' },
            { code: '+31', country: 'Netherlands' },
            { code: '+32', country: 'Belgium' },
            { code: '+33', country: 'France' },
            { code: '+34', country: 'Spain' },
            { code: '+36', country: 'Hungary' },
            { code: '+39', country: 'Italy' },
            { code: '+40', country: 'Romania' },
            { code: '+41', country: 'Switzerland' },
            { code: '+43', country: 'Austria' },
            { code: '+44', country: 'United Kingdom' },
            { code: '+45', country: 'Denmark' },
            { code: '+46', country: 'Sweden' },
            { code: '+47', country: 'Norway' },
            { code: '+48', country: 'Poland' },
            { code: '+49', country: 'Germany' },
            { code: '+51', country: 'Peru' },
            { code: '+52', country: 'Mexico' },
            { code: '+53', country: 'Cuba' },
            { code: '+54', country: 'Argentina' },
            { code: '+55', country: 'Brazil' },
            { code: '+56', country: 'Chile' },
            { code: '+57', country: 'Colombia' },
            { code: '+58', country: 'Venezuela' },
            { code: '+60', country: 'Malaysia' },
            { code: '+61', country: 'Australia' },
            { code: '+62', country: 'Indonesia' },
            { code: '+63', country: 'Philippines' },
            { code: '+64', country: 'New Zealand' },
            { code: '+65', country: 'Singapore' },
            { code: '+66', country: 'Thailand' },
            { code: '+81', country: 'Japan' },
            { code: '+82', country: 'South Korea' },
            { code: '+84', country: 'Vietnam' },
            { code: '+86', country: 'China' },
            { code: '+90', country: 'Turkey' },
            { code: '+91', country: 'India' },
            { code: '+92', country: 'Pakistan' },
            { code: '+93', country: 'Afghanistan' },
            { code: '+94', country: 'Sri Lanka' },
            { code: '+95', country: 'Myanmar' },
            { code: '+98', country: 'Iran' },
            { code: '+212', country: 'Morocco' },
            { code: '+213', country: 'Algeria' },
            { code: '+216', country: 'Tunisia' },
            { code: '+218', country: 'Libya' },
            { code: '+220', country: 'Gambia' },
            { code: '+221', country: 'Senegal' },
            { code: '+233', country: 'Ghana' },
            { code: '+234', country: 'Nigeria' },
            { code: '+249', country: 'Sudan' },
            { code: '+250', country: 'Rwanda' },
            { code: '+251', country: 'Ethiopia' },
            { code: '+254', country: 'Kenya' },
            { code: '+255', country: 'Tanzania' },
            { code: '+256', country: 'Uganda' },
            { code: '+260', country: 'Zambia' },
            { code: '+263', country: 'Zimbabwe' },
            { code: '+351', country: 'Portugal' },
            { code: '+352', country: 'Luxembourg' },
            { code: '+353', country: 'Ireland' },
            { code: '+354', country: 'Iceland' },
            { code: '+358', country: 'Finland' },
            { code: '+359', country: 'Bulgaria' },
            { code: '+370', country: 'Lithuania' },
            { code: '+371', country: 'Latvia' },
            { code: '+372', country: 'Estonia' },
            { code: '+380', country: 'Ukraine' },
            { code: '+381', country: 'Serbia' },
            { code: '+385', country: 'Croatia' },
            { code: '+386', country: 'Slovenia' },
            { code: '+420', country: 'Czech Republic' },
            { code: '+421', country: 'Slovakia' },
            { code: '+852', country: 'Hong Kong' },
            { code: '+853', country: 'Macau' },
            { code: '+855', country: 'Cambodia' },
            { code: '+856', country: 'Laos' },
            { code: '+880', country: 'Bangladesh' },
            { code: '+886', country: 'Taiwan' },
            { code: '+960', country: 'Maldives' },
            { code: '+961', country: 'Lebanon' },
            { code: '+962', country: 'Jordan' },
            { code: '+963', country: 'Syria' },
            { code: '+964', country: 'Iraq' },
            { code: '+965', country: 'Kuwait' },
            { code: '+966', country: 'Saudi Arabia' },
            { code: '+967', country: 'Yemen' },
            { code: '+968', country: 'Oman' },
            { code: '+970', country: 'Palestine' },
            { code: '+971', country: 'UAE' },
            { code: '+972', country: 'Israel' },
            { code: '+973', country: 'Bahrain' },
            { code: '+974', country: 'Qatar' },
            { code: '+975', country: 'Bhutan' },
            { code: '+976', country: 'Mongolia' },
            { code: '+977', country: 'Nepal' },
            { code: '+992', country: 'Tajikistan' },
            { code: '+993', country: 'Turkmenistan' },
            { code: '+994', country: 'Azerbaijan' },
            { code: '+995', country: 'Georgia' },
            { code: '+996', country: 'Kyrgyzstan' },
            { code: '+998', country: 'Uzbekistan' }
        ];
    },

    /**
     * Get valid mobile number digit length for a given country code
     */
    getMobileDigitsForCountry(countryCode) {
        const digitMap = {
            '+1': 10,      // US / Canada
            '+7': 10,      // Russia
            '+20': 10,     // Egypt
            '+27': 9,      // South Africa
            '+30': 10,     // Greece
            '+31': 9,      // Netherlands
            '+32': 9,      // Belgium
            '+33': 9,      // France
            '+34': 9,      // Spain
            '+36': 9,      // Hungary
            '+39': 10,     // Italy
            '+40': 10,     // Romania
            '+41': 9,      // Switzerland
            '+43': 10,     // Austria
            '+44': 10,     // United Kingdom
            '+45': 8,      // Denmark
            '+46': 9,      // Sweden
            '+47': 8,      // Norway
            '+48': 9,      // Poland
            '+49': 11,     // Germany
            '+51': 9,      // Peru
            '+52': 10,     // Mexico
            '+53': 8,      // Cuba
            '+54': 10,     // Argentina
            '+55': 11,     // Brazil
            '+56': 9,      // Chile
            '+57': 10,     // Colombia
            '+58': 10,     // Venezuela
            '+60': 10,     // Malaysia
            '+61': 9,      // Australia
            '+62': 11,     // Indonesia
            '+63': 10,     // Philippines
            '+64': 9,      // New Zealand
            '+65': 8,      // Singapore
            '+66': 9,      // Thailand
            '+81': 10,     // Japan
            '+82': 10,     // South Korea
            '+84': 9,      // Vietnam
            '+86': 11,     // China
            '+90': 10,     // Turkey
            '+91': 10,     // India
            '+92': 10,     // Pakistan
            '+93': 9,      // Afghanistan
            '+94': 9,      // Sri Lanka
            '+95': 9,      // Myanmar
            '+98': 10,     // Iran
            '+212': 9,     // Morocco
            '+213': 9,     // Algeria
            '+216': 8,     // Tunisia
            '+218': 10,    // Libya
            '+220': 7,     // Gambia
            '+221': 9,     // Senegal
            '+233': 9,     // Ghana
            '+234': 10,    // Nigeria
            '+249': 9,     // Sudan
            '+250': 9,     // Rwanda
            '+251': 9,     // Ethiopia
            '+254': 9,     // Kenya
            '+255': 9,     // Tanzania
            '+256': 9,     // Uganda
            '+260': 9,     // Zambia
            '+263': 9,     // Zimbabwe
            '+351': 9,     // Portugal
            '+352': 9,     // Luxembourg
            '+353': 9,     // Ireland
            '+354': 7,     // Iceland
            '+358': 10,    // Finland
            '+359': 9,     // Bulgaria
            '+370': 8,     // Lithuania
            '+371': 8,     // Latvia
            '+372': 8,     // Estonia
            '+380': 9,     // Ukraine
            '+381': 9,     // Serbia
            '+385': 9,     // Croatia
            '+386': 8,     // Slovenia
            '+420': 9,     // Czech Republic
            '+421': 9,     // Slovakia
            '+852': 8,     // Hong Kong
            '+853': 8,     // Macau
            '+855': 9,     // Cambodia
            '+856': 8,     // Laos
            '+880': 10,    // Bangladesh
            '+886': 9,     // Taiwan
            '+960': 7,     // Maldives
            '+961': 8,     // Lebanon
            '+962': 9,     // Jordan
            '+963': 9,     // Syria
            '+964': 10,    // Iraq
            '+965': 8,     // Kuwait
            '+966': 9,     // Saudi Arabia
            '+967': 9,     // Yemen
            '+968': 8,     // Oman
            '+970': 9,     // Palestine
            '+971': 9,     // UAE
            '+972': 9,     // Israel
            '+973': 8,     // Bahrain
            '+974': 8,     // Qatar
            '+975': 8,     // Bhutan
            '+976': 8,     // Mongolia
            '+977': 10,    // Nepal
            '+992': 9,     // Tajikistan
            '+993': 8,     // Turkmenistan
            '+994': 9,     // Azerbaijan
            '+995': 9,     // Georgia
            '+996': 9,     // Kyrgyzstan
            '+998': 9      // Uzbekistan
        };
        return digitMap[countryCode] || 10;
    },

    /**
     * Create a simple bar chart with canvas
     */
    renderBarChart(canvas, data, labels, color) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const w = rect.width;
        const h = rect.height;
        const padding = { top: 20, right: 20, bottom: 30, left: 40 };
        const chartW = w - padding.left - padding.right;
        const chartH = h - padding.top - padding.bottom;
        const maxVal = Math.max(...data) || 1;

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Grid lines
        const gridLines = 4;
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border-primary').trim();
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (chartH / gridLines) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();
        }

        // Bars
        const barWidth = (chartW / data.length) * 0.6;
        const gap = (chartW / data.length) * 0.4;

        data.forEach((val, i) => {
            const barH = (val / maxVal) * chartH;
            const x = padding.left + (chartW / data.length) * i + gap / 2;
            const y = padding.top + chartH - barH;

            // Bar gradient
            const gradient = ctx.createLinearGradient(x, y, x, y + barH);
            gradient.addColorStop(0, color || '#3b82f6');
            gradient.addColorStop(1, (color || '#3b82f6') + '60');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barH, [4, 4, 0, 0]);
            ctx.fill();

            // Label
            if (labels && labels[i]) {
                ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-tertiary').trim();
                ctx.font = '11px Inter';
                ctx.textAlign = 'center';
                ctx.fillText(labels[i], x + barWidth / 2, h - 8);
            }
        });

        // Y-axis labels
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-tertiary').trim();
        ctx.font = '10px Inter';
        ctx.textAlign = 'right';
        for (let i = 0; i <= gridLines; i++) {
            const val = Math.round(maxVal - (maxVal / gridLines) * i);
            const y = padding.top + (chartH / gridLines) * i + 4;
            ctx.fillText(val.toString(), padding.left - 8, y);
        }
    }
};

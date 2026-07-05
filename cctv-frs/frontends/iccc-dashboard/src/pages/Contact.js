/* ============================================================
   SENTINEL PRO — Contact Us Page
   ============================================================ */

const ContactPage = {
    render() {
        return `
            ${Navbar.render()}

            <div class="contact-layout">
                <div class="contact-info">
                    <div>
                        <div class="section-label">Get In Touch</div>
                        <h2 class="section-title" style="text-align:left;margin-bottom:var(--sp-3)">Contact Us</h2>
                        <p style="color:var(--text-secondary);font-size:var(--fs-base);line-height:1.6;margin-bottom:var(--sp-8)">
                            Have questions about SENTINEL PRO? Need technical support or want to discuss enterprise deployment? Our team is here to help.
                        </p>
                    </div>

                    <div class="contact-info-item">
                        <div class="contact-info-icon">
                            <i data-lucide="map-pin"></i>
                        </div>
                        <div>
                            <div class="contact-info-label">Address</div>
                            <div class="contact-info-value">SENTINEL PRO Technologies<br>Enterprise Solutions Division</div>
                        </div>
                    </div>

                    <div class="contact-info-item">
                        <div class="contact-info-icon">
                            <i data-lucide="mail"></i>
                        </div>
                        <div>
                            <div class="contact-info-label">Email</div>
                            <div class="contact-info-value">support@sentinelpro.com</div>
                        </div>
                    </div>

                    <div class="contact-info-item">
                        <div class="contact-info-icon">
                            <i data-lucide="phone"></i>
                        </div>
                        <div>
                            <div class="contact-info-label">Phone</div>
                            <div class="contact-info-value">+1 (800) SENTINEL</div>
                        </div>
                    </div>

                    <div class="contact-info-item">
                        <div class="contact-info-icon">
                            <i data-lucide="clock"></i>
                        </div>
                        <div>
                            <div class="contact-info-label">Support Hours</div>
                            <div class="contact-info-value">24/7 Technical Support</div>
                        </div>
                    </div>
                </div>

                <div class="card" style="align-self:center;">
                    <div class="card-header" style="margin-bottom:var(--sp-6)">
                        <h3 class="card-title">Send us a Message</h3>
                    </div>

                    <form id="contact-form" onsubmit="ContactPage.handleSubmit(event)" style="display:flex;flex-direction:column;gap:var(--sp-4)">
                        <div class="form-group">
                            <label class="form-label" for="contact-name">Full Name</label>
                            <input type="text" id="contact-name" class="form-input" placeholder="Enter your full name">
                            <div class="form-error" id="contact-name-error"></div>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="contact-email">Email Address</label>
                            <input type="email" id="contact-email" class="form-input" placeholder="Enter your email address">
                            <div class="form-error" id="contact-email-error"></div>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="contact-subject">Subject</label>
                            <input type="text" id="contact-subject" class="form-input" placeholder="What is this regarding?">
                            <div class="form-error" id="contact-subject-error"></div>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="contact-message">Message</label>
                            <textarea id="contact-message" class="form-textarea" placeholder="Describe your query or request..." rows="4"></textarea>
                            <div class="form-error" id="contact-message-error"></div>
                        </div>

                        <button type="submit" class="btn btn-blue btn-lg" style="width:100%" id="contact-submit-btn">
                            <i data-lucide="send"></i>
                            Send Message
                        </button>
                    </form>
                </div>
            </div>

            <footer class="landing-footer">
                <div class="footer-content">
                    <div class="footer-text">2026 SENTINEL PRO. All rights reserved.</div>
                    <div class="footer-links">
                        <a class="footer-link" onclick="location.hash='#/'">Home</a>
                        <a class="footer-link">Privacy Policy</a>
                    </div>
                </div>
            </footer>
        `;
    },

    handleSubmit(e) {
        e.preventDefault();

        const data = {
            name: document.getElementById('contact-name').value.trim(),
            email: document.getElementById('contact-email').value.trim(),
            subject: document.getElementById('contact-subject').value.trim(),
            message: document.getElementById('contact-message').value.trim()
        };

        // Clear previous errors
        ['name', 'email', 'subject', 'message'].forEach(field => {
            document.getElementById(`contact-${field}-error`).textContent = '';
            document.getElementById(`contact-${field}`).classList.remove('error');
        });

        const validation = SentinelValidators.validateContactForm(data);

        if (!validation.isValid) {
            Object.entries(validation.errors).forEach(([field, msg]) => {
                const errorEl = document.getElementById(`contact-${field}-error`);
                const inputEl = document.getElementById(`contact-${field}`);
                if (errorEl) errorEl.textContent = msg;
                if (inputEl) inputEl.classList.add('error');
            });
            return;
        }

        const btn = document.getElementById('contact-submit-btn');
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" class="animate-spin"></i> Sending...';
        if (typeof lucide !== 'undefined') lucide.createIcons();

        setTimeout(() => {
            SentinelToast.success('Message Sent', 'Thank you for reaching out. We will get back to you shortly.');
            document.getElementById('contact-form').reset();
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="send"></i> Send Message';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }, 1500);
    },

    init() {
        Navbar.initScroll();
    }
};

/* ============================================================
   SENTINEL PRO — Home / Landing Page
   ============================================================ */

const HomePage = {
    render() {
        return `
            ${Navbar.render()}

            <section class="hero" id="hero-section">
                <div class="hero-grid"></div>
                <div class="hero-content">
                    <div class="hero-badge">
                        <i data-lucide="shield-check" style="width:14px;height:14px;"></i>
                        AI-Powered Surveillance Platform
                    </div>
                    <h1 class="hero-title">
                        Next-Gen Security with<br>
                        <span class="gradient-text">SENTINEL PRO</span>
                    </h1>
                    <p class="hero-subtitle">
                        Enterprise-grade AI surveillance platform for real-time person tracking, 
                        intelligent detection, and automated evidence management. Protect what matters most.
                    </p>
                    <div class="hero-actions">
                        <button class="btn btn-blue btn-lg" onclick="location.hash='#/admin-login'">
                            <i data-lucide="shield"></i>
                            Admin Panel
                        </button>
                        <button class="btn btn-ghost btn-lg" onclick="location.hash='#/user-login'" style="border-color:var(--border-secondary)">
                            <i data-lucide="user"></i>
                            User Panel
                        </button>
                    </div>
                    <div class="hero-stats">
                        <div class="hero-stat">
                            <div class="hero-stat-value">3000+</div>
                            <div class="hero-stat-label">CCTV Streams</div>
                        </div>
                        <div class="hero-stat">
                            <div class="hero-stat-value">99.9%</div>
                            <div class="hero-stat-label">Accuracy</div>
                        </div>
                        <div class="hero-stat">
                            <div class="hero-stat-value">24/7</div>
                            <div class="hero-stat-label">Monitoring</div>
                        </div>
                        <div class="hero-stat">
                            <div class="hero-stat-value">&lt;1s</div>
                            <div class="hero-stat-label">Detection</div>
                        </div>
                    </div>
                </div>
            </section>

            <section class="features-section" id="features-section">
                <div class="section-header">
                    <div class="section-label">Core Capabilities</div>
                    <h2 class="section-title">Powerful Features for Modern Surveillance</h2>
                    <p class="section-desc">
                        Built with cutting-edge AI technology to deliver real-time detection, 
                        automated evidence storage, and comprehensive analytics.
                    </p>
                </div>

                <div class="features-grid">
                    <div class="feature-card animate-fade-in-up stagger-1" style="opacity:0">
                        <div class="feature-icon blue">
                            <i data-lucide="video"></i>
                        </div>
                        <h3 class="feature-title">Live CCTV Monitoring</h3>
                        <p class="feature-desc">Monitor up to 3,000+ CCTV streams simultaneously with intelligent grid layout and automatic suspect highlighting.</p>
                    </div>

                    <div class="feature-card animate-fade-in-up stagger-2" style="opacity:0">
                        <div class="feature-icon red">
                            <i data-lucide="scan-face"></i>
                        </div>
                        <h3 class="feature-title">AI-Powered Detection</h3>
                        <p class="feature-desc">Advanced face, body, and hybrid detection modes with adjustable threshold for precise person identification.</p>
                    </div>

                    <div class="feature-card animate-fade-in-up stagger-3" style="opacity:0">
                        <div class="feature-icon green">
                            <i data-lucide="archive"></i>
                        </div>
                        <h3 class="feature-title">Evidence Vault</h3>
                        <p class="feature-desc">Automatic evidence storage with video clips and detailed PDF reports generated for every detection event.</p>
                    </div>

                    <div class="feature-card animate-fade-in-up stagger-4" style="opacity:0">
                        <div class="feature-icon purple">
                            <i data-lucide="film"></i>
                        </div>
                        <h3 class="feature-title">Video Post Processing</h3>
                        <p class="feature-desc">Upload and analyze recorded videos with real-time progress tracking and comprehensive result reports.</p>
                    </div>

                    <div class="feature-card animate-fade-in-up stagger-5" style="opacity:0">
                        <div class="feature-icon amber">
                            <i data-lucide="bell-ring"></i>
                        </div>
                        <h3 class="feature-title">Instant Alerts</h3>
                        <p class="feature-desc">Real-time detection alerts with camera name, location, timestamp, and detailed detection summary.</p>
                    </div>

                    <div class="feature-card animate-fade-in-up stagger-6" style="opacity:0">
                        <div class="feature-icon cyan">
                            <i data-lucide="bar-chart-3"></i>
                        </div>
                        <h3 class="feature-title">Analytics Dashboard</h3>
                        <p class="feature-desc">Comprehensive system reports, detection analytics, history analysis, and user management for administrators.</p>
                    </div>
                </div>
            </section>

            <section class="cta-section" id="cta-section">
                <div class="cta-card">
                    <h2 class="cta-title">Ready to Secure Your Premises?</h2>
                    <p class="cta-desc">Get started with SENTINEL PRO today and experience enterprise-grade surveillance at your fingertips.</p>
                    <div class="cta-actions">
                        <button class="btn btn-blue btn-lg" onclick="location.hash='#/admin-login'">
                            <i data-lucide="shield"></i>
                            Access Admin Panel
                        </button>
                        <button class="btn btn-ghost btn-lg" onclick="location.hash='#/contact'">
                            <i data-lucide="mail"></i>
                            Contact Us
                        </button>
                    </div>
                </div>
            </section>

            <footer class="landing-footer">
                <div class="footer-content">
                    <div class="footer-text">
                        2026 SENTINEL PRO. All rights reserved. Enterprise Surveillance Platform.
                    </div>
                    <div class="footer-links">
                        <a class="footer-link" onclick="location.hash='#/contact'">Contact</a>
                        <a class="footer-link">Privacy Policy</a>
                        <a class="footer-link">Terms of Service</a>
                    </div>
                </div>
            </footer>
        `;
    },

    init() {
        Navbar.initScroll();

        // Intersection Observer for feature card animations
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.feature-card').forEach(card => {
            observer.observe(card);
        });
    }
};

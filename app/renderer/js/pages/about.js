/**
 * About Page - App information, version, tech stack, and developer message
 */

const AboutPage = {
    appName: 'CineStream',
    version: '1.4.1',
    author: 'Sushan Fernando',
    buildDate: 'February 2026',

    async render() {
        const container = document.getElementById('main-content');

        container.innerHTML = `
            <div class="about-page fade-in">
                <div class="about-header">
                    <div class="about-logo">
                        <img src="assets/icon.png" width="96" height="96" alt="CineStream Logo" style="border-radius: 20px; box-shadow: 0 10px 25px rgba(0,255,100,0.2); display: block; margin: 0 auto;">
                    </div>
                    <h1>${this.appName}</h1>
                    <p class="version-badge">Version ${this.version}</p>
                    <p class="author-badge">by ${this.author}</p>
                </div>

                <div class="about-content">
                    <!-- App Info Card -->
                    <div class="about-card">
                        <h2>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="16" x2="12" y2="12"/>
                                <line x1="12" y1="8" x2="12.01" y2="8"/>
                            </svg>
                            About This App
                        </h2>
                        <p class="about-description">
                            Movie App is a modern streaming application that lets you discover, browse, and watch 
                            movies, TV series, and anime. Built with performance and user experience in mind, 
                            it provides a seamless entertainment experience right on your desktop.
                        </p>
                    </div>

                    <!-- Version Info -->
                    <div class="about-card">
                        <h2>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 20h9"/>
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                            </svg>
                            Version Information
                        </h2>
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">Version</span>
                                <span class="info-value">${this.version}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Author</span>
                                <span class="info-value">${this.author}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Build Date</span>
                                <span class="info-value">${this.buildDate}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Platform</span>
                                <span class="info-value">Windows, macOS, Linux</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">License</span>
                                <span class="info-value">Personal Use</span>
                            </div>
                        </div>
                    </div>

                    <!-- Technology Stack -->
                    <div class="about-card">
                        <h2>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="16 18 22 12 16 6"/>
                                <polyline points="8 6 2 12 8 18"/>
                            </svg>
                            Technology Stack
                        </h2>
                        <div class="tech-stack">
                            <div class="tech-item">
                                <div class="tech-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                                    </svg>
                                </div>
                                <div class="tech-info">
                                    <span class="tech-name">Electron</span>
                                    <span class="tech-desc">Cross-platform desktop framework</span>
                                </div>
                            </div>
                            <div class="tech-item">
                                <div class="tech-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="16 18 22 12 16 6"/>
                                        <polyline points="8 6 2 12 8 18"/>
                                    </svg>
                                </div>
                                <div class="tech-info">
                                    <span class="tech-name">JavaScript</span>
                                    <span class="tech-desc">Primary programming language</span>
                                </div>
                            </div>
                            <div class="tech-item">
                                <div class="tech-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"/>
                                        <polygon points="10 8 16 12 10 16 10 8"/>
                                    </svg>
                                </div>
                                <div class="tech-info">
                                    <span class="tech-name">Fastify</span>
                                    <span class="tech-desc">High-performance backend server</span>
                                </div>
                            </div>
                            <div class="tech-item">
                                <div class="tech-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                                        <line x1="7" y1="2" x2="7" y2="22"/>
                                        <line x1="17" y1="2" x2="17" y2="22"/>
                                        <line x1="2" y1="12" x2="22" y2="12"/>
                                    </svg>
                                </div>
                                <div class="tech-info">
                                    <span class="tech-name">TMDB API</span>
                                    <span class="tech-desc">Movie & TV metadata provider</span>
                                </div>
                            </div>
                            <div class="tech-item">
                                <div class="tech-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <ellipse cx="12" cy="5" rx="9" ry="3"/>
                                        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                                        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                                    </svg>
                                </div>
                                <div class="tech-info">
                                    <span class="tech-name">SQLite</span>
                                    <span class="tech-desc">Local database storage</span>
                                </div>
                            </div>
                            <div class="tech-item">
                                <div class="tech-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <polyline points="7 10 12 15 17 10"/>
                                        <line x1="12" y1="15" x2="12" y2="3"/>
                                    </svg>
                                </div>
                                <div class="tech-info">
                                    <span class="tech-name">WebTorrent</span>
                                    <span class="tech-desc">Peer-to-peer streaming</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Features -->
                    <div class="about-card">
                        <h2>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                            </svg>
                            Key Features
                        </h2>
                        <ul class="features-list">
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polygon points="5 3 19 12 5 21 5 3"/>
                                </svg>
                                Stream movies, TV series, and anime
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="11" cy="11" r="8"/>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                </svg>
                                Advanced search and discover functionality
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <polyline points="7 10 12 15 17 10"/>
                                    <line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                                Download content for offline viewing
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                    <circle cx="12" cy="7" r="4"/>
                                </svg>
                                User profiles with personalization
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                                </svg>
                                Beautiful dark theme interface
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                                </svg>
                                Fast and responsive performance
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                                    <line x1="4" y1="22" x2="4" y2="15"/>
                                </svg>
                                Report issues directly to developers
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                                Secure user authentication
                            </li>
                        </ul>
                    </div>

                    <!-- Developer Message -->
                    <div class="about-card developer-card">
                        <h2>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                            Message from the Developer
                        </h2>
                        <div class="developer-message">
                            <p>
                                Thank you for using Movie App! This application was built with passion and dedication 
                                to provide you with the best entertainment experience. I'm constantly working to 
                                improve and add new features.
                            </p>
                            <p>
                                If you encounter any issues or have suggestions, please use the "Report" feature 
                                in the sidebar. Your feedback helps make this app better for everyone.
                            </p>
                            <p class="signature">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; vertical-align: middle; margin-right: 6px;">
                                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                                    <polygon points="10 8 16 12 10 16 10 8"/>
                                </svg>
                                Happy watching!
                            </p>
                        </div>
                    </div>

                    <!-- Credits -->
                    <div class="about-card">
                        <h2>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                            </svg>
                            Credits & Acknowledgments
                        </h2>
                        <div class="credits-list">
                            <div class="credit-item">
                                <span class="credit-label">Movie Data</span>
                                <span class="credit-value">The Movie Database (TMDB)</span>
                            </div>
                            <div class="credit-item">
                                <span class="credit-label">Icons</span>
                                <span class="credit-value">Feather Icons</span>
                            </div>
                            <div class="credit-item">
                                <span class="credit-label">Fonts</span>
                                <span class="credit-value">System Default</span>
                            </div>
                        </div>
                        <p class="disclaimer">
                            This product uses the TMDB API but is not endorsed or certified by TMDB.
                        </p>
                    </div>
                </div>

                <div class="about-footer">
                    <p>© 2026 ${this.author}. All rights reserved.</p>
                </div>
            </div>
        `;
    }
};

window.AboutPage = AboutPage;

/**
 * Authentication Page - Sign In / Sign Up
 */

const AuthPage = {
    isSignUp: true,
    posters: [],

    async render() {
        const container = document.getElementById('main-content');

        // Show loading while fetching movie posters
        container.innerHTML = `
            <div class="loading-screen">
                <div class="loading-spinner"></div>
                <p>Loading...</p>
            </div>
        `;

        // Fetch movie posters for background animation
        try {
            const [trending, popular] = await Promise.all([
                api.movies.getTrending(),
                api.movies.getPopular()
            ]);

            this.posters = [
                ...trending.results.slice(0, 10),
                ...popular.results.slice(0, 10)
            ].filter(m => m.poster);
        } catch (error) {
            console.error('Failed to load posters:', error);
        }

        this.renderContent(container);
        this.attachEventListeners();
    },

    renderContent(container) {
        const postersHTML = this.posters.map((movie, index) => `
            <div class="poster-item" style="animation-delay: ${index * 0.1}s">
                <img src="${movie.poster}" alt="${movie.title}" loading="lazy">
            </div>
        `).join('');

        container.innerHTML = `
            <div class="auth-page">
                <!-- Animated Poster Background -->
                <div class="poster-background">
                    <div class="poster-grid">
                        ${postersHTML}
                        ${postersHTML}
                    </div>
                </div>
                <div class="poster-overlay"></div>

                <!-- Auth Form Container -->
                <div class="auth-container">
                    <div class="auth-card">
                        <!-- Logo/Header -->
                        <div class="auth-header">
                            <div class="auth-logo">
                                <img src="assets/icon.png" width="80" height="80" alt="CineStream Logo" style="border-radius: 20px; display: block; margin: 0 auto;">
                            </div>
                            <h1 class="auth-title">CineStream</h1>
                            <p class="auth-subtitle">Your Ultimate Streaming Destination</p>
                        </div>

                        <!-- Sign Up Form -->
                        <form class="auth-form" id="signup-form" style="display: block;">
                            <div class="form-row">
                                <div class="form-group">
                                    <label>First Name</label>
                                    <div class="input-wrapper">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                            <circle cx="12" cy="7" r="4"/>
                                        </svg>
                                        <input type="text" id="signup-firstname" placeholder="First name" required>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label>Last Name</label>
                                    <div class="input-wrapper">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                            <circle cx="12" cy="7" r="4"/>
                                        </svg>
                                        <input type="text" id="signup-lastname" placeholder="Last name" required>
                                    </div>
                                </div>
                            </div>

                            <div class="form-group">
                                <label>Birthday</label>
                                <div class="input-wrapper">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                        <line x1="16" y1="2" x2="16" y2="6"/>
                                        <line x1="8" y1="2" x2="8" y2="6"/>
                                        <line x1="3" y1="10" x2="21" y2="10"/>
                                    </svg>
                                    <input type="date" id="signup-birthday" required>
                                </div>
                            </div>

                            <div class="form-group">
                                <label>Email Address</label>
                                <div class="input-wrapper">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                        <polyline points="22,6 12,13 2,6"/>
                                    </svg>
                                    <input type="email" id="signup-email" placeholder="Enter your email" required>
                                </div>
                            </div>

                            <div class="form-group">
                                <label>Password</label>
                                <div class="input-wrapper">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                    </svg>
                                    <input type="password" id="signup-password" placeholder="Create a password" required minlength="6">
                                    <button type="button" class="toggle-password" data-target="signup-password">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                            <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div class="form-group">
                                <label>Confirm Password</label>
                                <div class="input-wrapper">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                    </svg>
                                    <input type="password" id="signup-confirm" placeholder="Confirm your password" required>
                                    <button type="button" class="toggle-password" data-target="signup-confirm">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                            <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <button type="submit" class="btn-auth">Sign Up</button>

                            <p class="auth-error" id="signup-error"></p>

                            <p class="auth-switch">
                                Already have an account? <a href="#" id="show-signin">Sign In</a>
                            </p>
                        </form>

                        <!-- Sign In Form -->
                        <form class="auth-form" id="signin-form" style="display: none;">
                            <div class="form-group">
                                <label>Email Address</label>
                                <div class="input-wrapper">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                        <polyline points="22,6 12,13 2,6"/>
                                    </svg>
                                    <input type="email" id="signin-email" placeholder="Enter your email" required>
                                </div>
                            </div>

                            <div class="form-group">
                                <label>Password</label>
                                <div class="input-wrapper">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                    </svg>
                                    <input type="password" id="signin-password" placeholder="Enter your password" required>
                                    <button type="button" class="toggle-password" data-target="signin-password">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                            <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <button type="submit" class="btn-auth">Sign In</button>

                            <p class="auth-error" id="signin-error"></p>

                            <p class="auth-switch">
                                Don't have an account? <a href="#" id="show-signup">Sign Up</a>
                            </p>
                        </form>
                    </div>
                </div>
            </div>
        `;
    },

    attachEventListeners() {
        // Toggle password visibility
        document.querySelectorAll('.toggle-password').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = btn.dataset.target;
                const input = document.getElementById(targetId);
                input.type = input.type === 'password' ? 'text' : 'password';
            });
        });

        // Switch between forms
        document.getElementById('show-signin').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('signup-form').style.display = 'none';
            document.getElementById('signin-form').style.display = 'block';
            this.isSignUp = false;
        });

        document.getElementById('show-signup').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('signin-form').style.display = 'none';
            document.getElementById('signup-form').style.display = 'block';
            this.isSignUp = true;
        });

        // Sign Up form
        document.getElementById('signup-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const errorEl = document.getElementById('signup-error');
            errorEl.textContent = '';

            const firstName = document.getElementById('signup-firstname').value;
            const lastName = document.getElementById('signup-lastname').value;
            const birthday = document.getElementById('signup-birthday').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const confirm = document.getElementById('signup-confirm').value;

            if (password !== confirm) {
                errorEl.textContent = 'Passwords do not match';
                return;
            }

            if (password.length < 6) {
                errorEl.textContent = 'Password must be at least 6 characters';
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ firstName, lastName, birthday, email, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Sign up failed');
                }

                // Store token and user data
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                // Update sidebar UI
                if (window.updateUserUI) window.updateUserUI();

                // Navigate to home
                router.navigate('home');
            } catch (error) {
                errorEl.textContent = error.message;
            }
        });

        // Sign In form
        document.getElementById('signin-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const errorEl = document.getElementById('signin-error');
            errorEl.textContent = '';

            const email = document.getElementById('signin-email').value;
            const password = document.getElementById('signin-password').value;

            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/signin`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Sign in failed');
                }

                // Store token and user data
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                // Update sidebar UI
                if (window.updateUserUI) window.updateUserUI();

                // Navigate to home
                router.navigate('home');
            } catch (error) {
                errorEl.textContent = error.message;
            }
        });
    }
};

window.AuthPage = AuthPage;

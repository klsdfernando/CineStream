/**
 * User Profile Dashboard Page
 * Features User Analytics, Watch Time Stats, Player Breakdown, Favorites & Continue Watching
 */

const ProfilePage = {
    userData: null,
    analyticsData: null,
    continueWatching: [],
    favorites: [],
    likes: [],
    history: [],
    activeTab: 'continue',

    async render() {
        const container = document.getElementById('main-content');
        const token = localStorage.getItem('authToken');

        if (!token) {
            router.navigate('auth');
            return;
        }

        container.innerHTML = `
            <div class="loading-screen">
                <div class="loading-spinner"></div>
                <p>Loading user dashboard & analytics...</p>
            </div>
        `;

        try {
            const [userRes, analyticsRes, continueRes, favRes, likeRes, historyRes] = await Promise.all([
                window.api.auth.getUser(),
                window.api.activity.getAnalytics(),
                window.api.activity.getContinueWatching(),
                window.api.activity.getHistory('favorite'),
                window.api.activity.getHistory('like'),
                window.api.activity.getHistory('watched')
            ]);

            if (userRes.error) throw new Error(userRes.error);

            this.userData = userRes.user;
            this.analyticsData = analyticsRes.analytics || {};
            this.continueWatching = continueRes.continueWatching || [];
            this.favorites = favRes.history || [];
            this.likes = likeRes.history || [];
            this.history = historyRes.history || [];
        } catch (error) {
            console.error('Failed to load profile:', error);
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            router.navigate('auth');
            return;
        }

        this.renderContent(container);
        this.attachEventListeners();
    },

    renderContent(container) {
        const user = this.userData;
        const analytics = this.analyticsData;
        const initials = `${user.firstName?.[0] || 'U'}${user.lastName?.[0] || ''}`.toUpperCase();
        const memberSince = new Date(user.createdAt || Date.now()).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        container.innerHTML = `
            <div class="profile-page">
                <div class="profile-header">
                    <h1>User Dashboard</h1>
                    <button class="btn-logout" id="btn-logout">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                            <polyline points="16 17 21 12 16 7"/>
                            <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        Logout
                    </button>
                </div>

                <!-- Top Profile & Analytics Summary -->
                <div class="profile-summary-grid">
                    <!-- Profile Card -->
                    <div class="profile-card">
                        <div class="profile-avatar-section">
                            <div class="profile-avatar" id="profile-avatar">
                                ${user.profilePic
                                    ? `<img src="${user.profilePic}" alt="Profile">`
                                    : `<div class="avatar-initials">${initials}</div>`
                                }
                            </div>
                            <button class="btn-change-avatar" id="btn-change-avatar">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                    <circle cx="12" cy="13" r="4"/>
                                </svg>
                                Change Photo
                            </button>
                            <input type="file" id="avatar-input" accept="image/*" style="display: none;">
                        </div>

                        <div class="profile-info">
                            <h2 class="profile-name">${user.firstName} ${user.lastName}</h2>
                            <p class="profile-email">${user.email}</p>
                            <p class="profile-member-since">Member since ${memberSince}</p>
                        </div>
                    </div>

                    <!-- User Telemetry Analytics Cards -->
                    <div class="analytics-cards-grid">
                        <div class="analytics-card">
                            <div class="analytics-icon watch-time-icon">⏱️</div>
                            <div class="analytics-data">
                                <span class="analytics-label">Total Watch Time</span>
                                <span class="analytics-val">${analytics.totalWatchTimeFormatted || '0 Mins'}</span>
                            </div>
                        </div>

                        <div class="analytics-card">
                            <div class="analytics-icon player-icon">⚡</div>
                            <div class="analytics-data">
                                <span class="analytics-label">Favorite Player Server</span>
                                <span class="analytics-val highlight-green">${analytics.favoritePlayer || 'Vidnest'}</span>
                            </div>
                        </div>

                        <div class="analytics-card">
                            <div class="analytics-icon watched-icon">🎬</div>
                            <div class="analytics-data">
                                <span class="analytics-label">Watched Titles</span>
                                <span class="analytics-val">${analytics.totalMoviesWatched || 0} Movies • ${analytics.totalEpisodesWatched || 0} Episodes</span>
                            </div>
                        </div>

                        <div class="analytics-card">
                            <div class="analytics-icon fav-icon">❤️</div>
                            <div class="analytics-data">
                                <span class="analytics-label">Saved Favorites</span>
                                <span class="analytics-val">${analytics.totalFavorites || 0} Saved Items</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Dashboard Tab Navigation -->
                <div class="profile-dashboard-tabs" role="tablist">
                    <button class="profile-tab-btn ${this.activeTab === 'continue' ? 'active' : ''}" data-tab="continue">
                        Continue Watching (${this.continueWatching.length})
                    </button>
                    <button class="profile-tab-btn ${this.activeTab === 'favorites' ? 'active' : ''}" data-tab="favorites">
                        Favorites (${this.favorites.length})
                    </button>
                    <button class="profile-tab-btn ${this.activeTab === 'likes' ? 'active' : ''}" data-tab="likes">
                        Liked Content (${this.likes.length})
                    </button>
                    <button class="profile-tab-btn ${this.activeTab === 'history' ? 'active' : ''}" data-tab="history">
                        Watch History (${this.history.length})
                    </button>
                    <button class="profile-tab-btn ${this.activeTab === 'settings' ? 'active' : ''}" data-tab="settings">
                        Account Settings
                    </button>
                </div>

                <!-- Tab Body Content -->
                <div class="profile-tab-body" id="profile-tab-body">
                    ${this.renderTabBody()}
                </div>
            </div>
        `;
    },

    renderTabBody() {
        if (this.activeTab === 'continue') {
            if (this.continueWatching.length === 0) {
                return `<div class="empty-tab-state">No movies or TV shows currently in progress. Start watching any video!</div>`;
            }
            return `
                <div class="continue-watching-grid">
                    ${this.continueWatching.map(item => {
                        const pct = item.duration ? Math.min(100, Math.round((item.lastPosition / item.duration) * 100)) : 0;
                        const poster = api.posterUrl(item.posterPath);
                        return `
                            <div class="continue-card" onclick="router.navigate('watch', { id: '${item.mediaId}', mediaType: '${item.mediaType}' })">
                                <div class="continue-poster-wrap">
                                    <img src="${poster}" alt="${item.title}">
                                    <div class="continue-play-overlay">
                                        <svg viewBox="0 0 24 24" width="32" height="32" fill="#4ade80"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                    </div>
                                    <div class="continue-progress-bar"><span style="width: ${pct}%"></span></div>
                                </div>
                                <div class="continue-info">
                                    <h4 class="continue-title">${item.title}</h4>
                                    <span class="continue-meta">${item.mediaType === 'tv' ? `S${item.season || 1} E${item.episode || 1} • ` : ''}${pct}% Completed (${item.playerUsed || 'Vidnest'})</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        if (this.activeTab === 'favorites') {
            if (this.favorites.length === 0) {
                return `<div class="empty-tab-state">No favorite movies or series saved yet. Click the Favorites button on any movie page!</div>`;
            }
            return `
                <div class="profile-media-grid">
                    ${this.favorites.map(item => {
                        const poster = api.posterUrl(item.posterPath);
                        return `
                            <div class="profile-media-card" onclick="router.navigate('details', { id: '${item.mediaId}', mediaType: '${item.mediaType}' })">
                                <img src="${poster}" alt="${item.title}">
                                <div class="profile-media-info">
                                    <h4>${item.title}</h4>
                                    <span>${item.mediaType === 'tv' ? 'TV Series' : 'Movie'}</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        if (this.activeTab === 'likes') {
            if (this.likes.length === 0) {
                return `<div class="empty-tab-state">No liked titles yet.</div>`;
            }
            return `
                <div class="profile-media-grid">
                    ${this.likes.map(item => {
                        const poster = api.posterUrl(item.posterPath);
                        return `
                            <div class="profile-media-card" onclick="router.navigate('details', { id: '${item.mediaId}', mediaType: '${item.mediaType}' })">
                                <img src="${poster}" alt="${item.title}">
                                <div class="profile-media-info">
                                    <h4>${item.title}</h4>
                                    <span>Liked</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        if (this.activeTab === 'history') {
            if (this.history.length === 0) {
                return `<div class="empty-tab-state">No watch history available.</div>`;
            }
            return `
                <div class="history-list">
                    ${this.history.map(item => {
                        const dateStr = new Date(item.updatedAt || item.createdAt).toLocaleString();
                        return `
                            <div class="history-item" onclick="router.navigate('watch', { id: '${item.mediaId}', mediaType: '${item.mediaType}' })">
                                <div class="history-item-details">
                                    <span class="history-item-title">${item.title}</span>
                                    <span class="history-item-meta">${item.mediaType === 'tv' ? `S${item.season || 1} E${item.episode || 1} • ` : ''}Player: ${item.playerUsed || 'Vidnest'} • ${dateStr}</span>
                                </div>
                                <button class="btn btn-sm btn-primary">Watch Again</button>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        if (this.activeTab === 'settings') {
            const user = this.userData;
            return `
                <div class="profile-edit-section">
                    <h3>Edit Profile Settings</h3>
                    <form class="profile-form" id="profile-form">
                        <div class="form-row">
                            <div class="form-group">
                                <label>First Name</label>
                                <input type="text" id="edit-firstname" value="${user.firstName || ''}" required>
                            </div>
                            <div class="form-group">
                                <label>Last Name</label>
                                <input type="text" id="edit-lastname" value="${user.lastName || ''}" required>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Birthday</label>
                            <input type="date" id="edit-birthday" value="${user.birthday || ''}">
                        </div>

                        <div class="form-group">
                            <label>Bio</label>
                            <textarea id="edit-bio" placeholder="Tell us about yourself..." rows="3">${user.bio || ''}</textarea>
                        </div>

                        <div class="form-actions">
                            <button type="submit" class="btn-save" id="btn-save">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                    <polyline points="17 21 17 13 7 13 7 21"/>
                                    <polyline points="7 3 7 8 15 8"/>
                                </svg>
                                Save Changes
                            </button>
                        </div>

                        <p class="form-message" id="form-message"></p>
                    </form>
                </div>
            `;
        }

        return '';
    },

    attachEventListeners() {
        document.getElementById('btn-logout')?.addEventListener('click', () => {
            window.logoutUser();
        });

        document.getElementById('btn-change-avatar')?.addEventListener('click', () => {
            document.getElementById('avatar-input')?.click();
        });

        document.getElementById('avatar-input')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            e.target.value = '';

            const reader = new FileReader();
            reader.onload = (event) => {
                const imageSrc = event.target.result;
                if (window.ImageCropper) {
                    ImageCropper.open(imageSrc, async (croppedImage) => {
                        await this.updateProfile({ profilePic: croppedImage });
                        const avatarEl = document.getElementById('profile-avatar');
                        if (avatarEl) avatarEl.innerHTML = `<img src="${croppedImage}" alt="Profile">`;
                    });
                }
            };
            reader.readAsDataURL(file);
        });

        // Tab buttons
        document.querySelectorAll('.profile-tab-btn').forEach(btn => {
            btn.onclick = () => {
                this.activeTab = btn.dataset.tab;
                document.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const body = document.getElementById('profile-tab-body');
                if (body) body.innerHTML = this.renderTabBody();
                if (this.activeTab === 'settings') {
                    this.attachFormListener();
                }
            };
        });

        if (this.activeTab === 'settings') {
            this.attachFormListener();
        }
    },

    attachFormListener() {
        const form = document.getElementById('profile-form');
        if (!form) return;
        form.onsubmit = async (e) => {
            e.preventDefault();
            const firstName = document.getElementById('edit-firstname').value;
            const lastName = document.getElementById('edit-lastname').value;
            const birthday = document.getElementById('edit-birthday').value;
            const bio = document.getElementById('edit-bio').value;

            await this.updateProfile({ firstName, lastName, birthday, bio });
        };
    },

    async updateProfile(updates) {
        const messageEl = document.getElementById('form-message');
        const saveBtn = document.getElementById('btn-save');

        try {
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';
            }

            const data = await window.api.auth.updateProfile(updates);
            if (data.error) throw new Error(data.error);

            const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
            const updatedUser = { ...storedUser, ...data.user };
            localStorage.setItem('user', JSON.stringify(updatedUser));

            if (window.updateUserUI) window.updateUserUI();

            if (messageEl) {
                messageEl.textContent = 'Profile updated successfully!';
                messageEl.className = 'form-message success';
                setTimeout(() => { messageEl.textContent = ''; }, 3000);
            }

            this.userData = data.user;
        } catch (error) {
            console.error('Update error:', error);
            if (messageEl) {
                messageEl.textContent = error.message;
                messageEl.className = 'form-message error';
            }
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = `Save Changes`;
            }
        }
    }
};

window.ProfilePage = ProfilePage;

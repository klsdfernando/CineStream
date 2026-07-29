/**
 * Activity Page controller
 */

const ActivityPage = {
    currentTab: 'watched', // 'watched', 'liked', 'playlists'
    playlists: [],

    async render() {
        const mainContent = document.getElementById('main-content');

        mainContent.innerHTML = `
            <div class="activity-container">
                <div class="activity-header">
                    <h1 class="activity-title">User Activity</h1>
                    <button class="btn btn-primary" id="btn-create-playlist" style="display: none;">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Create Playlist
                    </button>
                </div>

                <div class="activity-tabs">
                    <button class="activity-tab active" data-tab="watched">Watch History</button>
                    <button class="activity-tab" data-tab="liked">Liked / Disliked</button>
                    <button class="activity-tab" data-tab="playlists">My Playlists</button>
                </div>

                <div id="activity-content-area">
                    <!-- Dynamic Content Loaded Here -->
                </div>
            </div>
        `;

        this.attachTabListeners();
        await this.loadCurrentTab();
    },

    attachTabListeners() {
        const tabs = document.querySelectorAll('.activity-tab');
        const createBtn = document.getElementById('btn-create-playlist');

        tabs.forEach(tab => {
            tab.addEventListener('click', async (e) => {
                // Update active class
                tabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');

                // Update current tab and load
                this.currentTab = e.target.dataset.tab;

                // Show/hide create playlist button
                createBtn.style.display = this.currentTab === 'playlists' ? 'flex' : 'none';

                await this.loadCurrentTab();
            });
        });

        if (createBtn) {
            createBtn.addEventListener('click', () => this.showCreatePlaylistModal());
        }
    },

    async loadCurrentTab() {
        const contentArea = document.getElementById('activity-content-area');
        contentArea.innerHTML = `
            <div class="loading-spinner" style="margin: 50px auto;"></div>
        `;

        try {
            if (this.currentTab === 'watched') {
                await this.loadHistory('watched', contentArea);
            } else if (this.currentTab === 'liked') {
                await this.loadHistory('liked', contentArea);
            } else if (this.currentTab === 'playlists') {
                await this.loadPlaylists(contentArea);
            }
        } catch (error) {
            console.error('Failed to load activity tab:', error);
            contentArea.innerHTML = `
                <div class="error-message">
                    <p>Failed to load data. Please try again.</p>
                </div>
            `;
        }
    },

    async loadHistory(type, container) {
        let items = [];
        let titleText = '';
        let emptyText = '';

        if (type === 'watched') {
            const res = await api.activity.getHistory('watched');
            items = res.history;
            emptyText = "You haven't watched anything yet.";
        } else if (type === 'liked') {
            const likes = await api.activity.getHistory('like');
            const dislikes = await api.activity.getHistory('dislike');
            // Combine and sort by date
            items = [...likes.history, ...dislikes.history].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            emptyText = "You haven't liked or disliked any media yet.";
        }

        if (items.length === 0) {
            container.innerHTML = `
                <div class="activity-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <h3>No Activity</h3>
                    <p>${emptyText}</p>
                </div>
            `;
            return;
        }

        let gridHtml = '<div class="activity-grid">';

        items.forEach(item => {
            const date = new Date(item.created_at).toLocaleDateString();
            const actionBadge = type === 'liked'
                ? `<span style="position:absolute; top:8px; right:8px; background: rgba(0,0,0,0.7); padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; color: ${item.action_type === 'like' ? '#22c55e' : '#ef4444'}">${item.action_type === 'like' ? '👍 Liked' : '👎 Disliked'}</span>`
                : `<span style="position:absolute; top:8px; right:8px; background: rgba(0,0,0,0.7); padding: 4px 8px; border-radius: 4px; font-size: 12px;">Watched ${date}</span>`;

            gridHtml += `
                <div class="movie-card" onclick="router.navigate('details', { id: '${item.media_id}', type: '${item.media_type}' })" style="position: relative;">
                    <div class="movie-poster">
                        ${item.poster_path
                    ? `<img src="https://image.tmdb.org/t/p/w342${item.poster_path}" alt="${item.title}" loading="lazy">`
                    : `<div class="movie-poster-placeholder">No Image</div>`}
                        ${actionBadge}
                    </div>
                    <div class="movie-info">
                        <h3 class="movie-title">${item.title}</h3>
                        <span class="movie-type" style="text-transform: uppercase; font-size: 12px; color: var(--text-secondary);">${item.media_type}</span>
                    </div>
                </div>
            `;
        });

        gridHtml += '</div>';
        container.innerHTML = gridHtml;
    },

    async loadPlaylists(container) {
        const res = await api.playlists.getAll();
        this.playlists = res.playlists;

        if (this.playlists.length === 0) {
            container.innerHTML = `
                <div class="activity-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <h3>No Playlists</h3>
                    <p>Create a playlist to organize your favorite movies and shows.</p>
                </div>
            `;
            return;
        }

        let gridHtml = '<div class="activity-grid">';

        this.playlists.forEach(playlist => {
            gridHtml += `
                <div class="playlist-card" onclick="ActivityPage.renderPlaylistDetails(${playlist.id})">
                    <div class="playlist-icon">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="8" y1="6" x2="21" y2="6"></line>
                            <line x1="8" y1="12" x2="21" y2="12"></line>
                            <line x1="8" y1="18" x2="21" y2="18"></line>
                            <line x1="3" y1="6" x2="3.01" y2="6"></line>
                            <line x1="3" y1="12" x2="3.01" y2="12"></line>
                            <line x1="3" y1="18" x2="3.01" y2="18"></line>
                        </svg>
                    </div>
                    <div>
                        <div class="playlist-title">${playlist.name}</div>
                        <div class="playlist-meta">${playlist.item_count} items</div>
                    </div>
                </div>
            `;
        });

        gridHtml += '</div>';
        container.innerHTML = gridHtml;
    },

    async renderPlaylistDetails(playlistId) {
        const contentArea = document.getElementById('activity-content-area');
        contentArea.innerHTML = '<div class="loading-spinner" style="margin: 50px auto;"></div>';

        // Hide create button when viewing details
        document.getElementById('btn-create-playlist').style.display = 'none';

        try {
            const res = await api.playlists.getDetails(playlistId);
            const playlist = res.playlist;

            let html = `
                <button class="btn-back-playlists" onclick="ActivityPage.loadCurrentTab()">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                    Back to Playlists
                </button>

                <div class="playlist-detail-header">
                    <div class="playlist-icon" style="width: 80px; height: 80px; margin-bottom: 0;">
                        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="8" y1="6" x2="21" y2="6"></line>
                            <line x1="8" y1="12" x2="21" y2="12"></line>
                            <line x1="8" y1="18" x2="21" y2="18"></line>
                            <line x1="3" y1="6" x2="3.01" y2="6"></line>
                            <line x1="3" y1="12" x2="3.01" y2="12"></line>
                            <line x1="3" y1="18" x2="3.01" y2="18"></line>
                        </svg>
                    </div>
                    <div class="playlist-detail-info">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div>
                                <h2 class="playlist-detail-title">${playlist.name}</h2>
                                ${playlist.description ? `<p class="playlist-detail-desc">${playlist.description}</p>` : ''}
                                <div class="playlist-meta">${playlist.items.length} items</div>
                            </div>
                            <button class="btn-delete-playlist" onclick="ActivityPage.deletePlaylist(${playlist.id})">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                                Delete Playlist
                            </button>
                        </div>
                    </div>
                </div>
            `;

            if (playlist.items.length === 0) {
                html += `
                    <div class="activity-empty">
                        <p>This playlist is empty. Browse movies and click "Save to Playlist" to add items.</p>
                    </div>
                `;
            } else {
                html += '<div class="activity-grid">';
                playlist.items.forEach(item => {
                    html += `
                        <div class="movie-card" style="position: relative;">
                            <div class="movie-poster" onclick="router.navigate('details', { id: '${item.media_id}', type: '${item.media_type}' })" style="cursor:pointer;">
                                ${item.poster_path
                            ? `<img src="https://image.tmdb.org/t/p/w342${item.poster_path}" alt="${item.title}" loading="lazy">`
                            : `<div class="movie-poster-placeholder">No Image</div>`}
                            </div>
                            <div class="movie-info">
                                <h3 class="movie-title">${item.title}</h3>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                                    <span class="movie-type" style="text-transform: uppercase; font-size: 12px; color: var(--text-secondary);">${item.media_type}</span>
                                    <button class="btn btn-sm" style="background:transparent; border:none; color:#ef4444; cursor:pointer;" onclick="ActivityPage.removeFromPlaylist(${playlist.id}, '${item.media_id}')" title="Remove from playlist">
                                        Remove
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
            }

            contentArea.innerHTML = html;

        } catch (error) {
            console.error('Failed to load playlist details:', error);
            contentArea.innerHTML = '<p>Error loading playlist. <button onclick="ActivityPage.loadCurrentTab()">Go back</button></p>';
        }
    },

    showCreatePlaylistModal() {
        const overlay = document.createElement('div');
        overlay.className = 'activity-modal-overlay';
        overlay.innerHTML = `
            <div class="activity-modal">
                <div class="activity-modal-header">
                    <h3 class="activity-modal-title">Create New Playlist</h3>
                    <button class="btn-modal-close" onclick="this.closest('.activity-modal-overlay').remove()">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="form-group">
                    <label>Playlist Name</label>
                    <input type="text" id="new-playlist-name" class="form-input" placeholder="e.g. Action Movies" autofocus>
                </div>
                <div class="form-group">
                    <label>Description (Optional)</label>
                    <input type="text" id="new-playlist-desc" class="form-input" placeholder="What's this playlist about?">
                </div>
                <button class="btn btn-primary" style="width:100%; margin-top: 10px;" onclick="ActivityPage.submitCreatePlaylist(this)">Create Playlist</button>
            </div>
        `;
        document.body.appendChild(overlay);
    },

    async submitCreatePlaylist(btn) {
        const nameInput = document.getElementById('new-playlist-name');
        const descInput = document.getElementById('new-playlist-desc');
        const name = nameInput.value.trim();

        if (!name) {
            nameInput.style.borderColor = '#ef4444';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Creating...';

        try {
            await api.playlists.create({ name, description: descInput.value.trim() });
            document.querySelector('.activity-modal-overlay').remove();
            this.loadCurrentTab(); // Refresh playlists
        } catch (error) {
            console.error('Failed to create playlist', error);
            alert('Failed to create playlist');
            btn.disabled = false;
            btn.textContent = 'Create Playlist';
        }
    },

    async deletePlaylist(id) {
        if (!confirm('Are you sure you want to delete this playlist?')) return;

        try {
            await api.playlists.delete(id);
            this.loadCurrentTab();
        } catch (error) {
            alert('Failed to delete playlist');
        }
    },

    async removeFromPlaylist(playlistId, mediaId) {
        if (!confirm('Remove this item from playlist?')) return;

        try {
            await api.playlists.removeItem(playlistId, mediaId);
            this.renderPlaylistDetails(playlistId);
        } catch (error) {
            alert('Failed to remove item');
        }
    }
};

window.ActivityPage = ActivityPage;

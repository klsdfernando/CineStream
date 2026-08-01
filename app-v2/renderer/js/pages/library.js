/**
 * User Library & Playlists Page
 * Dedicated page for Playlists, Favorites, Watchlist, and Liked content
 */

const LibraryPage = {
    playlists: [],
    favorites: [],
    watchlist: [],
    likes: [],
    dislikes: [],
    activeTab: 'playlists',
    selectedPlaylist: null,

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
                <p>Loading your library & playlists...</p>
            </div>
        `;

        try {
            const [plRes, favRes, watchRes, likeRes, disRes] = await Promise.all([
                api.playlists.getAll(),
                api.activity.getHistory('favorite'),
                api.activity.getContinueWatching(),
                api.activity.getHistory('like'),
                api.activity.getHistory('dislike')
            ]);

            this.playlists = plRes.playlists || [];
            this.favorites = favRes.history || [];
            this.watchlist = watchRes.continueWatching || [];
            this.likes = likeRes.history || [];
            this.dislikes = disRes.history || [];
        } catch (error) {
            console.error('Failed to load library:', error);
        }

        this.renderContent(container);
        this.attachEventListeners();
    },

    renderContent(container) {
        container.innerHTML = `
            <div class="library-page fade-in">
                <div class="library-header">
                    <div class="library-title-section">
                        <h1>My Library & Playlists</h1>
                        <p class="library-subtitle">Manage your custom playlists, favorites, watchlist, and liked movies</p>
                    </div>
                    ${this.activeTab === 'playlists' ? `
                        <button type="button" class="btn btn-primary" id="btn-create-playlist-main">
                            + Create Playlist
                        </button>
                    ` : ''}
                </div>

                <!-- Library Tabs Navigation -->
                <div class="library-tabs" role="tablist">
                    <button class="library-tab-btn ${this.activeTab === 'playlists' ? 'active' : ''}" data-tab="playlists">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        Playlists (${this.playlists.length})
                    </button>
                    <button class="library-tab-btn ${this.activeTab === 'favorites' ? 'active' : ''}" data-tab="favorites">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                        Favorites (${this.favorites.length})
                    </button>
                    <button class="library-tab-btn ${this.activeTab === 'watchlist' ? 'active' : ''}" data-tab="watchlist">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Watchlist & Progress (${this.watchlist.length})
                    </button>
                    <button class="library-tab-btn ${this.activeTab === 'likes' ? 'active' : ''}" data-tab="likes">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                        Liked Titles (${this.likes.length})
                    </button>
                </div>

                <!-- Library Tab Body -->
                <div class="library-body" id="library-body">
                    ${this.renderTabBody()}
                </div>
            </div>
        `;
    },

    renderTabBody() {
        if (this.activeTab === 'playlists') {
            if (this.selectedPlaylist) {
                return this.renderPlaylistDetailsView();
            }

            if (this.playlists.length === 0) {
                return `
                    <div class="empty-library-state">
                        <div class="empty-icon">
                            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        </div>
                        <h3>No Playlists Created Yet</h3>
                        <p>Create your custom movie collections or add items from any movie page!</p>
                    </div>
                `;
            }

            return `
                <div class="playlists-grid">
                    ${this.playlists.map(pl => `
                        <div class="playlist-card" onclick="LibraryPage.openPlaylist('${pl.id}')">
                            <div class="playlist-card-icon">
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                            </div>
                            <div class="playlist-card-content">
                                <h3 class="playlist-card-name">${pl.name}</h3>
                                <p class="playlist-card-desc">${pl.description || 'Custom playlist'}</p>
                                <span class="playlist-card-count">${pl.item_count || (pl.items ? pl.items.length : 0)} items</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (this.activeTab === 'favorites') {
            if (this.favorites.length === 0) {
                return `<div class="empty-library-state">No favorite movies or series saved yet.</div>`;
            }

            return `
                <div class="library-media-grid">
                    ${this.favorites.map(item => {
                        const poster = api.posterUrl(item.posterPath);
                        return `
                            <div class="library-media-card" onclick="router.navigate('details', { id: '${item.mediaId}', mediaType: '${item.mediaType}' })">
                                <img src="${poster}" alt="${item.title}">
                                <div class="library-media-info">
                                    <h4>${item.title}</h4>
                                    <span>${item.mediaType === 'tv' ? 'TV Series' : 'Movie'}</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        if (this.activeTab === 'watchlist') {
            if (this.watchlist.length === 0) {
                return `<div class="empty-library-state">No in-progress movies or episodes in your watchlist.</div>`;
            }

            return `
                <div class="library-media-grid">
                    ${this.watchlist.map(item => {
                        const pct = item.duration ? Math.min(100, Math.round((item.lastPosition / item.duration) * 100)) : 0;
                        const poster = api.posterUrl(item.posterPath);
                        return `
                            <div class="library-media-card" onclick="router.navigate('watch', { id: '${item.mediaId}', mediaType: '${item.mediaType}' })">
                                <div class="library-poster-wrap">
                                    <img src="${poster}" alt="${item.title}">
                                    <div class="library-progress-bar"><span style="width:${pct}%"></span></div>
                                </div>
                                <div class="library-media-info">
                                    <h4>${item.title}</h4>
                                    <span>${pct}% Completed</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        if (this.activeTab === 'likes') {
            if (this.likes.length === 0) {
                return `<div class="empty-library-state">No liked movies or series yet.</div>`;
            }

            return `
                <div class="library-media-grid">
                    ${this.likes.map(item => {
                        const poster = api.posterUrl(item.posterPath);
                        return `
                            <div class="library-media-card" onclick="router.navigate('details', { id: '${item.mediaId}', mediaType: '${item.mediaType}' })">
                                <img src="${poster}" alt="${item.title}">
                                <div class="library-media-info">
                                    <h4>${item.title}</h4>
                                    <span>Liked</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        return '';
    },

    renderPlaylistDetailsView() {
        const pl = this.selectedPlaylist;
        const items = pl.items || [];

        return `
            <div class="playlist-detail-view">
                <button type="button" class="btn btn-secondary btn-sm" onclick="LibraryPage.closePlaylistDetails()" style="margin-bottom:16px;">
                    ← Back to Playlists
                </button>
                <div class="playlist-detail-header">
                    <h2>${pl.name}</h2>
                    <p>${pl.description || 'Custom playlist'}</p>
                    <span class="playlist-count-badge">${items.length} items</span>
                </div>

                ${items.length === 0 ? `
                    <div class="empty-library-state">This playlist is empty. Add movies using the Add to Playlist button on any movie page!</div>
                ` : `
                    <div class="library-media-grid">
                        ${items.map(item => {
                            const poster = api.posterUrl(item.posterPath);
                            return `
                                <div class="library-media-card" onclick="router.navigate('watch', { id: '${item.mediaId}', mediaType: '${item.mediaType}' })">
                                    <img src="${poster}" alt="${item.title}">
                                    <div class="library-media-info">
                                        <h4>${item.title}</h4>
                                        <span>${item.mediaType === 'tv' ? 'TV Series' : 'Movie'}</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>
        `;
    },

    async openPlaylist(playlistId) {
        const res = await api.playlists.getDetails(playlistId);
        if (res && res.success && res.playlist) {
            this.selectedPlaylist = res.playlist;
            const body = document.getElementById('library-body');
            if (body) body.innerHTML = this.renderPlaylistDetailsView();
        }
    },

    closePlaylistDetails() {
        this.selectedPlaylist = null;
        const body = document.getElementById('library-body');
        if (body) body.innerHTML = this.renderTabBody();
    },

    attachEventListeners() {
        document.querySelectorAll('.library-tab-btn').forEach(btn => {
            btn.onclick = () => {
                this.activeTab = btn.dataset.tab;
                this.selectedPlaylist = null;
                document.querySelectorAll('.library-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const body = document.getElementById('library-body');
                if (body) body.innerHTML = this.renderTabBody();
            };
        });

        document.getElementById('btn-create-playlist-main')?.addEventListener('click', async () => {
            const name = prompt('Enter new playlist name:');
            if (!name) return;
            const res = await api.playlists.create({ name });
            if (res && res.success) {
                await this.render();
            }
        });
    }
};

window.LibraryPage = LibraryPage;

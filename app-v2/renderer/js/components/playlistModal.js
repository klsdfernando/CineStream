/**
 * Interactive Playlist Selector Modal
 * Allows adding movies/TV series to custom user playlists or creating a new playlist on the fly
 */

const PlaylistModal = {
    mediaData: null,
    rootEl: null,

    async open({ mediaId, mediaType, title, posterPath }) {
        this.mediaData = { mediaId: String(mediaId), mediaType: mediaType || 'movie', title, posterPath };
        this.init();

        const bodyEl = document.getElementById('playlist-modal-body');
        if (bodyEl) {
            bodyEl.innerHTML = `<div class="loading-spinner"></div><p style="text-align:center; margin-top:12px;">Loading playlists...</p>`;
        }

        this.rootEl.classList.add('is-open');
        await this.loadPlaylists();
    },

    init() {
        if (document.getElementById('playlist-modal-root')) {
            this.rootEl = document.getElementById('playlist-modal-root');
            return;
        }

        const root = document.createElement('div');
        root.id = 'playlist-modal-root';
        root.className = 'playlist-modal-root';
        root.innerHTML = `
            <div class="playlist-modal-backdrop" id="playlist-modal-backdrop"></div>
            <div class="playlist-modal-card">
                <div class="playlist-modal-header">
                    <h3 class="playlist-modal-title">Add to Playlist</h3>
                    <button type="button" class="playlist-modal-close" id="playlist-modal-close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="playlist-modal-media-title" id="playlist-modal-media-title"></div>
                <div class="playlist-modal-body" id="playlist-modal-body"></div>
                <div class="playlist-modal-create-row">
                    <input type="text" class="playlist-modal-input" id="playlist-new-name" placeholder="Create new playlist name..." maxlength="40">
                    <button type="button" class="btn btn-primary btn-sm" id="playlist-btn-create">+ Create & Add</button>
                </div>
            </div>
        `;

        document.body.appendChild(root);
        this.rootEl = root;

        document.getElementById('playlist-modal-close').onclick = () => this.close();
        document.getElementById('playlist-modal-backdrop').onclick = () => this.close();

        document.getElementById('playlist-btn-create').onclick = async () => {
            const input = document.getElementById('playlist-new-name');
            const name = input?.value?.trim();
            if (!name) return;

            const res = await api.playlists.create({ name });
            if (res && res.success && res.playlist) {
                input.value = '';
                await api.playlists.addItem({
                    playlistId: res.playlist.id,
                    mediaId: this.mediaData.mediaId,
                    mediaType: this.mediaData.mediaType,
                    title: this.mediaData.title,
                    posterPath: this.mediaData.posterPath
                });
                await this.loadPlaylists();
            }
        };
    },

    async loadPlaylists() {
        const titleEl = document.getElementById('playlist-modal-media-title');
        if (titleEl) titleEl.textContent = `Target: ${this.mediaData.title}`;

        const bodyEl = document.getElementById('playlist-modal-body');
        if (!bodyEl) return;

        try {
            const res = await api.playlists.getAll();
            const playlists = res.playlists || [];

            if (playlists.length === 0) {
                bodyEl.innerHTML = `<div class="empty-playlists-note">No custom playlists created yet. Type a name below to create your first playlist!</div>`;
                return;
            }

            bodyEl.innerHTML = playlists.map(pl => `
                <div class="playlist-modal-item">
                    <div class="playlist-modal-item-info">
                        <span class="playlist-item-name">📁 ${pl.name}</span>
                        <span class="playlist-item-count">${pl.item_count || 0} items</span>
                    </div>
                    <button type="button" class="btn-add-to-pl" data-playlist-id="${pl.id}">+ Add</button>
                </div>
            `).join('');

            bodyEl.querySelectorAll('.btn-add-to-pl').forEach(btn => {
                btn.onclick = async () => {
                    const plId = btn.dataset.playlistId;
                    btn.disabled = true;
                    btn.textContent = 'Adding...';

                    const addRes = await api.playlists.addItem({
                        playlistId: plId,
                        mediaId: this.mediaData.mediaId,
                        mediaType: this.mediaData.mediaType,
                        title: this.mediaData.title,
                        posterPath: this.mediaData.posterPath
                    });

                    if (addRes && addRes.success) {
                        btn.textContent = '✓ Added';
                        btn.classList.add('added');
                    } else {
                        btn.disabled = false;
                        btn.textContent = 'Error';
                    }
                };
            });
        } catch (error) {
            console.error('Failed to load playlists:', error);
            bodyEl.innerHTML = `<div class="empty-playlists-note">Error loading playlists.</div>`;
        }
    },

    close() {
        if (this.rootEl) {
            this.rootEl.classList.remove('is-open');
        }
    }
};

window.PlaylistModal = PlaylistModal;

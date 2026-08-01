/**
 * Floating Picture-in-Picture Mini Player
 * Keeps video playing in bottom-right corner when user browses other pages
 */
const MiniPlayer = {
    active: false,
    mediaId: null,
    mediaType: 'movie',
    title: '',
    season: 1,
    episode: 1,
    iframeRef: null,
    containerEl: null,

    init() {
        if (document.getElementById('mini-player-root')) return;

        const root = document.createElement('div');
        root.id = 'mini-player-root';
        root.className = 'mini-player-root';
        root.innerHTML = `
            <div class="mini-player-container" id="mini-player-container">
                <div class="mini-player-header">
                    <div class="mini-player-title-info">
                        <span class="mini-player-badge">PLAYING</span>
                        <span class="mini-player-title" id="mini-player-title">Movie Title</span>
                    </div>
                    <div class="mini-player-actions">
                        <button type="button" class="mini-player-btn expand" id="mini-player-expand" title="Expand to full screen">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
                                <polyline points="15 3 21 3 21 9"/>
                                <polyline points="9 21 3 21 3 15"/>
                                <line x1="21" y1="3" x2="14" y2="10"/>
                                <line x1="3" y1="21" x2="10" y2="14"/>
                            </svg>
                        </button>
                        <button type="button" class="mini-player-btn close" id="mini-player-close" title="Close player">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="mini-player-body" id="mini-player-body"></div>
            </div>
        `;
        document.body.appendChild(root);
        this.containerEl = root;

        document.getElementById('mini-player-expand')?.addEventListener('click', () => {
            this.expandToWatchPage();
        });

        document.getElementById('mini-player-close')?.addEventListener('click', () => {
            this.close();
        });
    },

    show({ iframe, title, mediaId, mediaType, season, episode }) {
        this.init();
        if (!iframe) return;

        this.iframeRef = iframe;
        this.title = title || 'Video Stream';
        this.mediaId = mediaId;
        this.mediaType = mediaType || 'movie';
        this.season = season || 1;
        this.episode = episode || 1;
        this.active = true;

        const titleEl = document.getElementById('mini-player-title');
        if (titleEl) titleEl.textContent = this.title;

        const body = document.getElementById('mini-player-body');
        if (body) {
            body.innerHTML = '';
            iframe.style.cssText = 'width: 100%; height: 100%; border: none; border-radius: 0 0 12px 12px;';
            body.appendChild(iframe);
        }

        this.containerEl?.classList.add('is-active');
    },

    restoreIframeToWatchPage(targetContainer) {
        if (!this.iframeRef || !targetContainer) return false;

        const preview = document.getElementById('video-preview');
        if (preview) preview.style.display = 'none';

        this.iframeRef.style.cssText = 'width: 100%; height: 100%; border: none; border-radius: var(--radius-lg);';
        targetContainer.appendChild(this.iframeRef);

        this.active = false;
        this.containerEl?.classList.remove('is-active');
        const body = document.getElementById('mini-player-body');
        if (body) body.innerHTML = '';

        if (window.WatchPage) {
            window.WatchPage.isPlaying = true;
        }

        return true;
    },

    expandToWatchPage() {
        if (!this.mediaId) return;

        const mediaId = this.mediaId;
        const mediaType = this.mediaType;

        this.containerEl?.classList.remove('is-active');
        router.navigate('watch', { id: mediaId, mediaType: mediaType });
    },

    close() {
        this.active = false;
        this.containerEl?.classList.remove('is-active');

        if (this.iframeRef) {
            try {
                this.iframeRef.src = 'about:blank';
                this.iframeRef.remove();
            } catch (e) {}
            this.iframeRef = null;
        }

        const body = document.getElementById('mini-player-body');
        if (body) body.innerHTML = '';

        if (window.WatchPage) {
            window.WatchPage.isPlaying = false;
        }
    }
};

window.MiniPlayer = MiniPlayer;

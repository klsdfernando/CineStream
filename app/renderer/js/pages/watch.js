/**
 * Watch Page - Video Player for Movies and TV Series
 */

const WatchPage = {
    mediaId: null,
    mediaType: 'movie', // 'movie' or 'tv'
    mediaData: null,
    isPlaying: false,
    currentPlayer: 'vidlink',
    // TV-specific state
    currentSeason: 1,
    currentEpisode: 1,
    seasonData: null,

    async render(params) {
        // Support both old format (just id) and new format ({id, mediaType})
        if (typeof params === 'object') {
            this.mediaId = params.id;
            this.mediaType = params.mediaType || 'movie';
        } else {
            this.mediaId = params;
            this.mediaType = 'movie';
        }

        const container = document.getElementById('main-content');

        // Show loading state
        container.innerHTML = `
            <div class="watch-page">
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                    <p>Loading ${this.mediaType === 'tv' ? 'TV series' : 'movie'}...</p>
                </div>
            </div>
        `;

        try {
            if (this.mediaType === 'tv') {
                await this.loadTVSeries();
            } else {
                await this.loadMovie();
            }
        } catch (error) {
            console.error('Failed to load watch page:', error);
            container.innerHTML = `
                <div class="watch-page">
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <p>Failed to load content. Please try again.</p>
                        <button class="btn btn-primary" onclick="window.router.navigate('home')">Go Home</button>
                    </div>
                </div>
            `;
        }
    },

    async loadMovie() {
        const [movie, similar] = await Promise.all([
            api.movies.getDetails(this.mediaId),
            api.movies.getSimilar(this.mediaId)
        ]);

        this.mediaData = movie;
        this.renderPage(movie, similar);
    },

    async loadTVSeries() {
        const [tvShow, similar] = await Promise.all([
            api.tv.getDetails(this.mediaId),
            api.tv.getSimilar(this.mediaId)
        ]);

        this.mediaData = tvShow;

        // Default to season 1
        this.currentSeason = 1;
        this.currentEpisode = 1;

        // Load first season episodes
        if (tvShow.seasons && tvShow.seasons.length > 0) {
            this.seasonData = await api.tv.getSeason(this.mediaId, 1);
        }

        this.renderPage(tvShow, similar);
    },

    renderPage(media, similar) {
        const container = document.getElementById('main-content');
        const backdropUrl = media.backdrop || media.poster;
        const isTV = this.mediaType === 'tv';

        container.innerHTML = `
            <div class="watch-page fade-in">
                <!-- Video Player Container -->
                <div class="video-player-container">
                    <!-- Preview with Poster -->
                    <div class="video-preview" id="video-preview">
                        <img src="${backdropUrl}" alt="${media.title}" class="video-preview-poster">
                        <div class="video-preview-overlay"></div>
                        <div class="video-play-button">
                            <svg viewBox="0 0 24 24">
                                <polygon points="5 3 19 12 5 21 5 3"/>
                            </svg>
                        </div>
                    </div>
                </div>

                <!-- Video Toolbar -->
                <div class="video-toolbar">
                    <button class="video-toolbar-btn" id="btn-favorite">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                        </svg>
                        Add to Favorites
                    </button>
                    <!-- <button class="video-toolbar-btn" id="btn-lights">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 18h6M10 22h4M12 2v1M4.22 4.22l.71.71M1 12h1M4.22 19.78l.71-.71M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z"/>
                        </svg>
                        Turn off Light
                    </button>
                    <button class="video-toolbar-btn" id="btn-comments">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        Comments
                    </button> -->
                    <button class="video-toolbar-btn" id="btn-fullscreen" style="margin-left: auto;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                        </svg>
                        Fullscreen
                    </button>
                </div>

                <!-- Download Section -->
                <div class="download-section" id="download-section">
                    <div class="download-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        <span>Download</span>
                        <div class="download-loading" id="download-loading">
                            <div class="spinner-small"></div>
                            <span>Searching torrents...</span>
                        </div>
                    </div>
                    <div class="download-options" id="download-options">
                        <!-- Will be populated by JavaScript -->
                        <div class="download-empty">No download options available</div>
                    </div>
                </div>

                ${isTV ? this.renderSeasonSelector() : ''}

                <!-- Content Layout -->
                <div class="watch-content">
                    <!-- Left Column - Media Info -->
                    <div class="watch-info">
                        <!-- Media Header -->
                        <div class="watch-movie-header">
                            <div class="watch-poster">
                                <img src="${media.poster}" alt="${media.title}">
                            </div>
                            <div class="watch-movie-details">
                                <h1 class="watch-movie-title">${media.title}</h1>
                                <div class="watch-badges">
                                    <span class="watch-badge hd">HD</span>
                                    ${media.rating ? `<span class="watch-badge imdb">IMDB: ${media.rating.toFixed(1)}</span>` : ''}
                                    ${isTV ? `<span class="watch-badge tv">TV Series</span>` : ''}
                                </div>
                                <p class="watch-movie-description">${media.overview || 'No description available.'}</p>
                            </div>
                        </div>

                        <!-- Media Meta -->
                        <div class="watch-meta-list">
                            ${media.releaseDate ? `
                                <div class="watch-meta-item">
                                    <span class="label">${isTV ? 'First Aired:' : 'Released:'}</span>
                                    <span class="value">${media.releaseDate}</span>
                                </div>
                            ` : ''}
                            ${media.genres?.length > 0 ? `
                                <div class="watch-meta-item">
                                    <span class="label">Genre:</span>
                                    <span class="value">${media.genres.map(g => g.name).join(', ')}</span>
                                </div>
                            ` : ''}
                            ${isTV && media.numberOfSeasons ? `
                                <div class="watch-meta-item">
                                    <span class="label">Seasons:</span>
                                    <span class="value">${media.numberOfSeasons}</span>
                                </div>
                                <div class="watch-meta-item">
                                    <span class="label">Episodes:</span>
                                    <span class="value">${media.numberOfEpisodes}</span>
                                </div>
                            ` : ''}
                            ${!isTV && media.runtime ? `
                                <div class="watch-meta-item">
                                    <span class="label">Duration:</span>
                                    <span class="value">${Math.floor(media.runtime / 60)}h ${media.runtime % 60}m</span>
                                </div>
                            ` : ''}
                            ${media.status ? `
                                <div class="watch-meta-item">
                                    <span class="label">Status:</span>
                                    <span class="value">${media.status}</span>
                                </div>
                            ` : ''}
                        </div>

                        <!-- Like/Dislike Actions -->
                        <div class="watch-actions">
                            <button class="watch-action-btn like" id="btn-like">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                                </svg>
                                Like
                            </button>
                            <button class="watch-action-btn dislike" id="btn-dislike">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                                </svg>
                                Dislike
                            </button>
                            <button class="watch-action-btn share" id="btn-share">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="18" cy="5" r="3"/>
                                    <circle cx="6" cy="12" r="3"/>
                                    <circle cx="18" cy="19" r="3"/>
                                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                                </svg>
                                Share
                            </button>
                            <button class="watch-action-btn save" id="btn-save-playlist">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                                </svg>
                                Save to Playlist
                            </button>
                        </div>
                    </div>

                    <!-- Right Column - Similar Content -->
                    <div class="watch-similar">
                        <h3 class="watch-similar-title">You May Also Like</h3>
                        <div class="watch-similar-grid" id="similar-movies">
                            ${this.renderSimilarContent(similar)}
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
        this.checkInteractionStatus(); // Set initial state for Like/Dislike buttons

        // Search for available torrents
        this.searchTorrents();
    },

    renderSeasonSelector() {
        const media = this.mediaData;
        if (!media.seasons || media.seasons.length === 0) return '';

        return `
            <div class="season-episode-selector">
                <div class="season-selector">
                    <label for="season-select">Season:</label>
                    <select id="season-select" class="season-dropdown">
                        ${media.seasons.map(s => `
                            <option value="${s.seasonNumber}" ${s.seasonNumber === this.currentSeason ? 'selected' : ''}>
                                Season ${s.seasonNumber} (${s.episodeCount} episodes)
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="episode-grid" id="episode-grid">
                    ${this.renderEpisodes()}
                </div>
            </div>
        `;
    },

    renderEpisodes() {
        if (!this.seasonData || !this.seasonData.episodes) {
            return '<div class="loading-episodes">Loading episodes...</div>';
        }

        return this.seasonData.episodes.map(ep => `
            <div class="episode-card ${ep.episodeNumber === this.currentEpisode ? 'active' : ''}" 
                 data-episode="${ep.episodeNumber}"
                 onclick="WatchPage.selectEpisode(${ep.episodeNumber})">
                <div class="episode-thumbnail">
                    ${ep.still ?
                `<img src="${ep.still}" alt="Episode ${ep.episodeNumber}">` :
                `<div class="episode-no-thumbnail">
                            <span>E${ep.episodeNumber}</span>
                        </div>`
            }
                    <div class="episode-number">EP ${ep.episodeNumber}</div>
                </div>
                <div class="episode-info">
                    <h4 class="episode-title">${ep.name || `Episode ${ep.episodeNumber}`}</h4>
                    ${ep.runtime ? `<span class="episode-runtime">${ep.runtime}m</span>` : ''}
                </div>
            </div>
        `).join('');
    },

    async selectEpisode(episodeNumber) {
        this.currentEpisode = episodeNumber;

        // Update episode cards active state
        document.querySelectorAll('.episode-card').forEach(card => {
            card.classList.remove('active');
            if (parseInt(card.dataset.episode) === episodeNumber) {
                card.classList.add('active');
            }
        });

        // Update player if already playing
        if (this.isPlaying) {
            this.updatePlayer();
        }

        // Refresh download options for the new episode
        this.searchTorrents();
    },

    async changeSeason(seasonNumber) {
        this.currentSeason = parseInt(seasonNumber);
        this.currentEpisode = 1; // Reset to episode 1

        // Load new season data
        const episodeGrid = document.getElementById('episode-grid');
        episodeGrid.innerHTML = '<div class="loading-episodes">Loading episodes...</div>';

        try {
            this.seasonData = await api.tv.getSeason(this.mediaId, this.currentSeason);
            episodeGrid.innerHTML = this.renderEpisodes();

            // Update player if already playing
            if (this.isPlaying) {
                this.updatePlayer();
            }

            // Refresh download options for the new season/episode
            this.searchTorrents();
        } catch (error) {
            console.error('Failed to load season:', error);
            episodeGrid.innerHTML = '<div class="error-message">Failed to load episodes</div>';
        }
    },

    updatePlayer() {
        const iframe = document.getElementById('video-player-iframe');
        if (iframe) {
            const playerUrl = this.currentPlayer === 'vidlink'
                ? this.buildPlayerUrl()
                : this.buildBackupPlayerUrl();
            iframe.src = playerUrl;
        }
    },

    renderSimilarContent(similar) {
        if (!similar?.results?.length) {
            return '<p class="no-similar">No similar content found.</p>';
        }

        const isTV = this.mediaType === 'tv';
        const mediaTypeForSimilar = isTV ? 'tv' : 'movie';

        return similar.results.slice(0, 12).map(item => `
            <div class="watch-similar-card" data-id="${item.id}" data-media-type="${mediaTypeForSimilar}">
                <div class="watch-similar-poster">
                    <img src="${item.poster || 'assets/no-poster.png'}" alt="${item.title}">
                </div>
                <div class="watch-similar-info">
                    <h4 class="watch-similar-name">${item.title}</h4>
                    <div class="watch-similar-meta">
                        <span>${item.year || 'N/A'}</span>
                        ${item.rating ? `
                            <span class="watch-similar-rating">
                                <svg viewBox="0 0 24 24">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                </svg>
                                ${item.rating.toFixed(1)}
                            </span>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    },

    attachEventListeners() {
        const preview = document.getElementById('video-preview');
        if (preview) {
            preview.addEventListener('click', () => this.handlePlay());
        }

        // Fullscreen button
        const fullscreenBtn = document.getElementById('btn-fullscreen');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }

        // Lights toggle
        const lightsBtn = document.getElementById('btn-lights');
        if (lightsBtn) {
            lightsBtn.addEventListener('click', () => this.toggleLights());
        }

        // Season selector (for TV)
        const seasonSelect = document.getElementById('season-select');
        if (seasonSelect) {
            seasonSelect.addEventListener('change', (e) => this.changeSeason(e.target.value));
        }

        // Similar content click handlers
        const similarCards = document.querySelectorAll('.watch-similar-card');
        similarCards.forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                const mediaType = card.dataset.mediaType;
                if (id) {
                    window.router.navigate('details', { id: parseInt(id), mediaType: mediaType });
                }
            });
        });

        // Like / Dislike / Share / Save functionality
        const likeBtn = document.getElementById('btn-like');
        const dislikeBtn = document.getElementById('btn-dislike');
        const shareBtn = document.getElementById('btn-share');
        const saveBtn = document.getElementById('btn-save-playlist');

        if (likeBtn) likeBtn.addEventListener('click', () => this.handleActionClick('like'));
        if (dislikeBtn) dislikeBtn.addEventListener('click', () => this.handleActionClick('dislike'));
        if (shareBtn) shareBtn.addEventListener('click', () => this.handleShareClick());
        if (saveBtn) saveBtn.addEventListener('click', () => this.handleSaveToPlaylistClick());
    },

    async checkInteractionStatus() {
        if (!localStorage.getItem('authToken')) return;

        try {
            const res = await api.activity.getStatus(this.mediaId);
            const status = res.status;

            const likeBtn = document.getElementById('btn-like');
            const dislikeBtn = document.getElementById('btn-dislike');

            if (likeBtn) likeBtn.classList.remove('active');
            if (dislikeBtn) dislikeBtn.classList.remove('active');

            if (status === 'like' && likeBtn) {
                likeBtn.classList.add('active');
                likeBtn.style.color = 'var(--accent-green)';
            } else if (status === 'dislike' && dislikeBtn) {
                dislikeBtn.classList.add('active');
                dislikeBtn.style.color = '#ef4444';
            }
        } catch (error) {
            console.error('Failed to get interaction status:', error);
        }
    },

    requireAuth() {
        if (!localStorage.getItem('authToken')) {
            alert('Please login to use this feature.');
            return false;
        }
        return true;
    },

    async handleActionClick(actionType) {
        if (!this.requireAuth()) return;

        try {
            const title = this.mediaData?.title || this.mediaData?.name || 'Unknown Title';
            const posterPath = this.mediaData?.poster_path;

            const res = await api.activity.record({
                mediaId: this.mediaId,
                mediaType: this.mediaType,
                title: title,
                posterPath: posterPath,
                actionType: actionType
            });

            if (res.success) {
                const likeBtn = document.getElementById('btn-like');
                const dislikeBtn = document.getElementById('btn-dislike');

                // Reset styles
                likeBtn.classList.remove('active');
                likeBtn.style.color = '';
                dislikeBtn.classList.remove('active');
                dislikeBtn.style.color = '';

                // Apply new style if added
                if (res.result.action === 'added' || res.result.action === 'updated') {
                    if (res.result.type === 'like') {
                        likeBtn.classList.add('active');
                        likeBtn.style.color = 'var(--accent-green)';
                    } else if (res.result.type === 'dislike') {
                        dislikeBtn.classList.add('active');
                        dislikeBtn.style.color = '#ef4444';
                    }
                }
            }
        } catch (error) {
            console.error(`Failed to record ${actionType} action:`, error);
            alert(`Failed to record action. Please try again.`);
        }
    },

    handleShareClick() {
        api.showUnderDevelopmentToast();
    },

    async handleSaveToPlaylistClick() {
        api.showUnderDevelopmentToast();
    },

    async saveMovieToPlaylist(playlistId) {
        try {
            const title = this.mediaData?.title || this.mediaData?.name || 'Unknown Title';
            const posterPath = this.mediaData?.poster_path;

            const res = await api.playlists.addItem(playlistId, {
                mediaId: this.mediaId,
                mediaType: this.mediaType,
                title: title,
                posterPath: posterPath
            });

            if (res.success) {
                document.querySelector('.playlist-modal-overlay').remove();
                alert('Saved to playlist successfully!');
            }
        } catch (error) {
            console.error('Failed to save to playlist:', error);
            alert(error.message || 'Failed to save to playlist');
        }
    },

    async quickCreatePlaylist() {
        const nameInput = document.getElementById('quick-new-playlist-name');
        const name = nameInput.value.trim();

        if (!name) {
            nameInput.style.borderColor = '#ef4444';
            return;
        }

        try {
            const res = await api.playlists.create({ name, description: '' });
            if (res.success) {
                // Now automatically add the movie to the newly created playlist
                await this.saveMovieToPlaylist(res.playlist.id);
            }
        } catch (error) {
            console.error('Failed to create playlist:', error);
            alert('Failed to create playlist');
        }
    },

    toggleLights() {
        const watchPage = document.querySelector('.watch-page');
        const btn = document.getElementById('btn-lights');

        if (watchPage.classList.contains('lights-off')) {
            watchPage.classList.remove('lights-off');
            btn.innerHTML = `
                    < svg viewBox = "0 0 24 24" fill = "none" stroke = "currentColor" stroke - width="2" >
                        <path d="M9 18h6M10 22h4M12 2v1M4.22 4.22l.71.71M1 12h1M4.22 19.78l.71-.71M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z" />
                </svg >
    Turn off Light
        `;
        } else {
            watchPage.classList.add('lights-off');
            btn.innerHTML = `
        < svg viewBox = "0 0 24 24" fill = "none" stroke = "currentColor" stroke - width="2" >
            <path d="M9 18h6M10 22h4M12 2v1M4.22 4.22l.71.71M1 12h1M4.22 19.78l.71-.71M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z" />
                </svg >
    Turn on Light
            `;
        }
    },

    toggleFullscreen() {
        const iframe = document.getElementById('video-player-iframe');
        if (!iframe) return;

        if (!document.fullscreenElement) {
            if (iframe.requestFullscreen) {
                iframe.requestFullscreen();
            } else if (iframe.webkitRequestFullscreen) {
                iframe.webkitRequestFullscreen();
            } else if (iframe.msRequestFullscreen) {
                iframe.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    },

    handlePlay() {
        const preview = document.getElementById('video-preview');
        const playerContainer = document.querySelector('.video-player-container');

        if (preview && this.mediaId) {
            const playerUrl = this.buildPlayerUrl();

            // Remove the preview
            preview.style.display = 'none';

            // Create and insert iframe
            const iframe = document.createElement('iframe');
            iframe.src = playerUrl;
            iframe.id = 'video-player-iframe';
            iframe.className = 'video-player-iframe';
            iframe.setAttribute('allowfullscreen', '');
            iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media');
            iframe.style.cssText = 'width: 100%; height: 100%; border: none; border-radius: var(--radius-lg);';

            playerContainer.appendChild(iframe);
            this.isPlaying = true;
            this.currentPlayer = 'vidlink';

            // Record "watched" activity if logged in
            if (localStorage.getItem('authToken')) {
                const title = this.mediaData?.title || this.mediaData?.name || 'Unknown Title';
                const posterPath = this.mediaData?.poster_path;

                api.activity.record({
                    mediaId: this.mediaId,
                    mediaType: this.mediaType,
                    title: title,
                    posterPath: posterPath,
                    actionType: 'watched'
                }).catch(err => console.error('Failed to record watch history:', err));
            }

            // Setup fallback listener disabled per request
            // this.setupPlayerFallback();
        }
    },

    /* Server 2 disabled 
    setupPlayerFallback() {
        // Listen for postMessage from iframe
        window.addEventListener('message', (event) => {
            if (event.origin.includes('vidlink.pro')) {
                const data = event.data;
                if (data && (
                    data.type === 'error' ||
                    data.error ||
                    data.status === 'not_found' ||
                    data.message?.includes('not found') ||
                    data.message?.includes('couldn\'t find')
                )) {
                    console.log('[Player] VidLink error detected, switching to backup player');
                    this.switchToBackupPlayer();
                }
            }
        });
    
        // Add "Try with Server 02" button after timeout
        setTimeout(() => {
            if (this.currentPlayer === 'vidlink') {
                this.addAlternatePlayerButton();
            }
        }, 5000);
    },
    
    addAlternatePlayerButton() {
        const toolbar = document.querySelector('.video-toolbar');
        if (toolbar && !document.getElementById('btn-alternate-player')) {
            const altBtn = document.createElement('button');
            altBtn.id = 'btn-alternate-player';
            altBtn.className = 'video-toolbar-btn';
            altBtn.innerHTML = \`
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 7l-7 5 7 5V7z"/>
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
                Try with Server 02
            \`;
            altBtn.onclick = () => this.switchToBackupPlayer();
    
            const fullscreenBtn = document.getElementById('btn-fullscreen');
            if (fullscreenBtn) {
                toolbar.insertBefore(altBtn, fullscreenBtn);
            } else {
                toolbar.appendChild(altBtn);
            }
        }
    },
    
    switchToBackupPlayer() {
        if (this.currentPlayer === 'backup') return;
    
        const iframe = document.getElementById('video-player-iframe');
        if (iframe && this.mediaId) {
            const backupUrl = this.buildBackupPlayerUrl();
            console.log('[Player] Switching to backup player:', backupUrl);
            iframe.src = backupUrl;
            this.currentPlayer = 'backup';
    
            const altBtn = document.getElementById('btn-alternate-player');
            if (altBtn) {
                altBtn.innerHTML = \`
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 4 23 10 17 10"/>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                    </svg>
                    Switch back to Server 01
                \`;
                altBtn.onclick = () => this.switchToVidLink();
            }
        }
    },
    
    switchToVidLink() {
        if (this.currentPlayer === 'vidlink') return;
    
        const iframe = document.getElementById('video-player-iframe');
        if (iframe && this.mediaId) {
            const playerUrl = this.buildPlayerUrl();
            console.log('[Player] Switching back to VidLink:', playerUrl);
            iframe.src = playerUrl;
            this.currentPlayer = 'vidlink';
    
            const altBtn = document.getElementById('btn-alternate-player');
            if (altBtn) {
                altBtn.innerHTML = \`
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M23 7l-7 5 7 5V7z"/>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                    </svg>
                    Try with Server 02
                \`;
                altBtn.onclick = () => this.switchToBackupPlayer();
            }
        }
    },
    */

    buildPlayerUrl() {
        const baseUrl = this.mediaType === 'tv'
            ? `https://vidlink.pro/tv/${this.mediaId}/${this.currentSeason}/${this.currentEpisode}`
            : `https://vidlink.pro/movie/${this.mediaId}`;

        const params = new URLSearchParams({
            primaryColor: '4CAF50',
            secondaryColor: '1a1a1a',
            iconColor: 'ffffff',
            icons: 'default',
            player: 'jw',
            title: 'true',
            poster: 'true',
            autoplay: 'true',
            nextbutton: 'false',
        });

        return `${baseUrl}?${params.toString()}`;
    },

    /* Server 2 Disabled
    buildBackupPlayerUrl() {
        if (this.mediaType === 'tv') {
            return `https://vidsrc.me/embed/tv?tmdb=${this.mediaId}&season=${this.currentSeason}&episode=${this.currentEpisode}`;
        }
        return `https://vidsrc.me/embed/movie?tmdb=${this.mediaId}`;
    },
    */

    /**
     * Search for available torrents
     */
    async searchTorrents() {
        const loadingEl = document.getElementById('download-loading');
        const optionsEl = document.getElementById('download-options');

        if (!loadingEl || !optionsEl) return;

        // Show loading
        loadingEl.classList.add('active');
        optionsEl.innerHTML = ''; // Clear previous results

        try {
            // Get IMDB ID from media data if available
            const imdbId = this.mediaData?.imdb_id || this.mediaData?.external_ids?.imdb_id;
            const title = this.mediaData?.title || this.mediaData?.name;

            // Search torrents via API
            const params = new URLSearchParams();
            if (imdbId) params.append('imdbId', imdbId);
            if (title) params.append('title', title);
            params.append('mediaType', this.mediaType);

            // Include season/episode info for TV shows
            if (this.mediaType === 'tv') {
                params.append('season', this.currentSeason);
                params.append('episode', this.currentEpisode);
            }

            const response = await fetch(`${API_BASE_URL}/api/torrents/search?${params.toString()}`);
            const data = await response.json();

            // Hide loading
            loadingEl.classList.remove('active');

            if (data.success && data.torrents.length > 0) {
                // Limit to 5 shown by default, hide the rest
                const torrents = data.torrents;
                const showLimit = 5;

                let html = '';

                // Render visible torrents
                html += torrents.slice(0, showLimit).map(t => this.renderTorrentOption(t)).join('');

                // Render hidden torrents if there are more than 5
                if (torrents.length > showLimit) {
                    const hiddenTorrentsHtml = torrents.slice(showLimit).map(t => this.renderTorrentOption(t)).join('');
                    html += `<div id="hidden-torrents" style="display: none;">${hiddenTorrentsHtml}</div>`;

                    // Add "Show More" button
                    html += `
                        <div class="show-more-container" style="text-align: center; margin-top: 15px;">
                            <button id="btn-show-more-torrents" class="btn btn-secondary" style="background: #2a2a2a; color: #fff; border: 1px solid #333; padding: 8px 16px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-size: 14px; transition: background 0.2s;">
                                <span>Show More Options (${torrents.length - showLimit})</span>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>
                        </div>
                    `;
                }

                optionsEl.innerHTML = html;
                this.attachDownloadListeners();

                // Attach event listener to "Show More" button if it exists
                const btnShowMore = document.getElementById('btn-show-more-torrents');
                if (btnShowMore) {
                    btnShowMore.addEventListener('click', () => {
                        const hiddenContainer = document.getElementById('hidden-torrents');
                        if (hiddenContainer.style.display === 'none') {
                            hiddenContainer.style.display = 'block';
                            btnShowMore.innerHTML = `
                                <span>Show Less Options</span>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="18 15 12 9 6 15"></polyline>
                                </svg>
                            `;
                        } else {
                            hiddenContainer.style.display = 'none';
                            btnShowMore.innerHTML = `
                                <span>Show More Options (${torrents.length - showLimit})</span>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            `;
                        }
                    });
                }
            } else {
                optionsEl.innerHTML = `<div class="download-empty">No download options found for this ${this.mediaType === 'tv' ? 'episode' : 'title'}</div>`;
            }
        } catch (error) {
            console.error('Torrent search error:', error);
            loadingEl.classList.remove('active');
            optionsEl.innerHTML = `<div class="download-empty">Failed to search for downloads</div>`;
        }
    },

    /**
     * Render a single torrent option
     */
    renderTorrentOption(torrent) {
        const qualityClass = `q-${torrent.quality.toLowerCase().replace(' ', '')}`;
        const seedIcon = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H8l5-7v4h3l-5 7z"/></svg>`;

        return `
            <div class="download-option" data-magnet="${torrent.magnetLink || ''}" data-hash="${torrent.hash || ''}">
                <div class="download-option-info">
                    <div class="download-quality">
                        <span class="quality-badge ${qualityClass}">${torrent.quality}</span>
                        <span class="download-type">${torrent.type || ''}</span>
                    </div>
                    <div class="download-details">
                        <span class="download-size">${torrent.size}</span>
                        <span class="download-seeds">${seedIcon} ${torrent.seeds} seeds</span>
                    </div>
                </div>
                <button class="download-btn" data-magnet="${torrent.magnetLink || ''}" data-torrent-type="${torrent.type || 'episode'}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Download
                </button>
            </div>
        `;
    },

    /**
     * Attach event listeners for download buttons
     */
    attachDownloadListeners() {
        const downloadBtns = document.querySelectorAll('.download-btn');
        downloadBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const magnetLink = btn.dataset.magnet;
                if (!magnetLink) {
                    console.error('No magnet link available');
                    return;
                }

                // Disable button and show starting state
                btn.disabled = true;
                btn.innerHTML = `<div class="spinner-small"></div> Starting...`;

                try {
                    // Start download via Electron IPC
                    if (window.electronAPI && window.electronAPI.torrent) {
                        // Get torrent type from button (season-pack vs episode)
                        const torrentType = btn.dataset.torrentType || 'episode';

                        const movieInfo = {
                            title: this.mediaData?.title || this.mediaData?.name,
                            poster: this.mediaData?.poster,
                            tmdbId: this.mediaId,
                            mediaType: this.mediaType,
                            torrentType: torrentType, // 'season-pack' or 'episode'
                            // Include season/episode info for TV shows
                            season: this.mediaType === 'tv' ? this.currentSeason : null,
                            episode: this.mediaType === 'tv' ? this.currentEpisode : null
                        };

                        const result = await window.electronAPI.torrent.start(magnetLink, movieInfo);

                        if (result.success) {
                            btn.innerHTML = `✓ Started`;
                            btn.classList.add('downloading');

                            // Show notification
                            setTimeout(() => {
                                btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <polyline points="7 10 12 15 17 10"/>
                                    <line x1="12" y1="15" x2="12" y2="3"/>
                                </svg> Download`;
                                btn.disabled = false;
                                btn.classList.remove('downloading');
                            }, 3000);
                        } else {
                            throw new Error(result.error || 'Failed to start download');
                        }
                    } else {
                        // Running in browser - show message
                        btn.innerHTML = `Desktop only`;
                        setTimeout(() => {
                            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg> Download`;
                            btn.disabled = false;
                        }, 2000);
                    }
                } catch (error) {
                    console.error('Download error:', error);
                    btn.innerHTML = `Error`;
                    btn.disabled = false;
                    setTimeout(() => {
                        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg> Download`;
                    }, 2000);
                }
            });
        });
    }
};

window.WatchPage = WatchPage;

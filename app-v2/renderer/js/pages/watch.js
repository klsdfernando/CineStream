/**
 * Watch Page - Video Player for Movies and TV Series
 */

const WatchPage = {
    mediaId: null,
    mediaType: 'movie', // 'movie' or 'tv'
    mediaData: null,
    isPlaying: false,
    currentPlayer: 'vidnest',
    // TV-specific state
    currentSeason: 1,
    currentEpisode: 1,
    seasonData: null,
    // Custom subtitle state
    customSubtitles: [],
    activeSubtitleId: null,
    pendingSubtitleFile: null,
    vidvaultTracks: [],
    vidvaultLoading: false,
    loadingVaultId: null,
    // Audio booster / equalizer state
    audioEnabled: false,
    audioBoost: 1,
    audioBands: [],
    audioPreset: 'flat',
    _audioApplyTimer: null,

    servers: [
        {
            id: 'vidnest',
            name: 'Vidnest',
            badge: 'Primary',
            getUrl: (type, id, s, e) => type === 'tv'
                ? `https://vidnest.fun/tv/${id}/${s}/${e}?color=4ade80`
                : `https://vidnest.fun/movie/${id}?color=4ade80`
        },
        {
            id: 'videasy',
            name: 'Videasy (High Quality)',
            getUrl: (type, id, s, e) => type === 'tv'
                ? `https://player.videasy.to/tv/${id}/${s}/${e}?color=4ade80`
                : `https://player.videasy.to/movie/${id}?color=4ade80`
        },
        {
            id: 'vidking',
            name: 'VidKing (High Quality)',
            getUrl: (type, id, s, e) => type === 'tv'
                ? `https://www.vidking.net/embed/tv/${id}/${s}/${e}?color=4ade80`
                : `https://www.vidking.net/embed/movie/${id}?color=4ade80`
        },
        {
            id: 'vidrock',
            name: 'VidRock',
            getUrl: (type, id, s, e) => type === 'tv'
                ? `https://vidrock.net/embed/tv/${id}/${s}/${e}?color=4ade80`
                : `https://vidrock.net/embed/movie/${id}?color=4ade80`
        },
        {
            id: '111movies',
            name: '111Movies',
            getUrl: (type, id, s, e) => type === 'tv'
                ? `https://player.vidlove.cc/embed/tv/${id}/${s}/${e}?color=4ade80`
                : `https://player.vidlove.cc/embed/movie/${id}?color=4ade80`
        }
    ],

    async render(params) {
        this.isPlaying = false;
        this.currentPlayer = 'vidnest';
        this.customSubtitles = [];
        this.activeSubtitleId = null;
        this.pendingSubtitleFile = null;
        this.vidvaultTracks = [];
        this.vidvaultLoading = false;
        this.loadingVaultId = null;
        this.audioEnabled = false;
        this.audioBoost = 1;
        this.audioBands = this.eqFrequencies.map(freq => ({ freq, gain: 0 }));
        this.audioPreset = 'flat';
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

                <!-- Server Selection Pill Bar -->
                <div class="server-selection-bar">
                    <div class="server-selection-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                            <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                            <line x1="6" y1="6" x2="6.01" y2="6"/>
                            <line x1="6" y1="18" x2="6.01" y2="18"/>
                        </svg>
                        <span>Server:</span>
                    </div>
                    <div class="server-pill-container" role="tablist">
                        ${this.servers.map((server, index) => `
                            <button type="button" 
                                    class="server-pill-btn ${this.currentPlayer === server.id ? 'active' : ''}" 
                                    data-server-id="${server.id}"
                                    onclick="WatchPage.switchServer('${server.id}')">
                                <span class="server-num">Server ${index + 1}</span>
                                <span class="server-name">${server.name}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div class="av-tools">
                    ${this.renderSubtitleBar()}
                    ${this.renderEqualizer()}
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
                            <button class="watch-action-btn favorite" id="btn-favorite">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                                </svg>
                                Favorites
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
        this.loadVidvaultSubtitles();
    },

    // Google language codes offered for machine translation
    translateLanguages: [
        { code: 'si', name: 'Sinhala' },
        { code: 'ta', name: 'Tamil' },
        { code: 'hi', name: 'Hindi' },
        { code: 'bn', name: 'Bengali' },
        { code: 'ur', name: 'Urdu' },
        { code: 'ar', name: 'Arabic' },
        { code: 'es', name: 'Spanish' },
        { code: 'fr', name: 'French' },
        { code: 'de', name: 'German' },
        { code: 'it', name: 'Italian' },
        { code: 'pt', name: 'Portuguese' },
        { code: 'ru', name: 'Russian' },
        { code: 'tr', name: 'Turkish' },
        { code: 'id', name: 'Indonesian' },
        { code: 'ms', name: 'Malay' },
        { code: 'th', name: 'Thai' },
        { code: 'vi', name: 'Vietnamese' },
        { code: 'ja', name: 'Japanese' },
        { code: 'ko', name: 'Korean' },
        { code: 'zh-CN', name: 'Chinese (Simplified)' },
    ],

    renderSubtitleBar() {
        return `
            <div class="subtitle-bar" id="subtitle-bar">
                <div class="subtitle-group subtitle-group--load">
                    <div class="subtitle-bar-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        <span>Load Sub</span>
                        <span class="subtitle-hint">From VidVault</span>
                    </div>
                    <div class="subtitle-vault-list" id="subtitle-vault-list">
                        <div class="subtitle-vault-empty">Looking up available subtitles…</div>
                    </div>
                </div>

                <div class="subtitle-group">
                    <div class="subtitle-bar-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="2" y="4" width="20" height="16" rx="2"/>
                            <line x1="6" y1="14" x2="11" y2="14"/>
                            <line x1="14" y1="14" x2="18" y2="14"/>
                            <line x1="6" y1="10" x2="9" y2="10"/>
                            <line x1="12" y1="10" x2="18" y2="10"/>
                        </svg>
                        <span>Custom Subtitles</span>
                        <span class="subtitle-hint">Start playback first</span>
                    </div>

                    <div class="subtitle-bar-body" id="subtitle-bar-body">
                        <div class="subtitle-subgroup">
                            <span class="subtitle-group-label">Upload a file</span>
                            <div class="subtitle-bar-controls">
                                <input type="file" id="subtitle-file-input" accept=".vtt,.srt,.txt" hidden>
                                <button type="button" class="subtitle-btn-file" id="subtitle-pick-btn">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <polyline points="17 8 12 3 7 8"/>
                                        <line x1="12" y1="3" x2="12" y2="15"/>
                                    </svg>
                                    <span id="subtitle-file-label">Choose file</span>
                                </button>
                                <input type="text" class="subtitle-name-input" id="subtitle-name-input" placeholder="Subtitle name (e.g. Sinhala)" maxlength="40">
                                <button type="button" class="subtitle-btn-add" id="subtitle-add-btn" disabled>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <line x1="12" y1="5" x2="12" y2="19"/>
                                        <line x1="5" y1="12" x2="19" y2="12"/>
                                    </svg>
                                    Add to Player
                                </button>
                            </div>
                        </div>

                        <div class="subtitle-subgroup">
                            <span class="subtitle-group-label">
                                Generate by translation
                                <span class="subtitle-badge-exp">Experimental</span>
                            </span>
                            <div class="subtitle-bar-controls">
                                <select class="subtitle-lang-select" id="subtitle-lang-select">
                                    ${this.translateLanguages.map(lang => `
                                        <option value="${lang.code}">${lang.name}</option>
                                    `).join('')}
                                </select>
                                <button type="button" class="subtitle-btn-generate" id="subtitle-generate-btn">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M5 8h9M9 4v4c0 4-2 6-5 7"/>
                                        <path d="M10 12c1 3 3 5 6 6"/>
                                        <path d="M14 20l4-9 4 9M15.5 17h5"/>
                                    </svg>
                                    Generate Subtitle
                                </button>
                                <span class="subtitle-generate-note">
                                    Translates VidVault's English track. Takes a minute or two.
                                </span>
                            </div>
                            <div class="subtitle-progress" id="subtitle-progress">
                                <div class="subtitle-progress-bar"><span id="subtitle-progress-fill"></span></div>
                                <span class="subtitle-progress-text" id="subtitle-progress-text"></span>
                            </div>
                        </div>
                    </div>

                    <div class="subtitle-status" id="subtitle-status"></div>
                    <div class="subtitle-track-list" id="subtitle-track-list"></div>
                </div>
            </div>
        `;
    },

    // Equalizer band centre frequencies (Hz)
    eqFrequencies: [60, 170, 310, 600, 1000, 3000, 6000, 12000],

    // Preset band gains (dB), aligned to eqFrequencies
    eqPresets: {
        flat:   { label: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0] },
        bass:   { label: 'Bass Boost', gains: [8, 6, 4, 1, 0, 0, 1, 2] },
        treble: { label: 'Treble Boost', gains: [-2, -1, 0, 0, 1, 3, 5, 6] },
        vocal:  { label: 'Vocal / Dialogue', gains: [-3, -2, 1, 4, 5, 3, 1, 0] },
        movie:  { label: 'Movie', gains: [5, 3, 1, 0, 1, 2, 3, 4] },
        music:  { label: 'Music', gains: [4, 2, 0, -1, -1, 0, 2, 3] },
        rock:   { label: 'Rock', gains: [5, 3, -1, -2, 0, 2, 4, 5] },
        party:  { label: 'Party', gains: [6, 5, 2, 0, 0, 2, 4, 5] },
    },

    formatFreq(freq) {
        return freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
    },

    renderEqualizer() {
        const boostPct = Math.round(this.audioBoost * 100);
        return `
            <div class="eq-bar" id="eq-bar">
                <div class="subtitle-bar-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
                        <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
                        <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
                        <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
                    </svg>
                    <span>Audio Booster &amp; Equalizer</span>
                    <label class="eq-switch">
                        <input type="checkbox" id="eq-enable" ${this.audioEnabled ? 'checked' : ''}>
                        <span class="eq-switch-track"><span class="eq-switch-thumb"></span></span>
                    </label>
                </div>

                <div class="eq-boost-row">
                    <span class="eq-row-label">Volume Boost</span>
                    <input type="range" class="eq-boost-slider" id="eq-boost" min="100" max="500" step="10" value="${boostPct}">
                    <span class="eq-boost-value" id="eq-boost-value">${boostPct}%</span>
                </div>

                <div class="eq-preset-row">
                    <span class="eq-row-label">Preset</span>
                    <select class="eq-preset-select" id="eq-preset">
                        ${Object.entries(this.eqPresets).map(([key, p]) => `
                            <option value="${key}" ${this.audioPreset === key ? 'selected' : ''}>${p.label}</option>
                        `).join('')}
                        <option value="custom" ${this.audioPreset === 'custom' ? 'selected' : ''}>Custom</option>
                    </select>
                    <button type="button" class="eq-reset-btn" id="eq-reset">Reset</button>
                </div>

                <div class="eq-bands" id="eq-bands">
                    ${this.audioBands.map((b, i) => `
                        <div class="eq-band">
                            <input type="range" class="eq-band-slider" data-band="${i}"
                                   min="-12" max="12" step="1" value="${b.gain}"
                                   orient="vertical">
                            <span class="eq-band-freq">${this.formatFreq(b.freq)}</span>
                        </div>
                    `).join('')}
                </div>

                <div class="eq-note" id="eq-note">Boost above 150% may distort. Applies to the active player's sound.</div>
            </div>
        `;
    },

    setEqNote(message, type = '') {
        const el = document.getElementById('eq-note');
        if (!el) return;
        el.textContent = message;
        el.className = `eq-note ${type}`;
    },

    applyAudioDebounced() {
        clearTimeout(this._audioApplyTimer);
        this._audioApplyTimer = setTimeout(() => this.applyAudio(), 140);
    },

    async applyAudio() {
        if (this.audioEnabled && !this.isPlaying) {
            this.setEqNote('Press play on the video first, then turn on the booster.', 'warn');
            return;
        }

        try {
            const res = await api.audio.apply({
                enabled: this.audioEnabled,
                gain: this.audioBoost,
                bands: this.audioBands,
            });

            if (!res.success) {
                this.setEqNote(res.error || 'Could not apply audio settings.', 'error');
                return;
            }

            if (this.audioEnabled) {
                this.setEqNote(`Booster on — ${Math.round(this.audioBoost * 100)}% volume.`, 'success');
            } else {
                this.setEqNote('Booster off — original sound restored.', '');
            }
        } catch (error) {
            console.error('Audio apply failed:', error);
            this.setEqNote(error.message || 'Could not apply audio settings.', 'error');
        }
    },

    applyPreset(name) {
        this.audioPreset = name;
        if (name !== 'custom' && this.eqPresets[name]) {
            const gains = this.eqPresets[name].gains;
            this.audioBands = this.audioBands.map((b, i) => ({ freq: b.freq, gain: gains[i] ?? 0 }));
            document.querySelectorAll('.eq-band-slider').forEach(slider => {
                const idx = Number(slider.dataset.band);
                slider.value = this.audioBands[idx].gain;
            });
        }
        if (this.audioEnabled) this.applyAudio();
    },

    resetEqualizer() {
        this.audioBoost = 1;
        this.audioPreset = 'flat';
        this.audioBands = this.audioBands.map(b => ({ freq: b.freq, gain: 0 }));

        const boost = document.getElementById('eq-boost');
        const boostValue = document.getElementById('eq-boost-value');
        const preset = document.getElementById('eq-preset');
        if (boost) boost.value = 100;
        if (boostValue) boostValue.textContent = '100%';
        if (preset) preset.value = 'flat';
        document.querySelectorAll('.eq-band-slider').forEach(slider => { slider.value = 0; });

        this.applyAudio();
    },

    /** Re-apply the audio graph after the player frame reloads. */
    reapplyAudio() {
        if (!this.audioEnabled) return;
        setTimeout(() => this.applyAudio(), 1500);
    },

    getVidvaultQuery() {
        const media = this.mediaData || {};
        return {
            type: this.mediaType === 'tv' ? 'tv' : 'movie',
            tmdbId: this.mediaId,
            season: this.currentSeason,
            episode: this.currentEpisode,
            title: media.title || media.name || '',
            year: media.year || '',
        };
    },

    async loadVidvaultSubtitles() {
        const list = document.getElementById('subtitle-vault-list');
        if (!list) return;

        this.vidvaultLoading = true;
        list.innerHTML = `<div class="subtitle-vault-empty">Looking up available subtitles…</div>`;

        try {
            const res = await api.subtitles.vidvaultList(this.getVidvaultQuery());
            if (!res.success) {
                this.vidvaultTracks = [];
                list.innerHTML = `<div class="subtitle-vault-empty">${res.error || 'No subtitles found.'}</div>`;
                return;
            }

            this.vidvaultTracks = res.tracks || [];
            this.renderVidvaultList();
        } catch (error) {
            console.error('VidVault subtitle lookup failed:', error);
            this.vidvaultTracks = [];
            list.innerHTML = `<div class="subtitle-vault-empty">Failed to load subtitles.</div>`;
        } finally {
            this.vidvaultLoading = false;
        }
    },

    renderVidvaultList() {
        const list = document.getElementById('subtitle-vault-list');
        if (!list) return;

        if (!this.vidvaultTracks.length) {
            list.innerHTML = `<div class="subtitle-vault-empty">No subtitles found for this title.</div>`;
            return;
        }

        list.innerHTML = this.vidvaultTracks.map(track => `
            <button type="button"
                    class="subtitle-vault-btn ${this.loadingVaultId === track.id ? 'loading' : ''} ${this.activeSubtitleId === `vv-${track.id}` ? 'active' : ''}"
                    data-vault-id="${track.id}">
                <span class="subtitle-vault-lang">${track.label}</span>
                ${track.size ? `<span class="subtitle-vault-size">${track.size}</span>` : ''}
            </button>
        `).join('');

        list.querySelectorAll('[data-vault-id]').forEach(btn => {
            btn.addEventListener('click', () => this.loadVidvaultTrack(btn.dataset.vaultId));
        });
    },

    async loadVidvaultTrack(trackId) {
        const track = this.vidvaultTracks.find(t => String(t.id) === String(trackId));
        if (!track) return;

        if (!this.isPlaying) {
            this.setSubtitleStatus('Press play on the video first, then load a subtitle.', 'error');
            return;
        }

        this.loadingVaultId = track.id;
        this.renderVidvaultList();
        this.setSubtitleStatus(`Loading ${track.label}…`, 'loading');

        try {
            const res = await api.subtitles.vidvaultLoad({
                id: `vv-${track.id}`,
                label: track.label,
                lang: track.lang,
                downloadUrl: track.downloadUrl,
                url: track.url,
                activate: true,
            });

            if (!res.success) {
                this.setSubtitleStatus(res.error || 'Failed to load subtitle.', 'error');
                return;
            }

            const existing = this.customSubtitles.findIndex(s => s.id === res.id);
            if (existing >= 0) this.customSubtitles.splice(existing, 1);
            this.customSubtitles.push({ id: res.id, label: res.label, content: res.content });
            this.activeSubtitleId = res.id;
            this.renderSubtitleList();
            this.renderVidvaultList();
            this.setSubtitleStatus(`"${res.label}" is now showing.`, 'success');
        } catch (error) {
            console.error('Failed to load VidVault subtitle:', error);
            this.setSubtitleStatus(error.message || 'Failed to load subtitle.', 'error');
        } finally {
            this.loadingVaultId = null;
            this.renderVidvaultList();
        }
    },

    setSubtitleProgress(percent, text) {
        const wrap = document.getElementById('subtitle-progress');
        const fill = document.getElementById('subtitle-progress-fill');
        const label = document.getElementById('subtitle-progress-text');
        if (!wrap) return;

        if (percent === null) {
            wrap.classList.remove('active');
            return;
        }
        wrap.classList.add('active');
        if (fill) fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
        if (label) label.textContent = text || '';
    },

    async generateSubtitle() {
        if (!this.isPlaying) {
            this.setSubtitleStatus('Press play on the video first, then generate.', 'error');
            return;
        }

        const select = document.getElementById('subtitle-lang-select');
        const btn = document.getElementById('subtitle-generate-btn');
        const code = select?.value || 'si';
        const language = this.translateLanguages.find(l => l.code === code);
        const label = language ? `${language.name} (AI)` : code;

        if (btn) btn.disabled = true;
        this.setSubtitleStatus('Fetching English subtitle from VidVault…', 'loading');
        this.setSubtitleProgress(0, 'Starting…');

        api.subtitles.removeGenerateProgress();
        api.subtitles.onGenerateProgress((data) => {
            if (data.phase === 'locating') {
                this.setSubtitleProgress(2, 'Looking up VidVault…');
            } else if (data.phase === 'downloading') {
                this.setSubtitleProgress(6, `Downloading ${data.source || 'English'} track…`);
            } else if (data.phase === 'translating') {
                const pct = data.total ? 10 + Math.round((data.done / data.total) * 84) : 10;
                this.setSubtitleProgress(pct, data.total ? `Translating ${data.done} / ${data.total} lines…` : 'Connecting to translator…');
            } else if (data.phase === 'injecting') {
                this.setSubtitleProgress(97, 'Adding to player…');
            }
        });

        try {
            const query = this.getVidvaultQuery();
            const english = this.vidvaultTracks.find(t =>
                /^en/i.test(t.lang) || /english/i.test(t.label)
            );

            const res = await api.subtitles.generate({
                targetLang: code,
                label,
                ...query,
                sourceDownloadUrl: english?.downloadUrl,
                sourceUrl: english?.url,
                sourceLabel: english?.label,
            });

            if (!res.success) {
                this.setSubtitleStatus(res.error || 'Could not generate the subtitle.', 'error');
                this.setSubtitleProgress(null);
                return;
            }

            this.customSubtitles.push({ id: res.id, label: res.label, content: res.content });
            this.activeSubtitleId = res.id;
            this.renderSubtitleList();
            this.renderVidvaultList();
            this.setSubtitleProgress(100, 'Done');
            setTimeout(() => this.setSubtitleProgress(null), 1200);

            const partial = res.failedCues > 0 ? ` ${res.failedCues} lines kept in English.` : '';
            this.setSubtitleStatus(`Generated "${res.label}" from ${res.sourceLabel} (${res.cueCount} lines).${partial}`, 'success');
        } catch (error) {
            console.error('Subtitle generation failed:', error);
            this.setSubtitleStatus(error.message || 'Subtitle generation failed.', 'error');
            this.setSubtitleProgress(null);
        } finally {
            api.subtitles.removeGenerateProgress();
            if (btn) btn.disabled = false;
        }
    },

    renderSubtitleList() {
        const list = document.getElementById('subtitle-track-list');
        if (!list) return;

        if (this.customSubtitles.length === 0) {
            list.innerHTML = '';
            return;
        }

        list.innerHTML = `
            <button type="button" class="subtitle-chip ${!this.activeSubtitleId ? 'active' : ''}" data-sub-id="">
                Off
            </button>
            ${this.customSubtitles.map(sub => `
                <span class="subtitle-chip-wrap">
                    <button type="button" class="subtitle-chip ${this.activeSubtitleId === sub.id ? 'active' : ''}" data-sub-id="${sub.id}">
                        ${sub.label}
                    </button>
                    <button type="button" class="subtitle-chip-remove" data-remove-id="${sub.id}" title="Remove">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </span>
            `).join('')}
        `;

        list.querySelectorAll('[data-sub-id]').forEach(btn => {
            btn.addEventListener('click', () => this.activateSubtitle(btn.dataset.subId || null));
        });
        list.querySelectorAll('[data-remove-id]').forEach(btn => {
            btn.addEventListener('click', () => this.removeSubtitle(btn.dataset.removeId));
        });
    },

    setSubtitleStatus(message, type = '') {
        const el = document.getElementById('subtitle-status');
        if (!el) return;
        el.textContent = message || '';
        el.className = `subtitle-status ${type}`;
    },

    /** Accepts SRT or VTT text and always returns valid WebVTT. */
    toWebVTT(text) {
        let out = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
        if (/^WEBVTT/.test(out.trim())) return out;
        out = out.replace(/(\d{2}:\d{2}:\d{2}),(\d{1,3})/g, '$1.$2');
        return `WEBVTT\n\n${out.trim()}\n`;
    },

    handleSubtitleFileChange(event) {
        const file = event.target.files && event.target.files[0];
        const label = document.getElementById('subtitle-file-label');
        const nameInput = document.getElementById('subtitle-name-input');
        const addBtn = document.getElementById('subtitle-add-btn');

        if (!file) {
            this.pendingSubtitleFile = null;
            if (label) label.textContent = 'Choose file';
            if (addBtn) addBtn.disabled = true;
            return;
        }

        this.pendingSubtitleFile = file;
        if (label) label.textContent = file.name.length > 26 ? `${file.name.slice(0, 24)}…` : file.name;
        if (addBtn) addBtn.disabled = false;
        if (nameInput && !nameInput.value.trim()) {
            nameInput.value = file.name.replace(/\.[^.]+$/, '').slice(0, 40);
        }
        this.setSubtitleStatus('');
    },

    async addCustomSubtitle() {
        const file = this.pendingSubtitleFile;
        if (!file) {
            this.setSubtitleStatus('Pick a subtitle file first.', 'error');
            return;
        }
        if (!this.isPlaying) {
            this.setSubtitleStatus('Press play on the video first, then add the subtitle.', 'error');
            return;
        }

        const nameInput = document.getElementById('subtitle-name-input');
        const addBtn = document.getElementById('subtitle-add-btn');
        const label = (nameInput?.value || '').trim() || file.name.replace(/\.[^.]+$/, '');

        if (addBtn) addBtn.disabled = true;
        this.setSubtitleStatus('Injecting subtitle into the player…', 'loading');

        try {
            const raw = await file.text();
            const content = this.toWebVTT(raw);
            const id = `cs-${Date.now()}`;

            const res = await api.subtitles.inject({ id, label, lang: 'und', content, activate: true });
            if (!res.success) {
                this.setSubtitleStatus(res.error || 'Failed to add subtitle.', 'error');
                if (addBtn) addBtn.disabled = false;
                return;
            }

            this.customSubtitles.push({ id, label, content });
            this.activeSubtitleId = id;
            this.renderSubtitleList();
            this.setSubtitleStatus(`"${label}" is now showing.`, 'success');

            this.pendingSubtitleFile = null;
            const fileInput = document.getElementById('subtitle-file-input');
            if (fileInput) fileInput.value = '';
            if (nameInput) nameInput.value = '';
            const fileLabel = document.getElementById('subtitle-file-label');
            if (fileLabel) fileLabel.textContent = 'Choose file';
        } catch (error) {
            console.error('Failed to add subtitle:', error);
            this.setSubtitleStatus(error.message || 'Failed to read the subtitle file.', 'error');
            if (addBtn) addBtn.disabled = false;
        }
    },

    async activateSubtitle(id) {
        const res = await api.subtitles.activate(id);
        if (!res.success) {
            this.setSubtitleStatus(res.error || 'Could not switch subtitle.', 'error');
            return;
        }
        this.activeSubtitleId = id || null;
        this.renderSubtitleList();
        this.renderVidvaultList();
        this.setSubtitleStatus(id ? 'Subtitle enabled.' : 'Subtitles off.', 'success');
    },

    async removeSubtitle(id) {
        await api.subtitles.remove(id);
        this.customSubtitles = this.customSubtitles.filter(sub => sub.id !== id);
        if (this.activeSubtitleId === id) this.activeSubtitleId = null;
        this.renderSubtitleList();
        this.setSubtitleStatus('Subtitle removed.', '');
    },

    /** Re-inject after the iframe reloads (server switch, episode change). */
    async reinjectSubtitles() {
        if (this.customSubtitles.length === 0) return;
        this.setSubtitleStatus('Re-applying your subtitles…', 'loading');

        for (const sub of this.customSubtitles) {
            const res = await api.subtitles.inject({
                id: sub.id,
                label: sub.label,
                lang: 'und',
                content: sub.content,
                activate: this.activeSubtitleId === sub.id,
            });
            if (!res.success) {
                this.setSubtitleStatus(res.error || 'Could not re-apply subtitles on this server.', 'error');
                return;
            }
        }
        this.setSubtitleStatus('Subtitles re-applied.', 'success');
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
        this.loadVidvaultSubtitles();
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
            this.loadVidvaultSubtitles();
        } catch (error) {
            console.error('Failed to load season:', error);
            episodeGrid.innerHTML = '<div class="error-message">Failed to load episodes</div>';
        }
    },

    updatePlayer() {
        const iframe = document.getElementById('video-player-iframe');
        if (iframe) {
            const playerUrl = this.buildPlayerUrl();
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

        // Custom subtitle controls
        const subFileInput = document.getElementById('subtitle-file-input');
        const subPickBtn = document.getElementById('subtitle-pick-btn');
        const subAddBtn = document.getElementById('subtitle-add-btn');

        if (subPickBtn && subFileInput) {
            subPickBtn.addEventListener('click', () => subFileInput.click());
            subFileInput.addEventListener('change', (e) => this.handleSubtitleFileChange(e));
        }
        if (subAddBtn) subAddBtn.addEventListener('click', () => this.addCustomSubtitle());

        const subGenerateBtn = document.getElementById('subtitle-generate-btn');
        if (subGenerateBtn) subGenerateBtn.addEventListener('click', () => this.generateSubtitle());

        // Audio booster / equalizer controls
        const eqEnable = document.getElementById('eq-enable');
        if (eqEnable) {
            eqEnable.addEventListener('change', (e) => {
                this.audioEnabled = e.target.checked;
                this.applyAudio();
            });
        }

        const eqBoost = document.getElementById('eq-boost');
        if (eqBoost) {
            eqBoost.addEventListener('input', (e) => {
                this.audioBoost = Number(e.target.value) / 100;
                const val = document.getElementById('eq-boost-value');
                if (val) val.textContent = `${e.target.value}%`;
                if (this.audioEnabled) this.applyAudioDebounced();
            });
        }

        const eqPreset = document.getElementById('eq-preset');
        if (eqPreset) eqPreset.addEventListener('change', (e) => this.applyPreset(e.target.value));

        const eqReset = document.getElementById('eq-reset');
        if (eqReset) eqReset.addEventListener('click', () => this.resetEqualizer());

        document.querySelectorAll('.eq-band-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const idx = Number(e.target.dataset.band);
                if (this.audioBands[idx]) this.audioBands[idx].gain = Number(e.target.value);
                this.audioPreset = 'custom';
                const presetSel = document.getElementById('eq-preset');
                if (presetSel) presetSel.value = 'custom';
                if (this.audioEnabled) this.applyAudioDebounced();
            });
        });

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

        // Like / Dislike / Favorites / Share
        const likeBtn = document.getElementById('btn-like');
        const dislikeBtn = document.getElementById('btn-dislike');
        const favoriteBtn = document.getElementById('btn-favorite');
        const shareBtn = document.getElementById('btn-share');

        if (likeBtn) likeBtn.addEventListener('click', () => this.handleActionClick('like'));
        if (dislikeBtn) dislikeBtn.addEventListener('click', () => this.handleActionClick('dislike'));
        if (favoriteBtn) favoriteBtn.addEventListener('click', () => this.handleSaveToPlaylistClick());
        if (shareBtn) shareBtn.addEventListener('click', () => this.handleShareClick());
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

    handlePlay() {
        const preview = document.getElementById('video-preview');
        const playerContainer = document.querySelector('.video-player-container');

        if (preview && this.mediaId) {
            const playerUrl = this.buildPlayerUrl();

            // Remove the preview
            preview.style.display = 'none';

            // Create and insert iframe if not already created
            let iframe = document.getElementById('video-player-iframe');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'video-player-iframe';
                iframe.className = 'video-player-iframe';
                iframe.setAttribute('allowfullscreen', '');
                iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media');
                iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
                iframe.style.cssText = 'width: 100%; height: 100%; border: none; border-radius: var(--radius-lg);';
                playerContainer.appendChild(iframe);
            }

            iframe.src = playerUrl;
            this.isPlaying = true;
            this.reinjectSubtitles();
            this.reapplyAudio();

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
        }
    },

    switchServer(serverId) {
        this.currentPlayer = serverId;

        // Update active class on pill buttons
        const buttons = document.querySelectorAll('.server-pill-btn');
        buttons.forEach(btn => {
            if (btn.dataset.serverId === serverId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        if (this.isPlaying) {
            const iframe = document.getElementById('video-player-iframe');
            if (iframe) {
                const playerUrl = this.buildPlayerUrl(serverId);
                console.log(`[Player] Switching server to ${serverId}:`, playerUrl);
                iframe.src = playerUrl;
                this.reinjectSubtitles();
                this.reapplyAudio();
            }
        } else {
            this.handlePlay();
        }
    },

    buildPlayerUrl(serverId) {
        const targetId = serverId || this.currentPlayer || 'vidnest';
        const server = this.servers.find(s => s.id === targetId) || this.servers[0];
        return server.getUrl(this.mediaType, this.mediaId, this.currentSeason, this.currentEpisode);
    },

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
            const searchParams = {
                mediaType: this.mediaType,
            };
            if (imdbId) searchParams.imdbId = imdbId;
            if (title) searchParams.title = title;
            if (this.mediaType === 'tv') {
                searchParams.season = this.currentSeason;
                searchParams.episode = this.currentEpisode;
            }

            const data = await window.api.torrentSearch.search(searchParams);

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

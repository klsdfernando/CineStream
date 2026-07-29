/**
 * Downloads Page - Manage active and completed downloads
 */

const DownloadsPage = {
    downloads: [],
    updateInterval: null,

    async render() {
        const container = document.getElementById('main-content');

        container.innerHTML = `
            <div class="downloads-page fade-in">
                <div class="downloads-header">
                    <h1>Downloads</h1>
                    <div class="downloads-path">
                        <span class="downloads-path-label">Save to:</span>
                        <span class="downloads-path-value" id="download-path">~/Downloads/MovieApp</span>
                        <button class="downloads-path-btn" id="btn-change-path">Change</button>
                    </div>
                </div>

                <div class="downloads-tabs">
                    <button class="tab-btn active" data-tab="active">Active</button>
                    <button class="tab-btn" data-tab="completed">Completed</button>
                </div>

                <div class="downloads-content" id="downloads-content">
                    <div class="downloads-loading">
                        <div class="spinner-small"></div>
                        <span>Loading downloads...</span>
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
        await this.loadDownloads();
        this.startProgressUpdates();
    },

    attachEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.renderDownloads(e.target.dataset.tab);
            });
        });
    },

    async loadDownloads() {
        try {
            if (window.electronAPI && window.electronAPI.torrent) {
                this.downloads = await window.electronAPI.torrent.getAll();
                const path = await window.electronAPI.torrent.getPath();
                document.getElementById('download-path').textContent = path;
            }
            this.renderDownloads('active');
        } catch (error) {
            console.error('Failed to load downloads:', error);
            this.renderDownloads('active');
        }
    },

    renderDownloads(tab = 'active') {
        const container = document.getElementById('downloads-content');

        const filtered = this.downloads.filter(d => {
            if (tab === 'active') return d.status !== 'completed';
            return d.status === 'completed';
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="downloads-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    <h2>${tab === 'active' ? 'No active downloads' : 'No completed downloads'}</h2>
                    <p>${tab === 'active' ? 'Start a download from any movie page' : 'Completed downloads will appear here'}</p>
                </div>
            `;
            return;
        }

        // Separate movies and TV shows
        const movies = filtered.filter(d => d.movieInfo?.mediaType !== 'tv');
        const tvShows = filtered.filter(d => d.movieInfo?.mediaType === 'tv');

        // Group TV shows by series title and season
        const tvGrouped = {};
        tvShows.forEach(d => {
            const title = d.movieInfo?.title || 'Unknown Show';
            const season = d.movieInfo?.season || 1;
            const key = title;

            if (!tvGrouped[key]) {
                tvGrouped[key] = {
                    title: title,
                    poster: d.movieInfo?.poster,
                    seasons: {}
                };
            }

            if (!tvGrouped[key].seasons[season]) {
                tvGrouped[key].seasons[season] = [];
            }
            tvGrouped[key].seasons[season].push(d);
        });

        let html = '<div class="downloads-organized">';

        // Render Movies section
        if (movies.length > 0) {
            html += `
                <div class="downloads-section">
                    <h2 class="downloads-section-title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                            <line x1="7" y1="2" x2="7" y2="22"/>
                            <line x1="17" y1="2" x2="17" y2="22"/>
                            <line x1="2" y1="12" x2="22" y2="12"/>
                            <line x1="2" y1="7" x2="7" y2="7"/>
                            <line x1="2" y1="17" x2="7" y2="17"/>
                            <line x1="17" y1="7" x2="22" y2="7"/>
                            <line x1="17" y1="17" x2="22" y2="17"/>
                        </svg>
                        Movies (${movies.length})
                    </h2>
                    <div class="downloads-grid">
                        ${movies.map(d => this.renderDownloadCard(d)).join('')}
                    </div>
                </div>
            `;
        }

        // Render TV Shows section (organized by show and season)
        if (Object.keys(tvGrouped).length > 0) {
            html += `
                <div class="downloads-section">
                    <h2 class="downloads-section-title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                            <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
                            <polyline points="17 2 12 7 7 2"/>
                        </svg>
                        TV Shows (${tvShows.length} episodes)
                    </h2>
            `;

            for (const showKey in tvGrouped) {
                const show = tvGrouped[showKey];
                html += `
                    <div class="tv-show-group">
                        <div class="tv-show-header">
                            <img class="tv-show-poster" src="${show.poster || 'assets/placeholder.png'}" 
                                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 150%22><rect fill=%22%23333%22 width=%22100%22 height=%22150%22/></svg>'">
                            <h3 class="tv-show-title">${show.title}</h3>
                        </div>
                `;

                // Sort seasons numerically
                const seasonNumbers = Object.keys(show.seasons).map(Number).sort((a, b) => a - b);

                for (const seasonNum of seasonNumbers) {
                    const episodes = show.seasons[seasonNum];
                    // Sort episodes by episode number
                    episodes.sort((a, b) => (a.movieInfo?.episode || 0) - (b.movieInfo?.episode || 0));

                    html += `
                        <div class="season-group">
                            <h4 class="season-title">Season ${seasonNum} (${episodes.length} episodes)</h4>
                            <div class="downloads-grid episodes-grid">
                                ${episodes.map(d => this.renderDownloadCard(d, true)).join('')}
                            </div>
                        </div>
                    `;
                }

                html += `</div>`;
            }

            html += `</div>`;
        }

        html += '</div>';
        container.innerHTML = html;

        this.attachCardListeners();
    },

    renderDownloadCard(download, isEpisode = false) {
        const progress = download.progress || 0;
        const speed = this.formatSpeed(download.downloadSpeed || 0);
        const eta = this.formatETA(download.eta || 0);
        const size = this.formatBytes(download.size || 0);
        const downloaded = this.formatBytes(download.downloaded || 0);

        // For episode cards, show episode number or season for season packs
        let displayTitle;
        if (isEpisode) {
            // Check if it's a season pack (type or name contains SEASON PACK)
            const isSeasonPack = download.torrentType === 'season-pack' ||
                (download.name && download.name.includes('SEASON')) ||
                (download.name && download.name.includes('PACK'));

            if (isSeasonPack) {
                displayTitle = `Full Season ${download.movieInfo?.season || ''}`;
            } else if (download.movieInfo?.episode) {
                displayTitle = `Episode ${download.movieInfo.episode}`;
            } else {
                displayTitle = download.movieInfo?.title || download.name || 'Unknown';
            }
        } else {
            displayTitle = download.movieInfo?.title || download.name || 'Unknown';
        }

        return `
            <div class="download-card ${isEpisode ? 'episode-card' : ''}" data-hash="${download.infoHash}">
                <div class="download-card-header">
                    ${!isEpisode ? `
                        <img class="download-card-poster" 
                             src="${download.movieInfo?.poster || 'assets/placeholder.png'}" 
                             alt="${download.name}"
                             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 150%22><rect fill=%22%23333%22 width=%22100%22 height=%22150%22/></svg>'">
                    ` : ''}
                    <div class="download-card-info">
                        <div class="download-card-title">${displayTitle}</div>
                        <div class="download-card-meta">${downloaded} / ${size}</div>
                        <span class="download-card-status ${download.status}">${download.status}</span>
                    </div>
                </div>
                
                <div class="download-card-progress">
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${progress}%"></div>
                    </div>
                    <div class="download-card-stats">
                        <span>${progress}%</span>
                        ${download.status === 'downloading' ? `
                            <span class="download-speed">${speed}</span>
                            <span>ETA: ${eta}</span>
                        ` : ''}
                        <span>${download.peers || 0} peers</span>
                    </div>
                </div>

                <div class="download-card-actions">
                    ${download.status === 'downloading' ? `
                        <button class="download-action-btn pause" data-action="pause" data-hash="${download.infoHash}">
                            <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                            Pause
                        </button>
                    ` : download.status === 'paused' ? `
                        <button class="download-action-btn resume" data-action="resume" data-hash="${download.infoHash}">
                            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            Resume
                        </button>
                    ` : ''}
                    <button class="download-action-btn cancel" data-action="cancel" data-hash="${download.infoHash}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        Remove
                    </button>
                </div>
            </div>
        `;
    },

    attachCardListeners() {
        document.querySelectorAll('.download-action-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const action = btn.dataset.action;
                const hash = btn.dataset.hash;

                if (window.electronAPI && window.electronAPI.torrent) {
                    try {
                        if (action === 'pause') {
                            await window.electronAPI.torrent.pause(hash);
                        } else if (action === 'resume') {
                            await window.electronAPI.torrent.resume(hash);
                        } else if (action === 'cancel') {
                            await window.electronAPI.torrent.cancel(hash);
                        }
                        await this.loadDownloads();
                    } catch (error) {
                        console.error(`Failed to ${action} download:`, error);
                    }
                }
            });
        });
    },

    startProgressUpdates() {
        // Clear any existing interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        // Remove old listeners to prevent memory leak
        if (window.electronAPI && window.electronAPI.torrent && window.electronAPI.torrent.removeAllListeners) {
            window.electronAPI.torrent.removeAllListeners();
        }

        // Setup progress event listeners
        if (window.electronAPI && window.electronAPI.torrent) {
            window.electronAPI.torrent.onProgress((data) => {
                this.updateDownloadProgress(data);
            });

            window.electronAPI.torrent.onCompleted((data) => {
                this.loadDownloads();
            });
        }

        // Poll for updates every 3 seconds (was 2, slightly increased to reduce load)
        this.updateInterval = setInterval(async () => {
            if (window.electronAPI && window.electronAPI.torrent) {
                this.downloads = await window.electronAPI.torrent.getAll();
                const activeTab = document.querySelector('.tab-btn.active');
                if (activeTab) {
                    this.renderDownloads(activeTab.dataset.tab);
                }
            }
        }, 3000);
    },

    updateDownloadProgress(data) {
        const card = document.querySelector(`[data-hash="${data.infoHash}"]`);
        if (!card) return;

        const progressBar = card.querySelector('.progress-bar');
        const stats = card.querySelector('.download-card-stats');

        if (progressBar) {
            progressBar.style.width = `${data.progress}%`;
        }

        if (stats) {
            stats.innerHTML = `
                <span>${data.progress}%</span>
                <span class="download-speed">${this.formatSpeed(data.downloadSpeed)}</span>
                <span>ETA: ${this.formatETA(data.eta)}</span>
                <span>${data.peers} peers</span>
            `;
        }
    },

    formatSpeed(bytesPerSecond) {
        if (bytesPerSecond === 0) return '0 B/s';
        const k = 1024;
        const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
        const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
        return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    formatETA(ms) {
        if (!ms || ms === Infinity) return '--:--';
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        return `${seconds}s`;
    },

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        // Clean up event listeners
        if (window.electronAPI && window.electronAPI.torrent && window.electronAPI.torrent.removeAllListeners) {
            window.electronAPI.torrent.removeAllListeners();
        }
    }
};

window.DownloadsPage = DownloadsPage;

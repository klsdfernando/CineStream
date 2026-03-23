/**
 * Torrent Manager
 * Handles WebTorrent client and download management in Electron main process
 */

const path = require('path');
const fs = require('fs');
const { app, ipcMain } = require('electron');

class TorrentManager {
    constructor() {
        this.client = null;
        this.WebTorrent = null;
        this.downloads = new Map(); // Map of infoHash -> download info
        this.downloadPath = null;
        this.mainWindow = null;
        this.historyFile = null; // Path to downloads history file
    }

    /**
     * Initialize the torrent client
     */
    async init(mainWindow) {
        this.mainWindow = mainWindow;
        this.downloadPath = path.join(app.getPath('downloads'), 'MovieApp');
        this.historyFile = path.join(app.getPath('userData'), 'downloads-history.json');

        // Load saved downloads from file
        this.loadDownloadsHistory();

        try {
            // Dynamic import for ES module
            const WebTorrentModule = await import('webtorrent');
            this.WebTorrent = WebTorrentModule.default;

            // Create client with connection limits to prevent network saturation
            this.client = new this.WebTorrent({
                maxConns: 30,        // Max connections per torrent (default 55)
                uploadLimit: 50000,  // 50 KB/s upload limit to save bandwidth
                downloadLimit: -1,   // No download limit
                dht: { maxTables: 500, maxValues: 500 } // Limit DHT usage
            });

            this.client.on('error', (err) => {
                console.error('[TorrentManager] Client error:', err.message);
            });

            console.log('[TorrentManager] Initialized with connection limits');
        } catch (error) {
            console.error('[TorrentManager] Failed to initialize WebTorrent:', error.message);
        }

        // Setup IPC handlers
        this.setupIPC();
    }

    /**
     * Load downloads history from file
     */
    loadDownloadsHistory() {
        try {
            if (fs.existsSync(this.historyFile)) {
                const data = fs.readFileSync(this.historyFile, 'utf-8');
                const history = JSON.parse(data);

                if (Array.isArray(history)) {
                    for (const download of history) {
                        // Only restore completed downloads
                        if (download.infoHash && download.status === 'completed') {
                            this.downloads.set(download.infoHash, download);
                        }
                    }
                    console.log(`[TorrentManager] Loaded ${this.downloads.size} completed downloads from history`);
                }
            }
        } catch (error) {
            console.error('[TorrentManager] Failed to load downloads history:', error.message);
        }
    }

    /**
     * Save downloads history to file
     */
    saveDownloadsHistory() {
        try {
            // Only save completed downloads
            const completedDownloads = Array.from(this.downloads.values())
                .filter(d => d.status === 'completed')
                .map(d => ({
                    infoHash: d.infoHash,
                    name: d.name,
                    movieInfo: d.movieInfo,
                    torrentType: d.torrentType || 'episode', // Save torrent type
                    status: d.status,
                    progress: d.progress,
                    size: d.size,
                    downloaded: d.downloaded,
                    startedAt: d.startedAt,
                    completedAt: d.completedAt,
                    files: d.files
                }));

            fs.writeFileSync(this.historyFile, JSON.stringify(completedDownloads, null, 2));
            console.log(`[TorrentManager] Saved ${completedDownloads.length} completed downloads to history`);
        } catch (error) {
            console.error('[TorrentManager] Failed to save downloads history:', error.message);
        }
    }

    /**
     * Setup IPC handlers for renderer communication
     */
    setupIPC() {
        // Start a download
        ipcMain.handle('torrent:start', async (event, magnetLink, movieInfo) => {
            try {
                return await this.startDownload(magnetLink, movieInfo);
            } catch (error) {
                console.error('[TorrentManager] IPC start error:', error);
                return { success: false, error: error.message };
            }
        });

        // Pause a download
        ipcMain.handle('torrent:pause', async (event, infoHash) => {
            try {
                return this.pauseDownload(infoHash);
            } catch (error) {
                console.error('[TorrentManager] IPC pause error:', error);
                return { success: false, error: error.message };
            }
        });

        // Resume a download
        ipcMain.handle('torrent:resume', async (event, infoHash) => {
            try {
                return this.resumeDownload(infoHash);
            } catch (error) {
                console.error('[TorrentManager] IPC resume error:', error);
                return { success: false, error: error.message };
            }
        });

        // Cancel/Remove a download
        ipcMain.handle('torrent:cancel', async (event, infoHash) => {
            try {
                return this.cancelDownload(infoHash);
            } catch (error) {
                console.error('[TorrentManager] IPC cancel error:', error);
                return { success: false, error: error.message };
            }
        });

        // Get all downloads
        ipcMain.handle('torrent:getAll', async () => {
            return this.getAllDownloads();
        });

        // Get download path
        ipcMain.handle('torrent:getPath', async () => {
            return this.downloadPath;
        });

        // Set download path
        ipcMain.handle('torrent:setPath', async (event, newPath) => {
            this.downloadPath = newPath;
            return true;
        });
    }

    /**
     * Find torrent by infoHash in the client
     */
    findTorrent(infoHash) {
        if (!this.client || !this.client.torrents) return null;
        return this.client.torrents.find(t => t.infoHash === infoHash);
    }

    /**
     * Start a new download
     */
    async startDownload(magnetLink, movieInfo = {}) {
        if (!this.client) {
            throw new Error('Torrent client not initialized');
        }

        if (!magnetLink) {
            throw new Error('Magnet link is required');
        }

        console.log('[TorrentManager] Starting download:', movieInfo.title || 'Unknown');
        console.log('[TorrentManager] Magnet:', magnetLink.substring(0, 60) + '...');

        // Extract infoHash from magnet link
        const hashMatch = magnetLink.match(/btih:([a-fA-F0-9]{40})/);
        const magnetHash = hashMatch ? hashMatch[1].toUpperCase() : null;

        // Check if already in client
        let existingTorrent = null;
        if (magnetHash) {
            existingTorrent = this.findTorrent(magnetHash);
        }

        if (existingTorrent) {
            console.log('[TorrentManager] Torrent already exists:', existingTorrent.infoHash);

            // Update downloads map if not there
            if (!this.downloads.has(existingTorrent.infoHash)) {
                this.addToDownloadsMap(existingTorrent, movieInfo);
                this.attachTorrentEvents(existingTorrent);
            }

            return {
                success: true,
                infoHash: existingTorrent.infoHash,
                message: 'Already downloading'
            };
        }

        // Add new torrent
        return new Promise((resolve, reject) => {
            try {
                const torrent = this.client.add(magnetLink, { path: this.downloadPath });

                // Wait for infoHash to be available
                const onInfoHash = () => {
                    const infoHash = torrent.infoHash;
                    console.log('[TorrentManager] Torrent infoHash ready:', infoHash);

                    // Store download info
                    this.downloads.set(infoHash, {
                        infoHash,
                        magnetLink,
                        name: movieInfo.title || 'Connecting...',
                        movieInfo,
                        torrentType: movieInfo.torrentType || 'episode', // 'season-pack' or 'episode'
                        status: 'connecting',
                        progress: 0,
                        downloadSpeed: 0,
                        uploadSpeed: 0,
                        size: 0,
                        downloaded: 0,
                        peers: 0,
                        eta: 0,
                        startedAt: Date.now(),
                        files: []
                    });

                    // Attach events
                    this.attachTorrentEvents(torrent);

                    // Resolve
                    resolve({
                        success: true,
                        infoHash,
                        name: movieInfo.title || 'Starting...'
                    });
                };

                // Check if infoHash is already available
                if (torrent.infoHash) {
                    onInfoHash();
                } else {
                    torrent.once('infoHash', onInfoHash);
                }

                // Handle error on add
                torrent.once('error', (err) => {
                    console.error('[TorrentManager] Torrent add error:', err.message);
                    reject(err);
                });

            } catch (error) {
                console.error('[TorrentManager] Add torrent error:', error);
                reject(error);
            }
        });
    }

    /**
     * Add torrent info to downloads map
     */
    addToDownloadsMap(torrent, movieInfo = {}) {
        this.downloads.set(torrent.infoHash, {
            infoHash: torrent.infoHash,
            magnetLink: torrent.magnetURI,
            name: torrent.name || movieInfo.title || 'Unknown',
            movieInfo,
            status: torrent.done ? 'completed' : (torrent.paused ? 'paused' : 'downloading'),
            progress: Math.round((torrent.progress || 0) * 100),
            downloadSpeed: torrent.downloadSpeed || 0,
            uploadSpeed: torrent.uploadSpeed || 0,
            size: torrent.length || 0,
            downloaded: torrent.downloaded || 0,
            peers: torrent.numPeers || 0,
            eta: torrent.timeRemaining || 0,
            startedAt: Date.now(),
            files: (torrent.files || []).map(f => ({
                name: f.name,
                size: f.length,
                path: f.path
            }))
        });
    }

    /**
     * Attach event listeners to a torrent
     */
    attachTorrentEvents(torrent) {
        const infoHash = torrent.infoHash;

        torrent.on('metadata', () => {
            console.log('[TorrentManager] Metadata received:', torrent.name);
            const download = this.downloads.get(infoHash);
            if (download) {
                download.name = torrent.name;
                download.size = torrent.length;
                download.status = 'downloading';
                download.files = torrent.files.map(f => ({
                    name: f.name,
                    size: f.length,
                    path: f.path
                }));
            }
        });

        torrent.on('download', () => {
            this.updateDownloadProgress(infoHash, torrent);
        });

        torrent.on('done', () => {
            console.log('[TorrentManager] Download complete:', torrent.name);
            const download = this.downloads.get(infoHash);
            if (download) {
                download.status = 'completed';
                download.progress = 100;
                download.completedAt = Date.now();
            }
            // Save to persistent storage
            this.saveDownloadsHistory();
            this.sendToRenderer('torrent:completed', { infoHash });
        });

        torrent.on('error', (err) => {
            console.error('[TorrentManager] Torrent error:', err.message);
            const download = this.downloads.get(infoHash);
            if (download) {
                download.status = 'error';
                download.error = err.message;
            }
            this.sendToRenderer('torrent:error', { infoHash, error: err.message });
        });
    }

    /**
     * Update download progress and send to renderer
     */
    updateDownloadProgress(infoHash, torrent) {
        const download = this.downloads.get(infoHash);
        if (!download) return;

        download.progress = Math.round(torrent.progress * 100);
        download.downloadSpeed = torrent.downloadSpeed;
        download.uploadSpeed = torrent.uploadSpeed;
        download.downloaded = torrent.downloaded;
        download.peers = torrent.numPeers;
        download.eta = torrent.timeRemaining;

        // Send update to renderer
        this.sendToRenderer('torrent:progress', {
            infoHash,
            progress: download.progress,
            downloadSpeed: download.downloadSpeed,
            downloaded: download.downloaded,
            peers: download.peers,
            eta: download.eta
        });
    }

    /**
     * Pause a download
     */
    pauseDownload(infoHash) {
        const torrent = this.findTorrent(infoHash);
        if (torrent) {
            // WebTorrent pause - stop peers
            torrent.pause();
            const download = this.downloads.get(infoHash);
            if (download) download.status = 'paused';
            console.log('[TorrentManager] Paused:', infoHash);
            return { success: true };
        }
        // If not in client but in our map, just update status
        const download = this.downloads.get(infoHash);
        if (download) {
            download.status = 'paused';
            return { success: true };
        }
        return { success: false, error: 'Torrent not found' };
    }

    /**
     * Resume a download
     */
    resumeDownload(infoHash) {
        const torrent = this.findTorrent(infoHash);
        if (torrent) {
            torrent.resume();
            const download = this.downloads.get(infoHash);
            if (download) download.status = 'downloading';
            console.log('[TorrentManager] Resumed:', infoHash);
            return { success: true };
        }
        // If not in client but in our map, just update status
        const download = this.downloads.get(infoHash);
        if (download) {
            download.status = 'downloading';
            return { success: true };
        }
        return { success: false, error: 'Torrent not found' };
    }

    /**
     * Cancel/Remove a download
     */
    cancelDownload(infoHash, deleteFiles = false) {
        const torrent = this.findTorrent(infoHash);
        if (torrent) {
            // Use client.remove instead of torrent.destroy
            this.client.remove(infoHash, { destroyStore: deleteFiles });
            console.log('[TorrentManager] Removed from client:', infoHash);
        }

        // Always remove from our map
        this.downloads.delete(infoHash);
        console.log('[TorrentManager] Removed from downloads map:', infoHash);
        return { success: true };
    }

    /**
     * Get all downloads
     */
    getAllDownloads() {
        // Sync with actual client state
        if (this.client && this.client.torrents) {
            for (const torrent of this.client.torrents) {
                const download = this.downloads.get(torrent.infoHash);
                if (download) {
                    download.progress = Math.round(torrent.progress * 100);
                    download.downloadSpeed = torrent.downloadSpeed;
                    download.downloaded = torrent.downloaded;
                    download.size = torrent.length || download.size;
                    download.peers = torrent.numPeers;
                    download.eta = torrent.timeRemaining;
                    if (torrent.done && download.status !== 'completed') {
                        download.status = 'completed';
                    }
                }
            }
        }
        return Array.from(this.downloads.values());
    }

    /**
     * Send message to renderer process
     */
    sendToRenderer(channel, data) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(channel, data);
        }
    }

    /**
     * Cleanup on app quit
     */
    destroy() {
        // Save downloads history before quitting
        this.saveDownloadsHistory();

        if (this.client) {
            this.client.destroy();
        }
    }
}

module.exports = new TorrentManager();

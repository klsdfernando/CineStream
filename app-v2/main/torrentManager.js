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

        // Select download path via native folder dialog
        ipcMain.handle('torrent:selectPath', async () => {
            const { dialog } = require('electron');
            if (!this.mainWindow || this.mainWindow.isDestroyed()) {
                return { canceled: true, path: this.downloadPath };
            }
            const result = await dialog.showOpenDialog(this.mainWindow, {
                properties: ['openDirectory', 'createDirectory'],
                title: 'Select Download Location',
                defaultPath: this.downloadPath
            });
            if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
                this.downloadPath = result.filePaths[0];
                return { canceled: false, path: this.downloadPath };
            }
            return { canceled: true, path: this.downloadPath };
        });
    }

    /**
     * Find torrent by infoHash in the client
     */
    /**
     * Find torrent by infoHash in the client
     */
    findTorrent(infoHash) {
        if (!this.client || !this.client.torrents || !infoHash) return null;
        const target = String(infoHash).toLowerCase();
        return this.client.torrents.find(t => (t.infoHash && t.infoHash.toLowerCase() === target));
    }

    /**
     * Helper to get download item from map case-insensitively
     */
    getDownloadItem(infoHash) {
        if (!infoHash) return null;
        const target = String(infoHash).toLowerCase();
        if (this.downloads.has(target)) return this.downloads.get(target);
        for (const [k, v] of this.downloads.entries()) {
            if (String(k).toLowerCase() === target) return v;
        }
        return null;
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

        // Extract infoHash from magnet link (normalized to lowercase)
        const hashMatch = magnetLink.match(/btih:([a-fA-F0-9]{40})/i);
        const magnetHash = hashMatch ? hashMatch[1].toLowerCase() : null;

        const defaultAnnounce = [
            'udp://tracker.opentrackr.org:1337/announce',
            'udp://open.demonii.com:1337/announce',
            'udp://tracker.openbittorrent.com:6969/announce',
            'udp://explodie.org:6969/announce',
            'udp://tracker.torrent.eu.org:451/announce',
            'udp://tracker.tiny-vps.com:6969/announce',
            'wss://tracker.openwebtorrent.com',
            'wss://tracker.webtorrent.dev',
            'wss://tracker.files.fm:7070/announce'
        ];

        const torrentInput = magnetLink || (magnetHash ? `magnet:?xt=urn:btih:${magnetHash}` : '');

        // Check if already in client
        let existingTorrent = null;
        if (magnetHash) {
            existingTorrent = this.findTorrent(magnetHash);
        }

        if (existingTorrent) {
            const hashKey = existingTorrent.infoHash.toLowerCase();
            console.log('[TorrentManager] Torrent already exists:', hashKey);

            if (!this.getDownloadItem(hashKey)) {
                this.addToDownloadsMap(existingTorrent, movieInfo);
                this.attachTorrentEvents(existingTorrent);
            }

            return {
                success: true,
                infoHash: hashKey,
                name: movieInfo.title || existingTorrent.name || 'Downloading',
                message: 'Already downloading'
            };
        }

        // Add new torrent
        return new Promise((resolve, reject) => {
            try {
                const torrent = this.client.add(torrentInput, {
                    path: this.downloadPath,
                    announce: defaultAnnounce
                });

                // Wait for infoHash to be available
                const onInfoHash = () => {
                    const infoHash = (torrent.infoHash || magnetHash || '').toLowerCase();
                    console.log('[TorrentManager] Torrent infoHash ready:', infoHash);

                    if (infoHash) {
                        // Store download info with lowercase key
                        this.downloads.set(infoHash, {
                            infoHash,
                            magnetLink,
                            name: torrent.name || movieInfo.title || 'Connecting...',
                            movieInfo,
                            torrentType: movieInfo.torrentType || 'episode',
                            status: 'downloading',
                            progress: Math.round((torrent.progress || 0) * 100),
                            downloadSpeed: torrent.downloadSpeed || 0,
                            uploadSpeed: torrent.uploadSpeed || 0,
                            size: torrent.length || 0,
                            downloaded: torrent.downloaded || 0,
                            peers: torrent.numPeers || 0,
                            eta: torrent.timeRemaining || 0,
                            startedAt: Date.now(),
                            files: []
                        });

                        // Attach events
                        this.attachTorrentEvents(torrent);
                    }

                    // Resolve
                    resolve({
                        success: true,
                        infoHash: infoHash || magnetHash,
                        name: movieInfo.title || 'Starting...'
                    });
                };

                if (torrent.infoHash || magnetHash) {
                    onInfoHash();
                } else {
                    torrent.once('infoHash', onInfoHash);
                }

                // Handle error on add
                torrent.once('error', (err) => {
                    console.error('[TorrentManager] Torrent add error:', err.message);
                    if (magnetHash && !this.getDownloadItem(magnetHash)) {
                        this.downloads.set(magnetHash.toLowerCase(), {
                            infoHash: magnetHash.toLowerCase(),
                            magnetLink,
                            name: movieInfo.title || 'Downloading...',
                            movieInfo,
                            torrentType: movieInfo.torrentType || 'episode',
                            status: 'downloading',
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
                        resolve({ success: true, infoHash: magnetHash.toLowerCase(), name: movieInfo.title || 'Starting...' });
                    } else {
                        reject(err);
                    }
                });

            } catch (error) {
                console.error('[TorrentManager] Add torrent error:', error);
                if (magnetHash) {
                    resolve({ success: true, infoHash: magnetHash.toLowerCase(), name: movieInfo.title || 'Starting...' });
                } else {
                    reject(error);
                }
            }
        });
    }

    /**
     * Add torrent info to downloads map
     */
    addToDownloadsMap(torrent, movieInfo = {}) {
        const infoHash = (torrent.infoHash || '').toLowerCase();
        if (!infoHash) return;

        this.downloads.set(infoHash, {
            infoHash,
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
        const infoHash = (torrent.infoHash || '').toLowerCase();

        torrent.on('metadata', () => {
            console.log('[TorrentManager] Metadata received:', torrent.name);
            const download = this.getDownloadItem(infoHash);
            if (download) {
                download.name = torrent.name;
                download.size = torrent.length;
                download.status = 'downloading';
                download.files = (torrent.files || []).map(f => ({
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
            const download = this.getDownloadItem(infoHash);
            if (download) {
                download.status = 'completed';
                download.progress = 100;
                download.completedAt = Date.now();
            }
            this.saveDownloadsHistory();
            this.sendToRenderer('torrent:completed', { infoHash });
        });

        torrent.on('error', (err) => {
            console.error('[TorrentManager] Torrent error:', err.message);
            const download = this.getDownloadItem(infoHash);
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
        const download = this.getDownloadItem(infoHash || torrent.infoHash);
        if (!download) return;

        if (download.status === 'paused' || torrent.paused) {
            download.downloadSpeed = 0;
            download.peers = 0;
            download.eta = 0;
            return;
        }

        download.progress = Math.round((torrent.progress || 0) * 100);
        download.downloadSpeed = torrent.downloadSpeed || 0;
        download.uploadSpeed = torrent.uploadSpeed || 0;
        download.downloaded = torrent.downloaded || 0;
        download.peers = torrent.numPeers || 0;
        download.eta = torrent.timeRemaining || 0;
        if (torrent.name && (download.name === 'Connecting...' || download.name === 'Downloading...')) {
            download.name = torrent.name;
        }

        // Send update to renderer
        this.sendToRenderer('torrent:progress', {
            infoHash: download.infoHash,
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
            try { torrent.pause(); } catch (e) {}
            if (torrent.deselect && torrent.pieces) {
                try { torrent.deselect(0, torrent.pieces.length - 1, 0); } catch (e) {}
            }
            if (torrent.wires) {
                torrent.wires.forEach(w => { try { w.destroy(); } catch (e) {} });
            }
        }
        const download = this.getDownloadItem(infoHash);
        if (download) {
            download.status = 'paused';
            download.downloadSpeed = 0;
            download.peers = 0;
            download.eta = 0;

            this.sendToRenderer('torrent:progress', {
                infoHash: download.infoHash,
                progress: download.progress,
                downloadSpeed: 0,
                downloaded: download.downloaded,
                peers: 0,
                eta: 0
            });
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
            try { torrent.resume(); } catch (e) {}
            if (torrent.select && torrent.pieces) {
                try { torrent.select(0, torrent.pieces.length - 1, 1); } catch (e) {}
            }
        }
        const download = this.getDownloadItem(infoHash);
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
            this.client.remove(torrent.infoHash, { destroyStore: deleteFiles });
        }

        const target = String(infoHash).toLowerCase();
        for (const [k, v] of Array.from(this.downloads.entries())) {
            if (String(k).toLowerCase() === target || v.infoHash.toLowerCase() === target) {
                this.downloads.delete(k);
            }
        }
        return { success: true };
    }

    /**
     * Get all downloads
     */
    getAllDownloads() {
        if (this.client && this.client.torrents) {
            for (const torrent of this.client.torrents) {
                const download = this.getDownloadItem(torrent.infoHash);
                if (download) {
                    if (download.status === 'paused' || torrent.paused) {
                        download.status = 'paused';
                        download.downloadSpeed = 0;
                        download.peers = 0;
                        download.eta = 0;
                    } else {
                        download.progress = Math.round((torrent.progress || 0) * 100);
                        download.downloadSpeed = torrent.downloadSpeed || 0;
                        download.downloaded = torrent.downloaded || 0;
                        download.size = torrent.length || download.size || 0;
                        download.peers = torrent.numPeers || 0;
                        download.eta = torrent.timeRemaining || 0;
                        if (torrent.name && (download.name === 'Connecting...' || download.name === 'Downloading...')) {
                            download.name = torrent.name;
                        }
                        if (torrent.done && download.status !== 'completed') {
                            download.status = 'completed';
                        }
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

/**
 * Stream Downloader Service
 * Downloads direct m3u8 HLS streams and mp4 video files to disk
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

class StreamDownloader {
    constructor() {
        this.activeDownloads = new Map(); // id -> download status
        this.downloadPath = path.join(app.getPath('downloads'), 'MovieApp');
        this.historyFile = path.join(app.getPath('userData'), 'direct-downloads-history.json');
        this.mainWindow = null;

        if (!fs.existsSync(this.downloadPath)) {
            fs.mkdirSync(this.downloadPath, { recursive: true });
        }
        this.loadHistory();
    }

    loadHistory() {
        try {
            if (fs.existsSync(this.historyFile)) {
                const data = fs.readFileSync(this.historyFile, 'utf-8');
                const history = JSON.parse(data);
                if (Array.isArray(history)) {
                    for (const item of history) {
                        if (item.id && item.status === 'completed') {
                            this.activeDownloads.set(item.id, item);
                        }
                    }
                }
            }
        } catch (e) {
            console.error('[StreamDownloader] Failed to load history:', e.message);
        }
    }

    saveHistory() {
        try {
            const completed = Array.from(this.activeDownloads.values()).filter(d => d.status === 'completed');
            fs.writeFileSync(this.historyFile, JSON.stringify(completed, null, 2));
        } catch (e) {
            console.error('[StreamDownloader] Failed to save history:', e.message);
        }
    }

    init(mainWindow) {
        this.mainWindow = mainWindow;
    }

    getAllDownloads() {
        return Array.from(this.activeDownloads.values());
    }

    async startDownload(streamInfo, mediaInfo) {
        const downloadId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const safeTitle = (mediaInfo?.title || 'Video')
            .replace(/[/\\?%*:|"<>]/g, '_')
            .trim();
        const seasonEpStr = mediaInfo?.season && mediaInfo?.episode
            ? `_S${String(mediaInfo.season).padStart(2, '0')}E${String(mediaInfo.episode).padStart(2, '0')}`
            : '';
        const qualityStr = (streamInfo.quality || 'HD').replace(/[^a-zA-Z0-9]/g, '_');

        const fileName = `${safeTitle}${seasonEpStr}_${qualityStr}.mp4`;
        const filePath = path.join(this.downloadPath, fileName);

        const downloadItem = {
            id: downloadId,
            downloadType: 'directStream',
            title: mediaInfo?.title || 'Direct Stream Download',
            poster: mediaInfo?.poster || null,
            fileName: fileName,
            filePath: filePath,
            streamUrl: streamInfo.url,
            playerSource: streamInfo.playerSource || 'Web Player',
            pixelSize: streamInfo.pixelSize || 'HD',
            quality: streamInfo.quality || 'HD',
            status: 'downloading', // downloading, completed, error, cancelled
            progress: 0,
            downloadedBytes: 0,
            totalBytes: 0,
            speed: 0,
            startTime: Date.now()
        };

        this.activeDownloads.set(downloadId, downloadItem);
        this.notifyProgress(downloadItem);

        // Execute download asynchronously
        if (streamInfo.type === 'mp4' || streamInfo.url.includes('.mp4')) {
            this.downloadMp4File(downloadId, streamInfo.url, filePath);
        } else {
            this.downloadHlsStream(downloadId, streamInfo.url, filePath);
        }

        return { success: true, downloadId, filePath };
    }

    async downloadMp4File(downloadId, url, filePath) {
        const item = this.activeDownloads.get(downloadId);
        if (!item) return;

        let downloadUrl = url;
        if (downloadUrl.includes('bcdnxw.hakunaymatata.com') && !downloadUrl.includes('v1.streamrk.site')) {
            downloadUrl = `https://v1.streamrk.site/${encodeURIComponent(downloadUrl)}`;
        }

        try {
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://vidvault.ru/'
            };

            let res = await fetch(downloadUrl, { headers, redirect: 'follow' });

            if (!res.ok && url !== downloadUrl) {
                res = await fetch(url, { headers, redirect: 'follow' });
            }

            if (!res.ok) throw new Error(`HTTP Error ${res.status}`);

            const totalBytes = parseInt(res.headers.get('content-length') || '0', 10);
            item.totalBytes = totalBytes;

            const fileStream = fs.createWriteStream(filePath);
            const nodeStream = Readable.fromWeb(res.body);

            let downloadedBytes = 0;
            let lastTime = Date.now();
            let lastBytes = 0;

            nodeStream.on('data', (chunk) => {
                if (item.status === 'cancelled') {
                    nodeStream.destroy();
                    fileStream.close();
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                    return;
                }

                downloadedBytes += chunk.length;
                item.downloadedBytes = downloadedBytes;

                if (totalBytes > 0) {
                    item.progress = Math.min(100, Math.round((downloadedBytes / totalBytes) * 100));
                }

                const now = Date.now();
                if (now - lastTime >= 1000) {
                    item.speed = Math.round((downloadedBytes - lastBytes) / ((now - lastTime) / 1000));
                    lastBytes = downloadedBytes;
                    lastTime = now;
                    this.notifyProgress(item);
                }
            });

            nodeStream.pipe(fileStream);

            fileStream.on('finish', () => {
                if (item.status !== 'cancelled') {
                    item.status = 'completed';
                    item.progress = 100;
                    item.speed = 0;
                    this.notifyProgress(item);
                }
            });

            fileStream.on('error', (err) => {
                item.status = 'error';
                item.error = err.message;
                this.notifyProgress(item);
            });

            nodeStream.on('error', (err) => {
                item.status = 'error';
                item.error = err.message;
                this.notifyProgress(item);
            });

        } catch (err) {
            console.error('[StreamDownloader] MP4 download error:', err.message);
            item.status = 'error';
            item.error = err.message;
            this.notifyProgress(item);
        }
    }

    async downloadHlsStream(downloadId, playlistUrl, filePath) {
        const item = this.activeDownloads.get(downloadId);
        if (!item) return;

        try {
            const res = await fetch(playlistUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://vidvault.ru/'
                }
            });
            const manifestText = await res.text();

            // Extract segment URLs (.ts files)
            const lines = manifestText.split('\n');
            const segmentUrls = [];

            for (let line of lines) {
                line = line.trim();
                if (line && !line.startsWith('#')) {
                    if (line.startsWith('http://') || line.startsWith('https://')) {
                        segmentUrls.push(line);
                    } else {
                        segmentUrls.push(new URL(line, playlistUrl).href);
                    }
                }
            }

            if (segmentUrls.length === 0) {
                throw new Error('No video segments found in playlist');
            }

            item.totalSegments = segmentUrls.length;
            item.completedSegments = 0;

            const fileStream = fs.createWriteStream(filePath);

            let downloadedBytes = 0;
            let lastTime = Date.now();
            let lastBytes = 0;

            for (let i = 0; i < segmentUrls.length; i++) {
                if (item.status === 'cancelled') {
                    fileStream.close();
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                    return;
                }

                const segUrl = segmentUrls[i];
                try {
                    const segRes = await fetch(segUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Referer': 'https://vidvault.ru/'
                        }
                    });

                    if (segRes.ok) {
                        const arrayBuf = await segRes.arrayBuffer();
                        const buffer = Buffer.from(arrayBuf);
                        fileStream.write(buffer);
                        downloadedBytes += buffer.length;
                        item.downloadedBytes = downloadedBytes;
                    }
                } catch (segErr) {
                    console.error(`[StreamDownloader] Failed segment ${i}:`, segErr.message);
                }

                item.completedSegments = i + 1;
                item.progress = Math.round(((i + 1) / segmentUrls.length) * 100);

                const now = Date.now();
                if (now - lastTime >= 1000) {
                    item.speed = Math.round((downloadedBytes - lastBytes) / ((now - lastTime) / 1000));
                    lastBytes = downloadedBytes;
                    lastTime = now;
                    this.notifyProgress(item);
                }
            }

            fileStream.end();
            item.status = 'completed';
            item.progress = 100;
            item.speed = 0;
            this.notifyProgress(item);

        } catch (err) {
            console.error('[StreamDownloader] HLS download error:', err.message);
            item.status = 'error';
            item.error = err.message;
            this.notifyProgress(item);
        }
    }

    cancelDownload(downloadId) {
        const item = this.activeDownloads.get(downloadId);
        if (item) {
            item.status = 'cancelled';
            this.notifyProgress(item);
        }
    }

    notifyProgress(item) {
        if (item && item.status === 'completed') {
            this.saveHistory();
        }
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('stream:download-progress', item);
        }
    }
}

module.exports = new StreamDownloader();

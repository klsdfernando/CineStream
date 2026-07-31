/**
 * Stream Sniffer Service
 * Intercepts m3u8 and mp4 video requests from embed players (Vidnest, VidLink, VidSrc, Videasy, VidKing, etc.)
 * Parses resolutions (pixel size) and player source origins.
 * Includes background invisible stream pre-fetching.
 */

const { session, BrowserWindow } = require('electron');

class StreamSniffer {
    constructor() {
        this.capturedStreams = new Map(); // Key: stream URL -> stream info
        this.mainWindow = null;
        this.isListening = false;
        this.currentMediaId = null;
        this.backgroundWindows = [];
    }

    init(mainWindow) {
        this.mainWindow = mainWindow;
        this.setupSniffer();
    }

    setMediaContext(mediaId, title) {
        this.currentMediaId = mediaId;
    }

    clearStreams() {
        this.capturedStreams.clear();
        this.closeBackgroundWindows();
        this.notifyRenderer();
    }

    closeBackgroundWindows() {
        if (this.backgroundWindows && this.backgroundWindows.length > 0) {
            this.backgroundWindows.forEach(win => {
                try {
                    if (win && !win.isDestroyed()) win.destroy();
                } catch (e) {}
            });
            this.backgroundWindows = [];
        }
    }

    getCapturedStreams() {
        return Array.from(this.capturedStreams.values());
    }

    prefetchBackgroundStreams({ mediaType, mediaId, season, episode }) {
        if (!mediaId) return;

        this.closeBackgroundWindows();

        const isTv = mediaType === 'tv';
        const s = season || 1;
        const e = episode || 1;

        const serverUrls = [
            { name: 'Vidnest', url: isTv ? `https://vidnest.fun/tv/${mediaId}/${s}/${e}?color=4ade80` : `https://vidnest.fun/movie/${mediaId}?color=4ade80` },
            { name: 'Videasy', url: isTv ? `https://player.videasy.to/tv/${mediaId}/${s}/${e}?color=4ade80` : `https://player.videasy.to/movie/${mediaId}?color=4ade80` },
            { name: 'VidKing', url: isTv ? `https://www.vidking.net/embed/tv/${mediaId}/${s}/${e}?color=4ade80` : `https://www.vidking.net/embed/movie/${mediaId}?color=4ade80` },
            { name: 'VidRock', url: isTv ? `https://vidrock.net/embed/tv/${mediaId}/${s}/${e}?color=4ade80` : `https://vidrock.net/embed/movie/${mediaId}?color=4ade80` },
            { name: '111Movies', url: isTv ? `https://111movies.com/tv/${mediaId}/${s}/${e}` : `https://111movies.com/movie/${mediaId}` },
        ];

        console.log(`[StreamSniffer] Pre-fetching streams in background for ${mediaType} #${mediaId}...`);

        serverUrls.forEach(server => {
            try {
                const win = new BrowserWindow({
                    width: 800,
                    height: 600,
                    show: false, // Completely invisible background window
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                        webSecurity: false
                    }
                });
                win.webContents.setAudioMuted(true); // Silence background audio

                this.backgroundWindows.push(win);

                win.loadURL(server.url).catch(() => {});

                // Auto-destroy after 12 seconds to save memory
                setTimeout(() => {
                    if (win && !win.isDestroyed()) {
                        win.destroy();
                    }
                }, 12000);
            } catch (err) {
                console.error(`[StreamSniffer] Failed background prefetch for ${server.name}:`, err.message);
            }
        });
    }

    setupSniffer() {
        if (this.isListening) return;

        const filter = {
            urls: [
                '*://*/*.m3u8*',
                '*://*/*.mp4*',
                '*://*/master.txt*',
                '*://*/playlist.txt*',
                '*://*/index.txt*'
            ]
        };

        session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
            callback({ cancel: false }); // Always allow request to continue

            const url = details.url;

            // Filter out ad segments, images, subtitles, fonts, key files, tiny chunks
            if (this.shouldIgnoreUrl(url)) return;

            // Identify player source from referrer / url
            const playerSource = this.identifyPlayerSource(details.referrer || details.url);

            // Process stream asynchronously
            this.processDetectedUrl(url, playerSource, details.referrer);
        });

        this.isListening = true;
        console.log('[StreamSniffer] Initialized m3u8/mp4 network sniffer');
    }

    shouldIgnoreUrl(url) {
        const lowerUrl = url.toLowerCase();

        // Ignore ts segment chunks (e.g. seg-1.ts, index_0_0.ts) unless it's a playlist
        if (lowerUrl.includes('.ts') && !lowerUrl.includes('.m3u8')) return true;

        // Ignore key files, subtitles, images, tracking/analytics
        if (lowerUrl.endsWith('.key') || lowerUrl.endsWith('.vtt') || lowerUrl.endsWith('.srt') ||
            lowerUrl.endsWith('.png') || lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.css') || lowerUrl.endsWith('.js')) {
            return true;
        }

        // Ignore doubleclick/ad hosts
        if (lowerUrl.includes('google') || lowerUrl.includes('analytics') || lowerUrl.includes('doubleclick') || lowerUrl.includes('yandex')) {
            return true;
        }

        return false;
    }

    identifyPlayerSource(referrerOrUrl) {
        if (!referrerOrUrl) return 'Web Player';
        const str = referrerOrUrl.toLowerCase();

        if (str.includes('vidnest')) return 'Vidnest Player';
        if (str.includes('videasy')) return 'Videasy Player';
        if (str.includes('vidking')) return 'VidKing Player';
        if (str.includes('vidrock')) return 'VidRook Player';
        if (str.includes('111movies')) return '111Movies Player';
        if (str.includes('vidlink.pro') || str.includes('vidlink')) return 'VidLink Player';
        if (str.includes('vidsrc')) return 'VidSrc Player';
        if (str.includes('autoembed')) return 'AutoEmbed Player';
        if (str.includes('smashystream')) return 'SmashyStream Player';

        try {
            const parsed = new URL(referrerOrUrl);
            const host = parsed.hostname.replace('www.', '');
            return host ? `${host.charAt(0).toUpperCase() + host.slice(1)} Player` : 'Web Stream Player';
        } catch (e) {
            return 'Web Stream Player';
        }
    }

    async processDetectedUrl(url, playerSource, referrer) {
        // Prevent duplicate processing
        if (this.capturedStreams.has(url)) return;

        console.log(`[StreamSniffer] Captured stream candidate: ${url.substring(0, 90)}... from ${playerSource}`);

        if (url.includes('.m3u8') || url.includes('master') || url.includes('playlist')) {
            await this.parseHlsManifest(url, playerSource, referrer);
        } else if (url.includes('.mp4')) {
            this.addStreamOption({
                id: Buffer.from(url).toString('base64').substring(0, 16),
                url: url,
                quality: '1080p HD',
                resolution: '1920x1080 (Estimated)',
                pixelSize: '1920 x 1080 px',
                playerSource: playerSource,
                type: 'mp4',
                detectedAt: Date.now()
            });
        }
    }

    async parseHlsManifest(masterUrl, playerSource, referrer) {
        try {
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            };
            if (referrer) headers['Referer'] = referrer;

            const res = await fetch(masterUrl, { headers, timeout: 5000 });
            const manifestText = await res.text();

            if (!manifestText.includes('#EXTM3U')) return;

            // Check if master playlist with resolution variants
            const streamInfRegex = /#EXT-X-STREAM-INF:.*?(?:RESOLUTION=(\d+x\d+))?.*?(?:BANDWIDTH=(\d+))?.*?\r?\n([^\r\n]+)/g;

            let match;
            let variantsFound = 0;

            while ((match = streamInfRegex.exec(manifestText)) !== null) {
                variantsFound++;
                const resolutionStr = match[1] || null; // e.g. "1920x1080"
                const bandwidth = match[2] ? parseInt(match[2]) : 0;
                let variantPath = match[3].trim();

                // Resolve relative stream path against master URL
                let variantUrl;
                try {
                    variantUrl = new URL(variantPath, masterUrl).href;
                } catch (e) {
                    variantUrl = variantPath;
                }

                // Determine quality label & pixel size
                const { quality, resolution, pixelSize } = this.formatResolution(resolutionStr, bandwidth);

                this.addStreamOption({
                    id: Buffer.from(variantUrl).toString('base64').substring(0, 16),
                    url: variantUrl,
                    masterUrl: masterUrl,
                    quality: quality,
                    resolution: resolution,
                    pixelSize: pixelSize,
                    bandwidth: bandwidth,
                    playerSource: playerSource,
                    type: 'hls',
                    detectedAt: Date.now()
                });
            }

            // If no variants in manifest (it's a media playlist directly), add as single option
            if (variantsFound === 0) {
                this.addStreamOption({
                    id: Buffer.from(masterUrl).toString('base64').substring(0, 16),
                    url: masterUrl,
                    masterUrl: masterUrl,
                    quality: 'HD Stream',
                    resolution: 'Auto Resolution',
                    pixelSize: 'Direct HLS Stream',
                    playerSource: playerSource,
                    type: 'hls',
                    detectedAt: Date.now()
                });
            }
        } catch (error) {
            console.error('[StreamSniffer] Error parsing HLS manifest:', error.message);
            // Fallback: add raw URL
            this.addStreamOption({
                id: Buffer.from(masterUrl).toString('base64').substring(0, 16),
                url: masterUrl,
                masterUrl: masterUrl,
                quality: 'HD Stream',
                resolution: 'Stream Link',
                pixelSize: 'HLS Stream',
                playerSource: playerSource,
                type: 'hls',
                detectedAt: Date.now()
            });
        }
    }

    formatResolution(resolutionStr, bandwidth) {
        if (resolutionStr) {
            const [width, height] = resolutionStr.split('x').map(n => parseInt(n));
            let quality = 'SD';
            if (height >= 2160 || width >= 3840) quality = '4K (2160p)';
            else if (height >= 1080 || width >= 1920) quality = '1080p FHD';
            else if (height >= 720 || width >= 1280) quality = '720p HD';
            else if (height >= 480) quality = '480p SD';
            else quality = `${height}p`;

            return {
                quality: quality,
                resolution: `${quality} [${resolutionStr}]`,
                pixelSize: `${width} x ${height} px`
            };
        }

        // Estimate from bandwidth if resolution string not present
        if (bandwidth > 5000000) return { quality: '1080p FHD', resolution: '1080p [1920x1080 est.]', pixelSize: '1920 x 1080 px' };
        if (bandwidth > 2500000) return { quality: '720p HD', resolution: '720p [1280x720 est.]', pixelSize: '1280 x 720 px' };
        if (bandwidth > 1000000) return { quality: '480p SD', resolution: '480p [854x480 est.]', pixelSize: '854 x 480 px' };

        return { quality: 'Auto HD', resolution: 'Auto Resolution', pixelSize: 'Dynamic Stream' };
    }

    addStreamOption(streamInfo) {
        this.capturedStreams.set(streamInfo.url, streamInfo);
        console.log(`[StreamSniffer] Stream added: ${streamInfo.playerSource} | ${streamInfo.pixelSize} | ${streamInfo.quality}`);
        this.notifyRenderer();
    }

    notifyRenderer() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            const streams = this.getCapturedStreams();
            this.mainWindow.webContents.send('stream:detected', streams);
        }
    }
}

module.exports = new StreamSniffer();

/**
 * Stream IPC Handlers
 * IPC registration for stream sniffer and direct stream downloader
 */

const { ipcMain } = require('electron');
const streamSniffer = require('../services/streamSniffer');
const streamDownloader = require('../services/streamDownloader');

function registerStreamHandlers() {
    // Get captured direct streams
    ipcMain.handle('stream:getCaptured', () => {
        return streamSniffer.getCapturedStreams();
    });

    // Clear captured streams
    ipcMain.handle('stream:clear', () => {
        streamSniffer.clearStreams();
        return { success: true };
    });

    // Prefetch background streams for all servers
    ipcMain.handle('stream:prefetch', (_, params) => {
        streamSniffer.prefetchBackgroundStreams(params);
        return { success: true };
    });

    // Start direct stream download
    ipcMain.handle('stream:startDownload', async (_, { streamInfo, mediaInfo }) => {
        try {
            return await streamDownloader.startDownload(streamInfo, mediaInfo);
        } catch (error) {
            console.error('[StreamIPC] Start download error:', error);
            return { success: false, error: error.message };
        }
    });

    // Cancel direct stream download
    ipcMain.handle('stream:cancelDownload', (_, downloadId) => {
        streamDownloader.cancelDownload(downloadId);
        return { success: true };
    });

    // Get all direct stream downloads
    ipcMain.handle('stream:getAllDownloads', () => {
        return streamDownloader.getAllDownloads();
    });

    console.log('[IPC] Stream sniffer, prefetcher, and downloader handlers registered');
}

module.exports = { registerStreamHandlers };

/**
 * Torrent IPC Handlers
 * Handles torrent search and version checking from the renderer process
 */

const { ipcMain } = require('electron');
const { searchTorrents } = require('../services/torrentSearch');
const { supabase } = require('../services/supabase');

function registerTorrentHandlers() {
    /**
     * Search for torrents by IMDB ID, title, or TMDB ID
     */
    ipcMain.handle('torrent:search', async (_, params) => {
        try {
            return await searchTorrents(params);
        } catch (error) {
            console.error('[Torrents] Search error:', error);
            return { success: false, error: 'Failed to search torrents', torrents: [] };
        }
    });

    /**
     * Check if a specific app version is blocked
     */
    ipcMain.handle('version:check', async (_, version) => {
        try {
            const { data: rule } = await supabase.from('version_rules')
                .select('*')
                .eq('version', version)
                .single();

            if (rule) {
                return {
                    blocked: true,
                    mode: rule.mode,
                    message: rule.message,
                    downloadUrl: rule.download_url
                };
            }

            return { blocked: false };
        } catch (error) {
            // If table doesn't exist or no match, version is fine
            return { blocked: false };
        }
    });

    console.log('[IPC] Torrent & Version handlers registered');
}

module.exports = { registerTorrentHandlers };

/**
 * Playlist IPC Handlers
 *
 * Supabase only — playlists belong to an account, so guests get a
 * "sign in" response rather than local storage. Row Level Security
 * enforces ownership; the explicit user_id filters are just to keep
 * the queries cheap.
 */

const { ipcMain } = require('electron');
const { supabase } = require('../services/supabase');
const { getCurrentUser } = require('../services/identity');
const { enrichItemsWithPosters, normalizePosterPath } = require('../services/posterEnrichment');

const AUTH_REQUIRED = { error: 'Sign in to use playlists', requiresAuth: true };

function mapItem(row) {
    return {
        id: row.id,
        mediaId: row.media_id,
        mediaType: row.media_type,
        title: row.title,
        posterPath: normalizePosterPath(row.poster_path),
        addedAt: row.added_at
    };
}

function registerPlaylistHandlers() {
    ipcMain.handle('playlist:create', async (_, { name, description, isPublic } = {}) => {
        try {
            if (!name || !name.trim()) return { error: 'Playlist name is required' };

            const user = await getCurrentUser();
            if (!user) return AUTH_REQUIRED;

            const { data, error } = await supabase
                .from('playlists')
                .insert({
                    user_id: user.id,
                    name: name.trim(),
                    description: description || '',
                    is_public: !!isPublic
                })
                .select()
                .single();

            if (error) return { error: error.message };
            return { success: true, playlist: { ...data, items: [], item_count: 0 } };
        } catch (error) {
            console.error('[Playlist] create failed:', error.message);
            return { error: 'Failed to create playlist' };
        }
    });

    ipcMain.handle('playlist:getAll', async () => {
        try {
            const user = await getCurrentUser();
            if (!user) return { success: true, playlists: [], requiresAuth: true };

            const { data, error } = await supabase
                .from('playlists')
                .select('*, playlist_items(count)')
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false });

            if (error) return { success: false, playlists: [] };

            const playlists = (data || []).map(p => ({
                ...p,
                item_count: p.playlist_items?.[0]?.count || 0
            }));
            return { success: true, playlists };
        } catch (error) {
            console.error('[Playlist] getAll failed:', error.message);
            return { success: false, playlists: [] };
        }
    });

    ipcMain.handle('playlist:getDetails', async (_, playlistId) => {
        try {
            const user = await getCurrentUser();
            if (!user) return { playlist: null, requiresAuth: true };

            const { data: playlist, error } = await supabase
                .from('playlists')
                .select('*')
                .eq('id', playlistId)
                .eq('user_id', user.id)
                .maybeSingle();

            if (error || !playlist) return { playlist: null };

            const { data: items } = await supabase
                .from('playlist_items')
                .select('*')
                .eq('playlist_id', playlistId)
                .order('added_at', { ascending: false });

            playlist.items = await enrichItemsWithPosters(
                (items || []).map(mapItem),
                async (item, posterPath) => {
                    if (!item.id) return;
                    await supabase
                        .from('playlist_items')
                        .update({ poster_path: posterPath })
                        .eq('id', item.id);
                }
            );
            playlist.item_count = playlist.items.length;
            return { success: true, playlist };
        } catch (error) {
            console.error('[Playlist] getDetails failed:', error.message);
            return { playlist: null };
        }
    });

    ipcMain.handle('playlist:addItem', async (_, { playlistId, mediaId, mediaType, title, posterPath } = {}) => {
        try {
            if (!playlistId || !mediaId) return { error: 'Playlist ID and media ID are required' };

            const user = await getCurrentUser();
            if (!user) return AUTH_REQUIRED;

            const { data, error } = await supabase
                .from('playlist_items')
                .upsert({
                    playlist_id: playlistId,
                    media_id: String(mediaId),
                    media_type: mediaType === 'tv' ? 'tv' : 'movie',
                    title: title || 'Unknown Title',
                    poster_path: normalizePosterPath(posterPath)
                }, { onConflict: 'playlist_id,media_id,media_type' })
                .select()
                .single();

            if (error) return { error: error.message };

            // bump the parent so "recently updated" ordering stays truthful
            await supabase
                .from('playlists')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', playlistId);

            return { success: true, item: mapItem(data) };
        } catch (error) {
            console.error('[Playlist] addItem failed:', error.message);
            return { error: 'Failed to add item to playlist' };
        }
    });

    ipcMain.handle('playlist:removeItem', async (_, { playlistId, mediaId } = {}) => {
        try {
            if (!playlistId || !mediaId) return { error: 'Playlist ID and media ID are required' };

            const user = await getCurrentUser();
            if (!user) return AUTH_REQUIRED;

            const { error } = await supabase
                .from('playlist_items')
                .delete()
                .eq('playlist_id', playlistId)
                .eq('media_id', String(mediaId));

            if (error) return { error: error.message };
            return { success: true };
        } catch (error) {
            console.error('[Playlist] removeItem failed:', error.message);
            return { error: 'Failed to remove item' };
        }
    });

    ipcMain.handle('playlist:delete', async (_, playlistId) => {
        try {
            const user = await getCurrentUser();
            if (!user) return AUTH_REQUIRED;

            const { error } = await supabase
                .from('playlists')
                .delete()
                .eq('id', playlistId)
                .eq('user_id', user.id);

            if (error) return { error: error.message };
            return { success: true };
        } catch (error) {
            console.error('[Playlist] delete failed:', error.message);
            return { error: 'Failed to delete playlist' };
        }
    });

    console.log('[IPC] Playlist handlers registered');
}

module.exports = { registerPlaylistHandlers };

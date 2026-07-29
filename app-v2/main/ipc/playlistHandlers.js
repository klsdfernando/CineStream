/**
 * Playlist IPC Handlers
 * Handles user playlists/watchlists via Supabase
 */

const { ipcMain } = require('electron');
const { supabase } = require('../services/supabase');

function registerPlaylistHandlers() {
    /**
     * Create a new playlist
     */
    ipcMain.handle('playlist:create', async (_, { name, description, isPublic }) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { error: 'Not authenticated' };
            if (!name) return { error: 'Playlist name is required' };

            const { data, error } = await supabase.from('playlists').insert({
                user_id: user.id, name, description: description || '', is_public: isPublic || false,
            }).select().single();

            if (error) throw error;
            return { success: true, playlist: data };
        } catch (error) {
            console.error('[Playlist] Error creating:', error);
            return { error: 'Failed to create playlist' };
        }
    });

    /**
     * Get all playlists for logged in user
     */
    ipcMain.handle('playlist:getAll', async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { playlists: [] };

            const { data, error } = await supabase.from('playlists')
                .select('*, playlist_items(count)')
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false });

            if (error) throw error;

            const playlists = (data || []).map(p => ({
                ...p,
                item_count: p.playlist_items?.[0]?.count || 0,
            }));

            return { success: true, playlists };
        } catch (error) {
            console.error('[Playlist] Error fetching:', error);
            return { playlists: [] };
        }
    });

    /**
     * Get a specific playlist with its items
     */
    ipcMain.handle('playlist:getDetails', async (_, playlistId) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { playlist: null };

            const { data: playlist, error } = await supabase.from('playlists')
                .select('*')
                .eq('id', playlistId)
                .eq('user_id', user.id)
                .single();

            if (error || !playlist) return { playlist: null };

            const { data: items } = await supabase.from('playlist_items')
                .select('*')
                .eq('playlist_id', playlistId)
                .order('added_at', { ascending: false });

            playlist.items = items || [];
            return { success: true, playlist };
        } catch (error) {
            console.error('[Playlist] Error fetching details:', error);
            return { playlist: null };
        }
    });

    /**
     * Add item to playlist
     */
    ipcMain.handle('playlist:addItem', async (_, { playlistId, mediaId, mediaType, title, posterPath }) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { error: 'Not authenticated' };
            if (!mediaId || !mediaType || !title) return { error: 'Missing required media details' };

            // Verify ownership
            const { data: playlist } = await supabase.from('playlists')
                .select('id').eq('id', playlistId).eq('user_id', user.id).single();
            if (!playlist) return { error: 'Playlist not found or unauthorized' };

            const { error } = await supabase.from('playlist_items').insert({
                playlist_id: playlistId, media_id: String(mediaId), media_type: mediaType,
                title, poster_path: posterPath || null,
            });

            if (error) {
                if (error.code === '23505') return { success: false, message: 'Item already in playlist' };
                throw error;
            }

            // Update playlist timestamp
            await supabase.from('playlists').update({ updated_at: new Date().toISOString() }).eq('id', playlistId);

            return { success: true };
        } catch (error) {
            console.error('[Playlist] Error adding item:', error);
            return { error: 'Failed to add item to playlist' };
        }
    });

    /**
     * Remove item from playlist
     */
    ipcMain.handle('playlist:removeItem', async (_, { playlistId, mediaId }) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { error: 'Not authenticated' };

            // Verify ownership
            const { data: playlist } = await supabase.from('playlists')
                .select('id').eq('id', playlistId).eq('user_id', user.id).single();
            if (!playlist) return { error: 'Playlist not found or unauthorized' };

            await supabase.from('playlist_items')
                .delete()
                .eq('playlist_id', playlistId)
                .eq('media_id', String(mediaId));

            await supabase.from('playlists').update({ updated_at: new Date().toISOString() }).eq('id', playlistId);

            return { success: true };
        } catch (error) {
            console.error('[Playlist] Error removing item:', error);
            return { error: 'Failed to remove item' };
        }
    });

    /**
     * Delete a playlist
     */
    ipcMain.handle('playlist:delete', async (_, playlistId) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { error: 'Not authenticated' };

            const { error } = await supabase.from('playlists')
                .delete()
                .eq('id', playlistId)
                .eq('user_id', user.id);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('[Playlist] Error deleting:', error);
            return { error: 'Failed to delete playlist' };
        }
    });

    console.log('[IPC] Playlist handlers registered');
}

module.exports = { registerPlaylistHandlers };

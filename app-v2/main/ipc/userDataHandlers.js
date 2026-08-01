/**
 * User Data IPC Handlers
 *
 * Favorites, player preferences and search history — all account-scoped.
 * Guests get an explicit "sign in required" response instead of silently
 * writing somewhere they can never read back.
 */

const { ipcMain } = require('electron');
const { supabase } = require('../services/supabase');
const { getCurrentUser } = require('../services/identity');

const AUTH_REQUIRED = { error: 'Sign in to use this', requiresAuth: true };
const DEFAULT_PREFS = { preferredServer: 'vidnest' };

function mapFavorite(row) {
    return {
        id: row.id,
        mediaId: row.media_id,
        mediaType: row.media_type,
        title: row.title,
        posterPath: row.poster_path,
        addedAt: row.added_at
    };
}

function registerUserDataHandlers() {
    // ─── Favorites ───────────────────────────────────────────────

    ipcMain.handle('favorites:list', async () => {
        try {
            const user = await getCurrentUser();
            if (!user) return { success: true, favorites: [], requiresAuth: true };

            const { data, error } = await supabase
                .from('favorites')
                .select('*')
                .eq('user_id', user.id)
                .order('added_at', { ascending: false });

            if (error) return { success: false, favorites: [] };
            return { success: true, favorites: (data || []).map(mapFavorite) };
        } catch (error) {
            console.error('[UserData] favorites:list failed:', error.message);
            return { success: false, favorites: [] };
        }
    });

    ipcMain.handle('favorites:toggle', async (_, { mediaId, mediaType, title, posterPath } = {}) => {
        try {
            if (!mediaId) return { error: 'Media ID is required' };

            const user = await getCurrentUser();
            if (!user) return AUTH_REQUIRED;

            const type = mediaType === 'tv' ? 'tv' : 'movie';
            const cleanId = String(mediaId);

            const { data: existing } = await supabase
                .from('favorites')
                .select('id')
                .eq('user_id', user.id)
                .eq('media_id', cleanId)
                .eq('media_type', type)
                .maybeSingle();

            if (existing) {
                await supabase.from('favorites').delete().eq('id', existing.id);
                return { success: true, favorited: false };
            }

            const { error } = await supabase.from('favorites').insert({
                user_id: user.id,
                media_id: cleanId,
                media_type: type,
                title: title || 'Unknown Title',
                poster_path: posterPath || null
            });

            if (error) return { error: error.message };
            return { success: true, favorited: true };
        } catch (error) {
            console.error('[UserData] favorites:toggle failed:', error.message);
            return { error: 'Failed to update favorites' };
        }
    });

    ipcMain.handle('favorites:check', async (_, mediaId, mediaType) => {
        try {
            const user = await getCurrentUser();
            if (!user) return { favorited: false, requiresAuth: true };

            let query = supabase
                .from('favorites')
                .select('id')
                .eq('user_id', user.id)
                .eq('media_id', String(mediaId));

            if (mediaType === 'movie' || mediaType === 'tv') {
                query = query.eq('media_type', mediaType);
            }

            const { data } = await query;
            return { favorited: (data || []).length > 0 };
        } catch (error) {
            return { favorited: false };
        }
    });

    // ─── Preferences ─────────────────────────────────────────────

    ipcMain.handle('prefs:get', async () => {
        try {
            const user = await getCurrentUser();
            if (!user) return { success: true, ...DEFAULT_PREFS, requiresAuth: true };

            const { data } = await supabase
                .from('user_preferences')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            return {
                success: true,
                preferredServer: data?.preferred_server || DEFAULT_PREFS.preferredServer
            };
        } catch (error) {
            return { success: false, ...DEFAULT_PREFS };
        }
    });

    ipcMain.handle('prefs:setServer', async (_, serverId) => {
        try {
            if (!serverId) return { error: 'Server id is required' };

            const user = await getCurrentUser();
            if (!user) return AUTH_REQUIRED;

            const { error } = await supabase
                .from('user_preferences')
                .upsert(
                    { user_id: user.id, preferred_server: serverId, updated_at: new Date().toISOString() },
                    { onConflict: 'user_id' }
                );

            if (error) return { error: error.message };
            return { success: true, preferredServer: serverId };
        } catch (error) {
            console.error('[UserData] prefs:setServer failed:', error.message);
            return { error: 'Failed to save preference' };
        }
    });

    // ─── Search history ──────────────────────────────────────────

    ipcMain.handle('search:record', async (_, query) => {
        try {
            const term = (query || '').trim();
            if (!term) return { success: false };

            const user = await getCurrentUser();
            if (!user) return { success: false, requiresAuth: true };

            // drop any earlier copy so the term resurfaces at the top
            await supabase
                .from('search_history')
                .delete()
                .eq('user_id', user.id)
                .eq('query', term);

            const { error } = await supabase
                .from('search_history')
                .insert({ user_id: user.id, query: term });

            if (error) return { success: false };
            return { success: true };
        } catch (error) {
            return { success: false };
        }
    });

    ipcMain.handle('search:getRecent', async (_, limit) => {
        try {
            const user = await getCurrentUser();
            if (!user) return { success: true, searches: [] };

            const { data } = await supabase
                .from('search_history')
                .select('id, query, searched_at')
                .eq('user_id', user.id)
                .order('searched_at', { ascending: false })
                .limit(Math.min(parseInt(limit, 10) || 10, 50));

            return {
                success: true,
                searches: (data || []).map(r => ({
                    id: r.id,
                    query: r.query,
                    searchedAt: r.searched_at
                }))
            };
        } catch (error) {
            return { success: false, searches: [] };
        }
    });

    ipcMain.handle('search:clear', async () => {
        try {
            const user = await getCurrentUser();
            if (!user) return AUTH_REQUIRED;

            await supabase.from('search_history').delete().eq('user_id', user.id);
            return { success: true };
        } catch (error) {
            return { error: 'Failed to clear search history' };
        }
    });

    console.log('[IPC] User data handlers registered');
}

module.exports = { registerUserDataHandlers };

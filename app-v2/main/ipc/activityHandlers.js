/**
 * Activity IPC Handlers
 * Handles user activity tracking (likes, dislikes, watch history) via Supabase
 */

const { ipcMain } = require('electron');
const { supabase } = require('../services/supabase');

function registerActivityHandlers() {
    /**
     * Record User Activity (Like, Dislike, Watched)
     */
    ipcMain.handle('activity:record', async (_, { mediaId, mediaType, title, posterPath, actionType }) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { error: 'Not authenticated' };

            if (!mediaId || !mediaType || !title || !actionType) {
                return { error: 'Missing required fields' };
            }
            if (!['like', 'dislike', 'watched'].includes(actionType)) {
                return { error: 'Invalid action type' };
            }

            const userId = user.id;

            if (actionType === 'like' || actionType === 'dislike') {
                const oppositeAction = actionType === 'like' ? 'dislike' : 'like';

                // Remove opposite action if exists
                await supabase.from('user_activity')
                    .delete()
                    .eq('user_id', userId)
                    .eq('media_id', String(mediaId))
                    .eq('action_type', oppositeAction);

                // Check if same action already exists (toggle off)
                const { data: existing } = await supabase.from('user_activity')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('media_id', String(mediaId))
                    .eq('action_type', actionType)
                    .single();

                if (existing) {
                    await supabase.from('user_activity').delete().eq('id', existing.id);
                    return { success: true, result: { action: 'removed', type: actionType } };
                }
            } else if (actionType === 'watched') {
                // Update timestamp if already exists
                const { data: existing } = await supabase.from('user_activity')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('media_id', String(mediaId))
                    .eq('action_type', 'watched')
                    .single();

                if (existing) {
                    await supabase.from('user_activity')
                        .update({ created_at: new Date().toISOString() })
                        .eq('id', existing.id);
                    return { success: true, result: { action: 'updated', type: 'watched' } };
                }
            }

            // Insert new action
            const { error } = await supabase.from('user_activity').insert({
                user_id: userId,
                media_id: String(mediaId),
                media_type: mediaType,
                title,
                poster_path: posterPath || null,
                action_type: actionType,
            });

            if (error) throw error;
            return { success: true, result: { action: 'added', type: actionType } };
        } catch (error) {
            console.error('[Activity] Error recording action:', error);
            return { error: 'Failed to record activity' };
        }
    });

    /**
     * Get User Activity History
     */
    ipcMain.handle('activity:getHistory', async (_, type) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { history: [] };

            if (!type || !['like', 'dislike', 'watched'].includes(type)) {
                return { error: 'Valid type is required' };
            }

            const { data, error } = await supabase.from('user_activity')
                .select('*')
                .eq('user_id', user.id)
                .eq('action_type', type)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            return { success: true, history: data || [] };
        } catch (error) {
            console.error('[Activity] Error fetching history:', error);
            return { history: [] };
        }
    });

    /**
     * Get specific media interaction status
     */
    ipcMain.handle('activity:getStatus', async (_, mediaId) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { status: 'none' };

            const { data } = await supabase.from('user_activity')
                .select('action_type')
                .eq('user_id', user.id)
                .eq('media_id', String(mediaId))
                .in('action_type', ['like', 'dislike'])
                .single();

            return { success: true, status: data?.action_type || 'none' };
        } catch (error) {
            return { status: 'none' };
        }
    });

    console.log('[IPC] Activity handlers registered');
}

module.exports = { registerActivityHandlers };

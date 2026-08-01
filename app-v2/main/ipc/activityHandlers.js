/**
 * Activity IPC Handlers
 *
 * Backed entirely by Supabase — the app requires a connection.
 *   watch_history / guest_watch_history : what was watched + resume position
 *   reactions                           : like & dislike (account only)
 *   favorites                           : favorites list (account only)
 *
 * Guests are identified by a device id and only get watch history.
 */

const { ipcMain } = require('electron');
const { supabase } = require('../services/supabase');
const { getActor } = require('../services/identity');

const AUTH_REQUIRED = { error: 'Sign in to use this', requiresAuth: true };

/** Movies always store season/episode as 0 so the UNIQUE key behaves. */
function normalizeEpisode(mediaType, season, episode) {
    if (mediaType !== 'tv') return { season: 0, episode: 0 };
    return {
        season: Number.isFinite(Number(season)) ? parseInt(season, 10) : 0,
        episode: Number.isFinite(Number(episode)) ? parseInt(episode, 10) : 0
    };
}

function toInt(value) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function mapHistoryRow(row, actionType = 'watched') {
    // The guest table has no generated progress/completed columns,
    // so derive them here to keep both shapes identical for the UI.
    const duration = row.duration_seconds || 0;
    const position = row.position_seconds || 0;
    const progress = row.progress_percent != null
        ? Number(row.progress_percent)
        : (duration > 0 ? Math.min(100, Math.round((position / duration) * 100)) : 0);
    const completed = row.completed != null
        ? !!row.completed
        : (duration > 0 && position >= duration * 0.9);

    return {
        id: row.id,
        mediaId: row.media_id,
        mediaType: row.media_type,
        title: row.title,
        posterPath: row.poster_path,
        actionType,
        season: row.season,
        episode: row.episode,
        lastPosition: row.position_seconds,
        duration: row.duration_seconds,
        watchSeconds: row.watch_seconds,
        progressPercent: progress,
        completed,
        playerUsed: row.player_used,
        createdAt: row.first_watched_at,
        updatedAt: row.last_watched_at
    };
}

function mapSimpleRow(row, actionType) {
    return {
        id: row.id,
        mediaId: row.media_id,
        mediaType: row.media_type,
        title: row.title,
        posterPath: row.poster_path,
        actionType,
        createdAt: row.created_at || row.added_at
    };
}

/**
 * Insert or advance a watch-history row.
 * Reads first because watch_seconds accumulates and the position should
 * never jump backwards just because a player reported a stale value.
 */
async function saveWatchProgress(actor, payload, addWatchSeconds = 0) {
    const mediaType = payload.mediaType === 'tv' ? 'tv' : 'movie';
    const { season, episode } = normalizeEpisode(mediaType, payload.season, payload.episode);
    const mediaId = String(payload.mediaId);
    const position = toInt(payload.lastPosition);
    const duration = toInt(payload.duration);
    const extraSeconds = toInt(addWatchSeconds);

    if (actor.isGuest) {
        const { error } = await supabase.rpc('guest_record_watch', {
            p_device_id: actor.deviceId,
            p_media_id: mediaId,
            p_media_type: mediaType,
            p_title: payload.title || 'Unknown Title',
            p_poster_path: payload.posterPath || null,
            p_season: season,
            p_episode: episode,
            p_position: position,
            p_duration: duration,
            p_watch_secs: extraSeconds,
            p_player: payload.playerUsed || 'Vidnest'
        });
        if (error) throw new Error(error.message);
        return;
    }

    const { data: existing } = await supabase
        .from('watch_history')
        .select('id, watch_seconds, position_seconds, duration_seconds, poster_path')
        .eq('user_id', actor.userId)
        .eq('media_id', mediaId)
        .eq('media_type', mediaType)
        .eq('season', season)
        .eq('episode', episode)
        .maybeSingle();

    if (existing) {
        const { error } = await supabase
            .from('watch_history')
            .update({
                title: payload.title || 'Unknown Title',
                poster_path: payload.posterPath || existing.poster_path || null,
                position_seconds: position || existing.position_seconds || 0,
                duration_seconds: Math.max(duration, existing.duration_seconds || 0),
                watch_seconds: (existing.watch_seconds || 0) + extraSeconds,
                player_used: payload.playerUsed || 'Vidnest',
                last_watched_at: new Date().toISOString()
            })
            .eq('id', existing.id);
        if (error) throw new Error(error.message);
        return;
    }

    const { error } = await supabase.from('watch_history').insert({
        user_id: actor.userId,
        media_id: mediaId,
        media_type: mediaType,
        title: payload.title || 'Unknown Title',
        poster_path: payload.posterPath || null,
        season,
        episode,
        position_seconds: position,
        duration_seconds: duration,
        watch_seconds: extraSeconds,
        player_used: payload.playerUsed || 'Vidnest'
    });
    if (error) throw new Error(error.message);
}

/** Toggle a like/dislike. Flipping like -> dislike updates the same row. */
async function toggleReaction(userId, payload, reaction) {
    const mediaType = payload.mediaType === 'tv' ? 'tv' : 'movie';
    const mediaId = String(payload.mediaId);

    const { data: existing } = await supabase
        .from('reactions')
        .select('id, reaction')
        .eq('user_id', userId)
        .eq('media_id', mediaId)
        .eq('media_type', mediaType)
        .maybeSingle();

    if (existing && existing.reaction === reaction) {
        await supabase.from('reactions').delete().eq('id', existing.id);
        return 'removed';
    }

    if (existing) {
        await supabase.from('reactions').update({ reaction }).eq('id', existing.id);
        return 'switched';
    }

    const { error } = await supabase.from('reactions').insert({
        user_id: userId,
        media_id: mediaId,
        media_type: mediaType,
        title: payload.title || 'Unknown Title',
        poster_path: payload.posterPath || null,
        reaction
    });
    if (error) throw new Error(error.message);
    return 'added';
}

async function toggleFavorite(userId, payload) {
    const mediaType = payload.mediaType === 'tv' ? 'tv' : 'movie';
    const mediaId = String(payload.mediaId);

    const { data: existing } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('media_id', mediaId)
        .eq('media_type', mediaType)
        .maybeSingle();

    if (existing) {
        await supabase.from('favorites').delete().eq('id', existing.id);
        return 'removed';
    }

    const { error } = await supabase.from('favorites').insert({
        user_id: userId,
        media_id: mediaId,
        media_type: mediaType,
        title: payload.title || 'Unknown Title',
        poster_path: payload.posterPath || null
    });
    if (error) throw new Error(error.message);
    return 'added';
}

function registerActivityHandlers() {
    /**
     * Toggle a like / dislike / favorite, or record a play.
     * Kept as one channel because the renderer already calls it that way.
     */
    ipcMain.handle('activity:record', async (_, payload = {}) => {
        try {
            const { mediaId, actionType } = payload;
            if (!mediaId || !actionType) {
                return { error: 'Media ID and action type are required' };
            }

            const actor = await getActor();

            if (actionType === 'watched') {
                await saveWatchProgress(actor, payload, 0);
                return { success: true, action: 'added', type: 'watched' };
            }

            if (actor.isGuest) return AUTH_REQUIRED;

            if (actionType === 'like' || actionType === 'dislike') {
                const action = await toggleReaction(actor.userId, payload, actionType);
                return { success: true, action, type: actionType };
            }

            if (actionType === 'favorite') {
                const action = await toggleFavorite(actor.userId, payload);
                return { success: true, action, type: 'favorite' };
            }

            return { error: `Unknown action type: ${actionType}` };
        } catch (error) {
            console.error('[Activity] record failed:', error.message);
            return { error: 'Failed to record activity' };
        }
    });

    /**
     * Periodic telemetry from the player: advances position and adds watch time.
     */
    ipcMain.handle('activity:recordWatchTime', async (_, payload = {}) => {
        try {
            if (!payload.mediaId) return { error: 'Media ID is required' };
            const actor = await getActor();
            await saveWatchProgress(actor, payload, payload.watchSeconds);
            return { success: true };
        } catch (error) {
            console.error('[Activity] recordWatchTime failed:', error.message);
            return { error: 'Failed to record watch time' };
        }
    });

    /**
     * Like / dislike / favorite state for the watch page buttons.
     */
    ipcMain.handle('activity:getStatus', async (_, mediaId, mediaType) => {
        const blank = { liked: false, disliked: false, favorited: false, requiresAuth: false };
        try {
            const actor = await getActor();
            if (actor.isGuest) return { ...blank, requiresAuth: true };

            const cleanId = String(mediaId);
            let reactionQuery = supabase
                .from('reactions')
                .select('reaction')
                .eq('user_id', actor.userId)
                .eq('media_id', cleanId);
            let favoriteQuery = supabase
                .from('favorites')
                .select('id')
                .eq('user_id', actor.userId)
                .eq('media_id', cleanId);

            if (mediaType === 'movie' || mediaType === 'tv') {
                reactionQuery = reactionQuery.eq('media_type', mediaType);
                favoriteQuery = favoriteQuery.eq('media_type', mediaType);
            }

            const [{ data: reactions }, { data: favorites }] = await Promise.all([
                reactionQuery,
                favoriteQuery
            ]);

            return {
                liked: (reactions || []).some(r => r.reaction === 'like'),
                disliked: (reactions || []).some(r => r.reaction === 'dislike'),
                favorited: (favorites || []).length > 0,
                requiresAuth: false
            };
        } catch (error) {
            return blank;
        }
    });

    /**
     * Started but not finished, newest first.
     */
    ipcMain.handle('activity:getContinueWatching', async () => {
        try {
            const actor = await getActor();

            if (actor.isGuest) {
                const { data, error } = await supabase.rpc('guest_continue_watching', {
                    p_device_id: actor.deviceId,
                    p_limit: 20
                });
                if (error) throw new Error(error.message);
                return {
                    success: true,
                    continueWatching: (data || []).map(r => mapHistoryRow(r))
                };
            }

            const { data, error } = await supabase
                .from('watch_history')
                .select('*')
                .eq('user_id', actor.userId)
                .eq('completed', false)
                .gt('position_seconds', 30)
                .order('last_watched_at', { ascending: false })
                .limit(20);
            if (error) throw new Error(error.message);

            return { success: true, continueWatching: (data || []).map(r => mapHistoryRow(r)) };
        } catch (error) {
            console.error('[Activity] getContinueWatching failed:', error.message);
            return { success: false, continueWatching: [] };
        }
    });

    /**
     * History by type: 'watched' | 'like' | 'dislike' | 'favorite'.
     * Omitting the type returns everything, newest first.
     */
    ipcMain.handle('activity:getHistory', async (_, actionType) => {
        try {
            const actor = await getActor();

            const fetchWatched = async () => {
                if (actor.isGuest) {
                    const { data } = await supabase.rpc('guest_watch_history_list', {
                        p_device_id: actor.deviceId,
                        p_limit: 200
                    });
                    return (data || []).map(r => mapHistoryRow(r));
                }
                const { data } = await supabase
                    .from('watch_history')
                    .select('*')
                    .eq('user_id', actor.userId)
                    .order('last_watched_at', { ascending: false })
                    .limit(200);
                return (data || []).map(r => mapHistoryRow(r));
            };

            const fetchReactions = async (reaction) => {
                if (actor.isGuest) return [];
                const { data } = await supabase
                    .from('reactions')
                    .select('*')
                    .eq('user_id', actor.userId)
                    .eq('reaction', reaction)
                    .order('created_at', { ascending: false });
                return (data || []).map(r => mapSimpleRow(r, reaction));
            };

            const fetchFavorites = async () => {
                if (actor.isGuest) return [];
                const { data } = await supabase
                    .from('favorites')
                    .select('*')
                    .eq('user_id', actor.userId)
                    .order('added_at', { ascending: false });
                return (data || []).map(r => mapSimpleRow(r, 'favorite'));
            };

            if (actionType === 'watched') return { success: true, history: await fetchWatched() };
            if (actionType === 'like') return { success: true, history: await fetchReactions('like') };
            if (actionType === 'dislike') return { success: true, history: await fetchReactions('dislike') };
            if (actionType === 'favorite') return { success: true, history: await fetchFavorites() };

            const [watched, likes, dislikes, favorites] = await Promise.all([
                fetchWatched(), fetchReactions('like'), fetchReactions('dislike'), fetchFavorites()
            ]);
            const history = [...watched, ...likes, ...dislikes, ...favorites]
                .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

            return { success: true, history };
        } catch (error) {
            console.error('[Activity] getHistory failed:', error.message);
            return { success: false, history: [] };
        }
    });

    /**
     * Remove a single history entry.
     */
    ipcMain.handle('activity:removeHistory', async (_, { id } = {}) => {
        try {
            if (!id) return { error: 'Entry id is required' };
            const actor = await getActor();
            if (actor.isGuest) return AUTH_REQUIRED;

            await supabase.from('watch_history').delete().eq('id', id).eq('user_id', actor.userId);
            return { success: true };
        } catch (error) {
            return { error: 'Failed to remove history entry' };
        }
    });

    /**
     * Wipe the whole watch history for the current account or device.
     */
    ipcMain.handle('activity:clearHistory', async () => {
        try {
            const actor = await getActor();

            if (actor.isGuest) {
                const { error } = await supabase.rpc('guest_clear_watch_history', {
                    p_device_id: actor.deviceId
                });
                if (error) throw new Error(error.message);
                return { success: true };
            }

            const { error } = await supabase
                .from('watch_history')
                .delete()
                .eq('user_id', actor.userId);
            if (error) throw new Error(error.message);
            return { success: true };
        } catch (error) {
            return { error: 'Failed to clear history' };
        }
    });

    /**
     * Totals for the profile page.
     */
    ipcMain.handle('activity:getAnalytics', async () => {
        const empty = {
            totalWatchTimeFormatted: '0 Mins',
            totalWatchSeconds: 0,
            favoritePlayerFormatted: 'Vidnest',
            watchedCount: 0,
            favoritesCount: 0,
            likesCount: 0
        };

        try {
            const actor = await getActor();

            let rows = [];
            let favoritesCount = 0;
            let likesCount = 0;

            if (actor.isGuest) {
                const { data } = await supabase.rpc('guest_watch_history_list', {
                    p_device_id: actor.deviceId,
                    p_limit: 500
                });
                rows = data || [];
            } else {
                const [history, favorites, likes] = await Promise.all([
                    supabase
                        .from('watch_history')
                        .select('watch_seconds, player_used')
                        .eq('user_id', actor.userId),
                    supabase
                        .from('favorites')
                        .select('id', { count: 'exact', head: true })
                        .eq('user_id', actor.userId),
                    supabase
                        .from('reactions')
                        .select('id', { count: 'exact', head: true })
                        .eq('user_id', actor.userId)
                        .eq('reaction', 'like')
                ]);
                rows = history.data || [];
                favoritesCount = favorites.count || 0;
                likesCount = likes.count || 0;
            }

            let totalSecs = 0;
            const playerCounts = {};
            rows.forEach(r => {
                totalSecs += r.watch_seconds || 0;
                const p = r.player_used || 'Vidnest';
                playerCounts[p] = (playerCounts[p] || 0) + 1;
            });

            let favoritePlayer = 'Vidnest';
            let maxCount = 0;
            Object.entries(playerCounts).forEach(([player, count]) => {
                if (count > maxCount) {
                    maxCount = count;
                    favoritePlayer = player;
                }
            });

            const totalStreams = Object.values(playerCounts).reduce((a, b) => a + b, 0);
            const playerPct = totalStreams > 0 ? Math.round((maxCount / totalStreams) * 100) : 100;
            const hrs = Math.floor(totalSecs / 3600);
            const mins = Math.floor((totalSecs % 3600) / 60);

            return {
                totalWatchTimeFormatted: hrs > 0 ? `${hrs} Hours ${mins} Mins` : `${mins} Mins`,
                totalWatchSeconds: totalSecs,
                favoritePlayerFormatted: totalStreams > 0
                    ? `${favoritePlayer} (${playerPct}% of streams)`
                    : 'Vidnest',
                watchedCount: rows.length,
                favoritesCount,
                likesCount
            };
        } catch (error) {
            console.error('[Activity] getAnalytics failed:', error.message);
            return empty;
        }
    });

    console.log('[IPC] Activity handlers registered');
}

module.exports = { registerActivityHandlers };

/**
 * Resolve missing poster paths from TMDB using the stored media id.
 *
 * Rows saved before posterPath was kept on media objects have null
 * poster_path. This fills them in on read and optionally writes the
 * value back so the next load is free.
 */

const tmdb = require('./tmdb');
const { getCachedOrFetch, CACHE_TTL } = require('./cache');

/** Keep only the TMDB-relative path ("/abc.jpg"), even if a full URL sneaks in. */
function normalizePosterPath(value) {
    if (!value || typeof value !== 'string') return null;

    const trimmed = value.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('/')) return trimmed;

    const tmdbMatch = trimmed.match(/\/t\/p\/[^/]+(\/[^?\s]+)/);
    if (tmdbMatch) return tmdbMatch[1];

    // already a non-TMDB absolute URL — leave it for the UI to use as-is
    if (/^https?:\/\//i.test(trimmed)) return trimmed;

    return `/${trimmed.replace(/^\/+/, '')}`;
}

async function fetchPosterPath(mediaId, mediaType) {
    if (!mediaId) return null;

    const id = String(mediaId);
    const type = mediaType === 'tv' ? 'tv' : 'movie';

    try {
        const details = type === 'tv'
            ? await getCachedOrFetch(`tv_${id}`, () => tmdb.getTVDetails(id), CACHE_TTL.movieDetails)
            : await getCachedOrFetch(`movie_${id}`, () => tmdb.getMovieDetails(id), CACHE_TTL.movieDetails);

        // posterPath is the relative TMDB path; fall back to extracting it
        // from the full poster URL for older cached transforms.
        return normalizePosterPath(details?.posterPath || details?.poster || null);
    } catch (e) {
        console.warn(`[Poster] TMDB lookup failed for ${type}/${id}:`, e.message);
        return null;
    }
}

/**
 * Enrich a list of { mediaId, mediaType, posterPath } items.
 * Returns a new array; does not mutate the input.
 *
 * @param {Array} items
 * @param {(item, posterPath) => Promise<void>|void} [onResolved]
 *   Called when a missing poster is fetched — use this to backfill Supabase.
 */
async function enrichItemsWithPosters(items, onResolved) {
    if (!Array.isArray(items) || items.length === 0) return items || [];

    const pending = new Map(); // "movie:123" -> Promise<path|null>

    const resolveKey = (mediaId, mediaType) => {
        const key = `${mediaType === 'tv' ? 'tv' : 'movie'}:${mediaId}`;
        if (!pending.has(key)) {
            pending.set(key, fetchPosterPath(mediaId, mediaType));
        }
        return pending.get(key);
    };

    const enriched = await Promise.all(items.map(async (item) => {
        const existing = normalizePosterPath(item.posterPath || item.poster_path);
        if (existing) {
            return { ...item, posterPath: existing };
        }

        const mediaId = item.mediaId || item.media_id;
        const mediaType = item.mediaType || item.media_type || 'movie';
        if (!mediaId) return { ...item, posterPath: null };

        const posterPath = await resolveKey(mediaId, mediaType);
        if (posterPath && typeof onResolved === 'function') {
            try {
                await onResolved({ ...item, mediaId, mediaType }, posterPath);
            } catch (e) {
                // backfill failures must not break the page
                console.warn('[Poster] backfill failed:', e.message);
            }
        }

        return { ...item, posterPath };
    }));

    return enriched;
}

module.exports = {
    normalizePosterPath,
    fetchPosterPath,
    enrichItemsWithPosters
};

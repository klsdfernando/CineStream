/**
 * VidVault subtitle source
 *
 * Uses the same public endpoints as https://vidvault.ru/:
 *   GET  /api/get-token
 *   POST /api/download-proxy  → mp4Data.*.captions[]
 *   GET  https://sub.k5s7sjozpn.workers.dev/?url=&title=  (download proxy)
 */

const API_BASE = 'https://vidvault.ru/api';
const SUB_PROXY = 'https://sub.k5s7sjozpn.workers.dev';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function formatSize(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return '';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function findCaptions(obj, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 8) return null;
    if (Array.isArray(obj.captions)) return obj.captions;
    for (const value of Object.values(obj)) {
        if (value && typeof value === 'object') {
            const found = findCaptions(value, depth + 1);
            if (found) return found;
        }
    }
    return null;
}

async function getToken() {
    const res = await fetch(`${API_BASE}/get-token`, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`VidVault token failed (HTTP ${res.status})`);
    const data = await res.json();
    if (!data?.t) throw new Error('VidVault token missing');
    return data.t;
}

/**
 * @param {{ type: 'movie'|'tv', tmdbId: string|number, season?: number, episode?: number, title?: string, year?: string|number }} opts
 */
async function listSubtitles(opts) {
    const { type, tmdbId, season, episode, title, year } = opts || {};
    if (!tmdbId) throw new Error('Missing TMDB id');

    const token = await getToken();
    const body = {
        type: type === 'tv' ? 'tv' : 'movie',
        tmdbId: String(tmdbId),
    };
    if (body.type === 'tv') {
        body.season = Number(season) || 1;
        body.episode = Number(episode) || 1;
    }

    const res = await fetch(`${API_BASE}/download-proxy`, {
        method: 'POST',
        headers: {
            'User-Agent': UA,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'x-request-token': token,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`VidVault lookup failed (HTTP ${res.status})`);
    const data = await res.json();
    const captions = findCaptions(data) || [];

    const displayTitle = body.type === 'movie'
        ? `${title || 'Movie'}${year ? ` (${year})` : ''}`
        : `${title || 'Show'}${year ? ` (${year})` : ''} S${body.season}E${body.episode}`;

    return captions
        .filter(c => c && c.url && c.lanName)
        .map((c, index) => ({
            id: String(c.id || `${c.lan}-${index}`),
            lang: String(c.lan || 'und'),
            label: String(c.lanName),
            size: formatSize(c.size),
            sizeBytes: Number(c.size) || 0,
            url: String(c.url),
            downloadUrl: `${SUB_PROXY}/?url=${encodeURIComponent(c.url)}&title=${encodeURIComponent(displayTitle)}`,
            delay: Number(c.delay) || 0,
        }));
}

/** Prefer the signed CDN URL (works from Node); fall back to VidVault's download proxy. */
async function downloadSubtitle(downloadUrl, fallbackUrl) {
    const tryFetch = async (url) => {
        const res = await fetch(url, {
            headers: {
                'User-Agent': UA,
                Accept: 'text/plain,text/vtt,application/x-subrip,*/*',
                Referer: 'https://vidvault.ru/',
            },
            redirect: 'follow',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!text || text.length < 20) throw new Error('Empty subtitle file');
        // Reject HTML error pages mistaken for subtitles.
        if (/^\s*<(!doctype|html)/i.test(text)) throw new Error('Got HTML instead of a subtitle file');
        return text;
    };

    const primary = fallbackUrl || downloadUrl;
    const secondary = downloadUrl && downloadUrl !== primary ? downloadUrl : null;

    try {
        return await tryFetch(primary);
    } catch (primaryError) {
        if (!secondary) throw primaryError;
        return tryFetch(secondary);
    }
}

function pickEnglishTrack(tracks) {
    if (!Array.isArray(tracks) || tracks.length === 0) return null;
    const english = tracks.filter(t =>
        /^en/i.test(t.lang) || /english/i.test(t.label)
    );
    const pool = english.length > 0 ? english : tracks;
    return pool.find(t => !/sdh|forced|cc\b|hi\b/i.test(t.label)) || pool[0];
}

module.exports = {
    listSubtitles,
    downloadSubtitle,
    pickEnglishTrack,
};

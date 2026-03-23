/**
 * Torrent Search Routes
 * Searches YTS API for movie torrents
 */

export default async function torrentRoutes(fastify) {
    /**
     * Search for movie/TV torrents by IMDB ID or title
     */
    fastify.get('/torrents/search', async (request, reply) => {
        const { imdbId, title, tmdbId, mediaType, season, episode } = request.query;

        if (!imdbId && !title) {
            return reply.status(400).send({ error: 'imdbId or title is required' });
        }

        try {
            let torrents = [];
            const isTV = mediaType === 'tv';

            // For TV shows - PRIORITIZE SEASON PACKS
            if (isTV && title) {
                const seasonStr = String(season).padStart(2, '0');
                const episodeStr = String(episode).padStart(2, '0');
                const seasonQuery = `${title} S${seasonStr}`;
                const episodeQuery = `${title} S${seasonStr}E${episodeStr}`;

                console.log(`[Torrents] Searching for TV season pack: ${seasonQuery}`);

                // PRIORITY 1: Search for SEASON PACKS first (all sources in parallel)
                const [tpbSeasonResult, x1337SeasonResult] = await Promise.allSettled([
                    searchTPB(`${title} S${seasonStr} complete`).catch(e => []),
                    searchTPB(seasonQuery).catch(e => []),
                ]);

                const tpbSeasonTorrents = tpbSeasonResult.status === 'fulfilled' ? tpbSeasonResult.value : [];
                const x1337SeasonTorrents = x1337SeasonResult.status === 'fulfilled' ? x1337SeasonResult.value : [];

                // Combine and filter for season packs (not individual episodes)
                let seasonPackResults = [...tpbSeasonTorrents, ...x1337SeasonTorrents];

                // Filter to only include season packs (larger files, contain "S01" but not specific episode)
                seasonPackResults = seasonPackResults.filter(t => {
                    const name = t.name.toUpperCase();
                    // Include if it has the season but NOT a specific episode number
                    const hasSeasonOnly = name.includes(`S${seasonStr}`) && !name.match(/S\d{2}E\d{2}/);
                    // Or if it explicitly says "complete" or "season"
                    const isCompletePack = name.includes('COMPLETE') || name.includes('SEASON') || name.includes('PACK');
                    // Or if the size is large (> 2GB typically means season pack)
                    const isLargeFile = (t.sizeBytes || 0) > 2 * 1024 * 1024 * 1024;
                    return hasSeasonOnly || isCompletePack || isLargeFile;
                });

                console.log(`[Torrents] Found ${seasonPackResults.length} season packs`);

                if (seasonPackResults.length > 0) {
                    // Mark as season packs and use them
                    torrents = seasonPackResults.slice(0, 10).map(t => ({
                        ...t,
                        name: t.name.includes('[SEASON') ? t.name : `[SEASON ${season} PACK] ${t.name}`,
                        type: 'season-pack'
                    }));
                }

                // FALLBACK: If no season packs, try individual episodes
                if (torrents.length === 0) {
                    console.log(`[Torrents] No season packs, trying individual episode: ${episodeQuery}`);

                    const [eztvResult, tpbResult] = await Promise.allSettled([
                        searchEZTV(title, season, episode).catch(e => []),
                        searchTPB(episodeQuery).catch(e => [])
                    ]);

                    const eztvTorrents = eztvResult.status === 'fulfilled' ? eztvResult.value : [];
                    const tpbTorrents = tpbResult.status === 'fulfilled' ? tpbResult.value : [];
                    torrents = [...eztvTorrents, ...tpbTorrents];

                    console.log(`[Torrents] Individual episode results: ${torrents.length}`);
                }

                // Remove duplicates by hash
                const seen = new Set();
                torrents = torrents.filter(t => {
                    if (!t.hash || seen.has(t.hash)) return false;
                    seen.add(t.hash);
                    return true;
                });

            } else {
                // For movies, try YTS API first (best for movies)
                const ytsResults = await searchYTS(imdbId, title);
                if (ytsResults.length > 0) {
                    torrents = ytsResults;
                }

                // If no results from YTS, try TPB
                if (torrents.length === 0 && title) {
                    console.log(`[Torrents] Trying TPB for movie: ${title}`);
                    torrents = await searchTPB(title);
                }

                // Try 1337x as last resort
                if (torrents.length === 0 && title) {
                    console.log(`[Torrents] Trying 1337x for movie: ${title}`);
                    torrents = await search1337x(title);
                }
            }

            // Sort by seeds descending
            torrents.sort((a, b) => (b.seeds || 0) - (a.seeds || 0));

            return {
                success: true,
                torrents: torrents.slice(0, 15), // Limit to 15 results
                source: torrents.length > 0 ? 'search' : null,
                searchedFor: isTV ? `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}` : title
            };
        } catch (error) {
            console.error('Torrent search error:', error);
            return reply.status(500).send({ error: 'Failed to search torrents' });
        }
    });
}

/**
 * Fetch with timeout helper
 */
async function fetchWithTimeout(url, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * Search YTS API for movie torrents
 * YTS has excellent quality releases with multiple resolutions
 */
async function searchYTS(imdbId, title) {
    // Try multiple YTS mirrors for reliability
    const mirrors = [
        'https://yts.torrentbay.st',
        'https://yts.mx',
        'https://yts.pm'
    ];

    for (const mirror of mirrors) {
        try {
            let url = `${mirror}/api/v2/list_movies.json?`;

            if (imdbId) {
                url += `query_term=${imdbId}`;
            } else if (title) {
                url += `query_term=${encodeURIComponent(title)}`;
            }

            console.log(`[Torrents] Trying YTS mirror: ${mirror}`);
            const response = await fetchWithTimeout(url, 8000);
            const data = await response.json();

            if (data.status !== 'ok' || !data.data?.movies) {
                console.log(`[Torrents] No movies found on ${mirror}`);
                continue;
            }

            const movie = data.data.movies[0];
            if (!movie || !movie.torrents) {
                continue;
            }

            console.log(`[Torrents] Found ${movie.torrents.length} torrents for "${movie.title}" on ${mirror}`);

            // Map YTS torrent data to our format
            return movie.torrents.map(torrent => ({
                quality: torrent.quality,
                type: torrent.type, // web, bluray, etc.
                size: torrent.size,
                sizeBytes: torrent.size_bytes,
                seeds: torrent.seeds,
                peers: torrent.peers,
                hash: torrent.hash,
                magnetLink: `magnet:?xt=urn:btih:${torrent.hash}&dn=${encodeURIComponent(movie.title)}&tr=udp://open.demonii.com:1337/announce&tr=udp://tracker.openbittorrent.com:80&tr=udp://tracker.coppersurfer.tk:6969&tr=udp://glotorrents.pw:6969/announce&tr=udp://tracker.opentrackr.org:1337/announce&tr=udp://torrent.gresille.org:80/announce&tr=udp://p4p.arenabg.com:1337&tr=udp://tracker.leechers-paradise.org:6969`,
                source: 'YTS',
                movieTitle: movie.title,
                year: movie.year,
                poster: movie.medium_cover_image
            }));
        } catch (error) {
            console.error(`[Torrents] YTS mirror ${mirror} failed:`, error.message);
            // Try next mirror
            continue;
        }
    }

    return [];
}

/**
 * Search EZTV for TV show torrents (excellent for TV series)
 * EZTV provides direct magnet links
 */
async function searchEZTV(showName, season, episode) {
    try {
        // EZTV API search
        const searchQuery = encodeURIComponent(showName);
        const url = `https://eztv.re/api/get-torrents?imdb_id=&limit=50&page=1&search=${searchQuery}`;

        console.log(`[Torrents] Searching EZTV for: ${showName}`);
        const response = await fetchWithTimeout(url, 10000);
        const data = await response.json();

        if (!data.torrents || !Array.isArray(data.torrents)) {
            console.log('[Torrents] No results from EZTV');
            return [];
        }

        // Filter for the specific episode if season/episode provided
        let torrents = data.torrents;

        if (season && episode) {
            // Format patterns: S01E05, 1x05, etc.
            const seasonStr = String(season).padStart(2, '0');
            const episodeStr = String(episode).padStart(2, '0');
            const patterns = [
                `S${seasonStr}E${episodeStr}`,
                `${season}x${episodeStr}`,
                `${season}x${episode}`
            ];

            torrents = torrents.filter(t => {
                const title = (t.title || t.filename || '').toUpperCase();
                return patterns.some(p => title.includes(p.toUpperCase()));
            });
        }

        // Map to our format
        return torrents.slice(0, 15).map(t => {
            const name = t.title || t.filename || '';
            let quality = 'Unknown';
            if (name.includes('2160p') || name.includes('4K')) quality = '2160p';
            else if (name.includes('1080p')) quality = '1080p';
            else if (name.includes('720p')) quality = '720p';
            else if (name.includes('480p')) quality = '480p';

            // Size formatting
            const sizeBytes = parseInt(t.size_bytes) || 0;
            const sizeMB = sizeBytes / (1024 * 1024);
            const sizeGB = sizeMB / 1024;
            const sizeStr = sizeGB >= 1 ? `${sizeGB.toFixed(2)} GB` : `${sizeMB.toFixed(0)} MB`;

            return {
                quality,
                type: name.includes('WEB') ? 'web' : (name.includes('HDTV') ? 'hdtv' : 'other'),
                size: sizeStr,
                sizeBytes: sizeBytes,
                seeds: parseInt(t.seeds) || 0,
                peers: parseInt(t.peers) || 0,
                magnetLink: t.magnet_url,
                hash: t.hash,
                source: 'EZTV',
                name: name
            };
        }).filter(t => t.magnetLink); // Only return torrents with magnet links

    } catch (error) {
        console.error('[Torrents] EZTV API error:', error.message);
        return [];
    }
}

/**
 * Search TorrentGalaxy for torrents (fallback, works for both movies and TV)
 * Uses their public API
 */
async function searchTorrentGalaxy(query) {
    try {
        const searchQuery = encodeURIComponent(query);
        const url = `https://torrentgalaxy.to/torrents.php?search=${searchQuery}&lang=0&nox=2&sort=seeders&order=desc`;

        console.log(`[Torrents] Searching TorrentGalaxy for: ${query}`);

        // This requires HTML scraping as TG doesn't have a public JSON API
        // For now, return empty and rely on EZTV for TV shows
        return [];
    } catch (error) {
        console.error('[Torrents] TorrentGalaxy error:', error.message);
        return [];
    }
}

/**
 * Search ThePirateBay via API proxy for torrents
 */
async function searchTPB(query) {
    try {
        const searchQuery = encodeURIComponent(query);
        // Using a public TPB API proxy
        const url = `https://apibay.org/q.php?q=${searchQuery}&cat=200,205,208`;

        console.log(`[Torrents] Searching TPB for: ${query}`);
        const response = await fetchWithTimeout(url, 10000);
        const data = await response.json();

        if (!data || !Array.isArray(data) || data[0]?.id === '0') {
            console.log('[Torrents] No results from TPB');
            return [];
        }

        // Standard trackers for magnet links
        const trackers = [
            'udp://tracker.openbittorrent.com:80',
            'udp://tracker.opentrackr.org:1337/announce',
            'udp://tracker.coppersurfer.tk:6969/announce',
            'udp://tracker.leechers-paradise.org:6969',
            'udp://explodie.org:6969'
        ].map(t => `&tr=${encodeURIComponent(t)}`).join('');

        return data.slice(0, 15).map(t => {
            const name = t.name || '';
            let quality = 'Unknown';
            if (name.includes('2160p') || name.includes('4K')) quality = '2160p';
            else if (name.includes('1080p')) quality = '1080p';
            else if (name.includes('720p')) quality = '720p';
            else if (name.includes('480p')) quality = '480p';

            // Size formatting
            const sizeBytes = parseInt(t.size) || 0;
            const sizeMB = sizeBytes / (1024 * 1024);
            const sizeGB = sizeMB / 1024;
            const sizeStr = sizeGB >= 1 ? `${sizeGB.toFixed(2)} GB` : `${sizeMB.toFixed(0)} MB`;

            // Build magnet link
            const magnetLink = `magnet:?xt=urn:btih:${t.info_hash}&dn=${encodeURIComponent(name)}${trackers}`;

            return {
                quality,
                type: name.includes('BluRay') ? 'bluray' : (name.includes('WEB') ? 'web' : 'other'),
                size: sizeStr,
                sizeBytes: sizeBytes,
                seeds: parseInt(t.seeders) || 0,
                peers: parseInt(t.leechers) || 0,
                magnetLink: magnetLink,
                hash: t.info_hash,
                source: 'TPB',
                name: name
            };
        }).filter(t => t.seeds > 0);

    } catch (error) {
        console.error('[Torrents] TPB API error:', error.message);
        return [];
    }
}

/**
 * Search 1337x via Torrent API (provides magnet links)
 */
async function search1337x(query) {
    try {
        // Using torrent-api.cc which provides JSON responses with magnets
        const searchQuery = encodeURIComponent(query);
        const url = `https://torrent-api.cc/1337x/${searchQuery}`;

        console.log(`[Torrents] Searching 1337x for: ${query}`);
        const response = await fetchWithTimeout(url, 10000);
        const data = await response.json();

        if (!data || !Array.isArray(data) || data.length === 0) {
            // Try alternative API
            const alt = `https://torrents-api.pages.dev/${searchQuery}`;
            console.log(`[Torrents] Trying alternative 1337x API`);
            const altResponse = await fetchWithTimeout(alt, 8000);
            const altData = await altResponse.json();

            if (altData && altData['1337x'] && Array.isArray(altData['1337x'])) {
                return altData['1337x'].slice(0, 10).map(t => formatTorrentResult(t, '1337x'));
            }
            return [];
        }

        return data.slice(0, 15).map(t => formatTorrentResult(t, '1337x'));
    } catch (error) {
        console.error('[Torrents] 1337x API error:', error.message);
        return [];
    }
}

/**
 * Format torrent result to standard format
 */
function formatTorrentResult(t, source) {
    const name = t.name || t.Name || t.title || '';
    let quality = 'Unknown';
    if (name.includes('2160p') || name.includes('4K')) quality = '2160p';
    else if (name.includes('1080p')) quality = '1080p';
    else if (name.includes('720p')) quality = '720p';
    else if (name.includes('480p')) quality = '480p';

    // Handle various size formats
    let sizeStr = t.size || t.Size || 'Unknown';
    let sizeBytes = 0;
    if (typeof sizeStr === 'number') {
        sizeBytes = sizeStr;
        const sizeMB = sizeBytes / (1024 * 1024);
        const sizeGB = sizeMB / 1024;
        sizeStr = sizeGB >= 1 ? `${sizeGB.toFixed(2)} GB` : `${sizeMB.toFixed(0)} MB`;
    }

    // Get magnet link - various field names
    const magnetLink = t.magnet || t.magnetLink || t.Magnet || t.magnetUrl || null;

    // Standard trackers if building magnet
    const hash = t.hash || t.infoHash || t.info_hash || '';
    let finalMagnet = magnetLink;
    if (!finalMagnet && hash) {
        const trackers = [
            'udp://tracker.openbittorrent.com:80',
            'udp://tracker.opentrackr.org:1337/announce'
        ].map(tr => `&tr=${encodeURIComponent(tr)}`).join('');
        finalMagnet = `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(name)}${trackers}`;
    }

    return {
        quality,
        type: name.includes('BluRay') ? 'bluray' : (name.includes('WEB') ? 'web' : 'other'),
        size: sizeStr,
        sizeBytes: sizeBytes,
        seeds: parseInt(t.seeds || t.Seeds || t.seeders || 0) || 0,
        peers: parseInt(t.leeches || t.Leeches || t.leechers || 0) || 0,
        magnetLink: finalMagnet,
        hash: hash,
        source: source,
        name: name
    };
}

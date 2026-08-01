/**
 * API Service - Handles all communication via IPC to the Electron main process
 * Replaces the old HTTP fetch-based API with IPC invoke calls
 * 
 * The api object interface is kept IDENTICAL to the old version
 * so all page files work without any changes.
 */

const api = {
    // Movie endpoints - mapped to IPC calls via electronAPI.tmdb.*
    movies: {
        getTrending: (timeWindow = 'day') => window.electronAPI.tmdb.getTrending(timeWindow),
        getPopular: (page = 1) => window.electronAPI.tmdb.getPopular(page),
        getTopRated: (page = 1) => window.electronAPI.tmdb.getTopRated(page),
        getNowPlaying: (page = 1) => window.electronAPI.tmdb.getNowPlaying(page),
        getUpcoming: (page = 1) => window.electronAPI.tmdb.getUpcoming(page),
        getRandom: () => window.electronAPI.tmdb.getRandom(),
        getDetails: (id) => window.electronAPI.tmdb.getMovieDetails(id),
        getCredits: (id) => window.electronAPI.tmdb.getMovieCredits(id),
        getImages: (id) => window.electronAPI.tmdb.getMovieImages(id),
        getVideos: (id) => window.electronAPI.tmdb.getMovieVideos(id),
        getSimilar: (id, page = 1) => window.electronAPI.tmdb.getSimilarMovies(id, page),
        getRecommendations: (id, page = 1) => window.electronAPI.tmdb.getMovieRecommendations(id, page),
    },

    // TV Series endpoints
    tv: {
        getTrending: () => window.electronAPI.tmdb.getTVTrending(),
        getPopular: (page = 1) => window.electronAPI.tmdb.getTVPopular(page),
        getTopRated: (page = 1) => window.electronAPI.tmdb.getTVTopRated(page),
        getAiring: () => window.electronAPI.tmdb.getTVAiring(),
        getDetails: (id) => window.electronAPI.tmdb.getTVDetails(id),
        getSeason: (id, seasonNumber) => window.electronAPI.tmdb.getTVSeason(id, seasonNumber),
        getCredits: (id) => window.electronAPI.tmdb.getTVCredits(id),
        getSimilar: (id, page = 1) => window.electronAPI.tmdb.getTVSimilar(id, page),
    },

    // Search endpoint
    search: (query, page = 1) => window.electronAPI.tmdb.search(query, page),

    // Discover endpoint
    discover: (options = {}) => window.electronAPI.tmdb.discover(options),

    // Genres endpoint
    getGenres: () => window.electronAPI.tmdb.getGenres(),

    // Person/Actor endpoints
    person: {
        getDetails: (id) => window.electronAPI.tmdb.getPersonDetails(id),
        getCredits: (id) => window.electronAPI.tmdb.getPersonCredits(id),
        getMovies: (id) => window.electronAPI.tmdb.getPersonMovies(id),
        getTV: (id) => window.electronAPI.tmdb.getPersonTV(id),
        getImages: (id) => window.electronAPI.tmdb.getPersonImages(id),
    },

    // Anime endpoints
    anime: {
        getTrending: () => window.electronAPI.tmdb.getAnimeTrending(),
        getPopular: (page = 1) => window.electronAPI.tmdb.getAnimePopular(page),
        getTopRated: (page = 1) => window.electronAPI.tmdb.getAnimeTopRated(page),
        getAiring: () => window.electronAPI.tmdb.getAnimeAiring(),
        discover: (options = {}) => window.electronAPI.tmdb.discoverAnime(options),
        getGenres: () => window.electronAPI.tmdb.getAnimeGenres(),
    },

    // ─── Auth endpoints (via Supabase) ───
    auth: {
        restoreSession: () => window.electronAPI.auth.restoreSession(),
        signup: (data) => window.electronAPI.auth.signup(data),
        signin: (data) => window.electronAPI.auth.signin(data),
        signout: () => window.electronAPI.auth.signout(),
        getUser: () => window.electronAPI.auth.getUser(),
        updateProfile: (data) => window.electronAPI.auth.updateProfile(data),
    },

    /**
     * Build a TMDB poster URL from a relative path ("/abc.jpg") or pass
     * through an absolute URL. Returns a local placeholder when missing.
     */
    posterUrl(path, size = 'w342') {
        if (!path) return 'assets/images/no-poster.png';
        if (/^https?:\/\//i.test(path)) return path;
        const cleaned = path.startsWith('/') ? path : `/${path}`;
        return `https://image.tmdb.org/t/p/${size}${cleaned}`;
    },

    // ─── User Activity endpoints (via Supabase) ───
    activity: {
        record: (data) => window.electronAPI.activity.record(data),
        recordWatchTime: (data) => window.electronAPI.activity.recordWatchTime(data),
        getHistory: (type) => window.electronAPI.activity.getHistory(type),
        getStatus: (mediaId, mediaType) => window.electronAPI.activity.getStatus(mediaId, mediaType),
        getContinueWatching: () => window.electronAPI.activity.getContinueWatching(),
        getAnalytics: () => window.electronAPI.activity.getAnalytics(),
        removeHistory: (id) => window.electronAPI.activity.removeHistory({ id }),
        clearHistory: () => window.electronAPI.activity.clearHistory(),
    },

    // ─── Favorites (account-scoped) ───
    favorites: {
        list: () => window.electronAPI.favorites.list(),
        toggle: (data) => window.electronAPI.favorites.toggle(data),
        check: (mediaId, mediaType) => window.electronAPI.favorites.check(mediaId, mediaType),
    },

    // ─── Player preferences ───
    prefs: {
        get: () => window.electronAPI.prefs.get(),
        setServer: (serverId) => window.electronAPI.prefs.setServer(serverId),
    },

    // ─── Search history ───
    searchHistory: {
        record: (query) => window.electronAPI.searchHistory.record(query),
        getRecent: (limit) => window.electronAPI.searchHistory.getRecent(limit),
        clear: () => window.electronAPI.searchHistory.clear(),
    },

    // ─── Playlists endpoints (via Supabase) ───
    playlists: {
        create: (data) => window.electronAPI.playlists.create(data),
        getAll: () => window.electronAPI.playlists.getAll(),
        getDetails: (id) => window.electronAPI.playlists.getDetails(id),
        addItem: (idOrData, dataObj) => {
            if (typeof idOrData === 'object' && idOrData !== null) {
                return window.electronAPI.playlists.addItem(idOrData);
            }
            return window.electronAPI.playlists.addItem({ playlistId: idOrData, ...(dataObj || {}) });
        },
        removeItem: (id, mediaId) => window.electronAPI.playlists.removeItem({ playlistId: id, mediaId }),
        delete: (id) => window.electronAPI.playlists.delete(id),
    },

    // ─── Reports ───
    reports: {
        submit: (data) => window.electronAPI.reports.submit(data),
    },

    // ─── Torrent Search (direct, no server) ───
    torrentSearch: {
        search: (params) => window.electronAPI.torrentSearch.search(params),
    },

    // ─── Custom Subtitles (injected into the player iframe) ───
    subtitles: {
        inject: (payload) => window.electronAPI.subtitles.inject(payload),
        activate: (id) => window.electronAPI.subtitles.activate(id),
        remove: (id) => window.electronAPI.subtitles.remove(id),
        playerReady: () => window.electronAPI.subtitles.playerReady(),
        listTracks: () => window.electronAPI.subtitles.listTracks(),
        vidvaultList: (options) => window.electronAPI.subtitles.vidvaultList(options),
        vidvaultLoad: (options) => window.electronAPI.subtitles.vidvaultLoad(options),
        vidvaultVideoDownloads: (options) => window.electronAPI.subtitles.vidvaultVideoDownloads(options),
        generate: (options) => window.electronAPI.subtitles.generate(options),
        onGenerateProgress: (cb) => window.electronAPI.subtitles.onGenerateProgress(cb),
        removeGenerateProgress: () => window.electronAPI.subtitles.removeGenerateProgress(),
    },

    // ─── Audio Booster / Equalizer ───
    audio: {
        apply: (cfg) => window.electronAPI.audio.apply(cfg),
        reset: () => window.electronAPI.audio.reset(),
    },

    // Legacy helper methods for backward compatibility
    /**
     * Make a GET request - now delegates to the appropriate IPC call
     * This is kept for any code that calls api.get() directly
     */
    async get(endpoint, params = {}) {
        console.warn(`[API] Legacy api.get() called for: ${endpoint}. Consider using specific api methods.`);
        // Map common endpoints to IPC calls
        if (endpoint.startsWith('/api/movies/trending')) return this.movies.getTrending(params.timeWindow);
        if (endpoint.startsWith('/api/movies/popular')) return this.movies.getPopular(params.page);
        if (endpoint.startsWith('/api/movies/top-rated')) return this.movies.getTopRated(params.page);
        if (endpoint.startsWith('/api/movies/now-playing')) return this.movies.getNowPlaying(params.page);
        if (endpoint.startsWith('/api/movies/upcoming')) return this.movies.getUpcoming(params.page);
        if (endpoint.startsWith('/api/movies/random')) return this.movies.getRandom();
        if (endpoint.startsWith('/api/search')) return this.search(params.query, params.page);
        if (endpoint.startsWith('/api/discover')) return this.discover(params);
        if (endpoint.startsWith('/api/genres')) return this.getGenres();
        // Movie details
        const movieMatch = endpoint.match(/^\/api\/movies\/(\d+)$/);
        if (movieMatch) return this.movies.getDetails(movieMatch[1]);
        const movieCreditsMatch = endpoint.match(/^\/api\/movies\/(\d+)\/credits$/);
        if (movieCreditsMatch) return this.movies.getCredits(movieCreditsMatch[1]);
        console.error(`[API] No IPC mapping for endpoint: ${endpoint}`);
        throw new Error(`Endpoint not supported in standalone mode: ${endpoint}`);
    },

    /**
     * Make an authenticated API request - now delegates to IPC
     */
    async authenticatedRequest(endpoint, method = 'GET', body = null) {
        console.warn(`[API] Legacy authenticatedRequest() called for: ${endpoint}`);
        // Map authenticated endpoints
        if (endpoint === '/auth/me') return this.auth.getUser();
        if (endpoint === '/auth/profile' && method === 'PUT') return this.auth.updateProfile(body);
        if (endpoint === '/auth/logout' && method === 'POST') return this.auth.signout();
        if (endpoint.startsWith('/activity/record') && method === 'POST') return this.activity.record(body);
        if (endpoint.startsWith('/activity/history')) {
            const type = new URL(`http://x${endpoint}`).searchParams.get('type');
            return this.activity.getHistory(type);
        }
        console.error(`[API] No IPC mapping for authenticated endpoint: ${endpoint}`);
        throw new Error(`Authenticated endpoint not supported: ${endpoint}`);
    },

    showUnderDevelopmentToast: () => {
        const existing = document.getElementById('dev-toast');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.id = 'dev-toast';
        toast.style.cssText = 'position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: rgba(30, 30, 30, 0.95); color: #fff; padding: 12px 24px; border-radius: 8px; border-left: 4px solid var(--accent-green); z-index: 9999; box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 12px; font-weight: 500; font-size: 14px; animation: slideUp 0.3s ease forwards; pointer-events: none;';
        
        toast.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--accent-green)" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            This feature is currently under development!
        `;
        
        if (!document.getElementById('toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                @keyframes slideUp { from { bottom: -50px; opacity: 0; } to { bottom: 30px; opacity: 1; } }
                @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

// Make api globally available
window.api = api;

const { contextBridge, ipcRenderer, shell } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Shell - Open external links
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

    // Window controls
    minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
    maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
    closeWindow: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

    // ─── TMDB Data ───
    tmdb: {
        // Movies
        getTrending: (timeWindow) => ipcRenderer.invoke('tmdb:trending', timeWindow),
        getPopular: (page) => ipcRenderer.invoke('tmdb:popular', page),
        getTopRated: (page) => ipcRenderer.invoke('tmdb:topRated', page),
        getNowPlaying: (page) => ipcRenderer.invoke('tmdb:nowPlaying', page),
        getUpcoming: (page) => ipcRenderer.invoke('tmdb:upcoming', page),
        getRandom: () => ipcRenderer.invoke('tmdb:random'),
        getMovieDetails: (id) => ipcRenderer.invoke('tmdb:movieDetails', id),
        getMovieCredits: (id) => ipcRenderer.invoke('tmdb:movieCredits', id),
        getMovieImages: (id) => ipcRenderer.invoke('tmdb:movieImages', id),
        getMovieVideos: (id) => ipcRenderer.invoke('tmdb:movieVideos', id),
        getSimilarMovies: (id, page) => ipcRenderer.invoke('tmdb:similarMovies', id, page),
        getMovieRecommendations: (id, page) => ipcRenderer.invoke('tmdb:movieRecommendations', id, page),
        // Search & Discover
        search: (query, page) => ipcRenderer.invoke('tmdb:search', query, page),
        discover: (options) => ipcRenderer.invoke('tmdb:discover', options),
        getGenres: () => ipcRenderer.invoke('tmdb:genres'),
        // TV
        getTVTrending: () => ipcRenderer.invoke('tmdb:tvTrending'),
        getTVPopular: (page) => ipcRenderer.invoke('tmdb:tvPopular', page),
        getTVTopRated: (page) => ipcRenderer.invoke('tmdb:tvTopRated', page),
        getTVAiring: () => ipcRenderer.invoke('tmdb:tvAiring'),
        getTVDetails: (id) => ipcRenderer.invoke('tmdb:tvDetails', id),
        getTVSeason: (id, seasonNumber) => ipcRenderer.invoke('tmdb:tvSeason', id, seasonNumber),
        getTVCredits: (id) => ipcRenderer.invoke('tmdb:tvCredits', id),
        getTVSimilar: (id, page) => ipcRenderer.invoke('tmdb:tvSimilar', id, page),
        // Person
        getPersonDetails: (id) => ipcRenderer.invoke('tmdb:personDetails', id),
        getPersonCredits: (id) => ipcRenderer.invoke('tmdb:personCredits', id),
        getPersonMovies: (id) => ipcRenderer.invoke('tmdb:personMovies', id),
        getPersonTV: (id) => ipcRenderer.invoke('tmdb:personTV', id),
        getPersonImages: (id) => ipcRenderer.invoke('tmdb:personImages', id),
        // Anime
        getAnimeTrending: () => ipcRenderer.invoke('tmdb:animeTrending'),
        getAnimePopular: (page) => ipcRenderer.invoke('tmdb:animePopular', page),
        getAnimeTopRated: (page) => ipcRenderer.invoke('tmdb:animeTopRated', page),
        getAnimeAiring: () => ipcRenderer.invoke('tmdb:animeAiring'),
        discoverAnime: (options) => ipcRenderer.invoke('tmdb:animeDiscover', options),
        getAnimeGenres: () => ipcRenderer.invoke('tmdb:animeGenres'),
    },

    // ─── Authentication ───
    auth: {
        signup: (data) => ipcRenderer.invoke('auth:signup', data),
        signin: (data) => ipcRenderer.invoke('auth:signin', data),
        signout: () => ipcRenderer.invoke('auth:signout'),
        getUser: () => ipcRenderer.invoke('auth:getUser'),
        updateProfile: (data) => ipcRenderer.invoke('auth:updateProfile', data),
    },

    // ─── User Activity ───
    activity: {
        record: (data) => ipcRenderer.invoke('activity:record', data),
        getHistory: (type) => ipcRenderer.invoke('activity:getHistory', type),
        getStatus: (mediaId) => ipcRenderer.invoke('activity:getStatus', mediaId),
    },

    // ─── Playlists ───
    playlists: {
        create: (data) => ipcRenderer.invoke('playlist:create', data),
        getAll: () => ipcRenderer.invoke('playlist:getAll'),
        getDetails: (id) => ipcRenderer.invoke('playlist:getDetails', id),
        addItem: (data) => ipcRenderer.invoke('playlist:addItem', data),
        removeItem: (data) => ipcRenderer.invoke('playlist:removeItem', data),
        delete: (id) => ipcRenderer.invoke('playlist:delete', id),
    },

    // ─── Reports ───
    reports: {
        submit: (data) => ipcRenderer.invoke('report:submit', data),
        getAll: () => ipcRenderer.invoke('report:getAll'),
    },

    // ─── Torrent Search ───
    torrentSearch: {
        search: (params) => ipcRenderer.invoke('torrent:search', params),
    },

    // ─── Custom Subtitles ───
    subtitles: {
        inject: (payload) => ipcRenderer.invoke('subtitle:inject', payload),
        activate: (id) => ipcRenderer.invoke('subtitle:activate', id),
        remove: (id) => ipcRenderer.invoke('subtitle:remove', id),
        playerReady: () => ipcRenderer.invoke('subtitle:playerReady'),
        listTracks: () => ipcRenderer.invoke('subtitle:listTracks'),
        vidvaultList: (options) => ipcRenderer.invoke('subtitle:vidvaultList', options),
        vidvaultLoad: (options) => ipcRenderer.invoke('subtitle:vidvaultLoad', options),
        generate: (options) => ipcRenderer.invoke('subtitle:generate', options),
        onGenerateProgress: (callback) => ipcRenderer.on('subtitle:generateProgress', (event, data) => callback(data)),
        removeGenerateProgress: () => ipcRenderer.removeAllListeners('subtitle:generateProgress'),
    },

    // ─── Audio Booster / Equalizer ───
    audio: {
        apply: (cfg) => ipcRenderer.invoke('audio:apply', cfg),
        reset: () => ipcRenderer.invoke('audio:reset'),
    },

    // ─── Version Check ───
    version: {
        check: (version) => ipcRenderer.invoke('version:check', version),
    },

    // ─── Torrent/Download controls ───
    torrent: {
        start: (magnetLink, movieInfo) => ipcRenderer.invoke('torrent:start', magnetLink, movieInfo),
        pause: (infoHash) => ipcRenderer.invoke('torrent:pause', infoHash),
        resume: (infoHash) => ipcRenderer.invoke('torrent:resume', infoHash),
        cancel: (infoHash) => ipcRenderer.invoke('torrent:cancel', infoHash),
        getAll: () => ipcRenderer.invoke('torrent:getAll'),
        getPath: () => ipcRenderer.invoke('torrent:getPath'),
        setPath: (newPath) => ipcRenderer.invoke('torrent:setPath', newPath),

        // Event listeners for progress updates
        onProgress: (callback) => ipcRenderer.on('torrent:progress', (event, data) => callback(data)),
        onCompleted: (callback) => ipcRenderer.on('torrent:completed', (event, data) => callback(data)),
        onError: (callback) => ipcRenderer.on('torrent:error', (event, data) => callback(data)),

        // Remove all listeners (for cleanup)
        removeAllListeners: () => {
            ipcRenderer.removeAllListeners('torrent:progress');
            ipcRenderer.removeAllListeners('torrent:completed');
            ipcRenderer.removeAllListeners('torrent:error');
        }
    },

    // Platform info
    platform: process.platform,
});

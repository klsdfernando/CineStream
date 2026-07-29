/**
 * TMDB IPC Handlers
 * Handles all movie/TV/anime/person data requests from the renderer process
 */

const { ipcMain } = require('electron');
const tmdb = require('../services/tmdb');
const { getCachedOrFetch, CACHE_TTL } = require('../services/cache');

function registerTmdbHandlers() {
    // ─── Movies ───
    ipcMain.handle('tmdb:trending', async (_, timeWindow = 'day') => {
        return getCachedOrFetch(`trending_${timeWindow}`, () => tmdb.getTrending(timeWindow), CACHE_TTL.trending);
    });
    ipcMain.handle('tmdb:popular', async (_, page = 1) => {
        return getCachedOrFetch(`popular_${page}`, () => tmdb.getPopular(parseInt(page)), CACHE_TTL.popular);
    });
    ipcMain.handle('tmdb:topRated', async (_, page = 1) => {
        return getCachedOrFetch(`top_rated_${page}`, () => tmdb.getTopRated(parseInt(page)), CACHE_TTL.topRated);
    });
    ipcMain.handle('tmdb:nowPlaying', async (_, page = 1) => {
        return getCachedOrFetch(`now_playing_${page}`, () => tmdb.getNowPlaying(parseInt(page)), CACHE_TTL.popular);
    });
    ipcMain.handle('tmdb:upcoming', async (_, page = 1) => {
        return getCachedOrFetch(`upcoming_${page}`, () => tmdb.getUpcoming(parseInt(page)), CACHE_TTL.popular);
    });
    ipcMain.handle('tmdb:random', async () => {
        return getCachedOrFetch('random_movies', () => tmdb.getRandomMovies(), 60);
    });
    ipcMain.handle('tmdb:movieDetails', async (_, id) => {
        return getCachedOrFetch(`movie_${id}`, () => tmdb.getMovieDetails(id), CACHE_TTL.movieDetails);
    });
    ipcMain.handle('tmdb:movieCredits', async (_, id) => {
        return getCachedOrFetch(`movie_credits_${id}`, () => tmdb.getMovieCredits(id), CACHE_TTL.movieDetails);
    });
    ipcMain.handle('tmdb:movieImages', async (_, id) => {
        return getCachedOrFetch(`movie_images_${id}`, () => tmdb.getMovieImages(id), CACHE_TTL.movieDetails);
    });
    ipcMain.handle('tmdb:movieVideos', async (_, id) => {
        return getCachedOrFetch(`movie_videos_${id}`, () => tmdb.getMovieVideos(id), CACHE_TTL.movieDetails);
    });
    ipcMain.handle('tmdb:similarMovies', async (_, id, page = 1) => {
        return getCachedOrFetch(`movie_similar_${id}_${page}`, () => tmdb.getSimilarMovies(id, parseInt(page)), CACHE_TTL.movieDetails);
    });
    ipcMain.handle('tmdb:movieRecommendations', async (_, id, page = 1) => {
        return getCachedOrFetch(`movie_recommendations_${id}_${page}`, () => tmdb.getMovieRecommendations(id, parseInt(page)), CACHE_TTL.movieDetails);
    });

    // ─── Search & Discover ───
    ipcMain.handle('tmdb:search', async (_, query, page = 1) => {
        const cacheKey = `search_${query.toLowerCase().trim()}_${page}`;
        return getCachedOrFetch(cacheKey, () => tmdb.searchMulti(query.trim(), parseInt(page)), CACHE_TTL.search);
    });
    ipcMain.handle('tmdb:discover', async (_, options = {}) => {
        const cacheKey = `discover_${JSON.stringify(options)}`;
        return getCachedOrFetch(cacheKey, () => tmdb.discoverMovies(options), CACHE_TTL.popular);
    });
    ipcMain.handle('tmdb:genres', async () => {
        return getCachedOrFetch('genres', () => tmdb.getGenres(), 86400);
    });

    // ─── TV Series ───
    ipcMain.handle('tmdb:tvTrending', async () => {
        return getCachedOrFetch('tv_trending', () => tmdb.getTrendingTV(), CACHE_TTL.trending);
    });
    ipcMain.handle('tmdb:tvPopular', async (_, page = 1) => {
        return getCachedOrFetch(`tv_popular_${page}`, () => tmdb.getPopularTV(parseInt(page)), CACHE_TTL.popular);
    });
    ipcMain.handle('tmdb:tvTopRated', async (_, page = 1) => {
        return getCachedOrFetch(`tv_top_rated_${page}`, () => tmdb.getTopRatedTV(parseInt(page)), CACHE_TTL.topRated);
    });
    ipcMain.handle('tmdb:tvAiring', async () => {
        return getCachedOrFetch('tv_airing', () => tmdb.getAiringTV(), CACHE_TTL.trending);
    });
    ipcMain.handle('tmdb:tvDetails', async (_, id) => {
        return getCachedOrFetch(`tv_${id}`, () => tmdb.getTVDetails(id), CACHE_TTL.movieDetails);
    });
    ipcMain.handle('tmdb:tvSeason', async (_, id, seasonNumber) => {
        return getCachedOrFetch(`tv_${id}_season_${seasonNumber}`, () => tmdb.getTVSeasonDetails(id, seasonNumber), CACHE_TTL.movieDetails);
    });
    ipcMain.handle('tmdb:tvCredits', async (_, id) => {
        return getCachedOrFetch(`tv_credits_${id}`, () => tmdb.getTVCredits(id), CACHE_TTL.movieDetails);
    });
    ipcMain.handle('tmdb:tvSimilar', async (_, id, page = 1) => {
        return getCachedOrFetch(`tv_similar_${id}_${page}`, () => tmdb.getSimilarTV(id, parseInt(page)), CACHE_TTL.movieDetails);
    });

    // ─── Person/Actor ───
    ipcMain.handle('tmdb:personDetails', async (_, id) => {
        return getCachedOrFetch(`person_${id}`, () => tmdb.getPersonDetails(id), CACHE_TTL.movieDetails);
    });
    ipcMain.handle('tmdb:personCredits', async (_, id) => {
        return getCachedOrFetch(`person_credits_${id}`, () => tmdb.getPersonCombinedCredits(id), CACHE_TTL.movieDetails);
    });
    ipcMain.handle('tmdb:personMovies', async (_, id) => {
        return getCachedOrFetch(`person_movies_${id}`, () => tmdb.getPersonMovieCredits(id), CACHE_TTL.movieDetails);
    });
    ipcMain.handle('tmdb:personTV', async (_, id) => {
        return getCachedOrFetch(`person_tv_${id}`, () => tmdb.getPersonTVCredits(id), CACHE_TTL.movieDetails);
    });
    ipcMain.handle('tmdb:personImages', async (_, id) => {
        return getCachedOrFetch(`person_images_${id}`, () => tmdb.getPersonImages(id), CACHE_TTL.movieDetails);
    });

    // ─── Anime ───
    ipcMain.handle('tmdb:animeTrending', async () => {
        return getCachedOrFetch('anime_trending', () => tmdb.getTrendingAnime(), CACHE_TTL.trending);
    });
    ipcMain.handle('tmdb:animePopular', async (_, page = 1) => {
        return getCachedOrFetch(`anime_popular_${page}`, () => tmdb.getPopularAnime(parseInt(page)), CACHE_TTL.popular);
    });
    ipcMain.handle('tmdb:animeTopRated', async (_, page = 1) => {
        return getCachedOrFetch(`anime_top_rated_${page}`, () => tmdb.getTopRatedAnime(parseInt(page)), CACHE_TTL.topRated);
    });
    ipcMain.handle('tmdb:animeAiring', async () => {
        return getCachedOrFetch('anime_airing', () => tmdb.getAiringAnime(), CACHE_TTL.trending);
    });
    ipcMain.handle('tmdb:animeDiscover', async (_, options = {}) => {
        const cacheKey = `anime_discover_${JSON.stringify(options)}`;
        return getCachedOrFetch(cacheKey, () => tmdb.discoverAnime(options), CACHE_TTL.popular);
    });
    ipcMain.handle('tmdb:animeGenres', async () => {
        return getCachedOrFetch('anime_genres', () => tmdb.getAnimeGenres(), 86400);
    });

    console.log('[IPC] TMDB handlers registered');
}

module.exports = { registerTmdbHandlers };

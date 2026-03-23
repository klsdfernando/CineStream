import { getCachedOrFetch } from '../utils/cache.js';
import * as tmdb from '../services/tmdb.js';

/**
 * Register anime routes
 * @param {import('fastify').FastifyInstance} fastify
 */
export async function animeRoutes(fastify) {

    // Get trending anime
    fastify.get('/api/anime/trending', async (request, reply) => {
        const data = await getCachedOrFetch(
            'anime_trending',
            () => tmdb.getTrendingAnime(),
            300 // Cache for 5 minutes
        );
        return data;
    });

    // Get popular anime
    fastify.get('/api/anime/popular', async (request, reply) => {
        const { page = 1 } = request.query;

        const cacheKey = `anime_popular_${page}`;
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.getPopularAnime(parseInt(page)),
            300
        );
        return data;
    });

    // Get top rated anime
    fastify.get('/api/anime/top-rated', async (request, reply) => {
        const { page = 1 } = request.query;

        const cacheKey = `anime_top_rated_${page}`;
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.getTopRatedAnime(parseInt(page)),
            300
        );
        return data;
    });

    // Get currently airing anime
    fastify.get('/api/anime/airing', async (request, reply) => {
        const data = await getCachedOrFetch(
            'anime_airing',
            () => tmdb.getAiringAnime(),
            300
        );
        return data;
    });

    // Discover anime with filters
    fastify.get('/api/anime/discover', async (request, reply) => {
        const { page = 1, sortBy = 'popularity.desc', year, genre } = request.query;

        const options = {
            page: parseInt(page),
            sortBy,
            year: year ? parseInt(year) : undefined,
            genre: genre || undefined,
        };

        const cacheKey = `anime_discover_${JSON.stringify(options)}`;
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.discoverAnime(options),
            300
        );
        return data;
    });

    // Get anime genres
    fastify.get('/api/anime/genres', async (request, reply) => {
        const data = await getCachedOrFetch(
            'anime_genres',
            () => tmdb.getAnimeGenres(),
            86400 // Cache for 24 hours
        );
        return data;
    });
}

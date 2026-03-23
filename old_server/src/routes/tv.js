import { config } from '../config.js';
import { getCachedOrFetch } from '../utils/cache.js';
import * as tmdb from '../services/tmdb.js';

/**
 * Register TV series routes
 * @param {import('fastify').FastifyInstance} fastify
 */
export async function tvRoutes(fastify) {

    // Get trending TV shows
    fastify.get('/api/tv/trending', async (request, reply) => {
        const cacheKey = 'tv_trending';
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.getTrendingTV(),
            config.cache.trending
        );
        return data;
    });

    // Get popular TV shows
    fastify.get('/api/tv/popular', async (request, reply) => {
        const { page = 1 } = request.query;
        const cacheKey = `tv_popular_${page}`;
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.getPopularTV(parseInt(page)),
            config.cache.trending
        );
        return data;
    });

    // Get top rated TV shows
    fastify.get('/api/tv/top-rated', async (request, reply) => {
        const { page = 1 } = request.query;
        const cacheKey = `tv_top_rated_${page}`;
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.getTopRatedTV(parseInt(page)),
            config.cache.trending
        );
        return data;
    });

    // Get currently airing TV shows
    fastify.get('/api/tv/airing', async (request, reply) => {
        const cacheKey = 'tv_airing';
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.getAiringTV(),
            config.cache.trending
        );
        return data;
    });

    // Get TV series details
    fastify.get('/api/tv/:id', async (request, reply) => {
        const { id } = request.params;

        const cacheKey = `tv_${id}`;
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.getTVDetails(id),
            config.cache.movieDetails
        );

        return data;
    });

    // Get TV season details with episodes
    fastify.get('/api/tv/:id/season/:seasonNumber', async (request, reply) => {
        const { id, seasonNumber } = request.params;

        const cacheKey = `tv_${id}_season_${seasonNumber}`;
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.getTVSeasonDetails(id, parseInt(seasonNumber)),
            config.cache.movieDetails
        );

        return data;
    });

    // Get TV series credits (cast & crew)
    fastify.get('/api/tv/:id/credits', async (request, reply) => {
        const { id } = request.params;

        const cacheKey = `tv_credits_${id}`;
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.getTVCredits(id),
            config.cache.movieDetails
        );

        return data;
    });

    // Get similar TV shows
    fastify.get('/api/tv/:id/similar', async (request, reply) => {
        const { id } = request.params;
        const { page = 1 } = request.query;

        const cacheKey = `tv_similar_${id}_${page}`;
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.getSimilarTV(id, parseInt(page)),
            config.cache.movieDetails
        );

        return data;
    });
}

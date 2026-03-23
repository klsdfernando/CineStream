import { config } from '../config.js';
import { getCachedOrFetch } from '../utils/cache.js';
import * as tmdb from '../services/tmdb.js';

/**
 * Register search routes
 * @param {import('fastify').FastifyInstance} fastify
 */
export async function searchRoutes(fastify) {

    // Search movies
    fastify.get('/api/search', async (request, reply) => {
        const { query, page = 1 } = request.query;

        if (!query || query.trim().length === 0) {
            return reply.status(400).send({
                error: 'Query parameter is required'
            });
        }

        const cacheKey = `search_${query.toLowerCase().trim()}_${page}`;
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.searchMulti(query.trim(), parseInt(page)),
            config.cache.search
        );

        return data;
    });
}

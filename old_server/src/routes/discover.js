import { config } from '../config.js';
import { getCachedOrFetch } from '../utils/cache.js';
import * as tmdb from '../services/tmdb.js';

/**
 * Register discover routes
 * @param {import('fastify').FastifyInstance} fastify
 */
export async function discoverRoutes(fastify) {

    // Discover movies with filters
    fastify.get('/api/discover', async (request, reply) => {
        const {
            page = 1,
            sortBy = 'popularity.desc',
            year,
            genre,
            minRating,
            maxRating
        } = request.query;

        const options = {
            page: parseInt(page),
            sortBy,
            year: year ? parseInt(year) : undefined,
            genre: genre || undefined,
            minRating: minRating ? parseFloat(minRating) : undefined,
            maxRating: maxRating ? parseFloat(maxRating) : undefined,
        };

        // Create cache key from options
        const cacheKey = `discover_${JSON.stringify(options)}`;
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.discoverMovies(options),
            config.cache.popular
        );

        return data;
    });
}

import { config } from '../config.js';
import { getCachedOrFetch } from '../utils/cache.js';
import * as tmdb from '../services/tmdb.js';

/**
 * Register movie routes
 * @param {import('fastify').FastifyInstance} fastify
 */
export async function movieRoutes(fastify) {

    // Get trending movies
    fastify.get('/api/movies/trending', async (request, reply) => {
        const { timeWindow = 'day' } = request.query;

        const cacheKey = `trending_${timeWindow}`;
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.getTrending(timeWindow),
            config.cache.trending
        );

        return data;
    });

    // Get popular movies
    fastify.get('/api/movies/popular', async (request, reply) => {
        const { page = 1 } = request.query;

        const cacheKey = `popular_${page}`;
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.getPopular(parseInt(page)),
            config.cache.popular
        );

        return data;
    });

    // Get top rated movies (This Week's Favorites)
    fastify.get('/api/movies/top-rated', async (request, reply) => {
        const { page = 1 } = request.query;

        const cacheKey = `top_rated_${page}`;
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.getTopRated(parseInt(page)),
            config.cache.topRated
        );

        return data;
    });

    // Get now playing movies
    fastify.get('/api/movies/now-playing', async (request, reply) => {
        const { page = 1 } = request.query;

        const cacheKey = `now_playing_${page}`;
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.getNowPlaying(parseInt(page)),
            config.cache.popular
        );

        return data;
    });

    // Get upcoming movies
    fastify.get('/api/movies/upcoming', async (request, reply) => {
        const { page = 1 } = request.query;

        const cacheKey = `upcoming_${page}`;
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.getUpcoming(parseInt(page)),
            config.cache.popular
        );

        return data;
    });

    // Get random movies
    fastify.get('/api/movies/random', async (request, reply) => {
        // Random movies have shorter cache since they should vary
        const data = await getCachedOrFetch(
            'random_movies',
            () => tmdb.getRandomMovies(),
            60 // 1 minute cache
        );

        return data;
    });

    // Get movie details
    fastify.get('/api/movies/:id', async (request, reply) => {
        const { id } = request.params;

        const cacheKey = `movie_${id}`;
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.getMovieDetails(id),
            config.cache.movieDetails
        );

        return data;
    });

    // Get movie credits (cast & crew)
    fastify.get('/api/movies/:id/credits', async (request, reply) => {
        const { id } = request.params;

        const cacheKey = `movie_credits_${id}`;
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.getMovieCredits(id),
            config.cache.movieDetails
        );

        return data;
    });

    // Get movie images
    fastify.get('/api/movies/:id/images', async (request, reply) => {
        const { id } = request.params;

        const cacheKey = `movie_images_${id}`;
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.getMovieImages(id),
            config.cache.movieDetails
        );

        return data;
    });

    // Get movie videos (trailers, etc.)
    fastify.get('/api/movies/:id/videos', async (request, reply) => {
        const { id } = request.params;

        const cacheKey = `movie_videos_${id}`;
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.getMovieVideos(id),
            config.cache.movieDetails
        );

        return data;
    });

    // Get similar movies
    fastify.get('/api/movies/:id/similar', async (request, reply) => {
        const { id } = request.params;
        const { page = 1 } = request.query;

        const cacheKey = `movie_similar_${id}_${page}`;
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.getSimilarMovies(id, parseInt(page)),
            config.cache.movieDetails
        );

        return data;
    });

    // Get movie recommendations
    fastify.get('/api/movies/:id/recommendations', async (request, reply) => {
        const { id } = request.params;
        const { page = 1 } = request.query;

        const cacheKey = `movie_recommendations_${id}_${page}`;
        const data = await getCachedOrFetch(
            cacheKey,
            () => tmdb.getMovieRecommendations(id, parseInt(page)),
            config.cache.movieDetails
        );

        return data;
    });

    // Get all genres
    fastify.get('/api/genres', async (request, reply) => {
        const data = await getCachedOrFetch(
            'genres',
            () => tmdb.getGenres(),
            86400 // Cache for 24 hours
        );

        return data;
    });
}

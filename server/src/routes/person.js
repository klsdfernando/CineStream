/**
 * Person/Actor Routes
 */

import * as tmdb from '../services/tmdb.js';

export default async function personRoutes(fastify) {
    // Get person details
    fastify.get('/person/:id', async (request, reply) => {
        const { id } = request.params;

        try {
            const person = await tmdb.getPersonDetails(id);
            return person;
        } catch (error) {
            console.error('Error fetching person details:', error);
            reply.status(500).send({ error: 'Failed to fetch person details' });
        }
    });

    // Get person combined credits (movies and TV)
    fastify.get('/person/:id/credits', async (request, reply) => {
        const { id } = request.params;

        try {
            const credits = await tmdb.getPersonCombinedCredits(id);
            return credits;
        } catch (error) {
            console.error('Error fetching person credits:', error);
            reply.status(500).send({ error: 'Failed to fetch person credits' });
        }
    });

    // Get person movie credits
    fastify.get('/person/:id/movies', async (request, reply) => {
        const { id } = request.params;

        try {
            const movies = await tmdb.getPersonMovieCredits(id);
            return movies;
        } catch (error) {
            console.error('Error fetching person movie credits:', error);
            reply.status(500).send({ error: 'Failed to fetch person movie credits' });
        }
    });

    // Get person TV credits
    fastify.get('/person/:id/tv', async (request, reply) => {
        const { id } = request.params;

        try {
            const tvShows = await tmdb.getPersonTVCredits(id);
            return tvShows;
        } catch (error) {
            console.error('Error fetching person TV credits:', error);
            reply.status(500).send({ error: 'Failed to fetch person TV credits' });
        }
    });

    // Get person images
    fastify.get('/person/:id/images', async (request, reply) => {
        const { id } = request.params;

        try {
            const images = await tmdb.getPersonImages(id);
            return images;
        } catch (error) {
            console.error('Error fetching person images:', error);
            reply.status(500).send({ error: 'Failed to fetch person images' });
        }
    });
}

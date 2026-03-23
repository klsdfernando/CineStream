/**
 * Playlist Routes
 * Handles creating, updating, and fetching custom user playlists
 */

import { playlistDb } from '../db/database.js';
import { verifyToken } from './auth.js';

export default async function playlistRoutes(fastify) {
    /**
     * Helper to verify authentication
     */
    const authenticate = async (request, reply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return reply.code(401).send({ error: 'Unauthorized' });
            }

            const token = authHeader.split(' ')[1];
            const decoded = verifyToken(token);
            request.user = decoded;
        } catch (error) {
            return reply.code(401).send({ error: 'Invalid or expired token' });
        }
    };

    /**
     * Create a new playlist
     */
    fastify.post('/playlists', {
        preValidation: authenticate
    }, async (request, reply) => {
        const { name, description, isPublic } = request.body;
        const userId = request.user.id;

        if (!name) {
            return reply.code(400).send({ error: 'Playlist name is required' });
        }

        try {
            const playlist = playlistDb.createPlaylist(userId, name, description, isPublic);
            return reply.send({ success: true, playlist });
        } catch (error) {
            console.error('[Playlist] Error creating playlist:', error);
            return reply.code(500).send({ error: 'Failed to create playlist' });
        }
    });

    /**
     * Get all playlists for logged in user
     */
    fastify.get('/playlists', {
        preValidation: authenticate
    }, async (request, reply) => {
        const userId = request.user.id;

        try {
            const playlists = playlistDb.getUserPlaylists(userId);
            return reply.send({ success: true, playlists });
        } catch (error) {
            console.error('[Playlist] Error fetching playlists:', error);
            return reply.code(500).send({ error: 'Failed to fetch playlists' });
        }
    });

    /**
     * Get a specific playlist with items
     */
    fastify.get('/playlists/:id', {
        preValidation: authenticate
    }, async (request, reply) => {
        const userId = request.user.id;
        const playlistId = request.params.id;

        try {
            const playlist = playlistDb.getPlaylistWithItems(playlistId, userId);
            if (!playlist) {
                return reply.code(404).send({ error: 'Playlist not found' });
            }
            return reply.send({ success: true, playlist });
        } catch (error) {
            console.error('[Playlist] Error fetching playlist:', error);
            return reply.code(500).send({ error: 'Failed to fetch playlist' });
        }
    });

    /**
     * Add item to playlist
     */
    fastify.post('/playlists/:id/items', {
        preValidation: authenticate
    }, async (request, reply) => {
        const userId = request.user.id;
        const playlistId = request.params.id;
        const { mediaId, mediaType, title, posterPath } = request.body;

        if (!mediaId || !mediaType || !title) {
            return reply.code(400).send({ error: 'Missing required media details' });
        }

        try {
            const result = playlistDb.addItem(playlistId, userId, mediaId, mediaType, title, posterPath);
            if (!result.success) {
                return reply.code(400).send({ error: result.message });
            }
            return reply.send(result);
        } catch (error) {
            console.error('[Playlist] Error adding item:', error);
            if (error.message.includes('not found')) {
                return reply.code(404).send({ error: error.message });
            }
            return reply.code(500).send({ error: 'Failed to add item to playlist' });
        }
    });

    /**
     * Remove item from playlist
     */
    fastify.delete('/playlists/:id/items/:mediaId', {
        preValidation: authenticate
    }, async (request, reply) => {
        const userId = request.user.id;
        const { id: playlistId, mediaId } = request.params;

        try {
            const result = playlistDb.removeItem(playlistId, userId, mediaId);
            return reply.send(result);
        } catch (error) {
            console.error('[Playlist] Error removing item:', error);
            if (error.message.includes('not found')) {
                return reply.code(404).send({ error: error.message });
            }
            return reply.code(500).send({ error: 'Failed to remove item from playlist' });
        }
    });

    /**
     * Delete a playlist
     */
    fastify.delete('/playlists/:id', {
        preValidation: authenticate
    }, async (request, reply) => {
        const userId = request.user.id;
        const playlistId = request.params.id;

        try {
            const result = playlistDb.deletePlaylist(playlistId, userId);
            if (result.success) {
                return reply.send({ success: true });
            }
            return reply.code(404).send({ error: 'Playlist not found or unauthorized' });
        } catch (error) {
            console.error('[Playlist] Error deleting playlist:', error);
            return reply.code(500).send({ error: 'Failed to delete playlist' });
        }
    });
}

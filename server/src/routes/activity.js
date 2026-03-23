/**
 * User Activity Routes
 * Handles tracking likes, dislikes, and watch history
 */

import { activityDb } from '../db/database.js';
import { verifyToken } from './auth.js';

export default async function activityRoutes(fastify) {
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
     * Record User Activity (Like, Dislike, Watched)
     */
    fastify.post('/activity/record', {
        preValidation: authenticate
    }, async (request, reply) => {
        const { mediaId, mediaType, title, posterPath, actionType } = request.body;
        console.log("RECEIVED ACTIVITY RECORD REQUEST:", request.body);
        const userId = request.user.id;

        if (!mediaId || !mediaType || !title || !actionType) {
            return reply.code(400).send({ error: 'Missing required fields' });
        }

        if (!['like', 'dislike', 'watched'].includes(actionType)) {
            return reply.code(400).send({ error: 'Invalid action type' });
        }

        try {
            const result = activityDb.recordAction(userId, mediaId, mediaType, title, posterPath, actionType);
            return reply.send({ success: true, result });
        } catch (error) {
            console.error('[Activity] Error recording action:', error);
            return reply.code(500).send({ error: 'Failed to record activity' });
        }
    });

    /**
     * Get User Activity History
     */
    fastify.get('/activity/history', {
        preValidation: authenticate
    }, async (request, reply) => {
        const userId = request.user.id;
        const { type } = request.query; // 'like', 'dislike', or 'watched'

        if (!type || !['like', 'dislike', 'watched'].includes(type)) {
            return reply.code(400).send({ error: 'valid type is required' });
        }

        try {
            const history = activityDb.getUserActivity(userId, type);
            return reply.send({ success: true, history });
        } catch (error) {
            console.error('[Activity] Error fetching history:', error);
            return reply.code(500).send({ error: 'Failed to fetch activity history' });
        }
    });

    /**
     * Get specific media interaction status (is it liked/disliked by user?)
     */
    fastify.get('/activity/status/:mediaId', {
        preValidation: authenticate
    }, async (request, reply) => {
        const userId = request.user.id;
        const { mediaId } = request.params;

        try {
            const status = activityDb.getMediaInteraction(userId, mediaId);
            return reply.send({ success: true, status: status || 'none' });
        } catch (error) {
            console.error('[Activity] Error fetching status:', error);
            return reply.code(500).send({ error: 'Failed to fetch status' });
        }
    });
}

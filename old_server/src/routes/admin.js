/**
 * Admin Routes
 */

import jwt from 'jsonwebtoken';
import { adminDb, userDb } from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'movie-app-secret-key-change-in-production';
const ADMIN_JWT_EXPIRES_IN = '24h';

/**
 * Generate admin JWT token
 */
function generateAdminToken(admin) {
    return jwt.sign(
        { id: admin.id, username: admin.username, isAdmin: true },
        JWT_SECRET,
        { expiresIn: ADMIN_JWT_EXPIRES_IN }
    );
}

/**
 * Verify admin token middleware
 */
export function verifyAdminToken(request, reply, done) {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.status(401).send({ error: 'No token provided' });
        return;
    }

    const token = authHeader.substring(7);

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded.isAdmin) {
            reply.status(403).send({ error: 'Admin access required' });
            return;
        }
        request.admin = decoded;
        done();
    } catch (error) {
        reply.status(401).send({ error: 'Invalid token' });
    }
}

export default async function adminRoutes(fastify) {
    /**
     * Admin Login
     */
    fastify.post('/admin/login', async (request, reply) => {
        const { username, password } = request.body;

        if (!username || !password) {
            return reply.status(400).send({ error: 'Username and password are required' });
        }

        try {
            const admin = adminDb.findByUsername(username);

            if (!admin) {
                return reply.status(401).send({ error: 'Invalid credentials' });
            }

            if (!adminDb.verifyPassword(admin, password)) {
                return reply.status(401).send({ error: 'Invalid credentials' });
            }

            const token = generateAdminToken(admin);

            return {
                message: 'Admin login successful',
                admin: {
                    id: admin.id,
                    username: admin.username
                },
                token
            };
        } catch (error) {
            console.error('Admin login error:', error);
            return reply.status(500).send({ error: 'Login failed' });
        }
    });

    /**
     * Get all users (admin only)
     */
    fastify.get('/admin/users', { preHandler: verifyAdminToken }, async (request, reply) => {
        try {
            const users = userDb.getAll();
            return { users };
        } catch (error) {
            console.error('Get users error:', error);
            return reply.status(500).send({ error: 'Failed to get users' });
        }
    });

    /**
     * Delete user (admin only)
     */
    fastify.delete('/admin/users/:id', { preHandler: verifyAdminToken }, async (request, reply) => {
        const { id } = request.params;

        try {
            const result = userDb.deleteById(parseInt(id));

            if (result.changes === 0) {
                return reply.status(404).send({ error: 'User not found' });
            }

            return { message: 'User deleted successfully' };
        } catch (error) {
            console.error('Delete user error:', error);
            return reply.status(500).send({ error: 'Failed to delete user' });
        }
    });

    /**
     * Get dashboard stats (admin only)
     */
    fastify.get('/admin/stats', { preHandler: verifyAdminToken }, async (request, reply) => {
        try {
            const totalUsers = userDb.getCount();
            const users = userDb.getAll();

            // Recent signups (last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const recentSignups = users.filter(u => new Date(u.created_at) >= sevenDaysAgo).length;

            return {
                stats: {
                    totalUsers,
                    recentSignups,
                    lastUpdated: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error('Get stats error:', error);
            return reply.status(500).send({ error: 'Failed to get stats' });
        }
    });

    /**
     * Change admin password (admin only)
     */
    fastify.put('/admin/password', { preHandler: verifyAdminToken }, async (request, reply) => {
        const { currentPassword, newPassword } = request.body;

        if (!currentPassword || !newPassword) {
            return reply.status(400).send({ error: 'Current and new password are required' });
        }

        if (newPassword.length < 6) {
            return reply.status(400).send({ error: 'New password must be at least 6 characters' });
        }

        try {
            const admin = adminDb.findByUsername(request.admin.username);

            if (!adminDb.verifyPassword(admin, currentPassword)) {
                return reply.status(401).send({ error: 'Current password is incorrect' });
            }

            adminDb.updatePassword(admin.id, newPassword);

            return { message: 'Password updated successfully' };
        } catch (error) {
            console.error('Update password error:', error);
            return reply.status(500).send({ error: 'Failed to update password' });
        }
    });
}

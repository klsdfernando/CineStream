/**
 * Authentication Routes
 */

import jwt from 'jsonwebtoken';
import { userDb } from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'movie-app-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

/**
 * Generate JWT token
 */
function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * Verify JWT token middleware
 */
export function verifyToken(request, reply, done) {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.status(401).send({ error: 'No token provided' });
        return;
    }

    const token = authHeader.substring(7);

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        request.user = decoded;
        done();
    } catch (error) {
        reply.status(401).send({ error: 'Invalid token' });
    }
}

export default async function authRoutes(fastify) {
    /**
     * Sign Up - Create new user
     */
    fastify.post('/auth/signup', async (request, reply) => {
        const { firstName, lastName, birthday, email, password } = request.body;

        // Validation
        if (!firstName || !lastName || !birthday || !email || !password) {
            return reply.status(400).send({ error: 'All fields are required' });
        }

        if (password.length < 6) {
            return reply.status(400).send({ error: 'Password must be at least 6 characters' });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return reply.status(400).send({ error: 'Invalid email format' });
        }

        try {
            const user = userDb.create(firstName, lastName, birthday, email, password);
            const token = generateToken(user);

            return {
                message: 'User created successfully',
                user: {
                    id: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email
                },
                token
            };
        } catch (error) {
            if (error.message === 'Email already exists') {
                return reply.status(409).send({ error: 'Email already registered' });
            }
            console.error('Signup error:', error);
            return reply.status(500).send({ error: 'Failed to create user' });
        }
    });

    /**
     * Sign In - Login user
     */
    fastify.post('/auth/signin', async (request, reply) => {
        const { email, password } = request.body;

        if (!email || !password) {
            return reply.status(400).send({ error: 'Email and password are required' });
        }

        try {
            const user = userDb.findByEmail(email);

            if (!user) {
                return reply.status(401).send({ error: 'Invalid email or password' });
            }

            if (!userDb.verifyPassword(user, password)) {
                return reply.status(401).send({ error: 'Invalid email or password' });
            }

            const token = generateToken(user);

            return {
                message: 'Login successful',
                user: {
                    id: user.id,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    email: user.email,
                    profilePic: user.profile_pic,
                    bio: user.bio
                },
                token
            };
        } catch (error) {
            console.error('Signin error:', error);
            return reply.status(500).send({ error: 'Login failed' });
        }
    });

    /**
     * Get current user
     */
    fastify.get('/auth/me', { preHandler: verifyToken }, async (request, reply) => {
        try {
            const user = userDb.findById(request.user.id);

            if (!user) {
                return reply.status(404).send({ error: 'User not found' });
            }

            return {
                user: {
                    id: user.id,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    birthday: user.birthday,
                    email: user.email,
                    profilePic: user.profile_pic,
                    bio: user.bio,
                    createdAt: user.created_at
                }
            };
        } catch (error) {
            console.error('Get user error:', error);
            return reply.status(500).send({ error: 'Failed to get user' });
        }
    });

    /**
     * Update user profile
     */
    fastify.put('/auth/profile', { preHandler: verifyToken }, async (request, reply) => {
        const { firstName, lastName, birthday, bio, profilePic } = request.body;

        try {
            const updates = {};
            if (firstName !== undefined) updates.first_name = firstName;
            if (lastName !== undefined) updates.last_name = lastName;
            if (birthday !== undefined) updates.birthday = birthday;
            if (bio !== undefined) updates.bio = bio;
            if (profilePic !== undefined) updates.profile_pic = profilePic;

            userDb.updateProfile(request.user.id, updates);

            const user = userDb.findById(request.user.id);

            return {
                message: 'Profile updated successfully',
                user: {
                    id: user.id,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    birthday: user.birthday,
                    email: user.email,
                    profilePic: user.profile_pic,
                    bio: user.bio,
                    createdAt: user.created_at
                }
            };
        } catch (error) {
            console.error('Update profile error:', error);
            return reply.status(500).send({ error: 'Failed to update profile' });
        }
    });

    /**
     * Logout - Just returns success (token invalidation handled client-side)
     */
    fastify.post('/auth/logout', async (request, reply) => {
        return { message: 'Logged out successfully' };
    });
}

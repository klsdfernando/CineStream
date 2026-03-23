import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { movieRoutes } from './routes/movies.js';
import { searchRoutes } from './routes/search.js';
import { discoverRoutes } from './routes/discover.js';
import { tvRoutes } from './routes/tv.js';
import personRoutes from './routes/person.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import torrentRoutes from './routes/torrents.js';
import { animeRoutes } from './routes/anime.js';
import { reportsRoutes } from './routes/reports.js';
import versionsRoutes from './routes/versions.js';
import activityRoutes from './routes/activity.js';
import playlistRoutes from './routes/playlists.js';
import { initDatabase } from './db/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize database
initDatabase();

// Create Fastify instance
const fastify = Fastify({
    logger: {
        level: 'info',
        transport: {
            target: 'pino-pretty',
            options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
            },
        },
    },
    bodyLimit: 10 * 1024 * 1024, // 10MB limit for base64 images
});

// Register CORS
await fastify.register(cors, {
    origin: true, // Allow all origins for development
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
});

// Serve static files for admin panel
await fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../public'),
    prefix: '/admin/',
});

// Register multipart for file uploads
await fastify.register(multipart, {
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
        files: 3, // Max 3 files
    }
});

// Health check endpoint
fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
});

// API info endpoint
fastify.get('/api', async () => {
    return {
        name: 'CineStream API',
        version: '1.0.0',
        endpoints: {
            movies: {
                trending: 'GET /api/movies/trending',
                popular: 'GET /api/movies/popular',
                topRated: 'GET /api/movies/top-rated',
                nowPlaying: 'GET /api/movies/now-playing',
                upcoming: 'GET /api/movies/upcoming',
                random: 'GET /api/movies/random',
                details: 'GET /api/movies/:id',
                credits: 'GET /api/movies/:id/credits',
                images: 'GET /api/movies/:id/images',
                videos: 'GET /api/movies/:id/videos',
                similar: 'GET /api/movies/:id/similar',
                recommendations: 'GET /api/movies/:id/recommendations',
            },
            tv: {
                details: 'GET /api/tv/:id',
                season: 'GET /api/tv/:id/season/:seasonNumber',
                credits: 'GET /api/tv/:id/credits',
                similar: 'GET /api/tv/:id/similar',
            },
            auth: {
                signup: 'POST /api/auth/signup',
                signin: 'POST /api/auth/signin',
                me: 'GET /api/auth/me',
                logout: 'POST /api/auth/logout',
            },
            admin: {
                login: 'POST /api/admin/login',
                users: 'GET /api/admin/users',
                deleteUser: 'DELETE /api/admin/users/:id',
                stats: 'GET /api/admin/stats',
            },
            search: 'GET /api/search?query=',
            discover: 'GET /api/discover?genre=&year=&sortBy=',
            genres: 'GET /api/genres',
        },
    };
});

// Register routes
await fastify.register(movieRoutes);
await fastify.register(tvRoutes);
await fastify.register(animeRoutes);
await fastify.register(searchRoutes);
await fastify.register(discoverRoutes);
await fastify.register(personRoutes, { prefix: '/api' });
await fastify.register(authRoutes, { prefix: '/api' });
await fastify.register(adminRoutes, { prefix: '/api' });
await fastify.register(torrentRoutes, { prefix: '/api' });
await fastify.register(reportsRoutes);
await fastify.register(versionsRoutes);
await fastify.register(activityRoutes, { prefix: '/api' });
await fastify.register(playlistRoutes, { prefix: '/api' });

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);

    reply.status(error.statusCode || 500).send({
        error: error.message || 'Internal Server Error',
        statusCode: error.statusCode || 500,
    });
});

// Start server
const start = async () => {
    try {
        await fastify.listen({ port: config.port, host: config.host });
        console.log(`
╔════════════════════════════════════════════════════════════╗
║                    CineStream API Server                   ║
╠════════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${config.port}                 ║
║  API docs at:       http://localhost:${config.port}/api             ║
║  Admin panel at:    http://localhost:${config.port}/admin/          ║
║  Health check:      http://localhost:${config.port}/health          ║
╚════════════════════════════════════════════════════════════╝
    `);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();

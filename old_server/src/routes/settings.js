/**
 * Server Settings Routes
 * Admin can view/update server configuration (.env) from the admin panel
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { verifyAdminToken } from './admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../../.env');

/**
 * Parse .env file into an object
 */
function readEnvFile() {
    try {
        if (!fs.existsSync(envPath)) {
            return {};
        }
        const content = fs.readFileSync(envPath, 'utf-8');
        const env = {};
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex === -1) continue;
            const key = trimmed.substring(0, eqIndex).trim();
            const value = trimmed.substring(eqIndex + 1).trim();
            env[key] = value;
        }
        return env;
    } catch (error) {
        console.error('[Settings] Error reading .env:', error.message);
        return {};
    }
}

/**
 * Write settings object back to .env file
 */
function writeEnvFile(settings) {
    const lines = [
        '# ═══════════════════════════════════════════════════════',
        '#  CineStream Server - Configuration',
        `#  Last updated: ${new Date().toISOString()}`,
        '# ═══════════════════════════════════════════════════════',
        '',
        `PORT=${settings.PORT || '3001'}`,
        `HOST=${settings.HOST || '0.0.0.0'}`,
        `TMDB_API_KEY=${settings.TMDB_API_KEY || ''}`,
        `JWT_SECRET=${settings.JWT_SECRET || ''}`,
        `ADMIN_PASSWORD=${settings.ADMIN_PASSWORD || 'admin123'}`,
    ];
    fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf-8');
}

// Allowed settings keys and their metadata
const SETTINGS_SCHEMA = [
    { key: 'PORT', label: 'Server Port', type: 'text', sensitive: false, placeholder: '3001' },
    { key: 'HOST', label: 'Server Host', type: 'text', sensitive: false, placeholder: '0.0.0.0' },
    { key: 'TMDB_API_KEY', label: 'TMDB API Key', type: 'password', sensitive: true, placeholder: 'Enter your TMDB API key' },
    { key: 'JWT_SECRET', label: 'JWT Secret', type: 'password', sensitive: true, placeholder: 'Long random string for token signing' },
    { key: 'ADMIN_PASSWORD', label: 'Admin Password', type: 'password', sensitive: true, placeholder: 'Admin login password' },
];

export default async function settingsRoutes(fastify) {

    /**
     * GET /api/admin/settings - Get current server settings
     */
    fastify.get('/admin/settings', { preHandler: verifyAdminToken }, async (request, reply) => {
        try {
            const env = readEnvFile();
            const hasEnvFile = fs.existsSync(envPath);

            // Return settings with sensitive values masked
            const settings = SETTINGS_SCHEMA.map(field => ({
                key: field.key,
                label: field.label,
                type: field.type,
                sensitive: field.sensitive,
                placeholder: field.placeholder,
                value: field.sensitive
                    ? (env[field.key] ? '••••••••' : '')  // Mask sensitive values
                    : (env[field.key] || ''),
                hasValue: !!env[field.key],
            }));

            return {
                hasEnvFile,
                settings,
                serverInfo: {
                    nodeVersion: process.version,
                    uptime: Math.floor(process.uptime()),
                    memoryUsage: Math.round(process.memoryUsage().rss / 1024 / 1024),
                    platform: process.platform,
                    envPath: envPath,
                }
            };
        } catch (error) {
            console.error('[Settings] Error getting settings:', error);
            return reply.status(500).send({ error: 'Failed to load settings' });
        }
    });

    /**
     * PUT /api/admin/settings - Update server settings
     * Only updates the fields that are provided
     */
    fastify.put('/admin/settings', { preHandler: verifyAdminToken }, async (request, reply) => {
        try {
            const updates = request.body;

            if (!updates || typeof updates !== 'object') {
                return reply.status(400).send({ error: 'Invalid settings data' });
            }

            // Read current settings
            const current = readEnvFile();

            // Only update allowed keys
            const allowedKeys = SETTINGS_SCHEMA.map(s => s.key);
            let changeCount = 0;

            for (const [key, value] of Object.entries(updates)) {
                if (allowedKeys.includes(key) && value !== undefined && value !== '••••••••') {
                    current[key] = value;
                    changeCount++;
                }
            }

            if (changeCount === 0) {
                return reply.status(400).send({ error: 'No valid settings to update' });
            }

            // Write back to .env file
            writeEnvFile(current);

            console.log(`[Settings] ${changeCount} setting(s) updated by admin`);

            return {
                success: true,
                message: `${changeCount} setting(s) updated. Restart the server for changes to take effect.`,
                restartRequired: true,
            };
        } catch (error) {
            console.error('[Settings] Error updating settings:', error);
            return reply.status(500).send({ error: 'Failed to update settings' });
        }
    });

    /**
     * POST /api/admin/settings/restart - Restart the server (PM2)
     */
    fastify.post('/admin/settings/restart', { preHandler: verifyAdminToken }, async (request, reply) => {
        try {
            reply.send({ success: true, message: 'Server restarting...' });

            // Delay restart so the response can be sent first
            setTimeout(() => {
                console.log('[Settings] Server restart requested by admin');
                process.exit(0); // PM2 will auto-restart
            }, 1000);
        } catch (error) {
            return reply.status(500).send({ error: 'Failed to restart server' });
        }
    });

    /**
     * GET /api/admin/settings/status - Quick server status check
     */
    fastify.get('/admin/settings/status', { preHandler: verifyAdminToken }, async (request, reply) => {
        const env = readEnvFile();
        const uptimeSec = Math.floor(process.uptime());
        const hours = Math.floor(uptimeSec / 3600);
        const minutes = Math.floor((uptimeSec % 3600) / 60);

        return {
            status: 'running',
            uptime: `${hours}h ${minutes}m`,
            uptimeSeconds: uptimeSec,
            memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
            nodeVersion: process.version,
            configured: {
                tmdbKey: !!env.TMDB_API_KEY,
                jwtSecret: !!env.JWT_SECRET,
                port: env.PORT || '3001',
            }
        };
    });
}

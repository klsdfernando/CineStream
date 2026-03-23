/**
 * Version Control Routes
 * Admin can block specific app versions with warning or lockout mode
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Initialize database
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'versions.db'));

// Create versions table
db.exec(`
    CREATE TABLE IF NOT EXISTS version_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT NOT NULL UNIQUE,
        mode TEXT NOT NULL CHECK(mode IN ('warning', 'lockout')),
        message TEXT NOT NULL,
        download_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

console.log('[Versions] Database initialized');

export default async function versionsRoutes(fastify) {

    // Public: Check if a version is blocked
    fastify.get('/api/versions/check/:version', async (request, reply) => {
        const { version } = request.params;

        try {
            const rule = db.prepare('SELECT * FROM version_rules WHERE version = ?').get(version);

            if (rule) {
                return {
                    blocked: true,
                    mode: rule.mode,
                    message: rule.message,
                    downloadUrl: rule.download_url
                };
            }

            return { blocked: false };
        } catch (error) {
            console.error('[Versions] Check error:', error);
            return reply.status(500).send({ error: 'Failed to check version' });
        }
    });

    // Admin: Get all version rules
    fastify.get('/api/admin/versions', async (request, reply) => {
        // Check admin auth
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }

        try {
            const rules = db.prepare('SELECT * FROM version_rules ORDER BY created_at DESC').all();
            return { rules };
        } catch (error) {
            console.error('[Versions] List error:', error);
            return reply.status(500).send({ error: 'Failed to list version rules' });
        }
    });

    // Admin: Add version rule
    fastify.post('/api/admin/versions', async (request, reply) => {
        // Check admin auth
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { version, mode, message, downloadUrl } = request.body;

        if (!version || !mode || !message) {
            return reply.status(400).send({ error: 'Version, mode, and message are required' });
        }

        if (!['warning', 'lockout'].includes(mode)) {
            return reply.status(400).send({ error: 'Mode must be "warning" or "lockout"' });
        }

        try {
            const stmt = db.prepare(`
                INSERT INTO version_rules (version, mode, message, download_url)
                VALUES (?, ?, ?, ?)
            `);

            const result = stmt.run(version, mode, message, downloadUrl || null);

            return {
                success: true,
                rule: {
                    id: result.lastInsertRowid,
                    version,
                    mode,
                    message,
                    download_url: downloadUrl
                }
            };
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return reply.status(400).send({ error: 'Version rule already exists' });
            }
            console.error('[Versions] Add error:', error);
            return reply.status(500).send({ error: 'Failed to add version rule' });
        }
    });

    // Admin: Update version rule
    fastify.put('/api/admin/versions/:id', async (request, reply) => {
        // Check admin auth
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;
        const { version, mode, message, downloadUrl } = request.body;

        try {
            const stmt = db.prepare(`
                UPDATE version_rules 
                SET version = ?, mode = ?, message = ?, download_url = ?
                WHERE id = ?
            `);

            const result = stmt.run(version, mode, message, downloadUrl || null, id);

            if (result.changes === 0) {
                return reply.status(404).send({ error: 'Rule not found' });
            }

            return { success: true };
        } catch (error) {
            console.error('[Versions] Update error:', error);
            return reply.status(500).send({ error: 'Failed to update version rule' });
        }
    });

    // Admin: Delete version rule
    fastify.delete('/api/admin/versions/:id', async (request, reply) => {
        // Check admin auth
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;

        try {
            const stmt = db.prepare('DELETE FROM version_rules WHERE id = ?');
            const result = stmt.run(id);

            if (result.changes === 0) {
                return reply.status(404).send({ error: 'Rule not found' });
            }

            return { success: true };
        } catch (error) {
            console.error('[Versions] Delete error:', error);
            return reply.status(500).send({ error: 'Failed to delete version rule' });
        }
    });
}

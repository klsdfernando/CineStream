import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import Database from 'better-sqlite3';

// Initialize database
const dbPath = path.join(process.cwd(), 'data', 'reports.db');
const uploadsDir = path.join(process.cwd(), 'uploads', 'reports');

// Ensure directories exist
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

const db = new Database(dbPath);

// Create reports table if not exists
db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        images TEXT DEFAULT '[]',
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
`);

console.log('[Reports] Database initialized');

/**
 * Register reports routes
 * @param {import('fastify').FastifyInstance} fastify
 */
export async function reportsRoutes(fastify) {

    // Submit a new report
    fastify.post('/api/reports', async (request, reply) => {
        try {
            const parts = request.parts();
            let name = '';
            let subject = '';
            let message = '';
            const imageFilenames = [];

            for await (const part of parts) {
                if (part.type === 'file' && part.filename) {
                    // Save image file
                    const filename = `${Date.now()}-${part.filename}`;
                    const filePath = path.join(uploadsDir, filename);

                    // Use pipeline for proper stream handling
                    await pipeline(part.file, fs.createWriteStream(filePath));

                    imageFilenames.push(filename);
                } else if (part.type === 'field') {
                    // Handle form fields
                    if (part.fieldname === 'name') name = part.value;
                    if (part.fieldname === 'subject') subject = part.value;
                    if (part.fieldname === 'message') message = part.value;
                }
            }

            // Validate required fields
            if (!name || !subject || !message) {
                return reply.status(400).send({
                    error: 'Name, subject, and message are required'
                });
            }

            // Insert into database
            const stmt = db.prepare(`
                INSERT INTO reports (name, subject, message, images)
                VALUES (?, ?, ?, ?)
            `);

            const result = stmt.run(name, subject, message, JSON.stringify(imageFilenames));

            console.log(`[Reports] New report submitted: ${subject} (ID: ${result.lastInsertRowid})`);

            return {
                success: true,
                id: result.lastInsertRowid,
                message: 'Report submitted successfully'
            };
        } catch (error) {
            console.error('[Reports] Error submitting report:', error);
            return reply.status(500).send({
                error: 'Failed to submit report'
            });
        }
    });

    // Get all reports (admin endpoint)
    fastify.get('/api/reports', async (request, reply) => {
        try {
            const stmt = db.prepare('SELECT * FROM reports ORDER BY createdAt DESC');
            const reports = stmt.all();

            // Parse images JSON for each report
            return reports.map(report => ({
                ...report,
                images: JSON.parse(report.images || '[]')
            }));
        } catch (error) {
            console.error('[Reports] Error fetching reports:', error);
            return reply.status(500).send({
                error: 'Failed to fetch reports'
            });
        }
    });

    // Serve report images
    fastify.get('/api/reports/images/:filename', async (request, reply) => {
        const { filename } = request.params;
        const filePath = path.join(uploadsDir, filename);

        if (!fs.existsSync(filePath)) {
            return reply.status(404).send({ error: 'Image not found' });
        }

        // Stream the file directly
        const stream = fs.createReadStream(filePath);
        const ext = path.extname(filename).toLowerCase();
        const contentTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        };

        reply.header('Content-Type', contentTypes[ext] || 'application/octet-stream');
        return reply.send(stream);
    });
}

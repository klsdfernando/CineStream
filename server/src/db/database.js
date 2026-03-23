/**
 * Database Setup and Connection
 */

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file path
const dbPath = path.join(__dirname, '../../data/app.db');

// Create database connection
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('journal_mode = WAL');

/**
 * Initialize database schema
 */
export function initDatabase() {
    // Create users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            birthday TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            profile_pic TEXT DEFAULT NULL,
            bio TEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Add profile_pic and bio columns if they don't exist (for existing databases)
    try {
        db.exec(`ALTER TABLE users ADD COLUMN profile_pic TEXT DEFAULT NULL`);
    } catch (e) { /* Column already exists */ }
    try {
        db.exec(`ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL`);
    } catch (e) { /* Column already exists */ }

    // Create user_activity table (likes, dislikes, watched history)
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            media_id TEXT NOT NULL,
            media_type TEXT NOT NULL, -- 'movie' or 'tv'
            title TEXT NOT NULL,
            poster_path TEXT,
            action_type TEXT NOT NULL, -- 'like', 'dislike', or 'watched'
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, media_id, action_type)
        )
    `);

    // Create playlists table
    db.exec(`
        CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            is_public BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Create playlist_items table
    db.exec(`
        CREATE TABLE IF NOT EXISTS playlist_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id INTEGER NOT NULL,
            media_id TEXT NOT NULL,
            media_type TEXT NOT NULL, -- 'movie' or 'tv'
            title TEXT NOT NULL,
            poster_path TEXT,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
            UNIQUE(playlist_id, media_id)
        )
    `);

    // Create admins table
    db.exec(`
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create default admin if not exists
    const adminExists = db.prepare('SELECT id FROM admins WHERE username = ?').get('admin');
    if (!adminExists) {
        const passwordHash = bcrypt.hashSync('admin123', 10);
        db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run('admin', passwordHash);
        console.log('[Database] Default admin created (username: admin, password: admin123)');
    }

    console.log('[Database] Initialized successfully');
}

// User operations
export const userDb = {
    /**
     * Create a new user
     */
    create(firstName, lastName, birthday, email, password) {
        const passwordHash = bcrypt.hashSync(password, 10);
        try {
            const result = db.prepare(`
                INSERT INTO users (first_name, last_name, birthday, email, password_hash)
                VALUES (?, ?, ?, ?, ?)
            `).run(firstName, lastName, birthday, email, passwordHash);
            return { id: result.lastInsertRowid, firstName, lastName, email };
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                throw new Error('Email already exists');
            }
            throw error;
        }
    },

    /**
     * Find user by email
     */
    findByEmail(email) {
        return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    },

    /**
     * Find user by ID
     */
    findById(id) {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        if (user) {
            // Don't return password hash
            const { password_hash, ...userWithoutPassword } = user;
            return userWithoutPassword;
        }
        return null;
    },

    /**
     * Update user profile
     */
    updateProfile(id, updates) {
        const allowedFields = ['first_name', 'last_name', 'birthday', 'bio', 'profile_pic'];
        const setClauses = [];
        const values = [];

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key) && value !== undefined) {
                setClauses.push(`${key} = ?`);
                values.push(value);
            }
        }

        if (setClauses.length === 0) return null;

        setClauses.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        const sql = `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`;
        return db.prepare(sql).run(...values);
    },

    /**
     * Get all users
     */
    getAll() {
        return db.prepare(`
            SELECT id, first_name, last_name, birthday, email, profile_pic, bio, created_at
            FROM users
            ORDER BY created_at DESC
        `).all();
    },

    /**
     * Delete user by ID
     */
    deleteById(id) {
        return db.prepare('DELETE FROM users WHERE id = ?').run(id);
    },

    /**
     * Get user count
     */
    getCount() {
        return db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    },

    /**
     * Verify password
     */
    verifyPassword(user, password) {
        return bcrypt.compareSync(password, user.password_hash);
    }
};

// Admin operations
export const adminDb = {
    /**
     * Find admin by username
     */
    findByUsername(username) {
        return db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
    },

    /**
     * Verify password
     */
    verifyPassword(admin, password) {
        return bcrypt.compareSync(password, admin.password_hash);
    },

    /**
     * Update admin password
     */
    updatePassword(id, newPassword) {
        const passwordHash = bcrypt.hashSync(newPassword, 10);
        return db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(passwordHash, id);
    }
};

// Activity operations
export const activityDb = {
    /**
     * Record a user action (like, dislike, watched)
     */
    recordAction(userId, mediaId, mediaType, title, posterPath, actionType) {
        // For likes/dislikes, we need to toggle (remove opposite action if exists, remove same action if clicking twice to undo)
        if (actionType === 'like' || actionType === 'dislike') {
            const oppositeAction = actionType === 'like' ? 'dislike' : 'like';

            // Try to delete opposite action if it exists
            db.prepare(`
                DELETE FROM user_activity 
                WHERE user_id = ? AND media_id = ? AND action_type = ?
            `).run(userId, mediaId, oppositeAction);

            // Check if exact same action already exists (user is toggling it off)
            const existing = db.prepare(`
                SELECT id FROM user_activity 
                WHERE user_id = ? AND media_id = ? AND action_type = ?
            `).get(userId, mediaId, actionType);

            if (existing) {
                // Remove the action
                db.prepare(`DELETE FROM user_activity WHERE id = ?`).run(existing.id);
                return { action: 'removed', type: actionType };
            }
        } else if (actionType === 'watched') {
            // For watch history, if it already exists, just update the timestamp
            const existing = db.prepare(`
                SELECT id FROM user_activity 
                WHERE user_id = ? AND media_id = ? AND action_type = 'watched'
            `).get(userId, mediaId);

            if (existing) {
                db.prepare(`
                    UPDATE user_activity SET created_at = CURRENT_TIMESTAMP WHERE id = ?
                `).run(existing.id);
                return { action: 'updated', type: 'watched' };
            }
        }

        // Insert new action
        try {
            db.prepare(`
                INSERT INTO user_activity (user_id, media_id, media_type, title, poster_path, action_type)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(userId, mediaId, mediaType, title, posterPath, actionType);

            return { action: 'added', type: actionType };
        } catch (error) {
            console.error('CRITICAL SQLITE ERROR [Database] Error recording activity:', error.message, error.stack);
            throw error;
        }
    },

    /**
     * Get user history by action type
     */
    getUserActivity(userId, actionType, limit = 50) {
        return db.prepare(`
            SELECT * FROM user_activity 
            WHERE user_id = ? AND action_type = ?
            ORDER BY created_at DESC
            LIMIT ?
        `).all(userId, actionType, limit);
    },

    /**
     * Get user's interaction status for a specific media item
     */
    getMediaInteraction(userId, mediaId) {
        const item = db.prepare(`
            SELECT action_type FROM user_activity 
            WHERE user_id = ? AND media_id = ? AND (action_type = 'like' OR action_type = 'dislike')
        `).get(userId, mediaId);

        return item ? item.action_type : null;
    }
};

// Playlist operations
export const playlistDb = {
    /**
     * Create a new playlist
     */
    createPlaylist(userId, name, description = '', isPublic = false) {
        const result = db.prepare(`
            INSERT INTO playlists (user_id, name, description, is_public)
            VALUES (?, ?, ?, ?)
        `).run(userId, name, description, isPublic ? 1 : 0);

        return { id: result.lastInsertRowid, name, description };
    },

    /**
     * Get all playlists for a user
     */
    getUserPlaylists(userId) {
        // Get playlists with item counts
        return db.prepare(`
            SELECT p.*, COUNT(pi.id) as item_count 
            FROM playlists p
            LEFT JOIN playlist_items pi ON p.id = pi.playlist_id
            WHERE p.user_id = ?
            GROUP BY p.id
            ORDER BY p.updated_at DESC
        `).all(userId);
    },

    /**
     * Get a specific playlist with its items
     */
    getPlaylistWithItems(playlistId, userId) {
        const playlist = db.prepare(`
            SELECT * FROM playlists WHERE id = ? AND user_id = ?
        `).get(playlistId, userId);

        if (!playlist) return null;

        const items = db.prepare(`
            SELECT * FROM playlist_items 
            WHERE playlist_id = ?
            ORDER BY added_at DESC
        `).all(playlistId);

        playlist.items = items;
        return playlist;
    },

    /**
     * Add item to playlist
     */
    addItem(playlistId, userId, mediaId, mediaType, title, posterPath) {
        // First verify ownership
        const playlist = db.prepare(`
            SELECT id FROM playlists WHERE id = ? AND user_id = ?
        `).get(playlistId, userId);

        if (!playlist) throw new Error('Playlist not found or unauthorized');

        try {
            const result = db.prepare(`
                INSERT INTO playlist_items (playlist_id, media_id, media_type, title, poster_path)
                VALUES (?, ?, ?, ?, ?)
            `).run(playlistId, mediaId, mediaType, title, posterPath);

            // Update playlist updated_at
            db.prepare(`UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(playlistId);

            return { id: result.lastInsertRowid, success: true };
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return { success: false, message: 'Item already in playlist' };
            }
            throw error;
        }
    },

    /**
     * Remove item from playlist
     */
    removeItem(playlistId, userId, mediaId) {
        // Verify ownership
        const playlist = db.prepare(`
            SELECT id FROM playlists WHERE id = ? AND user_id = ?
        `).get(playlistId, userId);

        if (!playlist) throw new Error('Playlist not found or unauthorized');

        db.prepare(`
            DELETE FROM playlist_items 
            WHERE playlist_id = ? AND media_id = ?
        `).run(playlistId, mediaId);

        // Update playlist updated_at
        db.prepare(`UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(playlistId);

        return { success: true };
    },

    /**
     * Delete playlist
     */
    deletePlaylist(playlistId, userId) {
        const result = db.prepare(`
            DELETE FROM playlists WHERE id = ? AND user_id = ?
        `).run(playlistId, userId);

        return { success: result.changes > 0 };
    }
};

export default db;

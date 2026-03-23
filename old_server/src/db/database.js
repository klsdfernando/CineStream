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

export default db;

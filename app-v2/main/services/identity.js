/**
 * Identity helpers
 *
 * Answers "who is making this request" for the rest of the main process:
 *   - a signed-in Supabase user, or
 *   - an anonymous device, identified by a random id kept in userData.
 *
 * Guests only ever get watch history. Likes, favorites and playlists
 * require an account.
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { supabase } = require('./supabase');

const DEVICE_FILE = path.join(app.getPath('userData'), 'device-id.json');

let cachedDeviceId = null;

function getDeviceId() {
    if (cachedDeviceId) return cachedDeviceId;

    try {
        if (fs.existsSync(DEVICE_FILE)) {
            const saved = JSON.parse(fs.readFileSync(DEVICE_FILE, 'utf8'));
            // the DB rejects anything shorter than 16 chars
            if (typeof saved?.deviceId === 'string' && saved.deviceId.length >= 16) {
                cachedDeviceId = saved.deviceId;
                return cachedDeviceId;
            }
        }
    } catch (e) {
        console.warn('[Identity] Could not read device id, generating a new one:', e.message);
    }

    cachedDeviceId = `dev_${crypto.randomBytes(24).toString('hex')}`;
    try {
        fs.writeFileSync(
            DEVICE_FILE,
            JSON.stringify({ deviceId: cachedDeviceId, createdAt: new Date().toISOString() }, null, 2),
            'utf8'
        );
    } catch (e) {
        console.error('[Identity] Could not persist device id:', e.message);
    }
    return cachedDeviceId;
}

/**
 * Resolve the signed-in user, or null for a guest.
 * Reads the in-memory session first so this stays off the network.
 */
async function getCurrentUser() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return null;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) return session.user;

        const { data: { user } } = await supabase.auth.getUser();
        return user || null;
    } catch (e) {
        return null;
    }
}

/**
 * Either { userId } for an account or { deviceId } for a guest.
 */
async function getActor() {
    const user = await getCurrentUser();
    if (user) return { isGuest: false, userId: user.id, deviceId: null };
    return { isGuest: true, userId: null, deviceId: getDeviceId() };
}

module.exports = { getDeviceId, getCurrentUser, getActor };

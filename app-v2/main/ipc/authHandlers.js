/**
 * Auth IPC Handlers
 *
 * Supabase Auth only. The app needs a connection to work, so there is no
 * local user database — a login either produces a real Supabase session
 * or it fails loudly.
 *
 * Only the tokens are cached on disk, so the session survives a restart.
 * If those tokens can no longer be exchanged for a live session we clear
 * them and report signed-out, rather than showing a signed-in UI that the
 * database would treat as a guest.
 */

const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { supabase } = require('../services/supabase');

const SESSION_FILE = path.join(app.getPath('userData'), 'user-session.json');

function savePersistentSession(sessionData) {
    try {
        fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2), 'utf8');
    } catch (e) {
        console.error('[Auth] Error saving session file:', e.message);
    }
}

function loadPersistentSession() {
    try {
        if (fs.existsSync(SESSION_FILE)) {
            return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('[Auth] Error loading session file:', e.message);
    }
    return null;
}

function clearPersistentSession() {
    try {
        if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
    } catch (e) {}
}

function supabaseConfigured() {
    return !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

/**
 * Supabase auth errors are terse and often mention server-side concepts
 * ("email rate limit exceeded") that mean nothing to someone using the app.
 * Translate the ones users actually hit into something actionable.
 */
const AUTH_ERROR_MESSAGES = {
    invalid_credentials: 'Incorrect email or password.',
    email_not_confirmed: 'This email has not been confirmed yet. Confirm it from your inbox, or turn off "Confirm email" in the Supabase Auth settings.',
    over_email_send_rate_limit: 'Supabase has sent too many emails recently. Wait about an hour, or turn off "Confirm email" in the Supabase Auth settings so it stops sending them.',
    over_request_rate_limit: 'Too many attempts. Please wait a moment and try again.',
    user_already_exists: 'That email is already registered. Try signing in instead.',
    email_exists: 'That email is already registered. Try signing in instead.',
    weak_password: 'Please choose a stronger password (at least 6 characters).',
    signup_disabled: 'New sign-ups are disabled for this project.'
};

function friendlyAuthError(error) {
    if (!error) return 'Something went wrong. Please try again.';

    const code = error.code || error.error_code;
    if (code && AUTH_ERROR_MESSAGES[code]) return AUTH_ERROR_MESSAGES[code];

    const msg = (error.message || '').toLowerCase();
    if (msg.includes('rate limit')) return AUTH_ERROR_MESSAGES.over_email_send_rate_limit;
    if (msg.includes('not confirmed')) return AUTH_ERROR_MESSAGES.email_not_confirmed;
    if (msg.includes('invalid login credentials')) return AUTH_ERROR_MESSAGES.invalid_credentials;
    if (msg.includes('already registered')) return AUTH_ERROR_MESSAGES.user_already_exists;
    if (msg.includes('for security purposes')) return 'Too many attempts in a row. Wait a few seconds and try again.';
    if (msg.includes('fetch failed') || msg.includes('network') ||
        msg.includes('enotfound') || msg.includes('eai_again')) {
        return 'Cannot reach the server. Check your internet connection.';
    }

    return error.message || 'Something went wrong. Please try again.';
}

/**
 * Remove the JSON stores the app used before everything moved to Supabase.
 * local-auth-users.json is the urgent one — it held passwords in plaintext.
 */
function removeLegacyLocalStores() {
    const legacy = [
        'local-auth-users.json',
        'local-activity-db.json',
        'local-playlists-db.json'
    ];

    legacy.forEach(name => {
        const file = path.join(app.getPath('userData'), name);
        try {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
                console.log(`[Auth] Removed legacy local store: ${name}`);
            }
        } catch (e) {
            console.warn(`[Auth] Could not remove ${name}:`, e.message);
        }
    });
}

/**
 * Make sure the signed-in user has a profiles row.
 * Accounts created before the schema was rebuilt won't have one, because
 * the auto-create trigger only fires for brand new signups.
 */
async function ensureProfile(user) {
    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        if (profile) return profile;

        const meta = user.user_metadata || {};
        const { data: created, error } = await supabase
            .from('profiles')
            .upsert({
                id: user.id,
                first_name: meta.first_name || '',
                last_name: meta.last_name || '',
                birthday: meta.birthday || '',
                email: user.email || ''
            }, { onConflict: 'id' })
            .select()
            .single();

        if (error) {
            console.warn('[Auth] Could not create profile row:', error.message);
            return null;
        }
        return created;
    } catch (e) {
        console.warn('[Auth] ensureProfile failed:', e.message);
        return null;
    }
}

function buildUser(user, profile) {
    return {
        id: user.id,
        firstName: profile?.first_name || user.user_metadata?.first_name || 'User',
        lastName: profile?.last_name || user.user_metadata?.last_name || '',
        birthday: profile?.birthday || user.user_metadata?.birthday || '',
        email: user.email,
        profilePic: profile?.profile_pic || null,
        bio: profile?.bio || null,
        createdAt: user.created_at
    };
}

function persist(user, session) {
    const sessionData = {
        user,
        token: session?.access_token || null,
        refreshToken: session?.refresh_token || null,
        savedAt: new Date().toISOString()
    };
    savePersistentSession(sessionData);
    return sessionData;
}

function registerAuthHandlers() {
    removeLegacyLocalStores();

    /**
     * Re-establish the Supabase session on startup.
     * The renderer must call this every launch — without it the main
     * process has no auth and every query would run as an anonymous guest.
     */
    ipcMain.handle('auth:restoreSession', async () => {
        try {
            if (!supabaseConfigured()) {
                return { success: false, error: 'Supabase is not configured' };
            }

            const saved = loadPersistentSession();
            if (!saved?.refreshToken) {
                clearPersistentSession();
                return { success: false };
            }

            const { data, error } = await supabase.auth.setSession({
                access_token: saved.token,
                refresh_token: saved.refreshToken
            });

            if (error || !data?.user) {
                console.warn('[Auth] Stored session is no longer valid:', error?.message || 'no user');
                clearPersistentSession();
                await supabase.auth.signOut().catch(() => {});
                return { success: false, error: 'Session expired, please sign in again' };
            }

            const profile = await ensureProfile(data.user);
            const userObj = buildUser(data.user, profile);
            const sessionData = persist(userObj, data.session);

            console.log('[Auth] Session restored for', userObj.email);
            return { success: true, user: userObj, token: sessionData.token };
        } catch (error) {
            console.error('[Auth] restoreSession failed:', error.message);
            return { success: false, error: 'Could not restore session' };
        }
    });

    ipcMain.handle('auth:signup', async (_, { firstName, lastName, birthday, email, password }) => {
        try {
            if (!firstName || !lastName || !email || !password) {
                return { error: 'First name, last name, email, and password are required' };
            }
            if (password.length < 6) {
                return { error: 'Password must be at least 6 characters' };
            }
            if (!supabaseConfigured()) {
                return { error: 'Supabase is not configured' };
            }

            const cleanEmail = email.trim().toLowerCase();
            const { data, error } = await supabase.auth.signUp({
                email: cleanEmail,
                password,
                options: {
                    data: { first_name: firstName, last_name: lastName, birthday: birthday || '' }
                }
            });

            if (error) {
                console.warn('[Auth] Sign up rejected:', error.message);
                return { error: friendlyAuthError(error) };
            }
            if (!data?.user) return { error: 'Sign up failed, please try again' };

            // With email confirmation enabled Supabase returns no session yet.
            if (!data.session) {
                return { error: 'Check your email to confirm your account, then sign in.' };
            }

            const profile = await ensureProfile(data.user);
            const userObj = buildUser(data.user, profile);
            const sessionData = persist(userObj, data.session);

            return { message: 'User created successfully', user: userObj, token: sessionData.token };
        } catch (error) {
            console.error('[Auth] Signup error:', error.message);
            return { error: 'Failed to create user' };
        }
    });

    ipcMain.handle('auth:signin', async (_, { email, password }) => {
        try {
            if (!email || !password) {
                return { error: 'Email and password are required' };
            }
            if (!supabaseConfigured()) {
                return { error: 'Supabase is not configured' };
            }

            const cleanEmail = email.trim().toLowerCase();
            const { data, error } = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password
            });

            if (error) {
                console.warn('[Auth] Sign in rejected:', error.message);
                return { error: friendlyAuthError(error) };
            }
            if (!data?.user || !data?.session) {
                return { error: 'Login failed, please try again' };
            }

            const profile = await ensureProfile(data.user);
            const userObj = buildUser(data.user, profile);
            const sessionData = persist(userObj, data.session);

            console.log('[Auth] Signed in as', userObj.email);
            return { message: 'Login successful', user: userObj, token: sessionData.token };
        } catch (error) {
            console.error('[Auth] Signin error:', error.message);
            return { error: 'Login failed' };
        }
    });

    ipcMain.handle('auth:getUser', async () => {
        try {
            if (!supabaseConfigured()) return { error: 'Not authenticated' };

            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) return { error: 'Not authenticated' };

            const profile = await ensureProfile(user);
            return { user: buildUser(user, profile) };
        } catch (error) {
            return { error: 'Failed to get user' };
        }
    });

    ipcMain.handle('auth:updateProfile', async (_, { firstName, lastName, birthday, bio, profilePic }) => {
        try {
            if (!supabaseConfigured()) return { error: 'Supabase is not configured' };

            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) return { error: 'Not authenticated', requiresAuth: true };

            const updates = { id: user.id, email: user.email || '' };
            if (firstName !== undefined) updates.first_name = firstName;
            if (lastName !== undefined) updates.last_name = lastName;
            if (birthday !== undefined) updates.birthday = birthday;
            if (bio !== undefined) updates.bio = bio;
            if (profilePic !== undefined) updates.profile_pic = profilePic;

            // upsert so this still works if the profile row is missing
            const { data: profile, error } = await supabase
                .from('profiles')
                .upsert(updates, { onConflict: 'id' })
                .select()
                .single();

            if (error) return { error: error.message };

            const userObj = buildUser(user, profile);
            const saved = loadPersistentSession();
            if (saved) savePersistentSession({ ...saved, user: userObj });

            return { message: 'Profile updated successfully', user: userObj };
        } catch (error) {
            console.error('[Auth] Update profile error:', error.message);
            return { error: 'Failed to update profile' };
        }
    });

    ipcMain.handle('auth:signout', async () => {
        try {
            if (supabaseConfigured()) {
                await supabase.auth.signOut().catch(() => {});
            }
        } catch (e) {}
        clearPersistentSession();
        return { message: 'Logged out successfully' };
    });

    console.log('[IPC] Auth handlers registered');
}

module.exports = { registerAuthHandlers };

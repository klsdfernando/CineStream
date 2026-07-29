/**
 * Supabase Client Initialization
 * Single shared client for the entire Electron main process
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env');
}

// Polyfill WebSocket for Supabase Realtime in Node < 21
if (typeof global.WebSocket === 'undefined') {
    global.WebSocket = require('ws');
}

const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // Desktop app, no URL detection
    }
});

console.log('[Supabase] Client initialized');

module.exports = { supabase };

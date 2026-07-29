-- =============================================
-- CineStream Supabase Database Schema
-- Run this in the Supabase SQL Editor
-- =============================================

-- 1. Profiles table (extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    birthday TEXT DEFAULT '',
    email TEXT DEFAULT '',
    profile_pic TEXT DEFAULT NULL,
    bio TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own profile
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, first_name, last_name, birthday, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'birthday', ''),
        NEW.email
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. User Activity table (likes, dislikes, watch history)
CREATE TABLE IF NOT EXISTS user_activity (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    media_id TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
    title TEXT NOT NULL,
    poster_path TEXT,
    action_type TEXT NOT NULL CHECK (action_type IN ('like', 'dislike', 'watched')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, media_id, action_type)
);

ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity" ON user_activity FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own activity" ON user_activity FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own activity" ON user_activity FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own activity" ON user_activity FOR DELETE USING (auth.uid() = user_id);

-- 3. Playlists table
CREATE TABLE IF NOT EXISTS playlists (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own playlists" ON playlists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own playlists" ON playlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own playlists" ON playlists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own playlists" ON playlists FOR DELETE USING (auth.uid() = user_id);

-- 4. Playlist Items table
CREATE TABLE IF NOT EXISTS playlist_items (
    id BIGSERIAL PRIMARY KEY,
    playlist_id BIGINT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    media_id TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
    title TEXT NOT NULL,
    poster_path TEXT,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(playlist_id, media_id)
);

ALTER TABLE playlist_items ENABLE ROW LEVEL SECURITY;

-- Users can manage items in their own playlists
CREATE POLICY "Users can view own playlist items" ON playlist_items FOR SELECT
    USING (EXISTS (SELECT 1 FROM playlists WHERE playlists.id = playlist_items.playlist_id AND playlists.user_id = auth.uid()));
CREATE POLICY "Users can insert into own playlists" ON playlist_items FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM playlists WHERE playlists.id = playlist_items.playlist_id AND playlists.user_id = auth.uid()));
CREATE POLICY "Users can delete from own playlists" ON playlist_items FOR DELETE
    USING (EXISTS (SELECT 1 FROM playlists WHERE playlists.id = playlist_items.playlist_id AND playlists.user_id = auth.uid()));

-- 5. Reports table (bug reports)
CREATE TABLE IF NOT EXISTS reports (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    images TEXT DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a report (no auth required)
CREATE POLICY "Anyone can submit reports" ON reports FOR INSERT WITH CHECK (true);
-- Only authenticated users can view reports (admin use)
CREATE POLICY "Authenticated can view reports" ON reports FOR SELECT USING (auth.role() = 'authenticated');

-- 6. Version Rules table (app version blocking)
CREATE TABLE IF NOT EXISTS version_rules (
    id BIGSERIAL PRIMARY KEY,
    version TEXT NOT NULL UNIQUE,
    mode TEXT NOT NULL CHECK (mode IN ('warning', 'lockout')),
    message TEXT NOT NULL,
    download_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE version_rules ENABLE ROW LEVEL SECURITY;

-- Anyone can check version rules (public read)
CREATE POLICY "Anyone can check versions" ON version_rules FOR SELECT USING (true);

-- =============================================
-- Storage Bucket for report images
-- Run this in the Supabase Dashboard > Storage
-- Create a bucket called "report-images" with public access
-- =============================================

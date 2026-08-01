-- =============================================================
-- CineStream — Supabase schema (full reset)
-- Run this whole file in the Supabase SQL Editor.
--
-- Design notes:
--   * Every signed-in user's data is isolated by RLS on auth.uid().
--   * Movies store season/episode as 0 so the UNIQUE keys work
--     (Postgres treats NULLs as distinct, which would allow dupes).
--   * Guests are identified by a random device id. Their watch history
--     lives in its own table reachable only through SECURITY DEFINER
--     functions, so the anon role can never scan the whole table.
--   * Likes/dislikes are an UPDATE on one row rather than delete+insert,
--     so created_at survives a user flipping their opinion.
-- =============================================================

-- ---------- clean slate ----------
DROP TABLE IF EXISTS playlist_items       CASCADE;
DROP TABLE IF EXISTS playlists            CASCADE;
DROP TABLE IF EXISTS watch_history        CASCADE;
DROP TABLE IF EXISTS guest_watch_history  CASCADE;
DROP TABLE IF EXISTS reactions            CASCADE;
DROP TABLE IF EXISTS favorites            CASCADE;
DROP TABLE IF EXISTS search_history       CASCADE;
DROP TABLE IF EXISTS user_preferences     CASCADE;
DROP TABLE IF EXISTS user_activity        CASCADE;  -- legacy
DROP TABLE IF EXISTS profiles             CASCADE;
DROP TABLE IF EXISTS reports              CASCADE;
DROP TABLE IF EXISTS version_rules        CASCADE;

DROP TRIGGER  IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user      CASCADE;
DROP FUNCTION IF EXISTS public.touch_updated_at     CASCADE;
DROP FUNCTION IF EXISTS public.guest_record_watch   CASCADE;
DROP FUNCTION IF EXISTS public.guest_watch_history_list      CASCADE;
DROP FUNCTION IF EXISTS public.guest_continue_watching       CASCADE;
DROP FUNCTION IF EXISTS public.guest_clear_watch_history     CASCADE;

-- ---------- shared helper ----------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


-- =============================================================
-- 1. profiles
-- =============================================================
CREATE TABLE profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name  TEXT NOT NULL DEFAULT '',
    last_name   TEXT NOT NULL DEFAULT '',
    birthday    TEXT DEFAULT '',
    email       TEXT DEFAULT '',
    profile_pic TEXT,
    bio         TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: select own" ON profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles: insert own" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles: update own" ON profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TRIGGER profiles_touch
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- auto-create a profile row whenever someone signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, first_name, last_name, birthday, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'birthday', ''),
        NEW.email
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =============================================================
-- 2. watch_history  (signed-in users, one row per episode)
-- =============================================================
CREATE TABLE watch_history (
    id               BIGSERIAL PRIMARY KEY,
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    media_id         TEXT NOT NULL,
    media_type       TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
    title            TEXT NOT NULL DEFAULT 'Unknown Title',
    poster_path      TEXT,
    -- movies use 0/0; TV uses the real season + episode
    season           INTEGER NOT NULL DEFAULT 0,
    episode          INTEGER NOT NULL DEFAULT 0,
    episode_title    TEXT,
    position_seconds INTEGER NOT NULL DEFAULT 0 CHECK (position_seconds >= 0),
    duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
    watch_seconds    INTEGER NOT NULL DEFAULT 0 CHECK (watch_seconds >= 0),
    player_used      TEXT NOT NULL DEFAULT 'Vidnest',
    progress_percent NUMERIC(5,2) GENERATED ALWAYS AS (
        CASE WHEN duration_seconds > 0
             THEN LEAST(100, ROUND((position_seconds::NUMERIC / duration_seconds::NUMERIC) * 100, 2))
             ELSE 0 END
    ) STORED,
    completed        BOOLEAN GENERATED ALWAYS AS (
        duration_seconds > 0 AND position_seconds >= (duration_seconds * 0.9)
    ) STORED,
    first_watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_watched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, media_id, media_type, season, episode)
);

CREATE INDEX watch_history_recent_idx
    ON watch_history (user_id, last_watched_at DESC);
-- powers "Continue Watching": started but not finished
CREATE INDEX watch_history_resume_idx
    ON watch_history (user_id, last_watched_at DESC)
    WHERE completed = FALSE AND position_seconds > 30;

ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watch_history: select own" ON watch_history
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "watch_history: insert own" ON watch_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watch_history: update own" ON watch_history
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watch_history: delete own" ON watch_history
    FOR DELETE USING (auth.uid() = user_id);


-- =============================================================
-- 3. guest_watch_history  (not signed in — keyed by device id)
--    RLS is on with NO policies, so direct access is denied for
--    everyone. All reads/writes go through the functions below.
-- =============================================================
CREATE TABLE guest_watch_history (
    id               BIGSERIAL PRIMARY KEY,
    device_id        TEXT NOT NULL CHECK (char_length(device_id) BETWEEN 16 AND 128),
    media_id         TEXT NOT NULL,
    media_type       TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
    title            TEXT NOT NULL DEFAULT 'Unknown Title',
    poster_path      TEXT,
    season           INTEGER NOT NULL DEFAULT 0,
    episode          INTEGER NOT NULL DEFAULT 0,
    position_seconds INTEGER NOT NULL DEFAULT 0 CHECK (position_seconds >= 0),
    duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
    watch_seconds    INTEGER NOT NULL DEFAULT 0 CHECK (watch_seconds >= 0),
    player_used      TEXT NOT NULL DEFAULT 'Vidnest',
    first_watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_watched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (device_id, media_id, media_type, season, episode)
);

CREATE INDEX guest_watch_history_recent_idx
    ON guest_watch_history (device_id, last_watched_at DESC);

ALTER TABLE guest_watch_history ENABLE ROW LEVEL SECURITY;
-- (intentionally no policies)

CREATE OR REPLACE FUNCTION public.guest_record_watch(
    p_device_id   TEXT,
    p_media_id    TEXT,
    p_media_type  TEXT,
    p_title       TEXT,
    p_poster_path TEXT DEFAULT NULL,
    p_season      INTEGER DEFAULT 0,
    p_episode     INTEGER DEFAULT 0,
    p_position    INTEGER DEFAULT 0,
    p_duration    INTEGER DEFAULT 0,
    p_watch_secs  INTEGER DEFAULT 0,
    p_player      TEXT DEFAULT 'Vidnest'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_device_id IS NULL OR char_length(p_device_id) < 16 THEN
        RAISE EXCEPTION 'invalid device id';
    END IF;

    INSERT INTO guest_watch_history AS g (
        device_id, media_id, media_type, title, poster_path,
        season, episode, position_seconds, duration_seconds,
        watch_seconds, player_used
    )
    VALUES (
        p_device_id, p_media_id, COALESCE(p_media_type, 'movie'),
        COALESCE(p_title, 'Unknown Title'), p_poster_path,
        COALESCE(p_season, 0), COALESCE(p_episode, 0),
        GREATEST(COALESCE(p_position, 0), 0), GREATEST(COALESCE(p_duration, 0), 0),
        GREATEST(COALESCE(p_watch_secs, 0), 0), COALESCE(p_player, 'Vidnest')
    )
    ON CONFLICT (device_id, media_id, media_type, season, episode) DO UPDATE
    SET position_seconds = GREATEST(EXCLUDED.position_seconds, 0),
        duration_seconds = GREATEST(EXCLUDED.duration_seconds, g.duration_seconds),
        watch_seconds    = g.watch_seconds + GREATEST(COALESCE(p_watch_secs, 0), 0),
        player_used      = EXCLUDED.player_used,
        title            = EXCLUDED.title,
        poster_path      = COALESCE(EXCLUDED.poster_path, g.poster_path),
        last_watched_at  = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.guest_watch_history_list(
    p_device_id TEXT,
    p_limit     INTEGER DEFAULT 100
)
RETURNS SETOF guest_watch_history
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_device_id IS NULL OR char_length(p_device_id) < 16 THEN
        RAISE EXCEPTION 'invalid device id';
    END IF;

    RETURN QUERY
        SELECT * FROM guest_watch_history
        WHERE device_id = p_device_id
        ORDER BY last_watched_at DESC
        LIMIT LEAST(COALESCE(p_limit, 100), 500);
END;
$$;

CREATE OR REPLACE FUNCTION public.guest_continue_watching(
    p_device_id TEXT,
    p_limit     INTEGER DEFAULT 20
)
RETURNS SETOF guest_watch_history
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_device_id IS NULL OR char_length(p_device_id) < 16 THEN
        RAISE EXCEPTION 'invalid device id';
    END IF;

    RETURN QUERY
        SELECT * FROM guest_watch_history
        WHERE device_id = p_device_id
          AND position_seconds > 30
          AND (duration_seconds = 0 OR position_seconds < duration_seconds * 0.9)
        ORDER BY last_watched_at DESC
        LIMIT LEAST(COALESCE(p_limit, 20), 100);
END;
$$;

CREATE OR REPLACE FUNCTION public.guest_clear_watch_history(p_device_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_device_id IS NULL OR char_length(p_device_id) < 16 THEN
        RAISE EXCEPTION 'invalid device id';
    END IF;

    DELETE FROM guest_watch_history WHERE device_id = p_device_id;
END;
$$;

REVOKE ALL ON FUNCTION public.guest_record_watch       FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guest_watch_history_list FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guest_continue_watching  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guest_clear_watch_history FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.guest_record_watch        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_watch_history_list  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_continue_watching   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_clear_watch_history TO anon, authenticated;


-- =============================================================
-- 4. reactions  (like / dislike — sign-in required)
-- =============================================================
CREATE TABLE reactions (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    media_id    TEXT NOT NULL,
    media_type  TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
    title       TEXT NOT NULL DEFAULT 'Unknown Title',
    poster_path TEXT,
    reaction    TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, media_id, media_type)
);

CREATE INDEX reactions_lookup_idx ON reactions (user_id, reaction, created_at DESC);

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions: select own" ON reactions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reactions: insert own" ON reactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions: update own" ON reactions
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions: delete own" ON reactions
    FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER reactions_touch
    BEFORE UPDATE ON reactions
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- =============================================================
-- 5. favorites  (its own list, separate from playlists)
-- =============================================================
CREATE TABLE favorites (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    media_id    TEXT NOT NULL,
    media_type  TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
    title       TEXT NOT NULL DEFAULT 'Unknown Title',
    poster_path TEXT,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, media_id, media_type)
);

CREATE INDEX favorites_recent_idx ON favorites (user_id, added_at DESC);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorites: select own" ON favorites
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "favorites: insert own" ON favorites
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "favorites: delete own" ON favorites
    FOR DELETE USING (auth.uid() = user_id);


-- =============================================================
-- 6. playlists + playlist_items
-- =============================================================
CREATE TABLE playlists (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
    description TEXT NOT NULL DEFAULT '',
    is_public   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX playlists_owner_idx ON playlists (user_id, updated_at DESC);

ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "playlists: select own" ON playlists
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "playlists: insert own" ON playlists
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "playlists: update own" ON playlists
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "playlists: delete own" ON playlists
    FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER playlists_touch
    BEFORE UPDATE ON playlists
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE playlist_items (
    id          BIGSERIAL PRIMARY KEY,
    playlist_id BIGINT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    media_id    TEXT NOT NULL,
    media_type  TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
    title       TEXT NOT NULL DEFAULT 'Unknown Title',
    poster_path TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (playlist_id, media_id, media_type)
);

CREATE INDEX playlist_items_parent_idx ON playlist_items (playlist_id, added_at DESC);

ALTER TABLE playlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "playlist_items: select own" ON playlist_items
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM playlists p
        WHERE p.id = playlist_items.playlist_id AND p.user_id = auth.uid()
    ));
CREATE POLICY "playlist_items: insert own" ON playlist_items
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM playlists p
        WHERE p.id = playlist_items.playlist_id AND p.user_id = auth.uid()
    ));
CREATE POLICY "playlist_items: update own" ON playlist_items
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM playlists p
        WHERE p.id = playlist_items.playlist_id AND p.user_id = auth.uid()
    ));
CREATE POLICY "playlist_items: delete own" ON playlist_items
    FOR DELETE USING (EXISTS (
        SELECT 1 FROM playlists p
        WHERE p.id = playlist_items.playlist_id AND p.user_id = auth.uid()
    ));


-- =============================================================
-- 7. user_preferences  (one row per user)
-- =============================================================
CREATE TABLE user_preferences (
    user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    preferred_server TEXT NOT NULL DEFAULT 'vidnest',
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences: select own" ON user_preferences
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_preferences: insert own" ON user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_preferences: update own" ON user_preferences
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_preferences_touch
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- =============================================================
-- 8. search_history
-- =============================================================
CREATE TABLE search_history (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    query       TEXT NOT NULL CHECK (char_length(trim(query)) > 0),
    searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX search_history_recent_idx ON search_history (user_id, searched_at DESC);

ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "search_history: select own" ON search_history
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "search_history: insert own" ON search_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "search_history: delete own" ON search_history
    FOR DELETE USING (auth.uid() = user_id);


-- =============================================================
-- 9. reports  (bug reports — anyone may submit)
-- =============================================================
CREATE TABLE reports (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name       TEXT NOT NULL,
    subject    TEXT NOT NULL,
    message    TEXT NOT NULL,
    images     TEXT NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- anyone may file a report, but nobody may file one in someone else's name
CREATE POLICY "reports: anyone can submit" ON reports
    FOR INSERT WITH CHECK (user_id IS NULL OR auth.uid() = user_id);
-- a signed-in user may read back only the reports they filed
CREATE POLICY "reports: select own" ON reports
    FOR SELECT USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);


-- =============================================================
-- 10. version_rules  (app version gating — public read)
-- =============================================================
CREATE TABLE version_rules (
    id           BIGSERIAL PRIMARY KEY,
    version      TEXT NOT NULL UNIQUE,
    mode         TEXT NOT NULL CHECK (mode IN ('warning', 'lockout')),
    message      TEXT NOT NULL,
    download_url TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE version_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "version_rules: public read" ON version_rules
    FOR SELECT USING (true);


-- =============================================================
-- 11. Role grants
--
-- RLS decides WHICH ROWS a user may touch, but Postgres still needs a
-- plain GRANT to allow touching the table at all. Without this every
-- query fails with "42501: permission denied for table ...", even for a
-- correctly signed-in user.
--
-- guest_watch_history is deliberately left out: it is reachable only
-- through the SECURITY DEFINER functions granted further above.
-- =============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON profiles          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON watch_history    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON reactions        TO authenticated;
GRANT SELECT, INSERT, DELETE         ON favorites        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON playlists        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON playlist_items   TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON user_preferences TO authenticated;
GRANT SELECT, INSERT, DELETE         ON search_history   TO authenticated;

-- bug reports may be filed without an account
GRANT INSERT ON reports TO anon, authenticated;
GRANT SELECT ON reports TO authenticated;

-- version gating is checked before login
GRANT SELECT ON version_rules TO anon, authenticated;

-- BIGSERIAL primary keys need their sequences to be usable by inserters
GRANT USAGE, SELECT ON SEQUENCE watch_history_id_seq  TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE reactions_id_seq      TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE favorites_id_seq      TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE playlists_id_seq      TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE playlist_items_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE search_history_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE reports_id_seq        TO anon, authenticated;


-- =============================================================
-- Storage
-- Create a public bucket named "report-images" in
-- Supabase Dashboard → Storage for bug-report screenshots.
-- =============================================================

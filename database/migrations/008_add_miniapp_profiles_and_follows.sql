ALTER TABLE miniapp_users
    ADD COLUMN IF NOT EXISTS bio VARCHAR(100),
    ADD COLUMN IF NOT EXISTS gender SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS nickname_change_window_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS nickname_change_count SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE miniapp_users
    ALTER COLUMN bio TYPE VARCHAR(100);

ALTER TABLE miniapp_users
    DROP CONSTRAINT IF EXISTS ck_miniapp_users_nickname_not_blank;

ALTER TABLE miniapp_users
    ADD CONSTRAINT ck_miniapp_users_nickname_not_blank
    CHECK (char_length(btrim(nickname)) BETWEEN 2 AND 20);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_miniapp_users_bio_not_blank'
          AND conrelid = 'miniapp_users'::regclass
    ) THEN
        ALTER TABLE miniapp_users
            ADD CONSTRAINT ck_miniapp_users_bio_not_blank
            CHECK (bio IS NULL OR char_length(btrim(bio)) BETWEEN 1 AND 100);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_miniapp_users_gender'
          AND conrelid = 'miniapp_users'::regclass
    ) THEN
        ALTER TABLE miniapp_users
            ADD CONSTRAINT ck_miniapp_users_gender CHECK (gender IN (0, 1, 2));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_miniapp_users_nickname_change_count'
          AND conrelid = 'miniapp_users'::regclass
    ) THEN
        ALTER TABLE miniapp_users
            ADD CONSTRAINT ck_miniapp_users_nickname_change_count
            CHECK (nickname_change_count BETWEEN 0 AND 3);
    END IF;
END
$$;

ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_posts_view_count'
          AND conrelid = 'posts'::regclass
    ) THEN
        ALTER TABLE posts
            ADD CONSTRAINT ck_posts_view_count CHECK (view_count >= 0);
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS miniapp_user_follows (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    follower_user_id BIGINT NOT NULL REFERENCES miniapp_users (id) ON DELETE RESTRICT,
    following_user_id BIGINT NOT NULL REFERENCES miniapp_users (id) ON DELETE RESTRICT,
    status SMALLINT NOT NULL DEFAULT 1,
    followed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_miniapp_user_follows_pair UNIQUE (follower_user_id, following_user_id),
    CONSTRAINT ck_miniapp_user_follows_not_self CHECK (follower_user_id <> following_user_id),
    CONSTRAINT ck_miniapp_user_follows_status CHECK (status IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_miniapp_user_follows_follower_status_followed
    ON miniapp_user_follows (follower_user_id, status, followed_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_miniapp_user_follows_following_status_followed
    ON miniapp_user_follows (following_user_id, status, followed_at DESC, id DESC);

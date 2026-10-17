CREATE TABLE IF NOT EXISTS posts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES miniapp_users (id) ON DELETE RESTRICT,
    circle_id BIGINT NOT NULL REFERENCES circles (id) ON DELETE RESTRICT,
    category_id BIGINT NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
    content_type VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    status SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT ck_posts_content_type CHECK (content_type IN ('TEXT', 'IMAGE_TEXT', 'VIDEO')),
    CONSTRAINT ck_posts_content_not_blank CHECK (char_length(btrim(content)) > 0),
    CONSTRAINT ck_posts_status CHECK (status IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_posts_circle_created
    ON posts (circle_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category_created
    ON posts (category_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_created
    ON posts (user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_posts_live_status_created
    ON posts (status, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS post_media (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts (id) ON DELETE RESTRICT,
    media_type VARCHAR(10) NOT NULL,
    media_url VARCHAR(1000) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_post_media_type CHECK (media_type IN ('IMAGE', 'VIDEO')),
    CONSTRAINT ck_post_media_sort_order CHECK (sort_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_post_media_post_sort
    ON post_media (post_id, sort_order, id);

CREATE TABLE IF NOT EXISTS post_likes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts (id) ON DELETE RESTRICT,
    user_id BIGINT NOT NULL REFERENCES miniapp_users (id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_post_likes_post_user UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_user_created
    ON post_likes (user_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS comments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts (id) ON DELETE RESTRICT,
    user_id BIGINT NOT NULL REFERENCES miniapp_users (id) ON DELETE RESTRICT,
    content VARCHAR(2000) NOT NULL,
    status SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT ck_comments_content_not_blank CHECK (char_length(btrim(content)) BETWEEN 1 AND 2000),
    CONSTRAINT ck_comments_status CHECK (status IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_comments_post_created
    ON comments (post_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_comments_user_created
    ON comments (user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_comments_live_status_created
    ON comments (status, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;

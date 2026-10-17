CREATE TABLE IF NOT EXISTS circles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description VARCHAR(500),
    cover_url VARCHAR(500),
    status SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_circles_name_not_blank CHECK (char_length(btrim(name)) BETWEEN 1 AND 50),
    CONSTRAINT ck_circles_status CHECK (status IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_circles_status_created
    ON circles (status, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS circle_members (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    circle_id BIGINT NOT NULL REFERENCES circles (id) ON DELETE RESTRICT,
    user_id BIGINT NOT NULL REFERENCES miniapp_users (id) ON DELETE RESTRICT,
    status SMALLINT NOT NULL DEFAULT 1,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_circle_members_circle_user UNIQUE (circle_id, user_id),
    CONSTRAINT ck_circle_members_status CHECK (status IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_circle_members_circle_status_joined
    ON circle_members (circle_id, status, joined_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_circle_members_user_status_joined
    ON circle_members (user_id, status, joined_at DESC, id DESC);

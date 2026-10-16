CREATE TABLE IF NOT EXISTS miniapp_users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    wx_openid VARCHAR(64) NOT NULL,
    wx_unionid VARCHAR(64),
    nickname VARCHAR(50) NOT NULL DEFAULT '微信用户',
    avatar_url VARCHAR(500),
    status SMALLINT NOT NULL DEFAULT 1,
    token_version INTEGER NOT NULL DEFAULT 0,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_miniapp_users_wx_openid UNIQUE (wx_openid),
    CONSTRAINT uk_miniapp_users_wx_unionid UNIQUE (wx_unionid),
    CONSTRAINT ck_miniapp_users_nickname_not_blank CHECK (char_length(btrim(nickname)) BETWEEN 1 AND 50),
    CONSTRAINT ck_miniapp_users_status CHECK (status IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_miniapp_users_status_created
    ON miniapp_users (status, created_at, id);

CREATE INDEX IF NOT EXISTS idx_miniapp_users_created
    ON miniapp_users (created_at, id);

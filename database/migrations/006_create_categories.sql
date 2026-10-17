CREATE TABLE IF NOT EXISTS categories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    code VARCHAR(50) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT ck_categories_name_not_blank CHECK (char_length(btrim(name)) BETWEEN 1 AND 50),
    CONSTRAINT ck_categories_code_format CHECK (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT ck_categories_sort_order CHECK (sort_order >= 0),
    CONSTRAINT ck_categories_status CHECK (status IN (0, 1)),
    CONSTRAINT uk_categories_code UNIQUE (code)
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_categories_name_live
    ON categories (name)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_categories_live_sort
    ON categories (status, sort_order, id)
    WHERE deleted_at IS NULL;

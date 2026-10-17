ALTER TABLE circles
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DROP INDEX IF EXISTS idx_circles_status_created;

CREATE INDEX idx_circles_status_created
    ON circles (status, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;

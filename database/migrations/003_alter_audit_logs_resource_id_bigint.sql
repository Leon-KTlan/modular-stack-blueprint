ALTER TABLE audit_logs
    ALTER COLUMN resource_id TYPE BIGINT
    USING resource_id::BIGINT;

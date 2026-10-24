-- Treehole V1: evidence retention is intentionally not a physical purge policy.

BEGIN;

CREATE TABLE treehole_posts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  content TEXT,
  moderation_status SMALLINT NOT NULL DEFAULT 0,
  review_version INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  content_fingerprint VARCHAR(64) NOT NULL,
  dedupe_window_started_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  client_request_id UUID NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  deleted_at TIMESTAMPTZ,
  purged_at TIMESTAMPTZ,
  ttl_hours SMALLINT NOT NULL DEFAULT 24,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_treehole_posts_1 CHECK ((purged_at IS NOT NULL AND content IS NULL) OR (purged_at IS NULL AND content IS NOT NULL AND char_length(btrim(content)) BETWEEN 1 AND 1000)),
  CONSTRAINT ck_treehole_posts_2 CHECK (moderation_status IN (0,1,2,3)),
  CONSTRAINT ck_treehole_posts_3 CHECK (review_version >= 0),
  CONSTRAINT ck_treehole_posts_4 CHECK (dedupe_window_started_at <= submitted_at AND submitted_at < dedupe_window_started_at + interval '24 hours'),
  CONSTRAINT ck_treehole_posts_5 CHECK (ttl_hours IN (1,6,12,24)),
  CONSTRAINT ck_treehole_posts_6 CHECK ((published_at IS NULL AND expires_at IS NULL) OR (published_at IS NOT NULL AND expires_at = published_at + ttl_hours * interval '1 hour'))
);

CREATE TABLE treehole_comments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  post_id BIGINT NOT NULL,
  reply_to_comment_id BIGINT,
  content TEXT,
  moderation_status SMALLINT NOT NULL DEFAULT 0,
  review_version INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  content_fingerprint VARCHAR(64) NOT NULL,
  dedupe_window_started_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  client_request_id UUID NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  deleted_at TIMESTAMPTZ,
  purged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_treehole_comments_1 CHECK ((purged_at IS NOT NULL AND content IS NULL) OR (purged_at IS NULL AND content IS NOT NULL AND char_length(btrim(content)) BETWEEN 1 AND 500)),
  CONSTRAINT ck_treehole_comments_2 CHECK (moderation_status IN (0,1,2,3)),
  CONSTRAINT ck_treehole_comments_3 CHECK (review_version >= 0),
  CONSTRAINT ck_treehole_comments_4 CHECK (dedupe_window_started_at <= submitted_at AND submitted_at < dedupe_window_started_at + interval '24 hours'),
  CONSTRAINT ck_treehole_comments_5 CHECK (reply_to_comment_id IS NULL OR reply_to_comment_id <> id)
);

CREATE TABLE treehole_participants (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  nickname VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE treehole_post_likes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE treehole_reviews (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id BIGINT,
  comment_id BIGINT,
  previous_review_id BIGINT,
  target_review_version INTEGER NOT NULL,
  source SMALLINT NOT NULL,
  reviewer_type SMALLINT NOT NULL,
  status SMALLINT NOT NULL DEFAULT 0,
  decision SMALLINT,
  rule_version VARCHAR(50) NOT NULL,
  model VARCHAR(100),
  violation_code VARCHAR(50),
  points SMALLINT,
  counted_violation_id BIGINT,
  reason TEXT,
  evidence_quotes JSONB,
  content_snapshot TEXT,
  context_snapshot JSONB,
  dedupe_key VARCHAR(100) NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  budget_day DATE,
  budget_attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_until TIMESTAMPTZ,
  lease_token UUID,
  operator_id INTEGER,
  completed_at TIMESTAMPTZ,
  purge_after TIMESTAMPTZ,
  purged_at TIMESTAMPTZ,
  decision_request_id UUID,
  decision_request_hash VARCHAR(64),
  decision_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_treehole_reviews_1 CHECK ((post_id IS NOT NULL)::integer + (comment_id IS NOT NULL)::integer = 1),
  CONSTRAINT ck_treehole_reviews_2 CHECK (target_review_version > 0),
  CONSTRAINT ck_treehole_reviews_3 CHECK (source IN (0,1,2,3,4)),
  CONSTRAINT ck_treehole_reviews_4 CHECK (reviewer_type IN (0,1,2)),
  CONSTRAINT ck_treehole_reviews_5 CHECK (status IN (0,1,2,3)),
  CONSTRAINT ck_treehole_reviews_6 CHECK (decision IS NULL OR decision IN (0,1,2)),
  CONSTRAINT ck_treehole_reviews_7 CHECK (points IS NULL OR points BETWEEN 1 AND 20),
  CONSTRAINT ck_treehole_reviews_8 CHECK (attempt_count >= 0),
  CONSTRAINT ck_treehole_reviews_budget CHECK (budget_attempts >= 0),
  CONSTRAINT ck_treehole_reviews_9 CHECK ((decision_request_id IS NULL AND decision_request_hash IS NULL AND decision_result IS NULL) OR (decision_request_id IS NOT NULL AND decision_request_hash IS NOT NULL AND decision_result IS NOT NULL)),
  CONSTRAINT ck_treehole_reviews_10 CHECK ((locked_until IS NULL) = (lease_token IS NULL))
);

CREATE TABLE treehole_reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reporter_user_id BIGINT NOT NULL,
  post_id BIGINT,
  comment_id BIGINT,
  reason SMALLINT NOT NULL,
  description VARCHAR(500),
  status SMALLINT NOT NULL DEFAULT 0,
  review_id BIGINT,
  decision_reason VARCHAR(1000),
  operator_id INTEGER,
  resolved_at TIMESTAMPTZ,
  decision_request_id UUID,
  decision_request_hash VARCHAR(64),
  decision_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_treehole_reports_1 CHECK ((post_id IS NOT NULL)::integer + (comment_id IS NOT NULL)::integer = 1),
  CONSTRAINT ck_treehole_reports_2 CHECK (reason IN (0,1,2,3,4,5)),
  CONSTRAINT ck_treehole_reports_3 CHECK (status IN (0,1,2)),
  CONSTRAINT ck_treehole_reports_4 CHECK ((decision_request_id IS NULL AND decision_request_hash IS NULL AND decision_result IS NULL) OR (decision_request_id IS NOT NULL AND decision_request_hash IS NOT NULL AND decision_result IS NOT NULL))
);

CREATE TABLE treehole_violations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  post_id BIGINT,
  comment_id BIGINT,
  review_id BIGINT NOT NULL,
  violation_code VARCHAR(50) NOT NULL,
  points SMALLINT NOT NULL,
  rule_version VARCHAR(50) NOT NULL,
  dedupe_fingerprint VARCHAR(64) NOT NULL,
  dedupe_window_started_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMPTZ,
  revoke_reason VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_treehole_violations_1 CHECK ((post_id IS NOT NULL)::integer + (comment_id IS NOT NULL)::integer = 1),
  CONSTRAINT ck_treehole_violations_2 CHECK (points BETWEEN 1 AND 20)
);

CREATE TABLE treehole_penalties (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  trigger_violation_id BIGINT,
  review_id BIGINT,
  tier SMALLINT NOT NULL,
  status SMALLINT NOT NULL,
  basis SMALLINT NOT NULL,
  score_snapshot INTEGER NOT NULL,
  rule_version VARCHAR(50) NOT NULL,
  reason VARCHAR(1000) NOT NULL,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  operator_id INTEGER,
  supersedes_penalty_id BIGINT,
  revoked_at TIMESTAMPTZ,
  revoke_reason VARCHAR(1000),
  revoke_operator_id INTEGER,
  decision_request_id UUID,
  decision_request_hash VARCHAR(64),
  decision_result JSONB,
  revoke_request_id UUID,
  revoke_request_hash VARCHAR(64),
  revoke_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_treehole_penalties_1 CHECK (tier BETWEEN 0 AND 5),
  CONSTRAINT ck_treehole_penalties_2 CHECK (status IN (0,1,2,3,4,5)),
  CONSTRAINT ck_treehole_penalties_3 CHECK (basis IN (0,1,2)),
  CONSTRAINT ck_treehole_penalties_4 CHECK (score_snapshot >= 0),
  CONSTRAINT ck_treehole_penalties_5 CHECK ((status IN (0,5) AND starts_at IS NULL AND ends_at IS NULL AND notified_at IS NULL) OR (status IN (1,2,3,4) AND starts_at IS NOT NULL AND notified_at IS NOT NULL AND ((tier=0 AND ends_at=starts_at AND status<>1) OR (tier BETWEEN 1 AND 4 AND ends_at>starts_at) OR (tier=5 AND ends_at IS NULL)))),
  CONSTRAINT ck_treehole_penalties_6 CHECK (status IN (0,5) OR tier < 3 OR operator_id IS NOT NULL),
  CONSTRAINT ck_treehole_penalties_7 CHECK (basis <> 1 OR operator_id IS NOT NULL),
  CONSTRAINT ck_treehole_penalties_8 CHECK (basis <> 2 OR (tier BETWEEN 1 AND 2 AND review_id IS NOT NULL AND ends_at IS NOT NULL)),
  CONSTRAINT ck_treehole_penalties_9 CHECK (operator_id IS NOT NULL OR status IN (0,5) OR tier=0 OR (tier IN (1,2) AND ends_at <= starts_at + interval '24 hours')),
  CONSTRAINT ck_treehole_penalties_10 CHECK ((decision_request_id IS NULL AND decision_request_hash IS NULL AND decision_result IS NULL) OR (decision_request_id IS NOT NULL AND decision_request_hash IS NOT NULL AND decision_result IS NOT NULL)),
  CONSTRAINT ck_treehole_penalties_11 CHECK ((revoke_request_id IS NULL AND revoke_request_hash IS NULL AND revoke_result IS NULL) OR (revoke_request_id IS NOT NULL AND revoke_request_hash IS NOT NULL AND revoke_result IS NOT NULL))
);

CREATE TABLE treehole_penalty_contents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  penalty_id BIGINT NOT NULL,
  post_id BIGINT,
  comment_id BIGINT,
  hidden_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_at TIMESTAMPTZ,
  CONSTRAINT ck_treehole_penalty_contents_1 CHECK ((post_id IS NOT NULL)::integer + (comment_id IS NOT NULL)::integer = 1)
);

CREATE TABLE treehole_appeals (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  penalty_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  reason VARCHAR(1000) NOT NULL,
  status SMALLINT NOT NULL DEFAULT 0,
  decision_reason VARCHAR(1000),
  operator_id INTEGER,
  resolved_at TIMESTAMPTZ,
  client_request_id UUID NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  decision_request_id UUID,
  decision_request_hash VARCHAR(64),
  decision_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_treehole_appeals_1 CHECK (status IN (0,1,2)),
  CONSTRAINT ck_treehole_appeals_2 CHECK ((decision_request_id IS NULL AND decision_request_hash IS NULL AND decision_result IS NULL) OR (decision_request_id IS NOT NULL AND decision_request_hash IS NOT NULL AND decision_result IS NOT NULL))
);

CREATE TABLE treehole_user_states (
  user_id BIGINT PRIMARY KEY,
  quota_date DATE NOT NULL,
  post_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  last_post_submitted_at TIMESTAMPTZ,
  last_comment_submitted_at TIMESTAMPTZ,
  last_enforced_tier SMALLINT NOT NULL DEFAULT -1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_treehole_user_states_1 CHECK (post_count >= 0),
  CONSTRAINT ck_treehole_user_states_2 CHECK (comment_count >= 0),
  CONSTRAINT ck_treehole_user_states_3 CHECK (last_enforced_tier IN (-1,0,1,2,3,4,5))
);

CREATE UNIQUE INDEX uk_treehole_posts_request ON treehole_posts (user_id,client_request_id);

CREATE INDEX idx_treehole_posts_mine ON treehole_posts (user_id,submitted_at DESC,id DESC);

CREATE INDEX idx_treehole_posts_pending ON treehole_posts (submitted_at,id) WHERE moderation_status=0 AND published_at IS NULL;

CREATE INDEX idx_treehole_posts_dedupe ON treehole_posts (user_id,content_fingerprint,dedupe_window_started_at DESC);

CREATE INDEX idx_treehole_posts_public ON treehole_posts (published_at DESC,id DESC) WHERE moderation_status=1 AND deleted_at IS NULL AND published_at IS NOT NULL;

CREATE INDEX idx_treehole_posts_expiry ON treehole_posts (expires_at,id);

CREATE UNIQUE INDEX uk_treehole_comments_request ON treehole_comments (user_id,client_request_id);

CREATE INDEX idx_treehole_comments_mine ON treehole_comments (user_id,submitted_at DESC,id DESC);

CREATE INDEX idx_treehole_comments_pending ON treehole_comments (submitted_at,id) WHERE moderation_status=0 AND published_at IS NULL;

CREATE INDEX idx_treehole_comments_dedupe ON treehole_comments (user_id,content_fingerprint,dedupe_window_started_at DESC);

CREATE UNIQUE INDEX uk_treehole_comments_id_post ON treehole_comments (id,post_id);

CREATE INDEX idx_treehole_comments_post ON treehole_comments (post_id,published_at,id);

CREATE UNIQUE INDEX uk_treehole_participants_user ON treehole_participants (post_id,user_id);

CREATE UNIQUE INDEX uk_treehole_participants_nickname ON treehole_participants (post_id,nickname);

CREATE UNIQUE INDEX uk_treehole_post_likes_user ON treehole_post_likes (post_id,user_id);

CREATE UNIQUE INDEX uk_treehole_reviews_dedupe ON treehole_reviews (dedupe_key);

CREATE UNIQUE INDEX uk_treehole_reviews_post_version ON treehole_reviews (post_id,target_review_version) WHERE post_id IS NOT NULL;

CREATE UNIQUE INDEX uk_treehole_reviews_comment_version ON treehole_reviews (comment_id,target_review_version) WHERE comment_id IS NOT NULL;

CREATE INDEX idx_treehole_reviews_queue ON treehole_reviews (reviewer_type,status,next_attempt_at,id);

CREATE INDEX idx_treehole_reviews_post ON treehole_reviews (post_id,created_at,id) WHERE post_id IS NOT NULL;

CREATE INDEX idx_treehole_reviews_comment ON treehole_reviews (comment_id,created_at,id) WHERE comment_id IS NOT NULL;

CREATE INDEX idx_treehole_reviews_purge ON treehole_reviews (purge_after);

CREATE UNIQUE INDEX uk_treehole_reports_post ON treehole_reports (reporter_user_id,post_id) WHERE post_id IS NOT NULL;

CREATE UNIQUE INDEX uk_treehole_reports_comment ON treehole_reports (reporter_user_id,comment_id) WHERE comment_id IS NOT NULL;

CREATE INDEX idx_treehole_reports_queue ON treehole_reports (status,created_at,id);

CREATE UNIQUE INDEX uk_treehole_violations_post ON treehole_violations (post_id) WHERE post_id IS NOT NULL;

CREATE UNIQUE INDEX uk_treehole_violations_comment ON treehole_violations (comment_id) WHERE comment_id IS NOT NULL;

CREATE UNIQUE INDEX uk_treehole_violations_batch ON treehole_violations (user_id,dedupe_fingerprint,dedupe_window_started_at);

CREATE INDEX idx_treehole_violations_score ON treehole_violations (user_id,confirmed_at,id) WHERE revoked_at IS NULL;

CREATE INDEX idx_treehole_penalties_user ON treehole_penalties (user_id,status,starts_at,id);

CREATE INDEX idx_treehole_penalties_queue ON treehole_penalties (status,created_at,id);

CREATE UNIQUE INDEX uk_treehole_penalty_contents_post ON treehole_penalty_contents (penalty_id,post_id) WHERE post_id IS NOT NULL;

CREATE UNIQUE INDEX uk_treehole_penalty_contents_comment ON treehole_penalty_contents (penalty_id,comment_id) WHERE comment_id IS NOT NULL;

CREATE INDEX idx_treehole_penalty_contents_hidden_post ON treehole_penalty_contents (post_id) WHERE released_at IS NULL;

CREATE INDEX idx_treehole_penalty_contents_hidden_comment ON treehole_penalty_contents (comment_id) WHERE released_at IS NULL;

CREATE UNIQUE INDEX uk_treehole_appeals_request ON treehole_appeals (user_id,client_request_id);

CREATE UNIQUE INDEX uk_treehole_appeals_pending ON treehole_appeals (penalty_id) WHERE status=0;

CREATE INDEX idx_treehole_appeals_queue ON treehole_appeals (status,created_at,id);

CREATE INDEX idx_treehole_appeals_mine ON treehole_appeals (user_id,created_at DESC,id DESC);

ALTER TABLE treehole_posts ADD CONSTRAINT fk_treehole_posts_user_id FOREIGN KEY (user_id) REFERENCES miniapp_users(id) ON DELETE RESTRICT;

ALTER TABLE treehole_comments ADD CONSTRAINT fk_treehole_comments_user_id FOREIGN KEY (user_id) REFERENCES miniapp_users(id) ON DELETE RESTRICT;

ALTER TABLE treehole_comments ADD CONSTRAINT fk_treehole_comments_post_id FOREIGN KEY (post_id) REFERENCES treehole_posts(id) ON DELETE RESTRICT;

ALTER TABLE treehole_participants ADD CONSTRAINT fk_treehole_participants_post_id FOREIGN KEY (post_id) REFERENCES treehole_posts(id) ON DELETE RESTRICT;

ALTER TABLE treehole_participants ADD CONSTRAINT fk_treehole_participants_user_id FOREIGN KEY (user_id) REFERENCES miniapp_users(id) ON DELETE RESTRICT;

ALTER TABLE treehole_post_likes ADD CONSTRAINT fk_treehole_post_likes_post_id FOREIGN KEY (post_id) REFERENCES treehole_posts(id) ON DELETE RESTRICT;

ALTER TABLE treehole_post_likes ADD CONSTRAINT fk_treehole_post_likes_user_id FOREIGN KEY (user_id) REFERENCES miniapp_users(id) ON DELETE RESTRICT;

ALTER TABLE treehole_reviews ADD CONSTRAINT fk_treehole_reviews_post_id FOREIGN KEY (post_id) REFERENCES treehole_posts(id) ON DELETE RESTRICT;

ALTER TABLE treehole_reviews ADD CONSTRAINT fk_treehole_reviews_comment_id FOREIGN KEY (comment_id) REFERENCES treehole_comments(id) ON DELETE RESTRICT;

ALTER TABLE treehole_reviews ADD CONSTRAINT fk_treehole_reviews_previous_review_id FOREIGN KEY (previous_review_id) REFERENCES treehole_reviews(id) ON DELETE RESTRICT;

ALTER TABLE treehole_reviews ADD CONSTRAINT fk_treehole_reviews_counted_violation_id FOREIGN KEY (counted_violation_id) REFERENCES treehole_violations(id) ON DELETE RESTRICT;

ALTER TABLE treehole_reviews ADD CONSTRAINT fk_treehole_reviews_operator_id FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE treehole_reports ADD CONSTRAINT fk_treehole_reports_reporter_user_id FOREIGN KEY (reporter_user_id) REFERENCES miniapp_users(id) ON DELETE RESTRICT;

ALTER TABLE treehole_reports ADD CONSTRAINT fk_treehole_reports_post_id FOREIGN KEY (post_id) REFERENCES treehole_posts(id) ON DELETE RESTRICT;

ALTER TABLE treehole_reports ADD CONSTRAINT fk_treehole_reports_comment_id FOREIGN KEY (comment_id) REFERENCES treehole_comments(id) ON DELETE RESTRICT;

ALTER TABLE treehole_reports ADD CONSTRAINT fk_treehole_reports_review_id FOREIGN KEY (review_id) REFERENCES treehole_reviews(id) ON DELETE RESTRICT;

ALTER TABLE treehole_reports ADD CONSTRAINT fk_treehole_reports_operator_id FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE treehole_violations ADD CONSTRAINT fk_treehole_violations_user_id FOREIGN KEY (user_id) REFERENCES miniapp_users(id) ON DELETE RESTRICT;

ALTER TABLE treehole_violations ADD CONSTRAINT fk_treehole_violations_post_id FOREIGN KEY (post_id) REFERENCES treehole_posts(id) ON DELETE RESTRICT;

ALTER TABLE treehole_violations ADD CONSTRAINT fk_treehole_violations_comment_id FOREIGN KEY (comment_id) REFERENCES treehole_comments(id) ON DELETE RESTRICT;

ALTER TABLE treehole_violations ADD CONSTRAINT fk_treehole_violations_review_id FOREIGN KEY (review_id) REFERENCES treehole_reviews(id) ON DELETE RESTRICT;

ALTER TABLE treehole_penalties ADD CONSTRAINT fk_treehole_penalties_user_id FOREIGN KEY (user_id) REFERENCES miniapp_users(id) ON DELETE RESTRICT;

ALTER TABLE treehole_penalties ADD CONSTRAINT fk_treehole_penalties_trigger_violation_id FOREIGN KEY (trigger_violation_id) REFERENCES treehole_violations(id) ON DELETE RESTRICT;

ALTER TABLE treehole_penalties ADD CONSTRAINT fk_treehole_penalties_review_id FOREIGN KEY (review_id) REFERENCES treehole_reviews(id) ON DELETE RESTRICT;

ALTER TABLE treehole_penalties ADD CONSTRAINT fk_treehole_penalties_operator_id FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE treehole_penalties ADD CONSTRAINT fk_treehole_penalties_supersedes_penalty_id FOREIGN KEY (supersedes_penalty_id) REFERENCES treehole_penalties(id) ON DELETE RESTRICT;

ALTER TABLE treehole_penalties ADD CONSTRAINT fk_treehole_penalties_revoke_operator_id FOREIGN KEY (revoke_operator_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE treehole_penalty_contents ADD CONSTRAINT fk_treehole_penalty_contents_penalty_id FOREIGN KEY (penalty_id) REFERENCES treehole_penalties(id) ON DELETE RESTRICT;

ALTER TABLE treehole_penalty_contents ADD CONSTRAINT fk_treehole_penalty_contents_post_id FOREIGN KEY (post_id) REFERENCES treehole_posts(id) ON DELETE RESTRICT;

ALTER TABLE treehole_penalty_contents ADD CONSTRAINT fk_treehole_penalty_contents_comment_id FOREIGN KEY (comment_id) REFERENCES treehole_comments(id) ON DELETE RESTRICT;

ALTER TABLE treehole_appeals ADD CONSTRAINT fk_treehole_appeals_penalty_id FOREIGN KEY (penalty_id) REFERENCES treehole_penalties(id) ON DELETE RESTRICT;

ALTER TABLE treehole_appeals ADD CONSTRAINT fk_treehole_appeals_user_id FOREIGN KEY (user_id) REFERENCES miniapp_users(id) ON DELETE RESTRICT;

ALTER TABLE treehole_appeals ADD CONSTRAINT fk_treehole_appeals_operator_id FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE treehole_user_states ADD CONSTRAINT fk_treehole_user_states_user_id FOREIGN KEY (user_id) REFERENCES miniapp_users(id) ON DELETE RESTRICT;

ALTER TABLE treehole_comments ADD CONSTRAINT fk_treehole_comments_reply FOREIGN KEY (reply_to_comment_id,post_id) REFERENCES treehole_comments(id,post_id) ON DELETE RESTRICT;

COMMIT;

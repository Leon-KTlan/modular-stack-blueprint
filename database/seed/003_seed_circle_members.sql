WITH target_circles AS (
    SELECT circle.id AS circle_id, desired.circle_order
    FROM (VALUES
        ('学习', 0),
        ('表白', 1),
        ('二手', 2)
    ) AS desired(name, circle_order)
    JOIN LATERAL (
        SELECT id
        FROM circles
        WHERE circles.name = desired.name
          AND circles.deleted_at IS NULL
        ORDER BY circles.id
        LIMIT 1
    ) AS circle ON TRUE
),
target_count AS (
    SELECT count(*) AS value FROM target_circles
),
ranked_users AS (
    SELECT id AS user_id, row_number() OVER (ORDER BY id) AS user_rank
    FROM miniapp_users
    WHERE status = 1
),
planned_memberships AS (
    SELECT circle.circle_id, users.user_id
    FROM ranked_users AS users
    CROSS JOIN target_count
    JOIN target_circles AS circle
      ON circle.circle_order = (users.user_rank - 1) % 3
    WHERE target_count.value = 3

    UNION ALL

    SELECT circle.circle_id, users.user_id
    FROM ranked_users AS users
    CROSS JOIN target_count
    JOIN target_circles AS circle
      ON circle.circle_order = users.user_rank % 3
    WHERE target_count.value = 3
      AND users.user_rank % 2 = 0
)
INSERT INTO circle_members (circle_id, user_id)
SELECT circle_id, user_id
FROM planned_memberships
ON CONFLICT (circle_id, user_id) DO NOTHING;

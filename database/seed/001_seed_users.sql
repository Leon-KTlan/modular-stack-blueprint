-- 演示账号：密码均为 Admin123! / User123!
-- Argon2id 哈希参数：m=19456、t=2、p=1；此 SQL 仅作为结构化种子数据示例。
INSERT INTO users (username, password_hash, phone, email, gender, role, status)
VALUES
  ('admin', '$argon2id$v=19$m=19456,p=1,t=2$upRAXNPx8hnR23zTtzKQzw$N4lBZ1qAIcfW5nG9mjtO/xh687uAjo5g1QmZaPFoEy4', '13800000001', 'admin@example.com', 1, 1, 1),
  ('leon', '$argon2id$v=19$m=19456,p=1,t=2$KUpvl0jpkVyfiwvvoDu69w$POoXhiK3CgtxFLIJXtFImGxuVPmMb8qlVrJWYjZ632I', '13800000002', 'leon@example.com', 1, 0, 1),
  ('alice', '$argon2id$v=19$m=19456,p=1,t=2$KUpvl0jpkVyfiwvvoDu69w$POoXhiK3CgtxFLIJXtFImGxuVPmMb8qlVrJWYjZ632I', NULL, 'alice@example.com', 2, 0, 0)
ON DUPLICATE KEY UPDATE
  phone = VALUES(phone),
  email = VALUES(email),
  gender = VALUES(gender),
  role = VALUES(role),
  status = VALUES(status);

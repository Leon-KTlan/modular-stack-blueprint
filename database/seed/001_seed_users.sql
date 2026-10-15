-- 演示账号：密码均为 Admin123! / User123!
-- bcrypt 哈希由服务端 seed 脚本生成；此 SQL 仅作为结构化种子数据示例。
INSERT INTO users (username, password_hash, phone, email, gender, role, status)
VALUES
  ('admin', '$2b$10$vMHby/bfRAN9gnLuSmRyTOBFshbXBUSVV5UfsJyWF3QbiwWOfEb7y', '13800000001', 'admin@example.com', 1, 1, 1),
  ('leon', '$2b$10$tBWfrj/VWTGh/dQtLZrTk.5/1b5JDuvjqz1i27wwEGarwiMDJpCBm', '13800000002', 'leon@example.com', 1, 0, 1),
  ('alice', '$2b$10$tBWfrj/VWTGh/dQtLZrTk.5/1b5JDuvjqz1i27wwEGarwiMDJpCBm', NULL, 'alice@example.com', 2, 0, 0)
ON DUPLICATE KEY UPDATE
  phone = VALUES(phone),
  email = VALUES(email),
  gender = VALUES(gender),
  role = VALUES(role),
  status = VALUES(status);

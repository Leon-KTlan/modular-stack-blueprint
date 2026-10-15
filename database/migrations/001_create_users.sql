CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户 ID',
    username VARCHAR(50) NOT NULL COMMENT '登录账号，同时作为展示名称',
    password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
    phone VARCHAR(20) NULL COMMENT '手机号码',
    email VARCHAR(255) NULL COMMENT '邮箱地址',
    gender TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '性别：0 未设置，1 男，2 女',
    role TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '角色：0 普通用户，1 管理员',
    status TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '状态：0 禁用，1 正常',
    token_version INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'JWT 版本号',
    last_login_at DATETIME NULL COMMENT '最后登录时间',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_username (username),
    UNIQUE KEY uk_users_phone (phone),
    UNIQUE KEY uk_users_email (email),
    KEY idx_users_status (status),
    KEY idx_users_role_status (role, status),
    CONSTRAINT chk_users_gender CHECK (gender IN (0, 1, 2)),
    CONSTRAINT chk_users_role CHECK (role IN (0, 1)),
    CONSTRAINT chk_users_status CHECK (status IN (0, 1))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '用户表';

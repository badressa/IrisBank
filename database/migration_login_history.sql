-- ================================================
-- Migration : historique des connexions
-- ================================================

CREATE TABLE IF NOT EXISTS `login_history` (
  `id`          INT            NOT NULL AUTO_INCREMENT,
  `user_id`     INT            NOT NULL,
  `ip_address`  VARCHAR(45)    NOT NULL DEFAULT '',
  `user_agent`  TEXT,
  `device_type` VARCHAR(50)    DEFAULT 'Inconnu',
  `os`          VARCHAR(80)    DEFAULT '',
  `browser`     VARCHAR(80)    DEFAULT '',
  `created_at`  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_login_history_user_id` (`user_id`),
  CONSTRAINT `fk_lh_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @db_name = DATABASE();

SET @has_login_attempts = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'login_attempts'
);
SET @sql = IF(
  @has_login_attempts = 0,
  'ALTER TABLE `users` ADD COLUMN `login_attempts` INT(11) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_locked_until = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'locked_until'
);
SET @sql = IF(
  @has_locked_until = 0,
  'ALTER TABLE `users` ADD COLUMN `locked_until` DATETIME DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_otp_pending = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'otp_pending'
);
SET @sql = IF(
  @has_otp_pending = 0,
  'ALTER TABLE `users` ADD COLUMN `otp_pending` TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `otp_codes` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL,
  `code_hash` VARCHAR(255) NOT NULL,
  `type` ENUM('login','transfer','password_reset','card_action') NOT NULL DEFAULT 'login',
  `expires_at` DATETIME NOT NULL,
  `used` TINYINT(1) NOT NULL DEFAULT 0,
  `attempts` INT(11) NOT NULL DEFAULT 0,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_otp_user` (`user_id`),
  KEY `idx_otp_expires` (`expires_at`),
  CONSTRAINT `fk_otp_user_repair` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `security_logs` (
  `id` BIGINT(20) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) DEFAULT NULL,
  `event_type` ENUM(
    'login_success','login_failed','otp_sent','otp_success','otp_failed',
    'password_changed','card_blocked','card_created',
    'transfer_initiated','transfer_failed',
    'account_locked','account_unlocked',
    'kyc_submitted','kyc_approved','kyc_rejected',
    'gdpr_export','gdpr_delete',
    'ticket_created','suspicious_activity','admin_action'
  ) NOT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `user_agent` TEXT DEFAULT NULL,
  `details` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_seclog_user` (`user_id`),
  KEY `idx_seclog_event` (`event_type`),
  KEY `idx_seclog_created` (`created_at`),
  CONSTRAINT `fk_seclog_user_repair` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
-- ============================================================
-- MIGRATION 001 : OTP / Code 6 chiffres post-login
-- ============================================================

CREATE TABLE IF NOT EXISTS `otp_codes` (
  `id`         INT(11)       NOT NULL AUTO_INCREMENT,
  `user_id`    INT(11)       NOT NULL,
  `code_hash`  VARCHAR(255)  NOT NULL,
  `type`       ENUM('login','transfer','password_reset','card_action') NOT NULL DEFAULT 'login',
  `expires_at` DATETIME      NOT NULL,
  `used`       TINYINT(1)    NOT NULL DEFAULT 0,
  `attempts`   INT(11)       NOT NULL DEFAULT 0,
  `ip_address` VARCHAR(45)   DEFAULT NULL,
  `created_at` TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_otp_user` (`user_id`),
  KEY `idx_otp_expires` (`expires_at`),
  CONSTRAINT `fk_otp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Ajouter colonnes OTP sur users
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `login_attempts`   INT(11)   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `locked_until`     DATETIME  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `otp_pending`      TINYINT(1) NOT NULL DEFAULT 0;

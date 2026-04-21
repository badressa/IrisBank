-- ============================================================
-- MIGRATION 005 : Logs sécurité + RGPD + CGU
-- ============================================================

-- Logs de sécurité
CREATE TABLE IF NOT EXISTS `security_logs` (
  `id`          BIGINT(20)   NOT NULL AUTO_INCREMENT,
  `user_id`     INT(11)      DEFAULT NULL,
  `event_type`  ENUM(
    'login_success','login_failed','otp_sent','otp_success','otp_failed',
    'password_changed','card_blocked','card_created',
    'transfer_initiated','transfer_failed',
    'account_locked','account_unlocked',
    'kyc_submitted','kyc_approved','kyc_rejected',
    'gdpr_export','gdpr_delete',
    'ticket_created','suspicious_activity','admin_action'
  ) NOT NULL,
  `ip_address`  VARCHAR(45)  DEFAULT NULL,
  `user_agent`  TEXT         DEFAULT NULL,
  `details`     JSON         DEFAULT NULL,
  `created_at`  TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_seclog_user`    (`user_id`),
  KEY `idx_seclog_event`   (`event_type`),
  KEY `idx_seclog_created` (`created_at`),
  CONSTRAINT `fk_seclog_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- CGU versionnées
CREATE TABLE IF NOT EXISTS `terms_versions` (
  `id`             INT(11)     NOT NULL AUTO_INCREMENT,
  `version`        VARCHAR(10) NOT NULL,
  `content`        LONGTEXT    NOT NULL,
  `effective_date` DATE        NOT NULL,
  `is_current`     TINYINT(1)  NOT NULL DEFAULT 0,
  `created_at`     TIMESTAMP   NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_version` (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Consentements RGPD par user
CREATE TABLE IF NOT EXISTS `user_consents` (
  `id`               INT(11)    NOT NULL AUTO_INCREMENT,
  `user_id`          INT(11)    NOT NULL,
  `terms_version_id` INT(11)    NOT NULL,
  `accepted`         TINYINT(1) NOT NULL DEFAULT 0,
  `accepted_at`      TIMESTAMP  NULL DEFAULT CURRENT_TIMESTAMP,
  `ip_address`       VARCHAR(45) DEFAULT NULL,
  `user_agent`       TEXT        DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_consent` (`user_id`,`terms_version_id`),
  CONSTRAINT `fk_consent_user`  FOREIGN KEY (`user_id`)          REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_consent_terms` FOREIGN KEY (`terms_version_id`) REFERENCES `terms_versions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Ajouter colonnes RGPD sur users
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `gdpr_accepted_at`  DATETIME DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `deleted_at`        DATETIME DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `anonymized`        TINYINT(1) NOT NULL DEFAULT 0;

-- CGU v1 par défaut
INSERT IGNORE INTO `terms_versions` (`version`, `content`, `effective_date`, `is_current`)
VALUES ('1.0', 'Conditions Générales d''Utilisation IRISBANK v1.0 — en vigueur à compter du 17/04/2026.', CURDATE(), 1);

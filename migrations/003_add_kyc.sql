-- ============================================================
-- MIGRATION 003 : KYC — Vérification d'identité par document
-- ============================================================

CREATE TABLE IF NOT EXISTS `kyc_verifications` (
  `id`                 INT(11)      NOT NULL AUTO_INCREMENT,
  `user_id`            INT(11)      NOT NULL,
  `status`             ENUM('not_started','pending','in_review','approved','rejected') NOT NULL DEFAULT 'not_started',
  `document_type`      ENUM('passport','national_id','driving_license') DEFAULT NULL,
  `document_front_url` VARCHAR(500) DEFAULT NULL,
  `document_back_url`  VARCHAR(500) DEFAULT NULL,
  `selfie_url`         VARCHAR(500) DEFAULT NULL,
  `rejection_reason`   TEXT         DEFAULT NULL,
  `reviewer_id`        INT(11)      DEFAULT NULL,
  `reviewer_notes`     TEXT         DEFAULT NULL,
  `submitted_at`       TIMESTAMP    NULL DEFAULT NULL,
  `reviewed_at`        TIMESTAMP    NULL DEFAULT NULL,
  `created_at`         TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         TIMESTAMP    NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_kyc_user` (`user_id`),
  KEY `idx_kyc_status` (`status`),
  CONSTRAINT `fk_kyc_user`     FOREIGN KEY (`user_id`)     REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_kyc_reviewer` FOREIGN KEY (`reviewer_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Ajouter colonne kyc_status sur users (résumé rapide)
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `kyc_status` ENUM('not_started','pending','approved','rejected') NOT NULL DEFAULT 'not_started';

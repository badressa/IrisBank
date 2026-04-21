-- ============================================================
-- MIGRATION 002 : Cartes physiques & virtuelles
-- ============================================================

CREATE TABLE IF NOT EXISTS `cards` (
  `id`            INT(11)      NOT NULL AUTO_INCREMENT,
  `account_id`    INT(11)      NOT NULL,
  `user_id`       INT(11)      NOT NULL,
  `card_type`     ENUM('virtual','physical') NOT NULL DEFAULT 'virtual',
  `status`        ENUM('active','blocked','expired','pending_delivery','cancelled') NOT NULL DEFAULT 'pending_delivery',
  `masked_number` VARCHAR(19)  DEFAULT NULL,   -- ex: **** **** **** 4242
  `last4`         CHAR(4)      DEFAULT NULL,
  `expiry_date`   DATE         DEFAULT NULL,
  `cvv_hash`      VARCHAR(255) DEFAULT NULL,   -- SHA-256, jamais en clair
  `pin_hash`      VARCHAR(255) DEFAULT NULL,   -- bcrypt
  `network`       ENUM('VISA','MASTERCARD') NOT NULL DEFAULT 'VISA',
  `delivery_address` VARCHAR(255) DEFAULT NULL,
  `created_at`    TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP    NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_card_account` (`account_id`),
  KEY `idx_card_user`    (`user_id`),
  CONSTRAINT `fk_card_account` FOREIGN KEY (`account_id`) REFERENCES `comptes_bancaires` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_card_user`    FOREIGN KEY (`user_id`)    REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

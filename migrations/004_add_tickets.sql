-- ============================================================
-- MIGRATION 004 : Tickets support client
-- ============================================================

CREATE TABLE IF NOT EXISTS `support_tickets` (
  `id`             INT(11)      NOT NULL AUTO_INCREMENT,
  `ticket_number`  VARCHAR(20)  NOT NULL,
  `user_id`        INT(11)      NOT NULL,
  `assigned_to`    INT(11)      DEFAULT NULL,
  `category`       ENUM('card','transfer','account','kyc','fraud','security','other') NOT NULL DEFAULT 'other',
  `priority`       ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  `status`         ENUM('open','in_progress','waiting_user','resolved','closed') NOT NULL DEFAULT 'open',
  `subject`        VARCHAR(255) NOT NULL,
  `description`    TEXT         NOT NULL,
  `resolved_at`    TIMESTAMP    NULL DEFAULT NULL,
  `created_at`     TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP    NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_ticket_number` (`ticket_number`),
  KEY `idx_ticket_user`   (`user_id`),
  KEY `idx_ticket_status` (`status`),
  CONSTRAINT `fk_ticket_user`     FOREIGN KEY (`user_id`)     REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ticket_assigned` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `ticket_messages` (
  `id`          INT(11)    NOT NULL AUTO_INCREMENT,
  `ticket_id`   INT(11)    NOT NULL,
  `sender_id`   INT(11)    NOT NULL,
  `message`     TEXT       NOT NULL,
  `is_internal` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`  TIMESTAMP  NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tmsg_ticket` (`ticket_id`),
  CONSTRAINT `fk_tmsg_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tmsg_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

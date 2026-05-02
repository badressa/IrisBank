ALTER TABLE `users`
  ADD COLUMN `secret_code_hash` VARCHAR(255) NULL DEFAULT NULL AFTER `password_hash`;
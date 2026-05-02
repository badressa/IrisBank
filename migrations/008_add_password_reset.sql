-- Migration 008: ajout des colonnes de réinitialisation du mot de passe
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_reset_token  VARCHAR(255) NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS password_reset_expires DATETIME    NULL DEFAULT NULL;

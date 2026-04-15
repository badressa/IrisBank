-- ================================================
-- 📧 MIGRATION: Ajouter colonnes de vérification d'email
-- ================================================
-- Exécutez ce script dans phpMyAdmin ou MySQL Client

-- Ajouter colonne email_verified (0 = non vérifié, 1 = vérifié)
ALTER TABLE users ADD COLUMN email_verified TINYINT(1) DEFAULT 0 AFTER is_admin;

-- Ajouter colonne verification_token (stocke le token d'activation)
ALTER TABLE users ADD COLUMN verification_token VARCHAR(255) NULL AFTER email_verified;

-- Ajouter colonne token_expiry (date d'expiration du token)
ALTER TABLE users ADD COLUMN token_expiry DATETIME NULL AFTER verification_token;

-- ================================================
-- Vérification
-- ================================================
-- Pour vérifier que les colonnes ont bien été ajoutées:
-- DESCRIBE users;
-- Vous devez voir les 3 nouvelles colonnes à la fin.

-- ================================================
-- Optionnel: Marquer les utilisateurs existants comme vérifiés
-- ================================================
-- Si vous avez déjà des utilisateurs qui doivent l'accès immédiat:
-- UPDATE users SET email_verified = 1 WHERE email_verified = 0;

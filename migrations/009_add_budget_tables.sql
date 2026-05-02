-- Migration 009 : tables du module Budget
CREATE TABLE IF NOT EXISTS budget_categories (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  nom      VARCHAR(100) NOT NULL,
  icone    VARCHAR(10)  NOT NULL DEFAULT '💰',
  couleur  VARCHAR(20)  NOT NULL DEFAULT '#4f7cff',
  UNIQUE KEY uq_nom (nom)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Catégories par défaut
INSERT IGNORE INTO budget_categories (nom, icone, couleur) VALUES
  ('Alimentation',        '🛒', '#22c55e'),
  ('Transport',           '🚗', '#3b82f6'),
  ('Logement',            '🏠', '#8b5cf6'),
  ('Santé',               '💊', '#ef4444'),
  ('Loisirs',             '🎮', '#f97316'),
  ('Restauration',        '🍽️', '#eab308'),
  ('Vêtements',           '👗', '#ec4899'),
  ('Éducation',           '📚', '#06b6d4'),
  ('Épargne',             '🏦', '#14b8a6'),
  ('Abonnements',         '📱', '#6366f1'),
  ('Voyages',             '✈️', '#f59e0b'),
  ('Divers',              '📦', '#64748b');

CREATE TABLE IF NOT EXISTS budget_limites (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  categorie_id  INT NOT NULL,
  plafond       DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_cat (user_id, categorie_id),
  FOREIGN KEY (categorie_id) REFERENCES budget_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS budget_paiements (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  user_id             INT NOT NULL,
  compte_source_id    INT NOT NULL,
  categorie_id        INT NOT NULL,
  montant             DECIMAL(10,2) NOT NULL,
  description         VARCHAR(255),
  recurrent           TINYINT(1) NOT NULL DEFAULT 0,
  statut              ENUM('ACTIF','ANNULE','TERMINE') NOT NULL DEFAULT 'ACTIF',
  prochaine_echeance  DATE,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (categorie_id) REFERENCES budget_categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS budget_historique (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  paiement_id  INT NOT NULL,
  user_id      INT NOT NULL,
  montant      DECIMAL(10,2) NOT NULL,
  mois         TINYINT NOT NULL,
  annee        SMALLINT NOT NULL,
  executed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (paiement_id) REFERENCES budget_paiements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

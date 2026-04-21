// middleware/authMiddleware.js — VERSION AMÉLIORÉE
// Ajoute : requireKyc, requireConsent

const db = require("../config/db");

// Utilisateur connecté
exports.requireAuth = (req, res, next) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Non connecté" });
  }
  next();
};

// Admin uniquement
exports.requireAdmin = (req, res, next) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Non connecté" });
  }
  if (req.session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Accès admin requis" });
  }
  next();
};

// KYC approuvé (pour les opérations sensibles : virement > seuil, carte physique, etc.)
exports.requireKyc = async (req, res, next) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Non connecté" });
  }

  const [rows] = await db.query(
    "SELECT kyc_status FROM users WHERE id = ?",
    [req.session.user.id]
  );

  if (!rows.length || rows[0].kyc_status !== "approved") {
    return res.status(403).json({
      error: "Vérification d'identité (KYC) requise pour cette opération.",
      requiresKyc: true
    });
  }

  next();
};

// CGU acceptées (vérifier à chaque requête sensible ou au login)
exports.requireConsent = async (req, res, next) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Non connecté" });
  }

  const [terms] = await db.query(
    "SELECT id FROM terms_versions WHERE is_current = 1 LIMIT 1"
  );

  if (!terms.length) return next(); // Pas de CGU configurée, on laisse passer

  const [consents] = await db.query(
    "SELECT id FROM user_consents WHERE user_id = ? AND terms_version_id = ? AND accepted = 1",
    [req.session.user.id, terms[0].id]
  );

  if (!consents.length) {
    return res.status(403).json({
      error: "Vous devez accepter les nouvelles Conditions Générales d'Utilisation.",
      requiresConsent: true
    });
  }

  next();
};

// controllers/rgpdController.js
const db     = require("../config/db");
const secLog = require("../services/securityLogger");

// ==============================
// EXPORT MES DONNÉES (Art. 20 RGPD)
// ==============================
exports.exportData = async (req, res) => {
  const userId = req.session.user.id;

  try {
    const [[user]] = await db.query(
      `SELECT id, nom, prenom, email, telephone, adresse,
              date_naissance, role, created_at, kyc_status
       FROM users WHERE id = ?`,
      [userId]
    );

    const [accounts] = await db.query(
      "SELECT id, iban, type, solde, statut, created_at FROM comptes_bancaires WHERE user_id = ?",
      [userId]
    );

    const [transactions] = await db.query(
      `SELECT t.id, t.type, t.montant, t.description, t.created_at,
              s.iban AS source_iban, d.iban AS dest_iban
       FROM transactions t
       LEFT JOIN comptes_bancaires s ON s.id = t.compte_source_id
       LEFT JOIN comptes_bancaires d ON d.id = t.compte_destination_id
       WHERE s.user_id = ? OR d.user_id = ?
       ORDER BY t.created_at DESC`,
      [userId, userId]
    );

    const [tickets] = await db.query(
      "SELECT id, ticket_number, category, status, subject, created_at FROM support_tickets WHERE user_id = ?",
      [userId]
    );

    const exportData = {
      export_date: new Date().toISOString(),
      user,
      accounts,
      transactions,
      tickets
    };

    await secLog.log({ userId, eventType: "gdpr_export", req });

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="irisbank_data_${userId}.json"`);
    return res.json(exportData);
  } catch (err) {
    console.error("RGPD EXPORT ERROR:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// ==============================
// SUPPRIMER MON COMPTE (Art. 17 RGPD — Droit à l'oubli)
// Anonymisation : les données financières sont conservées (obligation légale 10 ans)
// mais détachées de l'identité
// ==============================
exports.deleteAccount = async (req, res) => {
  const userId = req.session.user.id;

  try {
    // Vérifier qu'il n'y a pas de solde restant
    const [accounts] = await db.query(
      "SELECT SUM(solde) AS total FROM comptes_bancaires WHERE user_id = ? AND statut = 'ACTIF'",
      [userId]
    );

    if (Number(accounts[0].total) > 0) {
      return res.status(400).json({
        error: "Vous ne pouvez pas supprimer votre compte tant que vos comptes bancaires ont un solde positif."
      });
    }

    // Anonymiser l'utilisateur (ne pas supprimer — obligation légale)
    await db.query(
      `UPDATE users SET
         nom              = 'Supprimé',
         prenom           = 'RGPD',
         email            = CONCAT('deleted_', id, '@anonymized.local'),
         telephone        = NULL,
         adresse          = NULL,
         date_naissance   = NULL,
         password_hash    = '***DELETED***',
         email_verified   = 0,
         verification_token = NULL,
         token_expiry     = NULL,
         deleted_at       = NOW(),
         anonymized       = 1
       WHERE id = ?`,
      [userId]
    );

    await secLog.log({ userId, eventType: "gdpr_delete", req });

    // Détruire la session
    req.session.destroy(() => {
      res.clearCookie("irisbank.sid");
      return res.json({ message: "Votre compte a été anonymisé conformément au RGPD." });
    });
  } catch (err) {
    console.error("RGPD DELETE ERROR:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// ==============================
// ACCEPTER LES CGU
// ==============================
exports.acceptTerms = async (req, res) => {
  const userId = req.session.user.id;

  try {
    // Récupérer la version courante
    const [terms] = await db.query(
      "SELECT id, version FROM terms_versions WHERE is_current = 1 LIMIT 1"
    );

    if (!terms.length) {
      return res.status(500).json({ error: "Aucune version de CGU disponible" });
    }

    const termsId = terms[0].id;
    const ip      = req.headers["x-forwarded-for"] || req.socket?.remoteAddress;
    const ua      = req.headers["user-agent"];

    await db.query(
      `INSERT INTO user_consents (user_id, terms_version_id, accepted, ip_address, user_agent)
       VALUES (?, ?, 1, ?, ?)
       ON DUPLICATE KEY UPDATE accepted = 1, accepted_at = NOW(), ip_address = ?, user_agent = ?`,
      [userId, termsId, ip, ua, ip, ua]
    );

    await db.query(
      "UPDATE users SET gdpr_accepted_at = NOW() WHERE id = ?",
      [userId]
    );

    return res.json({ message: "CGU acceptées", version: terms[0].version });
  } catch (err) {
    console.error("ACCEPT TERMS ERROR:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// ==============================
// VÉRIFIER SI L'USER A ACCEPTÉ LES CGU COURANTES
// ==============================
exports.checkConsent = async (req, res) => {
  const userId = req.session.user.id;

  const [terms] = await db.query(
    "SELECT id, version FROM terms_versions WHERE is_current = 1 LIMIT 1"
  );

  if (!terms.length) return res.json({ hasAccepted: true });

  const [consents] = await db.query(
    "SELECT id FROM user_consents WHERE user_id = ? AND terms_version_id = ? AND accepted = 1",
    [userId, terms[0].id]
  );

  return res.json({
    hasAccepted:    consents.length > 0,
    currentVersion: terms[0].version
  });
};

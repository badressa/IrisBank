const { validationResult } = require("express-validator");
const db = require("../config/db");

// ==============================
// GENERATE FAKE IBAN
// Format attendu : FR76-YBNK-XXXX-XXXX-XXXX
// ==============================
function generateFakeIban() {
  const randomBlock = () =>
    String(Math.floor(Math.random() * 10000)).padStart(4, "0");

  return `FR76-YBNK-${randomBlock()}-${randomBlock()}-${randomBlock()}`;
}

// ==============================
// LIST MY ACCOUNTS
// ==============================
exports.listMine = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [rows] = await db.query(
      `SELECT id, iban, type, solde, statut, created_at
       FROM comptes_bancaires
       WHERE user_id = ?
       ORDER BY id DESC`,
      [userId]
    );

    return res.json({ comptes: rows });
  } catch (err) {
    console.error("LIST ACCOUNTS ERROR :", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// ==============================
// GET ONE ACCOUNT
// ==============================
exports.getOneMine = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: errors.array()[0].msg,
      errors: errors.array()
    });
  }

  try {
    const userId = req.session.user.id;
    const accountId = Number(req.params.id);

    if (!accountId || Number.isNaN(accountId)) {
      return res.status(400).json({ error: "ID de compte invalide" });
    }

    const [rows] = await db.query(
      `SELECT id, iban, type, solde, statut, created_at
       FROM comptes_bancaires
       WHERE id = ? AND user_id = ?`,
      [accountId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Compte introuvable" });
    }

    return res.json({ compte: rows[0] });
  } catch (err) {
    console.error("GET ACCOUNT ERROR :", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// ==============================
// CREATE ACCOUNT
// ==============================
exports.create = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: errors.array()[0].msg,
      errors: errors.array()
    });
  }

  const userId = req.session.user.id;
  const { type } = req.body;

  const allowedTypes = ["COURANT", "LIVRET_A", "PEL"];

  if (!type || !allowedTypes.includes(type)) {
    return res.status(400).json({ error: "Type de compte invalide" });
  }

  try {
    const [userRows] = await db.query(
      "SELECT nom, prenom FROM users WHERE id = ? LIMIT 1",
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    const user = userRows[0];

    const [existingAccounts] = await db.query(
      "SELECT COUNT(*) AS total FROM comptes_bancaires WHERE user_id = ?",
      [userId]
    );

    if (existingAccounts[0].total >= 10) {
      return res.status(400).json({
        error: "Nombre maximum de comptes atteint"
      });
    }

    let iban = generateFakeIban();
    let foundUnique = false;

    for (let i = 0; i < 10; i++) {
      const [exists] = await db.query(
        "SELECT id FROM comptes_bancaires WHERE iban = ?",
        [iban]
      );

      if (exists.length === 0) {
        foundUnique = true;
        break;
      }

      iban = generateFakeIban();
    }

    if (!foundUnique) {
      return res.status(500).json({
        error: "Impossible de générer un IBAN unique"
      });
    }

    const [result] = await db.query(
      `INSERT INTO comptes_bancaires (user_id, iban, type, solde, statut)
       VALUES (?, ?, ?, 0.00, 'ACTIF')`,
      [userId, iban, type]
    );

    const [rows] = await db.query(
      `SELECT id, iban, type, solde, statut, created_at
       FROM comptes_bancaires
       WHERE id = ?`,
      [result.insertId]
    );

    await db.query(
      "INSERT INTO notifications (message, type) VALUES (?, ?)",
      [
        `Nouveau compte ${type} créé pour ${user.prenom} ${user.nom} (${iban})`,
        "NEW_ACCOUNT"
      ]
    );

    return res.status(201).json({
      message: "Compte créé",
      compte: rows[0]
    });
  } catch (err) {
    console.error("CREATE ACCOUNT ERROR :", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// ==============================
// DELETE ACCOUNT
// ==============================
exports.remove = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: errors.array()[0].msg,
      errors: errors.array()
    });
  }

  try {
    const userId = req.session.user.id;
    const accountId = Number(req.params.id);

    if (!accountId || Number.isNaN(accountId)) {
      return res.status(400).json({ error: "ID de compte invalide" });
    }

    const [userRows] = await db.query(
      "SELECT nom, prenom FROM users WHERE id = ? LIMIT 1",
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    const user = userRows[0];

    const [rows] = await db.query(
      `SELECT id, iban, solde, statut
       FROM comptes_bancaires
       WHERE id = ? AND user_id = ?`,
      [accountId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Compte introuvable" });
    }

    if (String(rows[0].statut).toUpperCase() === "BLOQUE") {
      return res.status(400).json({
        error: "Impossible de supprimer un compte bloqué"
      });
    }

    if (Number(rows[0].solde) !== 0) {
      return res.status(400).json({
        error: "Impossible de supprimer : solde non nul"
      });
    }

    const iban = rows[0].iban;

    await db.query(
      `DELETE FROM comptes_bancaires WHERE id = ? AND user_id = ?`,
      [accountId, userId]
    );

    await db.query(
      "INSERT INTO notifications (message, type) VALUES (?, ?)",
      [
        `Compte supprimé par ${user.prenom} ${user.nom} (${iban})`,
        "DELETE_ACCOUNT"
      ]
    );

    return res.json({ message: "Compte supprimé" });
  } catch (err) {
    console.error("DELETE ACCOUNT ERROR :", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};
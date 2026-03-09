const { validationResult } = require("express-validator");
const db = require("../config/db");

function generateFakeIban() {
  const country = "FR";
  const check = String(Math.floor(Math.random() * 90) + 10);
  const body = Array.from({ length: 23 }, () =>
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".charAt(
      Math.floor(Math.random() * 36)
    )
  ).join("");
  return `${country}${check}${body}`;
}

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

    res.json({ comptes: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOneMine = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const userId = req.session.user.id;
    const accountId = Number(req.params.id);

    if (!accountId || isNaN(accountId)) {
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

    res.json({ compte: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const userId = req.session.user.id;
  const { type } = req.body;

  const allowedTypes = ["COURANT", "LIVRET_A", "PEL"];
  if (!type || !allowedTypes.includes(type)) {
    return res.status(400).json({ error: "Type de compte invalide" });
  }

  try {
    const [existingAccounts] = await db.query(
      "SELECT COUNT(*) AS total FROM comptes_bancaires WHERE user_id = ?",
      [userId]
    );

    if (existingAccounts[0].total >= 10) {
      return res.status(400).json({ error: "Nombre maximum de comptes atteint" });
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
      return res.status(500).json({ error: "Impossible de générer un IBAN unique" });
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

    res.status(201).json({ message: "Compte créé", compte: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const userId = req.session.user.id;
    const accountId = Number(req.params.id);

    if (!accountId || isNaN(accountId)) {
      return res.status(400).json({ error: "ID de compte invalide" });
    }

    const [rows] = await db.query(
      `SELECT id, solde, statut
       FROM comptes_bancaires
       WHERE id = ? AND user_id = ?`,
      [accountId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Compte introuvable" });
    }

    if (String(rows[0].statut).toUpperCase() === "BLOQUE") {
      return res.status(400).json({ error: "Impossible de supprimer un compte bloqué" });
    }

    if (Number(rows[0].solde) !== 0) {
      return res.status(400).json({ error: "Impossible de supprimer : solde non nul" });
    }

    await db.query(
      `DELETE FROM comptes_bancaires WHERE id = ? AND user_id = ?`,
      [accountId, userId]
    );

    res.json({ message: "Compte supprimé" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
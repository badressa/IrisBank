const db = require("../config/db");

// ==============================
// OUTILS VALIDATION
// ==============================
function isValidAmount(value) {
  if (value === undefined || value === null || value === "") {
    return false;
  }

  const amount = Number(value);

  if (Number.isNaN(amount) || amount <= 0) {
    return false;
  }

  return /^\d+(\.\d{1,2})?$/.test(String(value).trim());
}

// ==============================
// DEPOT
// ==============================
exports.deposit = async (req, res) => {
  const { accountId, amount } = req.body;
  const userId = req.session.user.id;

  if (!isValidAmount(amount)) {
    return res.status(400).json({
      error: "Le montant doit être positif avec 2 décimales maximum"
    });
  }

  const amountNumber = Number(amount);

  if (amountNumber < 1) {
    return res.status(400).json({
      error: "Le dépôt minimum est de 1€"
    });
  }

  try {
    const [account] = await db.query(
      "SELECT iban, statut FROM comptes_bancaires WHERE id = ? AND user_id = ?",
      [accountId, userId]
    );

    if (account.length === 0) {
      return res.status(403).json({
        error: "Compte non autorisé"
      });
    }

    if (account[0].statut === "BLOQUE") {
      return res.status(400).json({
        error: "Compte bloqué"
      });
    }

    await db.query(
      "UPDATE comptes_bancaires SET solde = solde + ? WHERE id = ?",
      [amountNumber, accountId]
    );

    await db.query(
      "INSERT INTO transactions (type, montant, compte_destination_id) VALUES ('DEPOT', ?, ?)",
      [amountNumber, accountId]
    );

    await db.query(
      "INSERT INTO notifications (message, type, user_id) VALUES (?, ?, ?)",
      [
        `💰 Dépôt de ${amountNumber.toFixed(2)}€ sur votre compte ****${account[0].iban.slice(-4)}`,
        "DEPOSIT",
        userId
      ]
    );

    return res.json({
      message: "Dépôt effectué"
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Erreur serveur"
    });
  }
};

// ==============================
// RETRAIT
// ==============================
exports.withdraw = async (req, res) => {
  const { accountId, amount } = req.body;
  const userId = req.session.user.id;

  if (!isValidAmount(amount)) {
    return res.status(400).json({
      error: "Le montant doit être positif avec 2 décimales maximum"
    });
  }

  const amountNumber = Number(amount);

  if (amountNumber < 1) {
    return res.status(400).json({
      error: "Le retrait minimum est de 1€"
    });
  }

  if (amountNumber > 1000) {
    return res.status(400).json({
      error: "Le retrait maximum autorisé est de 1000€"
    });
  }

  try {
    const [rows] = await db.query(
      "SELECT solde, statut, iban FROM comptes_bancaires WHERE id = ? AND user_id = ?",
      [accountId, userId]
    );

    if (rows.length === 0) {
      return res.status(403).json({
        error: "Compte non autorisé"
      });
    }

    if (rows[0].statut === "BLOQUE") {
      return res.status(400).json({
        error: "Compte bloqué"
      });
    }

    if (Number(rows[0].solde) < amountNumber) {
      return res.status(400).json({
        error: "Solde insuffisant"
      });
    }

    await db.query(
      "UPDATE comptes_bancaires SET solde = solde - ? WHERE id = ?",
      [amountNumber, accountId]
    );

    await db.query(
      "INSERT INTO transactions (type, montant, compte_source_id) VALUES ('RETRAIT', ?, ?)",
      [amountNumber, accountId]
    );

    await db.query(
      "INSERT INTO notifications (message, type, user_id) VALUES (?, ?, ?)",
      [
        `💸 Retrait de ${amountNumber.toFixed(2)}€ depuis votre compte ****${rows[0].iban.slice(-4)}`,
        "WITHDRAW",
        userId
      ]
    );

    return res.json({
      message: "Retrait effectué"
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Erreur serveur"
    });
  }
};

// ==============================
// VIREMENT
// ==============================
exports.transfer = async (req, res) => {
  const { fromAccountId, toIban, amount } = req.body;
  const userId = req.session.user.id;

  if (!isValidAmount(amount)) {
    return res.status(400).json({
      error: "Le montant doit être positif avec 2 décimales maximum"
    });
  }

  const amountNumber = Number(amount);

  if (amountNumber < 1) {
    return res.status(400).json({
      error: "Le virement minimum est de 1€"
    });
  }

  if (!toIban || typeof toIban !== "string") {
    return res.status(400).json({
      error: "IBAN destinataire invalide"
    });
  }

  const toIbanClean = toIban.trim().toUpperCase();

  let connection;

  try {
    const [userRows] = await db.query(
      "SELECT nom, prenom FROM users WHERE id = ?",
      [userId]
    );

    const user = userRows[0];

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [source] = await connection.query(
      "SELECT id, solde, statut, iban FROM comptes_bancaires WHERE id = ? AND user_id = ? FOR UPDATE",
      [fromAccountId, userId]
    );

    if (source.length === 0) {
      await connection.rollback();
      return res.status(403).json({
        error: "Compte source non autorisé"
      });
    }

    if (source[0].statut === "BLOQUE") {
      await connection.rollback();
      return res.status(400).json({
        error: "Compte bloqué"
      });
    }

    if (Number(source[0].solde) < amountNumber) {
      await connection.rollback();
      return res.status(400).json({
        error: "Solde insuffisant"
      });
    }

    const [dest] = await connection.query(
      "SELECT id, iban, statut, user_id FROM comptes_bancaires WHERE iban = ? FOR UPDATE",
      [toIbanClean]
    );

    if (dest.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        error: "Compte destination introuvable"
      });
    }

    const destId = dest[0].id;
    const destUserId = dest[0].user_id;

    if (!destUserId) {
      console.error("ERREUR user_id destination NULL");
    }

    if (destId === Number(fromAccountId)) {
      await connection.rollback();
      return res.status(400).json({
        error: "Impossible de se virer à soi-même"
      });
    }

    if (dest[0].statut === "BLOQUE") {
      await connection.rollback();
      return res.status(400).json({
        error: "Compte destination bloqué"
      });
    }

    // transfert
    await connection.query(
      "UPDATE comptes_bancaires SET solde = solde - ? WHERE id = ?",
      [amountNumber, fromAccountId]
    );

    await connection.query(
      "UPDATE comptes_bancaires SET solde = solde + ? WHERE id = ?",
      [amountNumber, destId]
    );

    await connection.query(
      "INSERT INTO transactions (type, montant, compte_source_id, compte_destination_id) VALUES ('VIREMENT', ?, ?, ?)",
      [amountNumber, fromAccountId, destId]
    );

    // notif expéditeur
    await connection.query(
      "INSERT INTO notifications (message, type, user_id) VALUES (?, ?, ?)",
      [
        `📤 Virement de ${amountNumber.toFixed(2)}€ envoyé`,
        "TRANSFER",
        userId
      ]
    );

    // notif destinataire
    if (destUserId) {
      await connection.query(
        "INSERT INTO notifications (message, type, user_id) VALUES (?, ?, ?)",
        [
          `💰 Vous avez reçu ${amountNumber.toFixed(2)}€ de ${user.prenom} ${user.nom}`,
          "TRANSFER_RECEIVED",
          destUserId
        ]
      );
    }

    await connection.commit();

    return res.json({
      message: "Virement effectué"
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }

    console.error(err);
    return res.status(500).json({
      error: "Erreur serveur"
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// ==============================
// HISTORIQUE
// ==============================
exports.history = async (req, res) => {
  const accountId = Number(req.params.accountId);
  const userId = req.session.user.id;

  try {
    const [account] = await db.query(
      "SELECT id FROM comptes_bancaires WHERE id = ? AND user_id = ?",
      [accountId, userId]
    );

    if (account.length === 0) {
      return res.status(403).json({
        error: "Accès refusé"
      });
    }

    const [rows] = await db.query(
      `SELECT * FROM transactions
       WHERE compte_source_id = ? OR compte_destination_id = ?
       ORDER BY created_at DESC`,
      [accountId, accountId]
    );

    return res.json({
      transactions: rows
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Erreur serveur"
    });
  }
};
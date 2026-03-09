const db = require("../config/db");

// CLIENTS

exports.getAllClients = async (req, res) => {
  try {
    const [clients] = await db.query(
      "SELECT id, nom, prenom, email FROM users WHERE role = 'CLIENT'"
    );

    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// CLIENT DETAIL

exports.getClient = async (req, res) => {
  try {
    const [client] = await db.query(
      "SELECT * FROM users WHERE id = ?",
      [req.params.id]
    );

    if (client.length === 0) {
      return res.status(404).json({ error: "Client introuvable" });
    }

    res.json(client[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// UPDATE CLIENT

exports.updateClient = async (req, res) => {
  try {
    const { nom, prenom, email } = req.body;

    await db.query(
      "UPDATE users SET nom = ?, prenom = ?, email = ? WHERE id = ?",
      [nom, prenom, email, req.params.id]
    );

    res.json({ message: "Client modifié" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE CLIENT

exports.deleteClient = async (req, res) => {
  try {
    await db.query(
      "DELETE FROM users WHERE id = ?",
      [req.params.id]
    );

    res.json({ message: "Client supprimé" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ACCOUNTS

exports.getAllAccounts = async (req, res) => {
  try {
    const [accounts] = await db.query(`
      SELECT 
        comptes_bancaires.*,
        users.nom,
        users.prenom
      FROM comptes_bancaires
      JOIN users ON comptes_bancaires.user_id = users.id
      ORDER BY comptes_bancaires.id DESC
    `);

    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// BLOCK / UNBLOCK ACCOUNT

exports.toggleAccountStatus = async (req, res) => {
  try {
    const [account] = await db.query(
      "SELECT statut FROM comptes_bancaires WHERE id = ?",
      [req.params.id]
    );

    if (account.length === 0) {
      return res.status(404).json({ error: "Compte introuvable" });
    }

    const currentStatus = String(account[0].statut).toUpperCase();
    const newStatus = currentStatus === "ACTIF" ? "BLOQUE" : "ACTIF";

    await db.query(
      "UPDATE comptes_bancaires SET statut = ? WHERE id = ?",
      [newStatus, req.params.id]
    );

    res.json({ message: "Statut modifié", statut: newStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// STATS

exports.getStats = async (req, res) => {
  try {
    const [[clients]] = await db.query(
      "SELECT COUNT(*) AS totalClients FROM users WHERE role = 'CLIENT'"
    );

    const [[accounts]] = await db.query(
      "SELECT COUNT(*) AS totalAccounts FROM comptes_bancaires"
    );

    const [[deposits]] = await db.query(
      "SELECT SUM(montant) AS totalDeposits FROM transactions WHERE UPPER(type) = 'DEPOT'"
    );

    res.json({
      clients: clients.totalClients || 0,
      accounts: accounts.totalAccounts || 0,
      deposits: deposits.totalDeposits || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ALL TRANSACTIONS

exports.getAllTransactions = async (req, res) => {
  try {
    const [transactions] = await db.query(`
      SELECT 
        t.id,
        t.type,
        t.montant,
        t.created_at AS date_transaction,
        s.iban AS source_iban,
        d.iban AS dest_iban
      FROM transactions t
      LEFT JOIN comptes_bancaires s 
        ON t.compte_source_id = s.id
      LEFT JOIN comptes_bancaires d 
        ON t.compte_destination_id = d.id
      ORDER BY t.created_at DESC
    `);

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// controllers/cardController.js
const crypto  = require("crypto");
const bcrypt  = require("bcrypt");
const db      = require("../config/db");
const secLog  = require("../services/securityLogger");

function generateCardNumber() {
  // Génère 16 chiffres, masqués sauf les 4 derniers
  const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
  const last4  = String(Math.floor(1000 + Math.random() * 9000));
  return {
    masked: `**** **** **** ${last4}`,
    last4,
    full:   digits + last4  // à hasher, ne jamais stocker en clair
  };
}

function generateExpiryDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 3);
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

// ==============================
// CRÉER UNE CARTE
// ==============================
exports.createCard = async (req, res) => {
  const userId    = req.session.user.id;
  const { account_id, card_type, network, delivery_address } = req.body;

  if (!["virtual", "physical"].includes(card_type)) {
    return res.status(400).json({ error: "Type de carte invalide (virtual | physical)" });
  }

  if (card_type === "physical" && !delivery_address?.trim()) {
    return res.status(400).json({ error: "Adresse de livraison requise pour une carte physique" });
  }

  // Vérifier que le compte appartient à l'user
  const [accounts] = await db.query(
    "SELECT id FROM comptes_bancaires WHERE id = ? AND user_id = ? AND statut = 'ACTIF'",
    [account_id, userId]
  );
  if (!accounts.length) {
    return res.status(403).json({ error: "Compte invalide ou bloqué" });
  }

  // Max 2 cartes par compte
  const [existing] = await db.query(
    "SELECT COUNT(*) AS total FROM cards WHERE account_id = ? AND status != 'cancelled'",
    [account_id]
  );
  if (existing[0].total >= 2) {
    return res.status(400).json({ error: "Maximum 2 cartes par compte" });
  }

  try {
    const { masked, last4 } = generateCardNumber();
    const expiry             = generateExpiryDate();
    const cvv                = String(Math.floor(100 + Math.random() * 900));
    const cvvHash            = crypto.createHash("sha256").update(cvv).digest("hex");

    const initialStatus = card_type === "virtual" ? "active" : "pending_delivery";

    const [result] = await db.query(
      `INSERT INTO cards
       (account_id, user_id, card_type, status, masked_number, last4,
        expiry_date, cvv_hash, network, delivery_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [account_id, userId, card_type, initialStatus,
       masked, last4, expiry, cvvHash,
       network || "VISA", delivery_address?.trim() || null]
    );

    await secLog.log({
      userId, eventType: "card_created", req,
      details: { cardId: result.insertId, card_type, account_id }
    });

    return res.status(201).json({
      message: card_type === "virtual"
        ? "Carte virtuelle créée et active immédiatement."
        : "Carte physique commandée. Livraison sous 5-7 jours ouvrés.",
      card: {
        id:           result.insertId,
        masked_number: masked,
        expiry_date:  expiry,
        card_type,
        status:       initialStatus,
        network:      network || "VISA"
      }
    });
  } catch (err) {
    console.error("CREATE CARD ERROR:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// ==============================
// MES CARTES
// ==============================
exports.myCards = async (req, res) => {
  const userId = req.session.user.id;

  const [rows] = await db.query(
    `SELECT c.id, c.card_type, c.status, c.masked_number, c.last4,
            c.expiry_date, c.network, c.created_at,
            cb.iban, cb.type AS account_type
     FROM cards c
     JOIN comptes_bancaires cb ON cb.id = c.account_id
     WHERE c.user_id = ? AND c.status != 'cancelled'
     ORDER BY c.created_at DESC`,
    [userId]
  );

  return res.json({ cards: rows });
};

// ==============================
// BLOQUER / DÉBLOQUER UNE CARTE
// ==============================
exports.toggleBlock = async (req, res) => {
  const userId = req.session.user.id;
  const cardId = Number(req.params.id);
  const { action } = req.body; // 'block' | 'unblock'

  if (!["block", "unblock"].includes(action)) {
    return res.status(400).json({ error: "Action invalide (block | unblock)" });
  }

  const [rows] = await db.query(
    "SELECT id, status FROM cards WHERE id = ? AND user_id = ?",
    [cardId, userId]
  );

  if (!rows.length) return res.status(404).json({ error: "Carte introuvable" });

  const newStatus = action === "block" ? "blocked" : "active";

  await db.query("UPDATE cards SET status = ? WHERE id = ?", [newStatus, cardId]);

  await secLog.log({
    userId, eventType: "card_blocked", req,
    details: { cardId, action }
  });

  return res.json({ message: `Carte ${action === "block" ? "bloquée" : "débloquée"}` });
};

// ==============================
// ANNULER UNE CARTE
// ==============================
exports.cancelCard = async (req, res) => {
  const userId = req.session.user.id;
  const cardId = Number(req.params.id);

  const [rows] = await db.query(
    "SELECT id FROM cards WHERE id = ? AND user_id = ?",
    [cardId, userId]
  );

  if (!rows.length) return res.status(404).json({ error: "Carte introuvable" });

  await db.query("UPDATE cards SET status = 'cancelled' WHERE id = ?", [cardId]);

  return res.json({ message: "Carte annulée" });
};

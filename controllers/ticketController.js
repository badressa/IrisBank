// controllers/ticketController.js
const db     = require("../config/db");
const secLog = require("../services/securityLogger");

// Génère un numéro de ticket lisible : TKT-2026-00042
async function generateTicketNumber() {
  const year = new Date().getFullYear();
  const [rows] = await db.query(
    "SELECT COUNT(*) AS total FROM support_tickets WHERE YEAR(created_at) = ?",
    [year]
  );
  const seq = String((rows[0].total || 0) + 1).padStart(5, "0");
  return `TKT-${year}-${seq}`;
}

// ==============================
// CLIENT — Créer un ticket
// ==============================
exports.createTicket = async (req, res) => {
  const userId = req.session.user.id;
  const { category, subject, description, priority } = req.body;

  if (!subject?.trim() || !description?.trim()) {
    return res.status(400).json({ error: "Sujet et description requis" });
  }

  const validCategories = ["card","transfer","account","kyc","fraud","security","other"];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: "Catégorie invalide" });
  }

  try {
    const ticketNumber = await generateTicketNumber();

    const [result] = await db.query(
      `INSERT INTO support_tickets
       (ticket_number, user_id, category, priority, status, subject, description)
       VALUES (?, ?, ?, ?, 'open', ?, ?)`,
      [ticketNumber, userId, category, priority || "medium", subject.trim(), description.trim()]
    );

    // Premier message automatique
    await db.query(
      `INSERT INTO ticket_messages (ticket_id, sender_id, message)
       VALUES (?, ?, ?)`,
      [result.insertId, userId, description.trim()]
    );

    await secLog.log({
      userId, eventType: "ticket_created", req,
      details: { ticketNumber, category }
    });

    return res.status(201).json({
      message: "Ticket créé avec succès",
      ticket: { id: result.insertId, ticket_number: ticketNumber }
    });
  } catch (err) {
    console.error("CREATE TICKET ERROR:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// ==============================
// CLIENT — Mes tickets
// ==============================
exports.myTickets = async (req, res) => {
  const userId = req.session.user.id;

  const [rows] = await db.query(
    `SELECT id, ticket_number, category, priority, status, subject, created_at, updated_at
     FROM support_tickets WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId]
  );

  return res.json({ tickets: rows });
};

// ==============================
// CLIENT — Détail d'un ticket + messages
// ==============================
exports.getTicket = async (req, res) => {
  const userId   = req.session.user.id;
  const ticketId = Number(req.params.id);

  const [tickets] = await db.query(
    `SELECT * FROM support_tickets WHERE id = ? AND user_id = ?`,
    [ticketId, userId]
  );

  if (!tickets.length) {
    return res.status(404).json({ error: "Ticket introuvable" });
  }

  const [messages] = await db.query(
    `SELECT m.id, m.message, m.created_at, m.is_internal,
            u.prenom, u.nom, u.role
     FROM ticket_messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.ticket_id = ? AND m.is_internal = 0
     ORDER BY m.created_at ASC`,
    [ticketId]
  );

  return res.json({ ticket: tickets[0], messages });
};

// ==============================
// CLIENT — Répondre à un ticket
// ==============================
exports.replyTicket = async (req, res) => {
  const userId   = req.session.user.id;
  const ticketId = Number(req.params.id);
  const { message } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: "Message requis" });
  }

  const [tickets] = await db.query(
    "SELECT id, status FROM support_tickets WHERE id = ? AND user_id = ?",
    [ticketId, userId]
  );

  if (!tickets.length) return res.status(404).json({ error: "Ticket introuvable" });
  if (tickets[0].status === "closed") return res.status(400).json({ error: "Ticket fermé" });

  await db.query(
    "INSERT INTO ticket_messages (ticket_id, sender_id, message) VALUES (?, ?, ?)",
    [ticketId, userId, message.trim()]
  );

  await db.query(
    "UPDATE support_tickets SET status = 'waiting_user', updated_at = NOW() WHERE id = ?",
    [ticketId]
  );

  return res.json({ message: "Réponse envoyée" });
};

// ==============================
// ADMIN — Tous les tickets
// ==============================
exports.adminListTickets = async (req, res) => {
  const { status, category } = req.query;

  let query = `
    SELECT t.*, u.nom, u.prenom, u.email
    FROM support_tickets t
    JOIN users u ON u.id = t.user_id
    WHERE 1=1
  `;
  const params = [];

  if (status)   { query += " AND t.status = ?";   params.push(status); }
  if (category) { query += " AND t.category = ?"; params.push(category); }

  query += " ORDER BY t.priority DESC, t.created_at ASC";

  const [rows] = await db.query(query, params);
  return res.json({ tickets: rows });
};

// ==============================
// ADMIN — Répondre / changer le statut
// ==============================
exports.adminUpdateTicket = async (req, res) => {
  const adminId  = req.session.user.id;
  const ticketId = Number(req.params.id);
  const { message, status, is_internal } = req.body;

  const [tickets] = await db.query(
    "SELECT id FROM support_tickets WHERE id = ?", [ticketId]
  );
  if (!tickets.length) return res.status(404).json({ error: "Ticket introuvable" });

  if (message?.trim()) {
    await db.query(
      "INSERT INTO ticket_messages (ticket_id, sender_id, message, is_internal) VALUES (?, ?, ?, ?)",
      [ticketId, adminId, message.trim(), is_internal ? 1 : 0]
    );
  }

  if (status) {
    const resolvedAt = status === "resolved" ? new Date() : null;
    await db.query(
      "UPDATE support_tickets SET status = ?, resolved_at = ?, assigned_to = ?, updated_at = NOW() WHERE id = ?",
      [status, resolvedAt, adminId, ticketId]
    );
  }

  await secLog.log({
    userId: adminId, eventType: "admin_action", req,
    details: { action: "ticket_update", ticketId, status }
  });

  return res.json({ message: "Ticket mis à jour" });
};

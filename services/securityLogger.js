// services/securityLogger.js
const db = require("../config/db");

/**
 * Enregistre un événement de sécurité dans security_logs.
 *
 * @param {object} opts
 * @param {number|null} opts.userId
 * @param {string}      opts.eventType  — voir ENUM dans migration 005
 * @param {object}      opts.req        — requête Express (pour IP/UA)
 * @param {object}      [opts.details]  — infos supplémentaires (JSON)
 */
exports.log = async ({ userId = null, eventType, req, details = {} }) => {
  try {
    const ip = req
      ? (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || null)
      : null;

    const ua = req ? (req.headers["user-agent"] || null) : null;

    await db.query(
      `INSERT INTO security_logs (user_id, event_type, ip_address, user_agent, details)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, eventType, ip, ua, JSON.stringify(details)]
    );
  } catch (err) {
    // Ne pas bloquer l'appel principal si le log échoue
    console.error("SECURITY LOG ERROR:", err.message);
  }
};

/**
 * Vérifie si un compte est verrouillé (trop de tentatives login).
 * Retourne true si verrouillé.
 */
exports.isAccountLocked = async (userId) => {
  const [rows] = await db.query(
    "SELECT locked_until, login_attempts FROM users WHERE id = ?",
    [userId]
  );

  if (!rows.length) return false;

  const { locked_until, login_attempts } = rows[0];

  if (locked_until && new Date() < new Date(locked_until)) {
    return true;
  }

  return false;
};

/**
 * Incrémente les tentatives de connexion.
 * Bloque le compte 30 min après 5 échecs.
 */
exports.recordLoginFailure = async (userId) => {
  const [rows] = await db.query(
    "SELECT login_attempts FROM users WHERE id = ?",
    [userId]
  );

  if (!rows.length) return;

  const attempts = (rows[0].login_attempts || 0) + 1;
  const lockUntil = attempts >= 5
    ? new Date(Date.now() + 30 * 60 * 1000)
    : null;

  await db.query(
    "UPDATE users SET login_attempts = ?, locked_until = ? WHERE id = ?",
    [attempts, lockUntil, userId]
  );
};

/**
 * Remet à zéro les tentatives après un login réussi.
 */
exports.resetLoginFailures = async (userId) => {
  await db.query(
    "UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?",
    [userId]
  );
};

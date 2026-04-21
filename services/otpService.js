// services/otpService.js
const crypto = require("crypto");
const db     = require("../config/db");

const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS       = 3;

/**
 * Génère un code OTP à 6 chiffres, le hash et le stocke en BDD.
 * Retourne le code en clair (à envoyer par email/SMS).
 */
exports.generateOtp = async (userId, type = "login", ipAddress = null) => {
  // Invalider les anciens OTP non utilisés du même type
  await db.query(
    `UPDATE otp_codes SET used = 1
     WHERE user_id = ? AND type = ? AND used = 0`,
    [userId, type]
  );

  const code     = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await db.query(
    `INSERT INTO otp_codes (user_id, code_hash, type, expires_at, ip_address)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, codeHash, type, expiresAt, ipAddress]
  );

  return code; // à envoyer par email
};

/**
 * Vérifie un code OTP soumis par l'utilisateur.
 * Retourne { valid: true } ou { valid: false, reason: '...' }
 */
exports.verifyOtp = async (userId, code, type = "login") => {
  const codeHash = crypto.createHash("sha256").update(String(code)).digest("hex");

  const [rows] = await db.query(
    `SELECT id, expires_at, used, attempts
     FROM otp_codes
     WHERE user_id = ? AND code_hash = ? AND type = ? AND used = 0
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, codeHash, type]
  );

  if (rows.length === 0) {
    // Incrémenter les tentatives sur le dernier OTP valide
    await db.query(
      `UPDATE otp_codes
       SET attempts = attempts + 1
       WHERE user_id = ? AND type = ? AND used = 0
       ORDER BY created_at DESC LIMIT 1`,
      [userId, type]
    );

    return { valid: false, reason: "Code invalide" };
  }

  const otp = rows[0];

  if (otp.attempts >= MAX_ATTEMPTS) {
    return { valid: false, reason: "Trop de tentatives, demandez un nouveau code" };
  }

  if (new Date() > new Date(otp.expires_at)) {
    return { valid: false, reason: "Code expiré" };
  }

  // Marquer comme utilisé
  await db.query(
    "UPDATE otp_codes SET used = 1 WHERE id = ?",
    [otp.id]
  );

  return { valid: true };
};

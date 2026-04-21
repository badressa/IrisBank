// controllers/kycController.js
const path    = require("path");
const fs      = require("fs");
const db      = require("../config/db");
const secLog  = require("../services/securityLogger");

const UPLOAD_DIR = path.join(__dirname, "../uploads/kyc");

// Créer le dossier si besoin
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ==============================
// GET MY KYC STATUS
// ==============================
exports.getMyKyc = async (req, res) => {
  const userId = req.session.user.id;

  const [rows] = await db.query(
    `SELECT id, status, document_type, submitted_at, reviewed_at, rejection_reason
     FROM kyc_verifications WHERE user_id = ?`,
    [userId]
  );

  return res.json({
    kyc: rows[0] || { status: "not_started" }
  });
};

// ==============================
// SUBMIT KYC — upload documents
// Utilise multer (configuré dans les routes)
// ==============================
exports.submitKyc = async (req, res) => {
  const userId       = req.session.user.id;
  const documentType = req.body.document_type;

  const allowed = ["passport", "national_id", "driving_license"];
  if (!allowed.includes(documentType)) {
    return res.status(400).json({ error: "Type de document invalide" });
  }

  if (!req.files || !req.files.document_front || !req.files.selfie) {
    return res.status(400).json({ error: "Documents requis : recto + selfie" });
  }

  const frontUrl  = `/uploads/kyc/${req.files.document_front[0].filename}`;
  const backUrl   = req.files.document_back
    ? `/uploads/kyc/${req.files.document_back[0].filename}`
    : null;
  const selfieUrl = `/uploads/kyc/${req.files.selfie[0].filename}`;

  try {
    // Upsert KYC
    const [existing] = await db.query(
      "SELECT id FROM kyc_verifications WHERE user_id = ?", [userId]
    );

    if (existing.length > 0) {
      await db.query(
        `UPDATE kyc_verifications
         SET status = 'pending', document_type = ?, document_front_url = ?,
             document_back_url = ?, selfie_url = ?, submitted_at = NOW(),
             rejection_reason = NULL, reviewed_at = NULL
         WHERE user_id = ?`,
        [documentType, frontUrl, backUrl, selfieUrl, userId]
      );
    } else {
      await db.query(
        `INSERT INTO kyc_verifications
         (user_id, status, document_type, document_front_url, document_back_url, selfie_url, submitted_at)
         VALUES (?, 'pending', ?, ?, ?, ?, NOW())`,
        [userId, documentType, frontUrl, backUrl, selfieUrl]
      );
    }

    await db.query(
      "UPDATE users SET kyc_status = 'pending' WHERE id = ?", [userId]
    );

    await secLog.log({ userId, eventType: "kyc_submitted", req, details: { documentType } });

    return res.json({ message: "Documents soumis. Votre dossier est en cours de vérification." });
  } catch (err) {
    console.error("KYC SUBMIT ERROR:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// ==============================
// ADMIN — LIST PENDING KYC
// ==============================
exports.adminListKyc = async (req, res) => {
  const { status = "pending" } = req.query;

  const [rows] = await db.query(
    `SELECT k.*, u.nom, u.prenom, u.email
     FROM kyc_verifications k
     JOIN users u ON u.id = k.user_id
     WHERE k.status = ?
     ORDER BY k.submitted_at ASC`,
    [status]
  );

  return res.json({ kycs: rows });
};

// ==============================
// ADMIN — APPROVE / REJECT KYC
// ==============================
exports.adminReviewKyc = async (req, res) => {
  const adminId = req.session.user.id;
  const { kycId } = req.params;
  const { decision, notes, rejection_reason } = req.body;

  if (!["approved", "rejected"].includes(decision)) {
    return res.status(400).json({ error: "Décision invalide (approved | rejected)" });
  }

  const [rows] = await db.query(
    "SELECT user_id FROM kyc_verifications WHERE id = ?", [kycId]
  );

  if (!rows.length) return res.status(404).json({ error: "KYC introuvable" });

  const targetUserId = rows[0].user_id;

  await db.query(
    `UPDATE kyc_verifications
     SET status = ?, reviewer_id = ?, reviewer_notes = ?,
         rejection_reason = ?, reviewed_at = NOW()
     WHERE id = ?`,
    [decision, adminId, notes || null, rejection_reason || null, kycId]
  );

  await db.query(
    "UPDATE users SET kyc_status = ? WHERE id = ?",
    [decision, targetUserId]
  );

  const eventType = decision === "approved" ? "kyc_approved" : "kyc_rejected";
  await secLog.log({
    userId: adminId,
    eventType,
    req,
    details: { kycId, targetUserId, decision }
  });

  return res.json({ message: `KYC ${decision === "approved" ? "approuvé" : "rejeté"}` });
};

// services/emailService.js  — VERSION AMÉLIORÉE
// Ajoute : sendOtpEmail, sendKycStatusEmail, sendTicketNotifEmail
// Compatible avec l'emailService original (Mailtrap / Nodemailer)

const nodemailer = require("nodemailer");
require("dotenv").config();

const SMTP_HOST = process.env.SMTP_HOST || process.env.EMAIL_HOST || "sandbox.smtp.mailtrap.io";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || "587", 10);
const SMTP_SECURE = (process.env.SMTP_SECURE || process.env.EMAIL_SECURE || "false") === "true";
const SMTP_USER = process.env.SMTP_USER || process.env.EMAIL_USER || "";
const SMTP_PASS = process.env.SMTP_PASSWORD || process.env.EMAIL_PASS || "";
const FROM = process.env.SMTP_FROM || process.env.EMAIL_FROM || '"IRISBANK" <no-reply@irisbank.fr>';

// ==============================
// TRANSPORTER (inchangé)
// ==============================

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT), // Converts the string "465" into a real number
  secure: process.env.SMTP_SECURE === "true", // Converts the string "true" into a real boolean
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});
// ==============================
// HELPER : envoyer un email HTML
// ==============================
async function sendMail(to, subject, html) {
  const info = await transporter.sendMail({ from: FROM, to, subject, html });
  return {
    success: true,
    messageId: info.messageId,
    response: info.response
  };
}

exports.verifyTransport = async () => transporter.verify();

// ==============================
// VÉRIFICATION EMAIL (inchangé)
// ==============================
exports.sendVerificationEmail = async (email, prenom, link) => {
  return sendMail(email, "Activez votre compte IRISBANK", `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
      <h2 style="color:#1a3c5e">Bienvenue chez IRISBANK, ${prenom} !</h2>
      <p>Cliquez sur le bouton ci-dessous pour activer votre compte :</p>
      <a href="${link}" style="display:inline-block;padding:12px 24px;background:#1a3c5e;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">
        Activer mon compte
      </a>
      <p style="color:#888;font-size:12px;margin-top:24px">Ce lien expire dans 24h.</p>
    </div>
  `);
};

// ==============================
// EMAIL BIENVENUE (inchangé)
// ==============================
exports.sendWelcomeEmail = async (email, nom, prenom) => {
  return sendMail(email, "Bienvenue chez IRISBANK !", `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
      <h2 style="color:#1a3c5e">Votre compte est activé, ${prenom} ${nom} !</h2>
      <p>Vous pouvez désormais vous connecter et profiter de tous les services IRISBANK.</p>
      <p style="color:#888;font-size:12px">IRISBANK — Votre banque en ligne sécurisée.</p>
    </div>
  `);
};

// ==============================
// 🔐 OTP 6 CHIFFRES (NOUVEAU)
// ==============================
exports.sendOtpEmail = async (email, prenom, code) => {
  return sendMail(email, "Votre code de connexion IRISBANK", `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
      <h2 style="color:#1a3c5e">Vérification en deux étapes</h2>
      <p>Bonjour <strong>${prenom}</strong>,</p>
      <p>Voici votre code de connexion IRISBANK :</p>
      <div style="text-align:center;margin:32px 0">
        <span style="font-size:40px;font-weight:bold;letter-spacing:12px;color:#1a3c5e;
                     background:#f0f4f8;padding:16px 32px;border-radius:8px;display:inline-block">
          ${code}
        </span>
      </div>
      <p>Ce code est valable <strong>5 minutes</strong>. Ne le communiquez jamais à personne.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
      <p style="color:#888;font-size:12px">
        Si vous n'êtes pas à l'origine de cette connexion, 
        <a href="${process.env.APP_URL || "http://localhost:3000"}/login">
          sécurisez votre compte immédiatement
        </a>.
      </p>
    </div>
  `);
};

// ==============================
// 📋 KYC — Statut mis à jour (NOUVEAU)
// ==============================
exports.sendKycStatusEmail = async (email, prenom, status, reason = null) => {
  const isApproved = status === "approved";
  const title      = isApproved
    ? " Votre identité a été vérifiée"
    : " Votre vérification d'identité a été refusée";

  const body = isApproved
    ? `<p>Bonne nouvelle ! Votre dossier KYC a été <strong>approuvé</strong>. Vous avez maintenant accès à toutes les fonctionnalités IRISBANK.</p>`
    : `<p>Votre dossier KYC a été <strong>refusé</strong>.</p>
       ${reason ? `<p><strong>Motif :</strong> ${reason}</p>` : ""}
       <p>Vous pouvez soumettre un nouveau dossier depuis votre espace client.</p>`;

  return sendMail(email, title, `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
      <h2 style="color:#1a3c5e">${title}</h2>
      <p>Bonjour <strong>${prenom}</strong>,</p>
      ${body}
      <p style="color:#888;font-size:12px;margin-top:24px">IRISBANK — Service de vérification d'identité.</p>
    </div>
  `);
};

// ==============================
// 🎫 TICKET — Nouvelle réponse (NOUVEAU)
// ==============================
exports.sendTicketReplyEmail = async (email, prenom, ticketNumber, message) => {
  return sendMail(email, `[${ticketNumber}] Nouvelle réponse à votre ticket`, `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
      <h2 style="color:#1a3c5e">Une réponse a été ajoutée à votre ticket</h2>
      <p>Bonjour <strong>${prenom}</strong>,</p>
      <p>Votre ticket <strong>${ticketNumber}</strong> a reçu une nouvelle réponse :</p>
      <blockquote style="border-left:4px solid #1a3c5e;padding-left:16px;color:#444">
        ${message}
      </blockquote>
      <a href="${process.env.APP_URL || "http://localhost:3000"}/dashboard"
         style="display:inline-block;padding:10px 20px;background:#1a3c5e;color:#fff;
                border-radius:6px;text-decoration:none;margin-top:16px">
        Voir mon ticket
      </a>
    </div>
  `);
};

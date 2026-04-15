const nodemailer = require("nodemailer");

// Configuration du transporteur email
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === "true" || false, // true pour 465, false pour autres ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

// Vérifier la connexion au serveur SMTP (optionnel - non-bloquant)
transporter.verify((error, success) => {
  if (error) {
    console.log("⚠️  SMTP non connecté (emails ne s'enverront pas):", error.message);
  } else {
    console.log("✅ Serveur SMTP connecté");
  }
});

// Envoyer un email de vérification (activation compte)
exports.sendVerificationEmail = async (email, nom, verificationLink) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; }
          .content { margin: 20px 0; line-height: 1.6; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; margin: 20px 0; cursor: pointer; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 10px 0; }
          .footer { color: #999; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Confirmez votre adresse email 📧</h1>
          </div>
          <div class="content">
            <p>Bonjour <strong>${nom}</strong>,</p>
            <p>Bienvenue sur IRISBANK! Pour finaliser votre inscription, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous :</p>
            <a href="${verificationLink}" class="button">✓ Vérifier mon email</a>
            <div class="warning">
              <strong>⏰ Important :</strong> Ce lien d'activation expire dans <strong>24 heures</strong>.
            </div>
            <p>Ou copiez ce lien dans votre navigateur :</p>
            <p style="background: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 12px;">
              ${verificationLink}
            </p>
            <p>Cordialement,<br><strong>L'équipe IRISBANK</strong></p>
          </div>
          <div class="footer">
            <p>© 2026 IRISBANK - Tous droits réservés</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Confirmez votre email - IRISBANK",
      html: htmlContent,
      text: `Bonjour ${nom}, Cliquez ici pour vérifier votre email: ${verificationLink}`
    });

    console.log("📧 Email de vérification envoyé:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(" Erreur envoi email:", error.message);
    return { success: false, error: error.message };
  }
};

// Envoyer un email de bienvenue
exports.sendWelcomeEmail = async (email, nom, prenom) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; }
          .content { margin: 20px 0; line-height: 1.6; }
          .footer { color: #999; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Bienvenue sur IRISBANK! 🏦</h1>
          </div>
          <div class="content">
            <p>Bonjour <strong>${prenom} ${nom}</strong>,</p>
            <p>Votre compte a été créé avec succès! Vous pouvez maintenant accéder à votre espace client.</p>
            <p><strong>Vos informations :</strong></p>
            <ul>
              <li>Email : ${email}</li>
              <li>Date de création : ${new Date().toLocaleDateString("fr-FR")}</li>
            </ul>
            <p>Rendez-vous sur votre <strong>tableau de bord</strong> pour commencer à gérer vos comptes bancaires.</p>
            <p>Cordialement,<br><strong>L'équipe IRISBANK</strong></p>
          </div>
          <div class="footer">
            <p>© 2026 IRISBANK - Tous droits réservés</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Bienvenue sur IRISBANK",
      html: htmlContent,
      text: `Bienvenue ${prenom} ${nom}! Votre compte est créé.`
    });

    console.log("Email envoyé:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Erreur envoi email:", error.message);
    return { success: false, error: error.message };
  }
};

// Envoyer un email de réinitialisation de mot de passe (optionnel)
exports.sendPasswordResetEmail = async (email, nom, resetLink) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ff6b6b; color: white; padding: 20px; border-radius: 8px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Réinitialisation de mot de passe</h1>
          </div>
          <p>Bonjour ${nom},</p>
          <p>Vous avez demandé une réinitialisation de mot de passe. Cliquez ci-dessous pour continuer :</p>
          <a href="${resetLink}" class="button">Réinitialiser mon mot de passe</a>
          <p><strong>Attention :</strong> Ce lien expire dans 24 heures.</p>
          <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
        </div>
      </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Réinitialisation de mot de passe - IRISBANK",
      html: htmlContent
    });

    console.log("📧 Email de réinitialisation envoyé:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(" Erreur envoi email:", error.message);
    return { success: false, error: error.message };
  }
};

// Pas besoin de module.exports = transporter car on utilise exports.nom_fonction
// Si vous avez besoin du transporter ailleurs, vous pouvez faire :
// exports.transporter = transporter;

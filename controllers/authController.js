const bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
const crypto = require("crypto");
const db = require("../config/db");
const emailService = require("../services/emailService");
const securityLogger = require("../services/securityLogger");

function sanitizeError(err) {
  if (!err) return "unknown";
  const code = err.code ? `code=${err.code}` : "";
  const errno = typeof err.errno !== "undefined" ? ` errno=${err.errno}` : "";
  const sqlState = err.sqlState ? ` sqlState=${err.sqlState}` : "";
  const message = err.message ? ` message=${String(err.message).slice(0, 180)}` : "";
  return `${code}${errno}${sqlState}${message}`.trim() || "unknown";
}

// ==============================
// PARSE USER-AGENT
// ==============================
function parseUserAgent(ua) {
  if (!ua) return { device_type: "Inconnu", os: "Inconnu", browser: "Inconnu" };

  let device_type = "PC";
  let os = "Inconnu";
  let browser = "Inconnu";

  // Device / OS
  if (/iphone/i.test(ua)) { device_type = "iOS"; os = "iOS"; }
  else if (/ipad/i.test(ua)) { device_type = "iOS"; os = "iPadOS"; }
  else if (/android/i.test(ua) && /mobile/i.test(ua)) { device_type = "Android"; os = "Android"; }
  else if (/android/i.test(ua)) { device_type = "Android"; os = "Android"; }
  else if (/windows/i.test(ua)) { device_type = "PC"; os = "Windows"; }
  else if (/macintosh|mac os x/i.test(ua)) { device_type = "Mac"; os = "macOS"; }
  else if (/linux/i.test(ua)) { device_type = "PC"; os = "Linux"; }

  // Browser
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = "Opera";
  else if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) browser = "Chrome";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua)) browser = "Safari";
  else if (/msie|trident/i.test(ua)) browser = "Internet Explorer";

  return { device_type, os, browser };
}

// ==============================
// REGISTER
// ==============================
exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: errors.array()[0].msg,
        errors: errors.array()
      });
    }

    const {
      nom,
      prenom,
      email,
      telephone,
      adresse,
      date_naissance,
      password
    } = req.body;

    const nomClean = nom.trim();
    const prenomClean = prenom.trim();
    const emailClean = email.trim().toLowerCase();
    const telephoneClean = telephone.trim();
    const adresseClean = adresse.trim();
    const dateNaissanceClean = date_naissance;

    // Vérifier unicité email
    const [users] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [emailClean]
    );

    if (users.length > 0) {
      return res.status(400).json({
        error: "Email déjà utilisé"
      });
    }

    // Hash du mot de passe
    const hash = await bcrypt.hash(password, 10);

    // Générer token de vérification (expire dans 24h)
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h

    // Insertion utilisateur (pas vérifié au départ)
    const [result] = await db.query(
      `INSERT INTO users
      (nom, prenom, email, telephone, adresse, date_naissance, password_hash, role, is_admin, email_verified, verification_token, token_expiry)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'CLIENT', 0, 0, ?, ?)`,
      [
        nomClean,
        prenomClean,
        emailClean,
        telephoneClean,
        adresseClean,
        dateNaissanceClean,
        hash,
        verificationToken,
        tokenExpiry
      ]
    );

    const userId = result.insertId;

    // Construire le lien de vérification
    const verificationLink = `${process.env.APP_URL || "http://localhost:3000"}/verify-email.html?token=${verificationToken}&userId=${userId}`;

    // Envoyer email de vérification
    await emailService.sendVerificationEmail(emailClean, prenomClean, verificationLink).catch(err => {
      console.error("Erreur lors de l'envoi de l'email de vérification:", err);
    });

    // Retourner un message demandant la vérification
    return res.status(201).json({
      message: "Inscription réussie! Vérifiez votre email pour activer votre compte.",
      email: emailClean,
      requiresVerification: true
    });
  } catch (err) {
    console.error("REGISTER ERROR :", err.message);
    console.error("Stack:", err.stack);
    securityLogger.log("DB_ERROR", req, {
      detail: `register failed: ${sanitizeError(err)}`
    });

    return res.status(500).json({
      error: "Erreur serveur",
      debug: err.message // À supprimer en production
    });
  }
};

// ==============================
// LOGIN
// ==============================
exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: errors.array()[0].msg,
        errors: errors.array()
      });
    }

    const { email, password } = req.body;
    const emailClean = email.trim().toLowerCase();

    const [users] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [emailClean]
    );

    if (users.length === 0) {
      await securityLogger.log("LOGIN_FAILED", req, {
        detail: `email not found: ${emailClean}`
      });
      return res.status(401).json({
        error: "Utilisateur introuvable"
      });
    }

    const user = users[0];

    // Vérifier que l'email est confirmé
    if (!user.email_verified) {
      return res.status(403).json({
        error: "Veuillez d'abord vérifier votre email",
        requiresVerification: true,
        email: user.email
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      await securityLogger.log("LOGIN_FAILED", req, {
        userId: user.id,
        detail: `invalid password for ${emailClean}`
      });
      return res.status(401).json({
        error: "Mot de passe incorrect"
      });
    }

    req.session.user = {
      id: user.id,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      role: user.role,
      is_admin: user.is_admin
    };

    // Enregistrer l'historique de connexion
    const rawIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    const ip = String(rawIp).split(",")[0].trim().slice(0, 45);
    const ua = req.headers["user-agent"] || "";
    const { device_type, os, browser } = parseUserAgent(ua);

    db.query(
      "INSERT INTO login_history (user_id, ip_address, user_agent, device_type, os, browser) VALUES (?, ?, ?, ?, ?, ?)",
      [user.id, ip, ua.slice(0, 500), device_type, os, browser]
    ).catch(err => {
      console.error("LOGIN_HISTORY INSERT ERROR:", err);
      securityLogger.log("DB_ERROR", req, {
        userId: user.id,
        detail: `login_history insert failed: ${sanitizeError(err)}`
      });
    });

    req.session.save((err) => {
      if (err) {
        console.error("SESSION SAVE ERROR:", err);
        return res.status(500).json({
          error: "Erreur session"
        });
      }

      return res.json({
        message: "Connexion réussie",
        user: req.session.user
      });
    });
  } catch (err) {
    console.error("LOGIN ERROR :", err);
    securityLogger.log("DB_ERROR", req, {
      detail: `login failed: ${sanitizeError(err)}`
    });

    return res.status(500).json({
      error: "Erreur serveur"
    });
  }
};

// ==============================
// ME
// ==============================
exports.me = (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      error: "Non connecté"
    });
  }

  return res.json({
    user: req.session.user
  });
};

// ==============================
// HISTORIQUE CONNEXIONS
// ==============================
exports.loginHistory = async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Non connecté" });
  }

  try {
    const [rows] = await db.query(
      `SELECT id, ip_address, device_type, os, browser, created_at
       FROM login_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.session.user.id]
    );

    return res.json({ history: rows });
  } catch (err) {
    console.error("LOGIN_HISTORY FETCH ERROR:", err);
    securityLogger.log("DB_ERROR", req, {
      userId: req.session.user.id,
      detail: `login_history fetch failed: ${sanitizeError(err)}`
    });
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// ==============================
// LOGOUT
// ==============================
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("LOGOUT ERROR :", err);
      return res.status(500).json({
        error: "Erreur lors de la déconnexion"
      });
    }

    res.clearCookie("irisbank.sid");

    return res.json({
      message: "Déconnexion réussie"
    });
  });
};

// ==============================
// VERIFY EMAIL (Confirmation par token)
// ==============================
exports.verifyEmail = async (req, res) => {
  try {
    const { token, userId } = req.body;

    if (!token || !userId) {
      return res.status(400).json({
        error: "Paramètres manquants"
      });
    }

    // Chercher l'utilisateur avec ce token
    const [users] = await db.query(
      `SELECT id, email, verification_token, token_expiry, email_verified 
       FROM users 
       WHERE id = ? AND verification_token = ?`,
      [userId, token]
    );

    if (users.length === 0) {
      return res.status(400).json({
        error: "Lien d'activation invalide"
      });
    }

    const user = users[0];

    // Vérifier que l'email n'est pas déjà vérifié
    if (user.email_verified) {
      return res.status(400).json({
        error: "Cet email a déjà été vérifié"
      });
    }

    // Vérifier que le token n'a pas expiré
    if (new Date() > new Date(user.token_expiry)) {
      return res.status(400).json({
        error: "Lien d'activation expiré",
        expired: true,
        email: user.email
      });
    }

    // Marquer l'email comme vérifié
    await db.query(
      `UPDATE users 
       SET email_verified = 1, verification_token = NULL, token_expiry = NULL 
       WHERE id = ?`,
      [userId]
    );

    // Envoyer email de bienvenue
    const [updatedUsers] = await db.query(
      "SELECT nom, prenom, email FROM users WHERE id = ?",
      [userId]
    );

    if (updatedUsers.length > 0) {
      const u = updatedUsers[0];
      emailService.sendWelcomeEmail(u.email, u.nom, u.prenom).catch(err => {
        console.error("Erreur envoi email bienvenue:", err);
      });
    }

    return res.json({
      message: "Email vérifié avec succès! Vous pouvez maintenant vous connecter.",
      verified: true
    });
  } catch (err) {
    console.error("VERIFY EMAIL ERROR:", err);
    securityLogger.log("DB_ERROR", req, {
      detail: `verify_email failed: ${sanitizeError(err)}`
    });
    return res.status(500).json({
      error: "Erreur serveur"
    });
  }
};

// ==============================
// RESEND VERIFICATION EMAIL
// ==============================
exports.resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Email requis"
      });
    }

    const emailClean = email.trim().toLowerCase();

    const [users] = await db.query(
      "SELECT id, nom, prenom, email, email_verified, verification_token, token_expiry FROM users WHERE email = ?",
      [emailClean]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: "Utilisateur non trouvé"
      });
    }

    const user = users[0];

    // Vérifier que l'email n'est pas déjà vérifié
    if (user.email_verified) {
      return res.status(400).json({
        error: "Cet email a déjà été vérifié"
      });
    }

    // Regénérer un nouveau token
    const newVerificationToken = crypto.randomBytes(32).toString("hex");
    const newTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.query(
      `UPDATE users 
       SET verification_token = ?, token_expiry = ? 
       WHERE id = ?`,
      [newVerificationToken, newTokenExpiry, user.id]
    );

    // Envoyer le nouvel email
    const verificationLink = `${process.env.APP_URL || "http://localhost:3000"}/verify-email.html?token=${newVerificationToken}&userId=${user.id}`;

    await emailService.sendVerificationEmail(emailClean, user.prenom, verificationLink).catch(err => {
      console.error("Erreur envoi email:", err);
    });

    return res.json({
      message: "Email de vérification renvoyé. Veuillez vérifier votre boîte mail."
    });
  } catch (err) {
    console.error("RESEND VERIFICATION ERROR:", err);
    securityLogger.log("DB_ERROR", req, {
      detail: `resend_verification failed: ${sanitizeError(err)}`
    });
    return res.status(500).json({
      error: "Erreur serveur"
    });
  }
};

// ==============================
// FORGOT PASSWORD
// ==============================
exports.forgotPassword = async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: errors.array()[0].msg,
        errors: errors.array()
      });
    }

    const { email } = req.body;
    const emailClean = email.trim().toLowerCase();

    const [users] = await db.query(
      "SELECT id, prenom, email FROM users WHERE email = ? LIMIT 1",
      [emailClean]
    );

    // Réponse neutre pour éviter l'énumération des comptes
    if (users.length === 0) {
      return res.json({
        message: "Si cet email existe, un lien de réinitialisation a été envoyé."
      });
    }

    const user = users[0];
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await db.query(
      `UPDATE users
       SET password_reset_token = ?, password_reset_expires = ?
       WHERE id = ?`,
      [resetToken, resetExpiry, user.id]
    );

    const resetLink = `${process.env.APP_URL || "http://localhost:3000"}/reset-password.html?token=${resetToken}&userId=${user.id}`;

    await emailService.sendPasswordResetEmail(user.email, user.prenom, resetLink).catch(err => {
      console.error("Erreur envoi email reset password:", err);
    });

    return res.json({
      message: "Si cet email existe, un lien de réinitialisation a été envoyé."
    });
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    securityLogger.log("DB_ERROR", req, {
      detail: `forgot_password failed: ${sanitizeError(err)}`
    });
    return res.status(500).json({
      error: "Erreur serveur"
    });
  }
};

// ==============================
// RESET PASSWORD
// ==============================
exports.resetPassword = async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: errors.array()[0].msg,
        errors: errors.array()
      });
    }

    const { token, userId, password } = req.body;

    const [users] = await db.query(
      `SELECT id, password_reset_token, password_reset_expires
       FROM users
       WHERE id = ? AND password_reset_token = ?`,
      [userId, token]
    );

    if (users.length === 0) {
      return res.status(400).json({
        error: "Lien de réinitialisation invalide"
      });
    }

    const user = users[0];

    if (!user.password_reset_expires || new Date() > new Date(user.password_reset_expires)) {
      return res.status(400).json({
        error: "Lien de réinitialisation expiré"
      });
    }

    const hash = await bcrypt.hash(password, 10);

    await db.query(
      `UPDATE users
       SET password_hash = ?,
           password_reset_token = NULL,
           password_reset_expires = NULL
       WHERE id = ?`,
      [hash, user.id]
    );

    return res.json({
      message: "Mot de passe réinitialisé avec succès"
    });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    securityLogger.log("DB_ERROR", req, {
      detail: `reset_password failed: ${sanitizeError(err)}`
    });
    return res.status(500).json({
      error: "Erreur serveur"
    });
  }
};
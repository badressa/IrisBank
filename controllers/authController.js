// controllers/authController.js  — VERSION AMÉLIORÉE
// Changements vs original :
//   1. Verrouillage après 5 échecs (30 min)
//   2. OTP 6 chiffres envoyé par email après login réussi
//   3. Route /verify-otp pour valider le code
//   4. Logs sécurité sur chaque action
//   5. Suppression du debug: err.message en production

const bcrypt         = require("bcrypt");
const crypto         = require("crypto");
const { validationResult } = require("express-validator");
const db             = require("../config/db");
const emailService   = require("../services/emailService");
const otpService     = require("../services/otpService");
const secLog         = require("../services/securityLogger");

// ==============================
// REGISTER
// ==============================
exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
    }

    const { nom, prenom, email, telephone, adresse, date_naissance, password } = req.body;

    const nomClean       = nom.trim();
    const prenomClean    = prenom.trim();
    const emailClean     = email.trim().toLowerCase();
    const telephoneClean = telephone.trim();
    const adresseClean   = adresse.trim();

    const [users] = await db.query("SELECT id FROM users WHERE email = ?", [emailClean]);
    if (users.length > 0) {
      return res.status(400).json({ error: "Email déjà utilisé" });
    }

    const hash              = await bcrypt.hash(password, 12); // 12 rounds (était 10)
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiry       = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [result] = await db.query(
      `INSERT INTO users
       (nom, prenom, email, telephone, adresse, date_naissance, password_hash,
        role, is_admin, email_verified, verification_token, token_expiry)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'CLIENT', 0, 0, ?, ?)`,
      [nomClean, prenomClean, emailClean, telephoneClean, adresseClean,
       date_naissance, hash, verificationToken, tokenExpiry]
    );

    const userId          = result.insertId;
    const verificationLink = `${process.env.APP_URL || "http://localhost:3000"}/verify-email?token=${verificationToken}&userId=${userId}`;

    await emailService.sendVerificationEmail(emailClean, prenomClean, verificationLink)
      .catch(err => console.error("Email vérification:", err));

    await secLog.log({ userId, eventType: "login_success", req, details: { action: "register" } });

    return res.status(201).json({
      message: "Inscription réussie ! Vérifiez votre email pour activer votre compte.",
      email: emailClean,
      requiresVerification: true
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err.message);
    return res.status(500).json({ error: "Erreur serveur" });
    // ⚠️  debug supprimé — ne jamais exposer err.message en production
  }
};

// ==============================
// LOGIN — étape 1 : mot de passe
// Après succès → génère OTP et demande le code
// ==============================
exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email, password } = req.body;
    const emailClean          = email.trim().toLowerCase();

    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [emailClean]);

    if (users.length === 0) {
      // Ne pas révéler si l'email existe ou non (timing attack)
      await new Promise(r => setTimeout(r, 200));
      return res.status(401).json({ error: "Identifiants incorrects" });
    }

    const user = users[0];

    // Vérifier email confirmé
    if (!user.email_verified) {
      return res.status(403).json({
        error: "Veuillez d'abord vérifier votre email",
        requiresVerification: true,
        email: user.email
      });
    }

    // Vérifier verrouillage
    const locked = await secLog.isAccountLocked(user.id);
    if (locked) {
      await secLog.log({ userId: user.id, eventType: "login_failed", req, details: { reason: "account_locked" } });
      return res.status(429).json({
        error: "Compte temporairement verrouillé suite à trop d'échecs. Réessayez dans 30 minutes."
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      await secLog.recordLoginFailure(user.id);
      await secLog.log({ userId: user.id, eventType: "login_failed", req, details: { reason: "wrong_password" } });
      return res.status(401).json({ error: "Identifiants incorrects" });
    }

    // Réinitialiser les compteurs d'échec
    await secLog.resetLoginFailures(user.id);

    // === GÉNÉRATION OTP ===
    const otpCode = await otpService.generateOtp(user.id, "login", req.ip);

    // Envoyer par email
    await emailService.sendOtpEmail(user.email, user.prenom, otpCode)
      .catch(err => console.error("Email OTP:", err));

    await secLog.log({ userId: user.id, eventType: "otp_sent", req });

    // Stocker l'userId en session intermédiaire (pas encore connecté)
    req.session.pendingOtp = { userId: user.id };

    return res.json({
      message: "Code de vérification envoyé par email.",
      requiresOtp: true
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// ==============================
// VERIFY OTP — étape 2 : code 6 chiffres
// ==============================
exports.verifyOtp = async (req, res) => {
  try {
    const { code } = req.body;

    if (!req.session.pendingOtp) {
      return res.status(400).json({ error: "Aucune connexion en attente" });
    }

    const { userId } = req.session.pendingOtp;

    const result = await otpService.verifyOtp(userId, code, "login");

    if (!result.valid) {
      await secLog.log({ userId, eventType: "otp_failed", req, details: { reason: result.reason } });
      return res.status(401).json({ error: result.reason });
    }

    // OTP valide → créer la session complète
    const [users] = await db.query(
      "SELECT id, email, nom, prenom, role, is_admin FROM users WHERE id = ?",
      [userId]
    );

    const user = users[0];

    delete req.session.pendingOtp;

    req.session.user = {
      id:       user.id,
      email:    user.email,
      nom:      user.nom,
      prenom:   user.prenom,
      role:     user.role,
      is_admin: user.is_admin
    };

    req.session.save((err) => {
      if (err) return res.status(500).json({ error: "Erreur session" });

      secLog.log({ userId: user.id, eventType: "login_success", req });

      return res.json({
        message: "Connexion réussie",
        user: req.session.user
      });
    });
  } catch (err) {
    console.error("VERIFY OTP ERROR:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// ==============================
// ME
// ==============================
exports.me = (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Non connecté" });
  }
  return res.json({ user: req.session.user });
};

// ==============================
// LOGOUT
// ==============================
exports.logout = (req, res) => {
  const userId = req.session?.user?.id;

  req.session.destroy((err) => {
    if (err) {
      console.error("LOGOUT ERROR:", err);
      return res.status(500).json({ error: "Erreur déconnexion" });
    }

    res.clearCookie("irisbank.sid");

    if (userId) {
      secLog.log({ userId, eventType: "login_success", req, details: { action: "logout" } });
    }

    return res.json({ message: "Déconnexion réussie" });
  });
};

// ==============================
// VERIFY EMAIL
// ==============================
exports.verifyEmail = async (req, res) => {
  try {
    const { token, userId } = req.body;

    if (!token || !userId) {
      return res.status(400).json({ error: "Paramètres manquants" });
    }

    const [users] = await db.query(
      `SELECT id, email, verification_token, token_expiry, email_verified
       FROM users WHERE id = ? AND verification_token = ?`,
      [userId, token]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: "Lien d'activation invalide" });
    }

    const user = users[0];

    if (user.email_verified) {
      return res.status(400).json({ error: "Cet email a déjà été vérifié" });
    }

    if (new Date() > new Date(user.token_expiry)) {
      return res.status(400).json({ error: "Lien d'activation expiré", expired: true, email: user.email });
    }

    await db.query(
      `UPDATE users SET email_verified = 1, verification_token = NULL, token_expiry = NULL WHERE id = ?`,
      [userId]
    );

    const [updated] = await db.query("SELECT nom, prenom, email FROM users WHERE id = ?", [userId]);
    if (updated.length > 0) {
      const u = updated[0];
      emailService.sendWelcomeEmail(u.email, u.nom, u.prenom).catch(console.error);
    }

    return res.json({ message: "Email vérifié avec succès ! Vous pouvez maintenant vous connecter.", verified: true });
  } catch (err) {
    console.error("VERIFY EMAIL ERROR:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// ==============================
// RESEND VERIFICATION EMAIL
// ==============================
exports.resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email requis" });

    const emailClean = email.trim().toLowerCase();
    const [users] = await db.query(
      "SELECT id, nom, prenom, email, email_verified FROM users WHERE email = ?",
      [emailClean]
    );

    if (users.length === 0) return res.status(404).json({ error: "Utilisateur non trouvé" });

    const user = users[0];
    if (user.email_verified) return res.status(400).json({ error: "Cet email a déjà été vérifié" });

    const newToken  = crypto.randomBytes(32).toString("hex");
    const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.query(
      "UPDATE users SET verification_token = ?, token_expiry = ? WHERE id = ?",
      [newToken, newExpiry, user.id]
    );

    const link = `${process.env.APP_URL || "http://localhost:3000"}/verify-email?token=${newToken}&userId=${user.id}`;
    await emailService.sendVerificationEmail(emailClean, user.prenom, link).catch(console.error);

    return res.json({ message: "Email de vérification renvoyé." });
  } catch (err) {
    console.error("RESEND VERIFICATION ERROR:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

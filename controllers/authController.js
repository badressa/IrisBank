// controllers/authController.js  — VERSION AMÉLIORÉE
// Changements vs original :
//   1. Verrouillage après 5 échecs (30 min)
//   2. Code secret stable 4 chiffres si configuré, sinon OTP email en secours
//   3. Routes /verify-otp et /verify-secret-code pour valider la 2e étape
//   4. Logs sécurité sur chaque action
//   5. Suppression du debug: err.message en production

const bcrypt         = require("bcrypt");
const crypto         = require("crypto");
const { validationResult } = require("express-validator");
const db             = require("../config/db");
const emailService   = require("../services/emailService");
const otpService     = require("../services/otpService");
const secLog         = require("../services/securityLogger");

const SECRET_CODE_RESEND_COOLDOWN_MS = 15 * 1000;

function generateSecretCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function assignAndEmailPermanentSecretCode(user) {
  const newSecretCode = generateSecretCode();
  const newSecretCodeHash = await bcrypt.hash(newSecretCode, 12);
  const previousSecretCodeHash = user.secret_code_hash || null;

  await db.query(
    "UPDATE users SET secret_code_hash = ? WHERE id = ?",
    [newSecretCodeHash, user.id]
  );

  try {
    await emailService.sendPermanentSecretCodeEmail(user.email, user.prenom, newSecretCode);
  } catch (err) {
    await db.query(
      "UPDATE users SET secret_code_hash = ? WHERE id = ?",
      [previousSecretCodeHash, user.id]
    );
    throw err;
  }
}

function buildSessionUser(user) {
  return {
    id:       user.id,
    email:    user.email,
    nom:      user.nom,
    prenom:   user.prenom,
    role:     user.role,
    is_admin: user.is_admin
  };
}

function completeLogin(req, res, user) {
  delete req.session.pendingAuth;
  delete req.session.pendingOtp;

  req.session.user = buildSessionUser(user);

  req.session.save((err) => {
    if (err) return res.status(500).json({ error: "Erreur session" });

    secLog.log({ userId: user.id, eventType: "login_success", req });

    return res.json({
      message: "Connexion réussie",
      user: req.session.user
    });
  });
}

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

    // Garde-fou: éviter un crash bcrypt si un ancien compte a un hash absent/invalide
    if (!user.password_hash || typeof user.password_hash !== "string") {
      await secLog.log({ userId: user.id, eventType: "login_failed", req, details: { reason: "invalid_password_state" } });
      return res.status(401).json({ error: "Identifiants incorrects" });
    }

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

    // Stocker l'userId en session intermédiaire (pas encore connecté)
    req.session.pendingAuth = { userId: user.id, secretCodeAttempts: 0 };
    req.session.pendingOtp = { userId: user.id };

    if (user.secret_code_hash) {
      await secLog.log({ userId: user.id, eventType: "otp_sent", req, details: { method: "secret_code" } });

      return res.json({
        message: "Entrez votre code secret pour terminer la connexion.",
        requiresSecretCode: true,
        secretCodeLength: 4
      });
    }

    // Si aucun code secret n'est configuré, en créer un permanent puis l'envoyer.
    try {
      await assignAndEmailPermanentSecretCode(user);
    } catch (err) {
      console.error("Email secret code:", err);
      return res.status(503).json({
        error: "Impossible d'envoyer le code secret par email. Réessayez dans un instant."
      });
    }

    await secLog.log({ userId: user.id, eventType: "otp_sent", req, details: { method: "secret_code_email_initial" } });

    return res.json({
      message: "Votre code secret permanent a ete envoye par email. Entrez-le pour terminer la connexion.",
      requiresSecretCode: true,
      secretCodeLength: 4,
      firstSecretCode: true
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

    if (!req.session.pendingAuth?.userId) {
      return res.status(400).json({ error: "Aucune connexion en attente" });
    }

    const { userId } = req.session.pendingAuth;

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

    return completeLogin(req, res, user);
  } catch (err) {
    console.error("VERIFY OTP ERROR:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// ==============================
// VERIFY SECRET CODE — étape 2 : code secret stable
// ==============================
exports.verifySecretCode = async (req, res) => {
  try {
    const { code } = req.body;

    if (!req.session.pendingAuth?.userId) {
      return res.status(400).json({ error: "Aucune connexion en attente" });
    }

    const userId = req.session.pendingAuth.userId;

    if ((req.session.pendingAuth.secretCodeAttempts || 0) >= 5) {
      delete req.session.pendingAuth;
      delete req.session.pendingOtp;
      return res.status(429).json({ error: "Trop de tentatives. Recommencez la connexion." });
    }

    const [users] = await db.query(
      "SELECT id, email, nom, prenom, role, is_admin, secret_code_hash FROM users WHERE id = ?",
      [userId]
    );

    if (!users.length || !users[0].secret_code_hash) {
      return res.status(400).json({ error: "Aucun code secret configuré" });
    }

    const user = users[0];
    const match = await bcrypt.compare(String(code), user.secret_code_hash);

    if (!match) {
      req.session.pendingAuth.secretCodeAttempts = (req.session.pendingAuth.secretCodeAttempts || 0) + 1;
      await secLog.log({ userId, eventType: "otp_failed", req, details: { reason: "wrong_secret_code" } });
      return res.status(401).json({ error: "Code secret incorrect" });
    }

    return completeLogin(req, res, user);
  } catch (err) {
    console.error("VERIFY SECRET CODE ERROR:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// ==============================
// RESEND SECRET CODE
// ==============================
exports.resendSecretCode = async (req, res) => {
  try {
    if (!req.session.pendingAuth?.userId) {
      return res.status(400).json({ error: "Aucune connexion en attente" });
    }

    const now = Date.now();
    const resendCooldownUntil = req.session.pendingAuth.secretCodeResendAvailableAt || 0;

    if (resendCooldownUntil > now) {
      const waitSeconds = Math.ceil((resendCooldownUntil - now) / 1000);
      return res.status(429).json({
        error: `Veuillez attendre ${waitSeconds}s avant un nouvel envoi.`,
        retryAfterSeconds: waitSeconds
      });
    }

    const userId = req.session.pendingAuth.userId;
    const [users] = await db.query(
      "SELECT id, email, prenom, secret_code_hash FROM users WHERE id = ?",
      [userId]
    );

    if (!users.length) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    const user = users[0];

    await assignAndEmailPermanentSecretCode(user);

    req.session.pendingAuth.secretCodeAttempts = 0;
    req.session.pendingAuth.secretCodeResendAvailableAt = now + SECRET_CODE_RESEND_COOLDOWN_MS;

    await secLog.log({ userId, eventType: "otp_sent", req, details: { method: "secret_code_email_resend" } });

    return res.json({
      message: "Un nouveau code secret permanent vient d'etre envoye par email.",
      retryAfterSeconds: Math.ceil(SECRET_CODE_RESEND_COOLDOWN_MS / 1000)
    });
  } catch (err) {
    console.error("RESEND SECRET CODE ERROR:", err);
    return res.status(503).json({ error: "Impossible d'envoyer le code secret par email." });
  }
};

// ==============================
// FORGOT PASSWORD
// ==============================
exports.forgotPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email } = req.body;
    const emailClean = email.trim().toLowerCase();

    const [users] = await db.query(
      "SELECT id, prenom, email FROM users WHERE email = ? AND deleted_at IS NULL",
      [emailClean]
    );

    // Réponse générique même si l'email n'existe pas (anti-énumération)
    if (!users.length) {
      return res.json({ message: "Si cet email est enregistré, vous recevrez un lien de réinitialisation." });
    }

    const user = users[0];

    const token   = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

    await db.query(
      "UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?",
      [token, expires, user.id]
    );

    const resetLink = `${process.env.APP_URL || "http://localhost:3000"}/reset-password?token=${token}&userId=${user.id}`;

    await emailService.sendPasswordResetEmail(user.email, user.prenom, resetLink)
      .catch(err => console.error("Email reset password:", err));

    await secLog.log({ userId: user.id, eventType: "login_failed", req, details: { action: "forgot_password_requested" } });

    return res.json({ message: "Si cet email est enregistré, vous recevrez un lien de réinitialisation." });
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// ==============================
// RESET PASSWORD
// ==============================
exports.resetPassword = async (req, res) => {
  try {
    const { token, userId, password } = req.body;

    if (!token || !userId || !password) {
      return res.status(400).json({ error: "Paramètres manquants" });
    }

    if (typeof password !== "string" || password.length < 8 || password.length > 100) {
      return res.status(400).json({ error: "Le mot de passe doit contenir entre 8 et 100 caractères" });
    }
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins une majuscule" });
    }
    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins un chiffre" });
    }

    const [users] = await db.query(
      "SELECT id, email, prenom, password_reset_token, password_reset_expires FROM users WHERE id = ? AND deleted_at IS NULL",
      [userId]
    );

    if (!users.length) {
      return res.status(400).json({ error: "Lien invalide" });
    }

    const user = users[0];

    if (!user.password_reset_token || user.password_reset_token !== token) {
      return res.status(400).json({ error: "Lien invalide ou déjà utilisé" });
    }

    if (!user.password_reset_expires || new Date() > new Date(user.password_reset_expires)) {
      return res.status(400).json({ error: "Lien expiré. Faites une nouvelle demande.", expired: true });
    }

    const hash = await bcrypt.hash(password, 12);

    await db.query(
      "UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL, login_attempts = 0, locked_until = NULL WHERE id = ?",
      [hash, user.id]
    );

    await secLog.log({ userId: user.id, eventType: "login_success", req, details: { action: "password_reset_done" } });

    return res.json({ message: "Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter." });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
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

const bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
const crypto = require("crypto");
const db = require("../config/db");
const emailService = require("../services/emailService");

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
    return res.status(500).json({
      error: "Erreur serveur"
    });
  }
};
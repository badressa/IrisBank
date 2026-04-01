const bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
const db = require("../config/db");

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

    // Insertion utilisateur
    const [result] = await db.query(
      `INSERT INTO users
      (nom, prenom, email, telephone, adresse, date_naissance, password_hash, role, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'CLIENT', 0)`,
      [
        nomClean,
        prenomClean,
        emailClean,
        telephoneClean,
        adresseClean,
        dateNaissanceClean,
        hash
      ]
    );

    // Création session
    req.session.user = {
      id: result.insertId,
      email: emailClean,
      nom: nomClean,
      prenom: prenomClean,
      role: "CLIENT",
      is_admin: 0
    };

    // Sauvegarde forcée de la session
    req.session.save((err) => {
      if (err) {
        console.error("SESSION SAVE ERROR:", err);
        return res.status(500).json({
          error: "Erreur session"
        });
      }

      return res.status(201).json({
        message: "Inscription réussie",
        user: req.session.user
      });
    });
  } catch (err) {
    console.error("REGISTER ERROR :", err);

    return res.status(500).json({
      error: "Erreur serveur"
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
const { validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const db = require("../config/db");

function safeUser(userRow) {
  return {
    id: userRow.id,
    nom: userRow.nom,
    prenom: userRow.prenom,
    email: userRow.email,
    telephone: userRow.telephone,
    adresse: userRow.adresse,
    date_naissance: userRow.date_naissance,
    role: userRow.role,
    created_at: userRow.created_at,
  };
}

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { nom, prenom, email, telephone, adresse, date_naissance, password } = req.body;

  try {
    const [existing] = await db.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: "Email déjà utilisé" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `INSERT INTO users (nom, prenom, email, telephone, adresse, date_naissance, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'CLIENT')`,
      [nom, prenom, email, telephone, adresse, date_naissance, password_hash]
    );

    const [rows] = await db.query(
      "SELECT * FROM users WHERE id = ? LIMIT 1",
      [result.insertId]
    );

    const user = rows[0];

    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({ error: "Erreur session" });
      }

      req.session.user = { id: user.id, role: user.role };

      return res.status(201).json({
        message: "Inscription OK",
        user: safeUser(user)
      });
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const [rows] = await db.query(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({ error: "Erreur session" });
      }

      req.session.user = { id: user.id, role: user.role };

      return res.json({
        message: "Connexion OK",
        user: safeUser(user)
      });
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.me = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: "Non connecté" });
    }

    const [rows] = await db.query(
      "SELECT * FROM users WHERE id = ? LIMIT 1",
      [req.session.user.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Session invalide" });
    }

    return res.json({ user: safeUser(rows[0]) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.logout = async (req, res) => {
  if (!req.session) {
    return res.json({ message: "Déconnecté" });
  }

  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Erreur lors de la déconnexion" });
    }

    res.clearCookie("connect.sid");
    return res.json({ message: "Déconnecté" });
  });
};
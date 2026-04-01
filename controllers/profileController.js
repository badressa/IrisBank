const { validationResult } = require("express-validator");
const db = require("../config/db");

// ==============================
// GET PROFILE
// ==============================
exports.getProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [rows] = await db.query(
      `SELECT id, nom, prenom, email, telephone, adresse, date_naissance, role, is_admin
       FROM users
       WHERE id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    return res.json({ user: rows[0] });
  } catch (err) {
    console.error("GET PROFILE ERROR :", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

// ==============================
// UPDATE PROFILE
// ==============================
exports.updateProfile = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: errors.array()[0].msg,
      errors: errors.array()
    });
  }

  try {
    const userId = req.session.user.id;

    const {
      nom,
      prenom,
      email,
      telephone,
      adresse
    } = req.body;

    const nomClean = nom.trim();
    const prenomClean = prenom.trim();
    const emailClean = email.trim().toLowerCase();
    const telephoneClean = telephone.trim();
    const adresseClean = adresse.trim();

    const [existing] = await db.query(
      "SELECT id FROM users WHERE email = ? AND id != ?",
      [emailClean, userId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        error: "Email déjà utilisé"
      });
    }

    await db.query(
      `UPDATE users
       SET nom = ?, prenom = ?, email = ?, telephone = ?, adresse = ?
       WHERE id = ?`,
      [nomClean, prenomClean, emailClean, telephoneClean, adresseClean, userId]
    );

    const [updatedRows] = await db.query(
      `SELECT id, nom, prenom, email, telephone, adresse, date_naissance, role, is_admin
       FROM users
       WHERE id = ?`,
      [userId]
    );

    return res.json({
      message: "Profil mis à jour",
      user: updatedRows[0]
    });
  } catch (err) {
    console.error("UPDATE PROFILE ERROR :", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};
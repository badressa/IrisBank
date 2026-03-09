const express = require("express");
const { body } = require("express-validator");
const authController = require("../controllers/authController");

const router = express.Router();

// Register
router.post(
  "/register",
  [
    body("nom")
      .trim()
      .notEmpty()
      .withMessage("Nom requis")
      .isLength({ max: 100 })
      .withMessage("Nom trop long"),

    body("prenom")
      .trim()
      .notEmpty()
      .withMessage("Prénom requis")
      .isLength({ max: 100 })
      .withMessage("Prénom trop long"),

    body("email")
      .isEmail()
      .withMessage("Email invalide")
      .normalizeEmail()
      .isLength({ max: 150 })
      .withMessage("Email trop long"),

    body("telephone")
      .trim()
      .isLength({ min: 10, max: 20 })
      .withMessage("Téléphone invalide"),

    body("adresse")
      .trim()
      .notEmpty()
      .withMessage("Adresse requise")
      .isLength({ max: 255 })
      .withMessage("Adresse trop longue"),

    body("date_naissance")
      .isISO8601()
      .withMessage("Date de naissance invalide (YYYY-MM-DD)"),

    body("password")
      .isLength({ min: 8, max: 100 })
      .withMessage("Mot de passe entre 8 et 100 caractères")
      .matches(/[A-Z]/)
      .withMessage("Mot de passe : 1 majuscule requise")
      .matches(/[0-9]/)
      .withMessage("Mot de passe : 1 chiffre requis"),
  ],
  authController.register
);

// Login
router.post(
  "/login",
  [
    body("email")
      .isEmail()
      .withMessage("Email invalide")
      .normalizeEmail(),

    body("password")
      .notEmpty()
      .withMessage("Mot de passe requis")
      .isLength({ min: 1, max: 100 })
      .withMessage("Mot de passe invalide"),
  ],
  authController.login
);

// Me (session)
router.get("/me", authController.me);

// Logout
router.post("/logout", authController.logout);

module.exports = router;
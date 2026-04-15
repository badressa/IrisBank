const express = require("express");
const { body } = require("express-validator");
const authController = require("../controllers/authController");

const router = express.Router();

// ========================================
// REGISTER
// ========================================
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
      .trim()
      .notEmpty()
      .withMessage("Email requis")
      .isEmail()
      .withMessage("Email invalide")
      .normalizeEmail()
      .isLength({ max: 150 })
      .withMessage("Email trop long"),

    body("telephone")
      .trim()
      .notEmpty()
      .withMessage("Téléphone requis")
      .matches(/^[0-9]{10}$/)
      .withMessage("Le téléphone doit contenir exactement 10 chiffres"),

    body("adresse")
      .trim()
      .notEmpty()
      .withMessage("Adresse requise")
      .isLength({ max: 255 })
      .withMessage("Adresse trop longue"),

    body("date_naissance")
      .notEmpty()
      .withMessage("Date de naissance requise")
      .isISO8601()
      .withMessage("Date de naissance invalide (format YYYY-MM-DD)"),

    body("password")
      .notEmpty()
      .withMessage("Mot de passe requis")
      .isLength({ min: 8, max: 100 })
      .withMessage("Le mot de passe doit contenir entre 8 et 100 caractères")
      .matches(/[A-Z]/)
      .withMessage("Le mot de passe doit contenir au moins une majuscule")
      .matches(/[0-9]/)
      .withMessage("Le mot de passe doit contenir au moins un chiffre"),
  ],
  authController.register
);

// ========================================
// LOGIN
// ========================================
router.post(
  "/login",
  [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email requis")
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

// ========================================
// USER SESSION
// ========================================
router.get("/me", authController.me);

// ========================================
// LOGOUT
// ========================================
router.post("/logout", authController.logout);

// ========================================
// VERIFY EMAIL (Confirmation par token)
// ========================================
router.post("/verify-email", authController.verifyEmail);

// ========================================
// RESEND VERIFICATION EMAIL
// ========================================
router.post("/resend-verification", authController.resendVerificationEmail);

module.exports = router;
const express = require("express");
const { body } = require("express-validator");
const profileController = require("../controllers/profileController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

// ==============================
// GET PROFILE
// ==============================
router.get("/", requireAuth, profileController.getProfile);

// ==============================
// UPDATE PROFILE
// ==============================
router.put(
  "/",
  requireAuth,
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
      .withMessage("Adresse trop longue")
  ],
  profileController.updateProfile
);

module.exports = router;
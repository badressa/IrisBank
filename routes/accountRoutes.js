const express = require("express");
const { body, param } = require("express-validator");
const accountController = require("../controllers/accountController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

// Lister mes comptes
router.get("/", requireAuth, accountController.listMine);

// Voir un compte
router.get(
  "/:id",
  requireAuth,
  [
    param("id")
      .isInt({ min: 1 })
      .withMessage("id invalide")
  ],
  accountController.getOneMine
);

// Créer un compte
router.post(
  "/",
  requireAuth,
  [
    body("type")
      .trim()
      .isIn(["COURANT", "LIVRET_A", "PEL"])
      .withMessage("type doit être COURANT, LIVRET_A ou PEL"),
  ],
  accountController.create
);

// Supprimer un compte (si solde = 0)
router.delete(
  "/:id",
  requireAuth,
  [
    param("id")
      .isInt({ min: 1 })
      .withMessage("id invalide")
  ],
  accountController.remove
);

module.exports = router;
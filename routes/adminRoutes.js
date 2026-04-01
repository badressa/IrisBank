const express = require("express");
const router = express.Router();
const db = require("../config/db");

const adminController = require("../controllers/adminController");
const { requireAuth, requireAdmin } = require("../middleware/authMiddleware");

// Clients
router.get("/clients", requireAuth, requireAdmin, adminController.getAllClients);
router.get("/clients/:id", requireAuth, requireAdmin, adminController.getClient);
router.put("/clients/:id", requireAuth, requireAdmin, adminController.updateClient);
router.delete("/clients/:id", requireAuth, requireAdmin, adminController.deleteClient);

// Comptes
router.get("/accounts", requireAuth, requireAdmin, adminController.getAllAccounts);
router.patch("/accounts/:id/block", requireAuth, requireAdmin, adminController.toggleAccountStatus);

// Statistiques
router.get("/stats", requireAuth, requireAdmin, adminController.getStats);

// Transactions
router.get("/transactions", requireAuth, requireAdmin, adminController.getAllTransactions);

// Notifications
router.get("/notifications", requireAuth, requireAdmin, adminController.getNotifications);

/* ROUTE RESET */

router.delete("/reset", requireAuth, requireAdmin, async (req, res) => {

  try {

    await db.query("SET FOREIGN_KEY_CHECKS = 0");

    await db.query("DELETE FROM transactions");
    await db.query("DELETE FROM comptes_bancaires");
    await db.query("DELETE FROM notifications");
    await db.query("DELETE FROM users WHERE is_admin = 0");

    await db.query("SET FOREIGN_KEY_CHECKS = 1");

    res.json({
      message: "Base réinitialisée"
    });

  } catch (err) {

    console.error("RESET ERROR:", err);

    res.status(500).json({
      error: "Erreur reset"
    });

  }

});

module.exports = router;

router.get("/search", requireAdmin, adminController.search);
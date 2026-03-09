const express = require("express");
const router = express.Router();

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

// Transactions (NOUVEAU)
router.get("/transactions", requireAuth, requireAdmin, adminController.getAllTransactions);

module.exports = router;
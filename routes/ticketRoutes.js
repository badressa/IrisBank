// routes/ticketRoutes.js
const express    = require("express");
const router     = express.Router();
const ticketCtrl = require("../controllers/ticketController");
const { requireAuth, requireAdmin } = require("../middleware/authMiddleware");

// Client
router.get("/",              requireAuth, ticketCtrl.myTickets);
router.post("/",             requireAuth, ticketCtrl.createTicket);
router.get("/:id",           requireAuth, ticketCtrl.getTicket);
router.post("/:id/reply",    requireAuth, ticketCtrl.replyTicket);

// Admin
router.get("/admin/all",             requireAdmin, ticketCtrl.adminListTickets);
router.put("/admin/:id",             requireAdmin, ticketCtrl.adminUpdateTicket);

module.exports = router;

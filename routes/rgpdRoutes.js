// routes/rgpdRoutes.js
const express   = require("express");
const router    = express.Router();
const rgpdCtrl  = require("../controllers/rgpdController");
const { requireAuth } = require("../middleware/authMiddleware");

router.get("/export",          requireAuth, rgpdCtrl.exportData);
router.delete("/delete-account", requireAuth, rgpdCtrl.deleteAccount);
router.post("/accept-terms",   requireAuth, rgpdCtrl.acceptTerms);
router.get("/check-consent",   requireAuth, rgpdCtrl.checkConsent);

module.exports = router;

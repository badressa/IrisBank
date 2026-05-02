const express = require("express");
const router = express.Router();
const stripeController = require("../controllers/stripeController");
const { requireAuth } = require("../middleware/authMiddleware");

router.get("/config", requireAuth, stripeController.getConfig);
router.get("/test-cards", requireAuth, stripeController.getTestCards);
router.post("/create-payment-intent", requireAuth, stripeController.createPaymentIntent);

module.exports = router;
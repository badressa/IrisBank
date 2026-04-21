// routes/cardRoutes.js
const express  = require("express");
const router   = express.Router();
const cardCtrl = require("../controllers/cardController");
const { requireAuth } = require("../middleware/authMiddleware");

router.get("/",              requireAuth, cardCtrl.myCards);
router.post("/",             requireAuth, cardCtrl.createCard);
router.patch("/:id/toggle",  requireAuth, cardCtrl.toggleBlock);
router.delete("/:id",        requireAuth, cardCtrl.cancelCard);

module.exports = router;

const express = require("express");
const { body } = require("express-validator");
const aiController = require("../controllers/aiController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.post(
  "/chat",
  requireAuth,
  [
    body("message")
      .trim()
      .notEmpty()
      .withMessage("Message requis")
      .isLength({ max: 2000 })
      .withMessage("Message trop long")
  ],
  aiController.chat
);

module.exports = router;
// routes/kycRoutes.js
const express  = require("express");
const multer   = require("multer");
const path     = require("path");
const router   = express.Router();
const kycCtrl  = require("../controllers/kycController");
const { requireAuth, requireAdmin } = require("../middleware/authMiddleware");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads/kyc")),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}_${req.session.user.id}_${file.fieldname}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".pdf"];
    const ext     = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error("Format accepté : JPG, PNG, PDF"));
  }
});

router.get("/",          requireAuth, kycCtrl.getMyKyc);
router.post("/submit",   requireAuth, upload.fields([
  { name: "document_front", maxCount: 1 },
  { name: "document_back",  maxCount: 1 },
  { name: "selfie",         maxCount: 1 }
]), kycCtrl.submitKyc);

// Admin
router.get("/admin/list",           requireAdmin, kycCtrl.adminListKyc);
router.post("/admin/review/:kycId", requireAdmin, kycCtrl.adminReviewKyc);

module.exports = router;

// ─────────────────────────────────────────────────────────────

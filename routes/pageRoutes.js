// routes/pageRoutes.js
// Gestion de toutes les routes de pages HTML avec protection d'accès

const express = require("express");
const router = express.Router();
const path = require("path");

const PUBLIC_DIR = path.join(__dirname, "..", "public");

// ─────────────────────────────────────────────
// HELPER : envoyer une page HTML
// ─────────────────────────────────────────────
function sendPage(res, filename) {
  res.sendFile(path.join(PUBLIC_DIR, filename));
}

// ─────────────────────────────────────────────
// MIDDLEWARE : vérifie si l'utilisateur est connecté
// ─────────────────────────────────────────────
function requireSession(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(403).sendFile(path.join(PUBLIC_DIR, "403.html"));
}

// ─────────────────────────────────────────────
// MIDDLEWARE : vérifie si l'utilisateur est admin
// ─────────────────────────────────────────────
function requireAdminSession(req, res, next) {
  if (req.session && req.session.user && req.session.user.is_admin) return next();
  if (req.session && req.session.user) return res.status(403).sendFile(path.join(PUBLIC_DIR, "403.html"));
  return res.status(403).sendFile(path.join(PUBLIC_DIR, "403.html"));
}

// ─────────────────────────────────────────────
// PAGES PUBLIQUES (pas besoin d'être connecté)
// ─────────────────────────────────────────────
router.get(["/", "/login", "/login.html"], (req, res) => {
  // Si déjà connecté → redirige vers dashboard
  if (req.session && req.session.user) return res.redirect("/dashboard.html");
  sendPage(res, "login.html");
});

router.get(["/register", "/register.html"], (req, res) => {
  if (req.session && req.session.user) return res.redirect("/dashboard.html");
  sendPage(res, "register.html");
});

router.get(["/verify-email", "/verify-email.html"], (req, res) => {
  sendPage(res, "verify-email.html");
});

router.get(["/reset-password", "/reset-password.html"], (req, res) => {
  sendPage(res, "reset-password.html");
});

// ─────────────────────────────────────────────
// PAGES PROTÉGÉES (doit être connecté)
// ─────────────────────────────────────────────
router.get(["/dashboard", "/dashboard.html"], requireSession, (req, res) => {
  sendPage(res, "dashboard.html");
});

router.get(["/profile", "/profile.html"], requireSession, (req, res) => {
  sendPage(res, "profile.html");
});

router.get(["/budget.html"], requireSession, (req, res) => {
  sendPage(res, "budget.html");
});

// ─────────────────────────────────────────────
// PAGES ADMIN (doit être admin)
// ─────────────────────────────────────────────
router.get(["/admin", "/admin.html"], requireAdminSession, (req, res) => {
  sendPage(res, "admin.html");
});

// ─────────────────────────────────────────────
// PAGES D'ERREUR
// ─────────────────────────────────────────────
router.get("/403.html", (req, res) => sendPage(res, "403.html"));
router.get("/404.html", (req, res) => sendPage(res, "404.html"));

module.exports = router;

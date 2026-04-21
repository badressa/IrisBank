/*const express = require("express");
const path = require("path");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const csrf = require("csurf");
const cookieParser = require("cookie-parser");

require("dotenv").config();

const db = require("./config/db");

// ===============================
// ROUTES
// ===============================
const authRoutes = require("./routes/authRoutes");
const accountRoutes = require("./routes/accountRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const adminRoutes = require("./routes/adminRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const profileRoutes = require("./routes/profileRoutes");
const aiRoutes = require("./routes/aiRoutes");
const budgetRoutes = require("./routes/budgetRoutes");

const app = express();

// ===============================
// MIDDLEWARES
// ===============================
// Interdire l'accès direct aux fichiers .html et .js
app.use((req, res, next) => {
  if (req.path.endsWith(".html") || req.path.endsWith(".js")) {
    return res.status(403).send("Accès interdit.");
  }
  next();
});
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ===============================
// SESSION
// ===============================
app.use(
  session({
    name: "irisbank.sid",
    secret: process.env.SESSION_SECRET || "irisbanksecret",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60
    }
  })
);

// empêcher cache navigateur
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// ===============================
// RATE LIMIT LOGIN
// ===============================
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Trop de tentatives de connexion. Réessaie plus tard."
  }
});

// ===============================
// CSRF
// ===============================
const csrfProtection = csrf({
  cookie: true
});

// token CSRF
app.get("/api/csrf-token", csrfProtection, (req, res) => {
  res.json({
    csrfToken: req.csrfToken()
  });
});

// ===============================
// ROUTES DES PAGES HTML
// ===============================
const publicDir = path.join(__dirname, "public");

const htmlPages = {
  "/": "index.html",
  "/accueil": "index.html",
  "/login": "login.html",
  "/register": "register.html",
  "/dashboard": "dashboard.html",
  "/profile": "profile.html",
  "/admin": "admin.html",
  "/verify-email": "verify-email.html",
  "/budget": "budget.html"
};

Object.entries(htmlPages).forEach(([routePath, fileName]) => {
  app.get(routePath, (req, res) => {
    res.sendFile(path.join(publicDir, fileName));
  });
});

// ===============================
// ROUTES AUTH (PAS DE CSRF)
// ===============================
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth", authRoutes);

// ===============================
// ROUTES PROTÉGÉES (AVEC CSRF)
// ===============================
app.use("/api/accounts", csrfProtection, accountRoutes);
app.use("/api/transactions", csrfProtection, transactionRoutes);
app.use("/api/admin", csrfProtection, adminRoutes);
app.use("/api/notifications", csrfProtection, notificationRoutes);
app.use("/api/profile", csrfProtection, profileRoutes);
app.use("/api/ai", csrfProtection, aiRoutes);
app.use("/budget", budgetRoutes);

// ===============================
// 404
// ===============================
app.use("/api", (req, res) => {
  res.status(404).json({
    error: "Route API introuvable"
  });
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(publicDir, "404.html"));
});

// ===============================
// ERREUR CSRF
// ===============================
app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).json({
      error: "Token CSRF invalide ou manquant"
    });
  }

  console.error("SERVER ERROR:", err);

  res.status(500).json({
    error: "Erreur serveur"
  });
});

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 IRISBANK server running on port " + PORT);
});

require('./services/budgetCron');
*/


const express = require("express");
const path = require("path");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const csrf = require("csurf");
const cookieParser = require("cookie-parser");
const fs           = require("fs");
require('./services/budgetCron');
require("dotenv").config();
const db = require("./config/db");

// ===============================
// ROUTES
// ===============================
const authRoutes = require("./routes/authRoutes");
const accountRoutes = require("./routes/accountRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const adminRoutes = require("./routes/adminRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const profileRoutes = require("./routes/profileRoutes");
const aiRoutes = require("./routes/aiRoutes");
const budgetRoutes = require("./routes/budgetRoutes");

// NOUVELLES ROUTES
const cardRoutes        = require("./routes/cardRoutes");
const kycRoutes         = require("./routes/kycRoutes");
const ticketRoutes      = require("./routes/ticketRoutes");
const rgpdRoutes        = require("./routes/rgpdRoutes");

const app = express();

// ===============================
// MIDDLEWARES
// ===============================
// Interdire l'accès direct aux fichiers .html et .js
app.use((req, res, next) => {
  if (req.path.endsWith(".html") || req.path.endsWith(".js")) {
    return res.status(403).send("Accès interdit.");
  }
  next();
});
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ===============================
// HEADERS SÉCURITÉ
// ===============================
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("X-XSS-Protection", "1; mode=block");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Ne jamais exposer la techno serveur
  res.removeHeader("X-Powered-By");
  next();
});

// ===============================
// DOSSIER UPLOADS (créer si absent)
// ===============================
const uploadDir = path.join(__dirname, "uploads/kyc");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ===============================
// SESSION
// ===============================
app.use(
  session({
    name: "irisbank.sid",
    secret: process.env.SESSION_SECRET || "irisbanksecret",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 30 // 30 minutes
    }
  })
);

// empêcher cache navigateur
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// ===============================
// RATE LIMIT LOGIN
// ===============================
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Trop de tentatives de connexion. Réessaie plus tard."
  }
});

// OTP : 5 tentatives / 10 min
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { error: "Trop de tentatives. Demandez un nouveau code." }
});

// API globale : 200 req / 15 min
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: "Trop de requêtes, réessayez plus tard." }
});

app.use("/api/", apiLimiter);
// ===============================
// CSRF
// ===============================
const csrfProtection = csrf({
  cookie: true
});

// token CSRF
app.get("/api/csrf-token", csrfProtection, (req, res) => {
  res.json({
    csrfToken: req.csrfToken()
  });
});

// ===============================
// ROUTES DES PAGES HTML
// ===============================
const publicDir = path.join(__dirname, "public");

const htmlPages = {
  "/": "index.html",
  "/accueil": "index.html",
  "/login": "login.html",
  "/register": "register.html",
  "/dashboard": "dashboard.html",
  "/profile": "profile.html",
  "/admin": "admin.html",
  "/verify-email": "verify-email.html",
  "/budget": "budget.html"
};

Object.entries(htmlPages).forEach(([routePath, fileName]) => {
  app.get(routePath, (req, res) => {
    res.sendFile(path.join(publicDir, fileName));
  });
});

// ===============================
// ROUTES AUTH (PAS DE CSRF)
// ===============================
app.use("/api/auth/login",      loginLimiter);
app.use("/api/auth/verify-otp", otpLimiter);
app.use("/api/auth",            authRoutes);

// ===============================
// ROUTES PROTÉGÉES (AVEC CSRF)
// ===============================
app.use("/api/accounts", csrfProtection, accountRoutes);
app.use("/api/transactions", csrfProtection, transactionRoutes);
app.use("/api/admin", csrfProtection, adminRoutes);
app.use("/api/notifications", csrfProtection, notificationRoutes);
app.use("/api/profile", csrfProtection, profileRoutes);
app.use("/api/ai", csrfProtection, aiRoutes);
app.use("/budget", budgetRoutes);
app.use("/api/cards",         csrfProtection, cardRoutes);
app.use("/api/kyc",           csrfProtection, kycRoutes);
app.use("/api/tickets",       csrfProtection, ticketRoutes);
app.use("/api/rgpd",          csrfProtection, rgpdRoutes);

// ===============================
// 404
// ===============================
app.use("/api", (req, res) => {
  res.status(404).json({
    error: "Route API introuvable"
  });
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(publicDir, "404.html"));
});

// ===============================
// ERREUR CSRF
// ===============================
app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).json({
      error: "Token CSRF invalide ou manquant"
    });
  }

  console.error("SERVER ERROR:", err);

  res.status(500).json({
    error: "Erreur serveur"
  });
});
// ===============================
// UPLOADS — accessibles uniquement aux users connectés
// (pas en static public direct)
// ===============================
app.use("/uploads", (req, res, next) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Non autorisé" });
  }
  next();
}, express.static(path.join(__dirname, "uploads")));

// ===============================
// GESTION ERREURS
// ===============================
app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).json({ error: "Token CSRF invalide ou manquant" });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Fichier trop volumineux" });
  }

  console.error("SERVER ERROR:", err.message);

  // Ne jamais exposer le stack en production
  const isDev = process.env.NODE_ENV !== "production";
  res.status(500).json({
    error:  "Erreur serveur",
    ...(isDev && { debug: err.message })
  });
});

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 IRISBANK server running on port " + PORT);
  console.log(`📋 Env: ${process.env.NODE_ENV || "development"}`);
});


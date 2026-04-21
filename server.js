const express = require("express");
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
const contractRoutes = require('./routes/contracts');

const app = express();

// ===============================
// MIDDLEWARES
// ===============================
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

const budgetRoutes = require('./routes/budgetRoutes');
app.use('/budget', budgetRoutes);
app.use('/api/contracts', contractRoutes);

require('./services/budgetCron');
require('./services/salaryService');
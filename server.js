const express = require("express");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const csrf = require("csurf");
const cookieParser = require("cookie-parser");

require("dotenv").config();

const db = require("./config/db");

// routes
const authRoutes = require("./routes/authRoutes");
const accountRoutes = require("./routes/accountRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

// rate limit login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5
});

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// session
app.use(
  session({
    secret: process.env.SESSION_SECRET || "irisbanksecret",
    resave: false,
    saveUninitialized: false
  })
);

// CSRF avec cookie
const csrfProtection = csrf({
  cookie: true
});

// route token
app.get("/api/csrf-token", csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// routes
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth", csrfProtection, authRoutes);
app.use("/api/accounts", csrfProtection, accountRoutes);
app.use("/api/transactions", csrfProtection, transactionRoutes);
app.use("/api/admin", csrfProtection, adminRoutes);

// erreur CSRF
app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).json({ error: "Token CSRF invalide ou manquant" });
  }
  next(err);
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
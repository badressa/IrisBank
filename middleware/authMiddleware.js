const securityLogger = require("../services/securityLogger");

exports.requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    securityLogger.log("UNAUTH_ACCESS", req, { detail: "Accès API sans session" });
    return res.status(401).json({ error: "Non connecté" });
  }
  next();
};

exports.requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.user) {
    securityLogger.log("UNAUTH_ACCESS", req, { detail: "Accès admin sans session" });
    return res.status(401).json({ error: "Non connecté" });
  }
  if (req.session.user.role !== "ADMIN") {
    securityLogger.log("ADMIN_ACCESS_DENIED", req, {
      userId: req.session.user.id,
      detail: `Rôle insuffisant: ${req.session.user.role}`
    });
    return res.status(403).json({ error: "Accès admin requis" });
  }
  next();
};
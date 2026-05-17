/**
 * securityLogger.js
 * Log centralisé des événements de sécurité — aligné OWASP Top 10
 * Console colorée + écriture en DB (security_logs)
 */

const db = require("../config/db");

// Catalogue OWASP
const EVENTS = {
  // A01 – Broken Access Control
  UNAUTH_ACCESS:        { severity: "HIGH",     label: "A01 Accès non autorisé" },
  ADMIN_ACCESS_DENIED:  { severity: "HIGH",     label: "A01 Tentative accès admin" },
  IDOR_ATTEMPT:         { severity: "HIGH",     label: "A01 IDOR / accès compte tiers" },

  // A02 – Cryptographic Failures
  CSRF_INVALID:         { severity: "HIGH",     label: "A02 Token CSRF invalide" },

  // A03 – Injection
  SQL_PATTERN:          { severity: "CRITICAL", label: "A03 Pattern injection SQL/NoSQL" },
  XSS_PATTERN:          { severity: "CRITICAL", label: "A03 Pattern XSS détecté" },
  CMD_INJECTION:        { severity: "CRITICAL", label: "A03 Pattern injection commande" },
  PATH_TRAVERSAL:       { severity: "CRITICAL", label: "A03 Path traversal détecté" },

  // A04 / A05 – Insecure Design / Misconfiguration
  LARGE_PAYLOAD:        { severity: "MEDIUM",   label: "A05 Payload anormalement grand" },
  UNUSUAL_METHOD:       { severity: "MEDIUM",   label: "A05 Méthode HTTP inhabituelle" },
  SUSPICIOUS_HEADER:    { severity: "MEDIUM",   label: "A05 En-tête suspect" },

  // A07 – Authentication Failures
  LOGIN_FAILED:         { severity: "MEDIUM",   label: "A07 Échec de connexion" },
  BRUTE_FORCE:          { severity: "CRITICAL", label: "A07 Brute force détecté" },
  RATE_LIMITED:         { severity: "HIGH",     label: "A07 Rate limit déclenché" },
  INVALID_TOKEN:        { severity: "HIGH",     label: "A07 Token invalide / expiré" },

  // A08 – Data Integrity
  TAMPERED_AMOUNT:      { severity: "CRITICAL", label: "A08 Montant anormal / falsifié" },

  // A09 – Logging & Monitoring
  SERVER_ERROR:         { severity: "MEDIUM",   label: "A09 Erreur serveur 500" },
  DB_ERROR:             { severity: "HIGH",     label: "A09 Erreur base de données" },

  // Générique
  LOGIN_OK:             { severity: "LOW",      label: "Connexion réussie" },
  SUSPICIOUS_UA:        { severity: "LOW",      label: "Recon User-Agent suspect" },
  SCANNER_DETECTED:     { severity: "HIGH",     label: "Scanner / fuzzer détecté" },
};

const COLORS = {
  CRITICAL: "\x1b[41m\x1b[97m",
  HIGH:     "\x1b[31m",
  MEDIUM:   "\x1b[33m",
  LOW:      "\x1b[36m",
  RESET:    "\x1b[0m",
};

/**
 * @param {string} event  - clé de EVENTS
 * @param {object} req    - Express request (optionnel)
 * @param {object} extra  - { userId, detail, ip }
 */
async function log(event, req = null, extra = {}) {
  const meta = EVENTS[event] || { severity: "MEDIUM", label: event };

  const ip = req
    ? String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim().slice(0, 45)
    : (extra.ip || "");

  const method   = req?.method || "";
  const urlPath  = req?.originalUrl?.slice(0, 500) || "";
  const userId   = extra.userId ?? (req?.session?.user?.id ?? null);
  const detail   = extra.detail || "";

  const color = COLORS[meta.severity] || "";
  const ts    = new Date().toISOString();

  console.log(
    `${color}[SECURITY][${meta.severity}] ${ts} | ${meta.label}${COLORS.RESET}` +
    ` | IP:${ip || "-"} | ${method} ${urlPath}` +
    (detail ? ` | ${detail}` : "")
  );

  db.query(
    "INSERT INTO security_logs (user_id, event, severity, ip_address, method, path, detail) VALUES (?,?,?,?,?,?,?)",
    [userId, event, meta.severity, ip, method, urlPath, detail]
  ).catch(err => console.error("[SECURITY] DB write failed:", err.message));
}

module.exports = { log, EVENTS };

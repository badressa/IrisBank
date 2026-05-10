#!/usr/bin/env node
/**
 * security-dashboard.js
 * CLI — tableau de bord sécurité IRISBANK
 * Usage : node security-dashboard.js [--tail] [--severity=HIGH] [--limit=50]
 *
 * Options :
 *   --tail          Mode live : affiche les nouveaux logs toutes les 3s
 *   --severity=X    Filtre : LOW | MEDIUM | HIGH | CRITICAL
 *   --limit=N       Nombre de logs à afficher (défaut: 30)
 *   --stats         Affiche uniquement le résumé statistique
 */

require("dotenv").config();
const db = require("./config/db");

// ── Args ─────────────────────────────────────────────────────────────────────
const args      = process.argv.slice(2);
const TAIL      = args.includes("--tail");
const STATS     = args.includes("--stats");
const limitArg  = args.find(a => a.startsWith("--limit="));
const sevArg    = args.find(a => a.startsWith("--severity="));
const LIMIT     = limitArg ? parseInt(limitArg.split("=")[1]) : 30;
const SEV_FILTER = sevArg  ? sevArg.split("=")[1].toUpperCase() : null;

// ── Colors ───────────────────────────────────────────────────────────────────
const C = {
  CRITICAL: "\x1b[41m\x1b[97m",
  HIGH:     "\x1b[31m",
  MEDIUM:   "\x1b[33m",
  LOW:      "\x1b[36m",
  DIM:      "\x1b[2m",
  BOLD:     "\x1b[1m",
  CYAN:     "\x1b[96m",
  GREEN:    "\x1b[32m",
  RESET:    "\x1b[0m",
};

function color(sev, txt) {
  return (C[sev] || "") + txt + C.RESET;
}

function pad(str, n) {
  return String(str || "").padEnd(n).slice(0, n);
}

// ── Banners ──────────────────────────────────────────────────────────────────
const OWASP_TIPS = [
  "A01 Broken Access Control — vérifiez que chaque route valide bien la session",
  "A02 Cryptographic Failures — ne jamais stocker de mots de passe en clair",
  "A03 Injection — utilisez toujours des requêtes paramétrées (pas de concaténation SQL)",
  "A04 Insecure Design — journalisez TOUTES les actions sensibles",
  "A05 Security Misconfiguration — désactivez les routes de debug en prod",
  "A06 Vulnerable Components — maintenez npm audit propre",
  "A07 Auth Failures — limitez les tentatives de connexion par IP",
  "A08 Data Integrity — validez les montants côté serveur, jamais côté client",
  "A09 Logging & Monitoring — ce dashboard est votre premier rempart",
  "A10 SSRF — ne redirigez jamais vers une URL fournie par l'utilisateur",
];

// Recent real-world hacks (hardcoded news digest — update periodically)
const RECENT_HACKS = [
  "2024 — Change Healthcare (UnitedHealth) : 22 millions de dossiers médicaux volés via VPN sans MFA",
  "2024 — Snowflake clients (Ticketmaster, Santander…) : credential stuffing, pas de MFA",
  "2024 — AT&T : 73M comptes exposés, mot de passe chiffré mais clé prévisible",
  "2025 — PowerSchool : accès à 62M élèves via credential volé sur portail maintenance",
  "2025 — Oracle Health : breach de données patients, vieux serveur legacy non patché",
  "2025 — Community Health Center : 1M patients, ransomware via phishing email",
  "2026 — Tendance : AiTM phishing bypasse le MFA en volant le cookie de session",
];

function printBanner() {
  console.log(`\n${C.BOLD}${C.CYAN}╔══════════════════════════════════════════════════════════╗`);
  console.log(`║        IRISBANK — Security Dashboard (OWASP mode)       ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝${C.RESET}\n`);
}

function printOwaspTip() {
  const tip = OWASP_TIPS[Math.floor(Math.random() * OWASP_TIPS.length)];
  console.log(`${C.GREEN}[OWASP TIP]${C.RESET} ${tip}\n`);
}

function printRecentHacks() {
  console.log(`${C.BOLD}━━ Actualités Hacks récents ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.RESET}`);
  RECENT_HACKS.forEach(h => console.log(`  ${C.DIM}►${C.RESET} ${h}`));
  console.log();
}

// ── Stats ─────────────────────────────────────────────────────────────────────
async function printStats() {
  const [total]    = await db.query("SELECT COUNT(*) AS n FROM security_logs");
  const [bySev]    = await db.query("SELECT severity, COUNT(*) AS n FROM security_logs GROUP BY severity ORDER BY FIELD(severity,'CRITICAL','HIGH','MEDIUM','LOW')");
  const [byEvent]  = await db.query("SELECT event, COUNT(*) AS n FROM security_logs GROUP BY event ORDER BY n DESC LIMIT 10");
  const [topIps]   = await db.query("SELECT ip_address, COUNT(*) AS n FROM security_logs WHERE severity IN ('HIGH','CRITICAL') GROUP BY ip_address ORDER BY n DESC LIMIT 5");
  const [last24]   = await db.query("SELECT COUNT(*) AS n FROM security_logs WHERE created_at >= NOW() - INTERVAL 24 HOUR");
  const [critical24] = await db.query("SELECT COUNT(*) AS n FROM security_logs WHERE severity='CRITICAL' AND created_at >= NOW() - INTERVAL 24 HOUR");

  console.log(`${C.BOLD}━━ Statistiques ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.RESET}`);
  console.log(`  Total logs    : ${C.BOLD}${total[0].n}${C.RESET}`);
  console.log(`  Dernières 24h : ${C.BOLD}${last24[0].n}${C.RESET}  (dont CRITICAL: ${color("CRITICAL", String(critical24[0].n))})`);
  console.log();

  console.log(`  Par sévérité :`);
  bySev.forEach(r => console.log(`    ${color(r.severity, pad(r.severity, 9))} : ${r.n}`));
  console.log();

  console.log(`  Top événements :`);
  byEvent.forEach(r => console.log(`    ${pad(r.event, 22)} : ${r.n}`));
  console.log();

  if (topIps.length) {
    console.log(`  IPs suspectes (HIGH/CRITICAL) :`);
    topIps.forEach(r => console.log(`    ${C.HIGH}${r.ip_address}${C.RESET} — ${r.n} events`));
    console.log();
  }
}

// ── Log rows ──────────────────────────────────────────────────────────────────
async function fetchLogs(afterId = 0) {
  const conditions = ["id > ?"];
  const params     = [afterId];

  if (SEV_FILTER) { conditions.push("severity = ?"); params.push(SEV_FILTER); }

  const where = conditions.join(" AND ");
  const [rows] = await db.query(
    `SELECT id, created_at, severity, event, ip_address, method, path, detail, user_id
     FROM security_logs WHERE ${where} ORDER BY id DESC LIMIT ?`,
    [...params, LIMIT]
  );
  return rows.reverse();
}

function printRow(r) {
  const ts     = new Date(r.created_at).toLocaleString("fr-FR");
  const sev    = color(r.severity, pad(r.severity, 8));
  const event  = pad(r.event, 20);
  const ip     = pad(r.ip_address || "-", 16);
  const route  = `${pad(r.method || "", 5)} ${(r.path || "").slice(0, 40)}`;
  const detail = r.detail ? ` ${C.DIM}| ${r.detail.slice(0, 80)}${C.RESET}` : "";
  console.log(`${C.DIM}${ts}${C.RESET} | ${sev} | ${event} | IP:${ip} | ${route}${detail}`);
}

function printHeader() {
  console.log(`${C.BOLD}━━ Logs de sécurité ${SEV_FILTER ? `[${SEV_FILTER}]` : "[TOUS]"} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.RESET}`);
  console.log(`${"Date/Heure".padEnd(20)} | ${"SEVERITY".padEnd(9)} | ${"EVENT".padEnd(20)} | ${"IP".padEnd(20)} | Route`);
  console.log("─".repeat(110));
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  printBanner();
  printOwaspTip();

  if (!TAIL) {
    printRecentHacks();
  }

  await printStats();

  if (STATS) { process.exit(0); }

  printHeader();
  const rows = await fetchLogs(0);
  rows.forEach(printRow);

  if (!TAIL) {
    console.log(`\n${C.DIM}Astuce : node security-dashboard.js --tail  pour le mode live${C.RESET}\n`);
    process.exit(0);
  }

  // ── Live tail ──────────────────────────────────────────────────────────────
  let lastId = rows.length ? rows[rows.length - 1].id : 0;
  console.log(`\n${C.GREEN}[LIVE] En attente de nouveaux événements... (Ctrl+C pour quitter)${C.RESET}`);

  setInterval(async () => {
    try {
      const newRows = await fetchLogs(lastId);
      newRows.forEach(r => { printRow(r); lastId = r.id; });
    } catch (e) {
      console.error("[LIVE] Erreur:", e.message);
    }
  }, 3000);
})();

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

const WEEK_AMOUNT_THRESHOLD = 10000;
const EXTERNAL_TIMEOUT_MS = 5000;
const THREAT_INTEL_LIMIT = 5;
const countryCache = new Map();

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
const THREAT_FEEDS = {
  kev: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
  advisories: "https://www.cisa.gov/cybersecurity-advisories/all.xml",
};

const OWASP_KEYWORDS = [
  { category: "A01 Broken Access Control", terms: ["auth bypass", "privilege", "access control", "authorization", "account takeover"] },
  { category: "A02 Cryptographic Failures", terms: ["cryptographic", "encryption", "cipher", "certificate", "tls", "token leakage"] },
  { category: "A03 Injection", terms: ["sql injection", "command injection", "ldap injection", "xss", "cross-site scripting", "template injection"] },
  { category: "A05 Security Misconfiguration", terms: ["default configuration", "misconfiguration", "exposed admin", "open redirect", "debug"] },
  { category: "A07 Identification and Authentication Failures", terms: ["authentication", "credential", "password", "session fixation", "mfa", "cookie theft"] },
  { category: "A08 Software and Data Integrity Failures", terms: ["deserialization", "supply chain", "dependency", "integrity", "signature bypass"] },
  { category: "A10 SSRF", terms: ["ssrf", "server-side request forgery"] },
];

function printBanner() {
  console.log(`\n${C.BOLD}${C.CYAN}╔══════════════════════════════════════════════════════════╗`);
  console.log(`║        IRISBANK — Security Dashboard (OWASP mode)       ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝${C.RESET}\n`);
}

function formatDate(value) {
  if (!value) return "date inconnue";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("fr-FR");
}

function stripTags(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeXmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractXmlTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? decodeXmlEntities(stripTags(match[1])) : "";
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXTERNAL_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "user-agent": "IRISBANK-Security-Dashboard/1.0",
        accept: options.accept || "application/json, text/xml, application/xml, text/plain",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function inferOwaspCategory(...values) {
  const haystack = values.join(" ").toLowerCase();
  const match = OWASP_KEYWORDS.find(({ terms }) => terms.some((term) => haystack.includes(term)));
  return match ? match.category : "A06 Vulnerable and Outdated Components";
}

async function fetchRecentKevs() {
  try {
    const response = await fetchWithTimeout(THREAT_FEEDS.kev);
    const payload = await response.json();
    const vulnerabilities = Array.isArray(payload.vulnerabilities) ? payload.vulnerabilities : [];

    return vulnerabilities
      .sort((left, right) => new Date(right.dateAdded) - new Date(left.dateAdded))
      .slice(0, THREAT_INTEL_LIMIT)
      .map((item) => ({
        cve: item.cveID || "CVE inconnu",
        title: item.vulnerabilityName || `${item.vendorProject || "Vendor"} ${item.product || "Produit"}`,
        vendor: item.vendorProject || "Vendor inconnu",
        product: item.product || "Produit inconnu",
        addedAt: item.dateAdded,
        ransomware: item.knownRansomwareCampaignUse || "Unknown",
        summary: item.shortDescription || "",
        owasp: inferOwaspCategory(item.vulnerabilityName, item.shortDescription),
      }));
  } catch (error) {
    return [{ error: `Flux KEV indisponible: ${error.message}` }];
  }
}

async function fetchRecentAdvisories() {
  try {
    const response = await fetchWithTimeout(THREAT_FEEDS.advisories, { accept: "application/rss+xml, application/xml, text/xml" });
    const xml = await response.text();
    const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi))
      .slice(0, THREAT_INTEL_LIMIT)
      .map((match) => {
        const itemXml = match[1];
        return {
          title: extractXmlTag(itemXml, "title"),
          link: extractXmlTag(itemXml, "link"),
          publishedAt: extractXmlTag(itemXml, "pubDate"),
          summary: extractXmlTag(itemXml, "description"),
          owasp: inferOwaspCategory(extractXmlTag(itemXml, "title"), extractXmlTag(itemXml, "description")),
        };
      })
      .filter((item) => item.title);

    if (!items.length) {
      return [{ error: "Flux CISA vide ou non parsable" }];
    }

    return items;
  } catch (error) {
    return [{ error: `Flux alertes CISA indisponible: ${error.message}` }];
  }
}

async function printThreatIntel() {
  const [kevs, advisories] = await Promise.all([fetchRecentKevs(), fetchRecentAdvisories()]);

  console.log(`${C.BOLD}━━ Veille sécurité temps réel ━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.RESET}`);

  if (kevs[0] && kevs[0].error) {
    console.log(`  ${C.HIGH}KEV${C.RESET} ${kevs[0].error}`);
  } else {
    console.log(`  ${C.GREEN}CISA Known Exploited Vulnerabilities${C.RESET}`);
    kevs.forEach((item) => {
      const ransomware = String(item.ransomware).toLowerCase() === "known" ? color("CRITICAL", "ransomware:KNOWN") : `ransomware:${item.ransomware}`;
      console.log(`    ${C.DIM}►${C.RESET} ${item.cve} | ${item.title}`);
      console.log(`      ${item.vendor} / ${item.product} | ajouté: ${formatDate(item.addedAt)} | ${item.owasp} | ${ransomware}`);
      if (item.summary) {
        console.log(`      ${C.DIM}${item.summary.slice(0, 160)}${C.RESET}`);
      }
    });
  }

  console.log();

  if (advisories[0] && advisories[0].error) {
    console.log(`  ${C.HIGH}ALERTES${C.RESET} ${advisories[0].error}`);
  } else {
    console.log(`  ${C.GREEN}Alertes et advisories CISA${C.RESET}`);
    advisories.forEach((item) => {
      console.log(`    ${C.DIM}►${C.RESET} ${item.title}`);
      console.log(`      ${formatDate(item.publishedAt)} | ${item.owasp}`);
      if (item.summary) {
        console.log(`      ${C.DIM}${item.summary.slice(0, 160)}${C.RESET}`);
      }
      if (item.link) {
        console.log(`      ${item.link}`);
      }
    });
  }

  console.log();
}

function formatEur(n) {
  return `${Number(n || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}€`;
}

function isPrivateOrLocalIp(ipRaw) {
  const ip = String(ipRaw || "").trim().replace("::ffff:", "");
  if (!ip) return true;
  if (ip === "127.0.0.1" || ip === "::1" || ip.toLowerCase() === "localhost") return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
  return false;
}

async function resolveCountryFromIp(ipRaw) {
  const ip = String(ipRaw || "").trim().replace("::ffff:", "");
  if (!ip) return "Inconnu";
  if (isPrivateOrLocalIp(ip)) return "LOCAL";
  if (countryCache.has(ip)) return countryCache.get(ip);

  try {
    const r = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
    if (!r.ok) {
      countryCache.set(ip, "Inconnu");
      return "Inconnu";
    }
    const j = await r.json();
    const country = String(j.country_name || j.country || "Inconnu").slice(0, 60);
    countryCache.set(ip, country || "Inconnu");
    return country || "Inconnu";
  } catch (_) {
    countryCache.set(ip, "Inconnu");
    return "Inconnu";
  }
}

async function printWeeklyRiskAlerts() {
  const [bigTransfers] = await db.query(
    `SELECT t.id, t.montant, t.created_at,
            src.user_id AS user_id,
            COALESCE(u.email, 'inconnu') AS email,
            COALESCE(src.iban, 'N/A') AS iban_source,
            COALESCE(dst.iban, 'N/A') AS iban_destination
     FROM transactions t
     LEFT JOIN comptes_bancaires src ON src.id = t.compte_source_id
     LEFT JOIN comptes_bancaires dst ON dst.id = t.compte_destination_id
     LEFT JOIN users u ON u.id = src.user_id
     WHERE UPPER(t.type) = 'VIREMENT'
       AND t.montant > ?
       AND t.created_at >= NOW() - INTERVAL 7 DAY
     ORDER BY t.created_at DESC
     LIMIT 20`,
    [WEEK_AMOUNT_THRESHOLD]
  );

  const [bigAccounts] = await db.query(
    `SELECT c.id, c.user_id, COALESCE(u.email, 'inconnu') AS email,
            c.iban, c.type, c.solde, c.created_at
     FROM comptes_bancaires c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE c.solde > ?
       AND c.created_at >= NOW() - INTERVAL 7 DAY
     ORDER BY c.solde DESC
     LIMIT 20`,
    [WEEK_AMOUNT_THRESHOLD]
  );

  const [multiDevices] = await db.query(
    `SELECT lh.user_id,
            COALESCE(u.email, 'inconnu') AS email,
            COUNT(*) AS connexions,
            COUNT(DISTINCT CONCAT(COALESCE(lh.device_type,''),'|',COALESCE(lh.os,''),'|',COALESCE(lh.browser,''))) AS appareils,
            COUNT(DISTINCT lh.ip_address) AS ips
     FROM login_history lh
     JOIN users u ON u.id = lh.user_id
     WHERE lh.created_at >= NOW() - INTERVAL 7 DAY
     GROUP BY lh.user_id, u.email
     HAVING appareils >= 2
     ORDER BY appareils DESC, connexions DESC
     LIMIT 20`
  );

  const [loginIps] = await db.query(
    `SELECT lh.user_id, COALESCE(u.email, 'inconnu') AS email, lh.ip_address,
            MAX(lh.created_at) AS derniere_connexion
     FROM login_history lh
     JOIN users u ON u.id = lh.user_id
     WHERE lh.created_at >= NOW() - INTERVAL 7 DAY
       AND lh.ip_address IS NOT NULL
       AND lh.ip_address <> ''
     GROUP BY lh.user_id, u.email, lh.ip_address
     ORDER BY lh.user_id, derniere_connexion DESC`
  );

  const perUserCountries = new Map();
  for (const row of loginIps) {
    const country = await resolveCountryFromIp(row.ip_address);
    const key = `${row.user_id}|${row.email}`;
    if (!perUserCountries.has(key)) {
      perUserCountries.set(key, new Map());
    }
    const countriesMap = perUserCountries.get(key);
    if (!countriesMap.has(country)) {
      countriesMap.set(country, []);
    }
    countriesMap.get(country).push(String(row.ip_address).replace("::ffff:", ""));
  }

  const multiCountries = [];
  for (const [key, countriesMap] of perUserCountries.entries()) {
    const countries = Array.from(countriesMap.keys()).filter((c) => c && c !== "Inconnu");
    if (countries.length >= 2) {
      const [userId, email] = key.split("|");
      multiCountries.push({ userId, email, countries });
    }
  }

  console.log(`${C.BOLD}${C.HIGH}━━ Alertes Semaine (> 10 000€ / connexions anormales) ━━━━━━━━━━━━━━━━━━━━━${C.RESET}`);

  if (!bigTransfers.length && !bigAccounts.length && !multiDevices.length && !multiCountries.length) {
    console.log(`  ${C.GREEN}Aucune alerte critique cette semaine.${C.RESET}`);
    console.log();
    return;
  }

  if (bigTransfers.length) {
    console.log(`  ${C.HIGH}Virements > ${WEEK_AMOUNT_THRESHOLD}€ (7 jours)${C.RESET}`);
    bigTransfers.forEach((r) => {
      const when = new Date(r.created_at).toLocaleString("fr-FR");
      console.log(`    ${C.HIGH}•${C.RESET} #${r.id} | ${formatEur(r.montant)} | ${r.email} | ${when}`);
    });
    console.log();
  }

  if (bigAccounts.length) {
    console.log(`  ${C.HIGH}Comptes > ${WEEK_AMOUNT_THRESHOLD}€ créés cette semaine${C.RESET}`);
    bigAccounts.forEach((r) => {
      const when = new Date(r.created_at).toLocaleString("fr-FR");
      console.log(`    ${C.HIGH}•${C.RESET} compte#${r.id} | ${r.email} | ${r.type} | ${formatEur(r.solde)} | ${when}`);
    });
    console.log();
  }

  if (multiDevices.length) {
    console.log(`  ${C.HIGH}Utilisateurs connectés sur plusieurs appareils (7 jours)${C.RESET}`);
    multiDevices.forEach((r) => {
      console.log(`    ${C.HIGH}•${C.RESET} user#${r.user_id} ${r.email} | appareils:${r.appareils} | IPs:${r.ips} | connexions:${r.connexions}`);
    });
    console.log();
  }

  if (multiCountries.length) {
    console.log(`  ${C.HIGH}Utilisateurs connectés depuis plusieurs pays (7 jours)${C.RESET}`);
    multiCountries.forEach((r) => {
      console.log(`    ${C.HIGH}•${C.RESET} user#${r.userId} ${r.email} | pays: ${r.countries.join(", ")}`);
    });
    console.log();
  }
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
  await printThreatIntel();

  await printStats();
  await printWeeklyRiskAlerts();

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

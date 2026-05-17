const db = require("../config/db");
const { isOllamaEnabled, generateWithOllama, OLLAMA_MODEL } = require("../services/ollamaService");
const { isGeminiEnabled, generateWithGemini, GEMINI_MODEL } = require("../services/geminiService");

const LARGE_AMOUNT_EUR = 10000;
const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^::1$/i,
  /^fc00:/i,
  /^fd00:/i
];
const SUSPICIOUS_DESCRIPTION_PATTERNS = [
  /ami/i,
  /urgent/i,
  /verif/i,
  /verification/i,
  /nouveau compte/i,
  /nv compte/i,
  /ext/i,
  /externe/i,
  /wallet/i,
  /crypto/i,
  /cadeau/i,
  /test/i,
  /cash/i
];

function isPrivateIp(ip) {
  return !ip || PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(String(ip)));
}

function normalizeIp(ip) {
  if (!ip) return "";
  const trimmedIp = String(ip).trim();
  return trimmedIp.startsWith("::ffff:") ? trimmedIp.slice(7) : trimmedIp;
}

function toAmount(value) {
  return Number(value || 0);
}

function normalizeFreeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getMonthRange(inputMonth, inputYear) {
  const now = new Date();
  const year = Number(inputYear) || now.getFullYear();
  const month = Number(inputMonth) || (now.getMonth() + 1);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { month, year, start, end };
}

function toSqlDate(date) {
  return new Date(date).toISOString().slice(0, 19).replace("T", " ");
}

function looksSuspiciousDescription(description) {
  const normalized = normalizeFreeText(description);
  return Boolean(normalized) && SUSPICIOUS_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

function mapAiErrorForAdmin(rawError, provider) {
  const raw = String(rawError || "");
  if (!raw) return "Analyse locale utilisee.";
  if (raw.includes("GEMINI_HTTP_429")) return "Quota Gemini temporairement depasse. Analyse locale utilisee.";
  if (raw.includes("GEMINI_HTTP_403") || raw.includes("GEMINI_MISSING_API_KEY")) return "Configuration Gemini invalide. Analyse locale utilisee.";
  if (raw.includes("OLLAMA_HTTP_")) return "Service Ollama indisponible. Analyse locale utilisee.";
  if (raw.includes("AbortError") || raw.includes("aborted")) return provider === "gemini"
    ? "Gemini a depasse le delai. Analyse locale utilisee."
    : "Ollama a depasse le delai. Analyse locale utilisee.";
  return "Moteur IA indisponible. Analyse locale utilisee.";
}

function buildLocalFraudAnalysis(context) {
  const lines = [];
  const monthLabel = `${String(context.month).padStart(2, "0")}/${context.year}`;

  lines.push(`Analyse fraude du mois ${monthLabel}`);
  lines.push(`Score de risque estime: ${context.riskScore}/100.`);
  lines.push("");
  lines.push("Signaux detectes");
  lines.push(`- Virements >= 10 000 EUR: ${context.largeTransfers.length}`);
  lines.push(`- Virements a motif douteux: ${context.suspiciousDescriptions.length}`);
  lines.push(`- Virements vers comptes recents: ${context.newAccountTransfers.length}`);
  lines.push(`- Depots externes >= 10 000 EUR: ${context.externalLargeDeposits.length}`);
  lines.push(`- Utilisateurs multi-appareils: ${context.multiDeviceLogins.length}`);
  lines.push(`- Utilisateurs multi-pays: ${context.multiCountryLogins.length}`);
  lines.push("");
  lines.push("Transactions a verifier en priorite");

  if (!context.topTransactions.length) {
    lines.push("- Aucune transaction fortement suspecte detectee ce mois-ci.");
  } else {
    context.topTransactions.slice(0, 5).forEach((item) => {
      const reasons = item.reasons.join(", ");
      lines.push(`- ${item.type} ${item.montant.toFixed(2)} EUR le ${new Date(item.created_at).toLocaleString("fr-FR")} | ${reasons}`);
    });
  }

  lines.push("");
  lines.push("Connexions a verifier");
  if (!context.multiDeviceLogins.length && !context.multiCountryLogins.length) {
    lines.push("- Aucun profil multi-appareil ou multi-pays critique detecte.");
  }
  context.multiDeviceLogins.slice(0, 5).forEach((user) => {
    lines.push(`- ${user.fullName}: ${user.deviceCount} appareils ce mois-ci.`);
  });
  context.multiCountryLogins.slice(0, 5).forEach((user) => {
    lines.push(`- ${user.fullName}: pays observes ${user.countries.join(", ")}.`);
  });

  lines.push("");
  lines.push("Actions recommandees");
  lines.push("- Verifier manuellement les virements de montant eleve vers comptes recents.");
  lines.push("- Contacter les clients avec connexions multi-pays si le pattern est inhabituel.");
  lines.push("- Controler les motifs de virement ambigus: ami, verification, nouveau compte, ext/externe.");
  lines.push("- Surveiller les depots externes importants sur des comptes recemment ouverts.");

  return lines.join("\n");
}

async function resolveCountryFromIp(ip, cache) {
  const normalizedIp = normalizeIp(ip);

  if (!normalizedIp) return "Inconnu";
  if (isPrivateIp(normalizedIp)) return "Réseau local";
  if (cache.has(normalizedIp)) return cache.get(normalizedIp);

  let country = "Inconnu";

  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(normalizedIp)}`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.success && data.country) {
        country = data.country;
      }
    }
  } catch (error) {
    country = "Inconnu";
  }

  cache.set(normalizedIp, country);
  return country;
}

// ==============================
// CLIENTS
// ==============================
exports.getAllClients = async (req, res) => {
  try {
    const [clients] = await db.query(
      "SELECT id, nom, prenom, email FROM users WHERE role = 'CLIENT'"
    );

    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==============================
// CLIENT DETAIL
// ==============================
exports.getClient = async (req, res) => {
  try {
    const [client] = await db.query(
      "SELECT * FROM users WHERE id = ?",
      [req.params.id]
    );

    if (client.length === 0) {
      return res.status(404).json({ error: "Client introuvable" });
    }

    res.json(client[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==============================
// UPDATE CLIENT
// ==============================
exports.updateClient = async (req, res) => {
  try {
    const { nom, prenom, email } = req.body;

    await db.query(
      "UPDATE users SET nom = ?, prenom = ?, email = ? WHERE id = ?",
      [nom, prenom, email, req.params.id]
    );

    res.json({ message: "Client modifié" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==============================
// DELETE CLIENT
// ==============================
exports.deleteClient = async (req, res) => {
  try {
    await db.query(
      "DELETE FROM users WHERE id = ?",
      [req.params.id]
    );

    res.json({ message: "Client supprimé" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==============================
// ACCOUNTS
// ==============================
exports.getAllAccounts = async (req, res) => {
  try {
    const [accounts] = await db.query(`
      SELECT 
        comptes_bancaires.*,
        users.nom,
        users.prenom
      FROM comptes_bancaires
      JOIN users ON comptes_bancaires.user_id = users.id
      ORDER BY comptes_bancaires.id DESC
    `);

    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==============================
// BLOCK / UNBLOCK ACCOUNT
// ==============================
exports.toggleAccountStatus = async (req, res) => {
  try {
    const [account] = await db.query(
      "SELECT statut FROM comptes_bancaires WHERE id = ?",
      [req.params.id]
    );

    if (account.length === 0) {
      return res.status(404).json({ error: "Compte introuvable" });
    }

    const currentStatus = String(account[0].statut).toUpperCase();
    const newStatus = currentStatus === "ACTIF" ? "BLOQUE" : "ACTIF";

    await db.query(
      "UPDATE comptes_bancaires SET statut = ? WHERE id = ?",
      [newStatus, req.params.id]
    );

    await db.query(
      "INSERT INTO notifications (message, type) VALUES (?, ?)",
      [`Compte #${req.params.id} passé en statut ${newStatus}`, "ACCOUNT_STATUS"]
    );

    res.json({ message: "Statut modifié", statut: newStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==============================
// 🔎 RECHERCHE ADMIN
// ==============================
exports.search = async (req, res) => {
  try {
    const q = req.query.q ? req.query.q.trim() : "";

    if (!q) {
      return res.json({ results: [] });
    }

    const like = `%${q}%`;

    const [results] = await db.query(`
      SELECT 
        u.id AS user_id,
        u.nom,
        u.prenom,
        u.email,
        c.id AS account_id,
        c.iban,
        c.type,
        c.solde,
        c.statut
      FROM users u
      LEFT JOIN comptes_bancaires c 
        ON c.user_id = u.id
      WHERE 
        u.nom LIKE ?
        OR u.prenom LIKE ?
        OR u.email LIKE ?
        OR c.iban LIKE ?
      ORDER BY u.id DESC
    `, [like, like, like, like]);

    res.json({ results });

  } catch (error) {
    console.error("SEARCH ERROR :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// ==============================
// 📊 STATS
// ==============================
exports.getStats = async (req, res) => {
  try {
    const [[clients]] = await db.query(
      "SELECT COUNT(*) AS totalClients FROM users WHERE role = 'CLIENT'"
    );

    const [[accounts]] = await db.query(
      "SELECT COUNT(*) AS totalAccounts FROM comptes_bancaires"
    );

    const [[deposits]] = await db.query(
      "SELECT COALESCE(SUM(montant), 0) AS totalDeposits FROM transactions WHERE UPPER(type) = 'DEPOT'"
    );

    res.json({
      clients: clients.totalClients,
      accounts: accounts.totalAccounts,
      deposits: deposits.totalDeposits
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==============================
// ALL TRANSACTIONS
// ==============================
exports.getAllTransactions = async (req, res) => {
  try {
    const [transactions] = await db.query(`
      SELECT 
        t.id,
        t.type,
        t.montant,
        t.created_at AS date_transaction,
        s.iban AS source_iban,
        d.iban AS dest_iban
      FROM transactions t
      LEFT JOIN comptes_bancaires s 
        ON t.compte_source_id = s.id
      LEFT JOIN comptes_bancaires d 
        ON t.compte_destination_id = d.id
      ORDER BY t.created_at DESC
    `);

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==============================
// NOTIFICATIONS
// ==============================
exports.getNotifications = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10"
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==============================
// SECURITY OVERVIEW
// ==============================
exports.getSecurityOverview = async (req, res) => {
  try {
    const [largeTransfers] = await db.query(
      `SELECT
        t.id,
        t.montant,
        t.created_at,
        src.iban AS source_iban,
        dst.iban AS destination_iban,
        u_src.nom AS source_nom,
        u_src.prenom AS source_prenom,
        u_dst.nom AS destination_nom,
        u_dst.prenom AS destination_prenom
       FROM transactions t
       LEFT JOIN comptes_bancaires src ON src.id = t.compte_source_id
       LEFT JOIN comptes_bancaires dst ON dst.id = t.compte_destination_id
       LEFT JOIN users u_src ON u_src.id = src.user_id
       LEFT JOIN users u_dst ON u_dst.id = dst.user_id
       WHERE UPPER(t.type) = 'VIREMENT'
         AND t.montant >= ?
         AND t.created_at >= NOW() - INTERVAL 7 DAY
       ORDER BY t.created_at DESC`,
      [LARGE_AMOUNT_EUR]
    );

    const [largeExternalDeposits] = await db.query(
      `SELECT
        t.id,
        t.montant,
        t.created_at,
        dst.iban AS destination_iban,
        u.nom,
        u.prenom
       FROM transactions t
       JOIN comptes_bancaires dst ON dst.id = t.compte_destination_id
       JOIN users u ON u.id = dst.user_id
       WHERE UPPER(t.type) = 'DEPOT'
         AND t.compte_source_id IS NULL
         AND t.montant >= ?
         AND t.created_at >= NOW() - INTERVAL 7 DAY
       ORDER BY t.created_at DESC`,
      [LARGE_AMOUNT_EUR]
    );

    const [largeAccounts] = await db.query(
      `SELECT
        c.id,
        c.iban,
        c.type,
        c.solde,
        c.statut,
        u.nom,
        u.prenom
       FROM comptes_bancaires c
       JOIN users u ON u.id = c.user_id
       WHERE c.solde >= ?
       ORDER BY c.solde DESC`,
      [LARGE_AMOUNT_EUR]
    );

    const [recentLogins] = await db.query(
      `SELECT
        lh.user_id,
        lh.ip_address,
        lh.device_type,
        lh.os,
        lh.browser,
        lh.created_at,
        u.nom,
        u.prenom,
        u.email
       FROM login_history lh
       JOIN users u ON u.id = lh.user_id
       WHERE lh.created_at >= NOW() - INTERVAL 7 DAY
       ORDER BY lh.created_at DESC
       LIMIT 250`
    );

    const geoCache = new Map();
    const loginRows = await Promise.all(
      recentLogins.map(async (row) => ({
        ...row,
        country: await resolveCountryFromIp(row.ip_address, geoCache)
      }))
    );

    const perUser = new Map();

    loginRows.forEach((row) => {
      if (!perUser.has(row.user_id)) {
        perUser.set(row.user_id, {
          userId: row.user_id,
          fullName: `${row.prenom} ${row.nom}`.trim(),
          email: row.email,
          devices: new Set(),
          countries: new Set(),
          lastLoginAt: row.created_at
        });
      }

      const current = perUser.get(row.user_id);
      current.devices.add(`${row.device_type || "Inconnu"} / ${row.os || "Inconnu"} / ${row.browser || "Inconnu"}`);
      current.countries.add(row.country || "Inconnu");

      if (!current.lastLoginAt || new Date(row.created_at) > new Date(current.lastLoginAt)) {
        current.lastLoginAt = row.created_at;
      }
    });

    const multiDeviceLogins = [];
    const multiCountryLogins = [];

    perUser.forEach((entry) => {
      const devices = Array.from(entry.devices);
      const countries = Array.from(entry.countries);
      const resolvedCountries = countries.filter((country) => country && country !== "Inconnu" && country !== "Réseau local");

      if (devices.length > 1) {
        multiDeviceLogins.push({
          userId: entry.userId,
          fullName: entry.fullName,
          email: entry.email,
          devices,
          deviceCount: devices.length,
          lastLoginAt: entry.lastLoginAt
        });
      }

      if (resolvedCountries.length > 1) {
        multiCountryLogins.push({
          userId: entry.userId,
          fullName: entry.fullName,
          email: entry.email,
          countries,
          countryCount: resolvedCountries.length,
          lastLoginAt: entry.lastLoginAt
        });
      }
    });

    res.json({
      threshold: LARGE_AMOUNT_EUR,
      weeklyRiskTotals: {
        largeTransfersAmount: largeTransfers.reduce((sum, item) => sum + toAmount(item.montant), 0),
        externalDepositsAmount: largeExternalDeposits.reduce((sum, item) => sum + toAmount(item.montant), 0),
        largeAccountsAmount: largeAccounts.reduce((sum, item) => sum + toAmount(item.solde), 0)
      },
      largeTransfers,
      largeExternalDeposits,
      largeAccounts,
      multiDeviceLogins: multiDeviceLogins.sort((a, b) => new Date(b.lastLoginAt) - new Date(a.lastLoginAt)),
      multiCountryLogins: multiCountryLogins.sort((a, b) => new Date(b.lastLoginAt) - new Date(a.lastLoginAt))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==============================
// AI FRAUD ANALYSIS
// ==============================
exports.getFraudAnalysis = async (req, res) => {
  try {
    const { month, year, start, end } = getMonthRange(req.query?.month, req.query?.year);

    const [monthlyTransactions] = await db.query(
      `SELECT
        t.id,
        t.type,
        t.montant,
        t.description,
        t.created_at,
        t.compte_source_id,
        t.compte_destination_id,
        src.iban AS source_iban,
        dst.iban AS destination_iban,
        src.created_at AS source_account_created_at,
        dst.created_at AS destination_account_created_at,
        u_src.nom AS source_nom,
        u_src.prenom AS source_prenom,
        u_dst.nom AS destination_nom,
        u_dst.prenom AS destination_prenom
       FROM transactions t
       LEFT JOIN comptes_bancaires src ON src.id = t.compte_source_id
       LEFT JOIN comptes_bancaires dst ON dst.id = t.compte_destination_id
       LEFT JOIN users u_src ON u_src.id = src.user_id
       LEFT JOIN users u_dst ON u_dst.id = dst.user_id
       WHERE t.created_at >= ? AND t.created_at < ?
       ORDER BY t.created_at DESC
       LIMIT 400`,
      [toSqlDate(start), toSqlDate(end)]
    );

    const [monthlyLogins] = await db.query(
      `SELECT
        lh.user_id,
        lh.ip_address,
        lh.device_type,
        lh.os,
        lh.browser,
        lh.created_at,
        u.nom,
        u.prenom,
        u.email
       FROM login_history lh
       JOIN users u ON u.id = lh.user_id
       WHERE lh.created_at >= ? AND lh.created_at < ?
       ORDER BY lh.created_at DESC
       LIMIT 300`,
      [toSqlDate(start), toSqlDate(end)]
    );

    const geoCache = new Map();
    const loginRows = await Promise.all(
      monthlyLogins.map(async (row) => ({
        ...row,
        country: await resolveCountryFromIp(row.ip_address, geoCache)
      }))
    );

    const largeTransfers = [];
    const suspiciousDescriptions = [];
    const newAccountTransfers = [];
    const externalLargeDeposits = [];
    const topTransactions = [];

    monthlyTransactions.forEach((tx) => {
      const txType = String(tx.type || "").toUpperCase();
      const amount = toAmount(tx.montant);
      const reasons = [];
      const destinationAgeDays = tx.destination_account_created_at
        ? Math.floor((new Date(tx.created_at) - new Date(tx.destination_account_created_at)) / 86400000)
        : null;

      if (txType === "VIREMENT" && amount >= LARGE_AMOUNT_EUR) {
        largeTransfers.push(tx);
        reasons.push("montant eleve");
      }

      if (txType === "VIREMENT" && looksSuspiciousDescription(tx.description)) {
        suspiciousDescriptions.push(tx);
        reasons.push(`motif douteux: ${tx.description || "sans motif"}`);
      }

      if (txType === "VIREMENT" && destinationAgeDays !== null && destinationAgeDays >= 0 && destinationAgeDays <= 14) {
        newAccountTransfers.push({
          ...tx,
          destinationAgeDays
        });
        reasons.push(`compte destination recent (${destinationAgeDays} j)`);
      }

      if (txType === "DEPOT" && !tx.compte_source_id && amount >= LARGE_AMOUNT_EUR) {
        externalLargeDeposits.push(tx);
        reasons.push("depot externe eleve");
      }

      if (reasons.length) {
        topTransactions.push({
          ...tx,
          reasons
        });
      }
    });

    const byUser = new Map();
    loginRows.forEach((row) => {
      if (!byUser.has(row.user_id)) {
        byUser.set(row.user_id, {
          userId: row.user_id,
          fullName: `${row.prenom} ${row.nom}`.trim(),
          email: row.email,
          devices: new Set(),
          countries: new Set(),
          lastLoginAt: row.created_at
        });
      }

      const current = byUser.get(row.user_id);
      current.devices.add(`${row.device_type || "Inconnu"} / ${row.os || "Inconnu"} / ${row.browser || "Inconnu"}`);
      if (row.country) current.countries.add(row.country);
      if (!current.lastLoginAt || new Date(row.created_at) > new Date(current.lastLoginAt)) {
        current.lastLoginAt = row.created_at;
      }
    });

    const multiDeviceLogins = [];
    const multiCountryLogins = [];
    byUser.forEach((entry) => {
      const devices = Array.from(entry.devices);
      const countries = Array.from(entry.countries).filter((country) => country && country !== "Inconnu" && country !== "Réseau local");

      if (devices.length > 1) {
        multiDeviceLogins.push({
          userId: entry.userId,
          fullName: entry.fullName,
          email: entry.email,
          deviceCount: devices.length,
          devices,
          lastLoginAt: entry.lastLoginAt
        });
      }

      if (countries.length > 1) {
        multiCountryLogins.push({
          userId: entry.userId,
          fullName: entry.fullName,
          email: entry.email,
          countryCount: countries.length,
          countries,
          lastLoginAt: entry.lastLoginAt
        });
      }
    });

    const riskScore = Math.min(
      100,
      largeTransfers.length * 20 +
      suspiciousDescriptions.length * 15 +
      newAccountTransfers.length * 12 +
      externalLargeDeposits.length * 20 +
      multiDeviceLogins.length * 8 +
      multiCountryLogins.length * 18
    );

    const context = {
      month,
      year,
      riskScore,
      largeTransfers,
      suspiciousDescriptions,
      newAccountTransfers,
      externalLargeDeposits,
      multiDeviceLogins: multiDeviceLogins.sort((a, b) => new Date(b.lastLoginAt) - new Date(a.lastLoginAt)),
      multiCountryLogins: multiCountryLogins.sort((a, b) => new Date(b.lastLoginAt) - new Date(a.lastLoginAt)),
      topTransactions: topTransactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    };

    const suspiciousTransactionLines = context.topTransactions.slice(0, 12).map((tx) => {
      const sourceName = `${tx.source_prenom || "?"} ${tx.source_nom || ""}`.trim();
      const destinationName = `${tx.destination_prenom || "?"} ${tx.destination_nom || ""}`.trim();
      return `- ${tx.type} ${toAmount(tx.montant).toFixed(2)} EUR le ${new Date(tx.created_at).toLocaleString("fr-FR")} | ${sourceName} -> ${destinationName} | ${tx.source_iban || "-"} -> ${tx.destination_iban || "-"} | motif: ${tx.description || "sans motif"} | raisons: ${tx.reasons.join(", ")}`;
    }).join("\n") || "- aucun cas transactionnel critique";

    const loginLines = [
      ...context.multiDeviceLogins.slice(0, 8).map((user) => `- multi-appareils: ${user.fullName} | ${user.devices.join(" ; ")}`),
      ...context.multiCountryLogins.slice(0, 8).map((user) => `- multi-pays: ${user.fullName} | ${user.countries.join(" ; ")}`)
    ].join("\n") || "- aucun cas critique de connexion";

    const prompt = [
      "Tu es un analyste fraude bancaire senior.",
      "Analyse le mois en cours et reponds en francais, de maniere concrete et exploitable pour un admin bancaire.",
      `Periode: ${String(month).padStart(2, "0")}/${year}`,
      `Score de risque calcule localement: ${riskScore}/100`,
      `Virements >= 10 000 EUR: ${context.largeTransfers.length}`,
      `Virements avec motif douteux: ${context.suspiciousDescriptions.length}`,
      `Virements vers comptes recents: ${context.newAccountTransfers.length}`,
      `Depots externes >= 10 000 EUR: ${context.externalLargeDeposits.length}`,
      `Profils multi-appareils: ${context.multiDeviceLogins.length}`,
      `Profils multi-pays: ${context.multiCountryLogins.length}`,
      "",
      "Transactions suspectes detaillees:",
      suspiciousTransactionLines,
      "",
      "Connexions suspectes detaillees:",
      loginLines,
      "",
      "Reponds avec ces 5 sections exactes:",
      "Verdict global",
      "Transactions douteuses",
      "Connexions douteuses",
      "Hypotheses de fraude",
      "Actions immediates"
    ].join("\n");

    const aiProvider = String(process.env.AI_PROVIDER || "ollama").toLowerCase();
    let analysis = "";
    let provider = "local-fallback";
    let model = "rules";
    let providerError = null;

    if (aiProvider === "gemini") {
      if (isGeminiEnabled()) {
        const result = await generateWithGemini(prompt);
        if (result.ok && result.text) {
          analysis = result.text;
          provider = "gemini";
          model = result.model;
        } else {
          providerError = result.error || "GEMINI_UNAVAILABLE";
        }
      } else {
        providerError = "GEMINI_DISABLED";
      }

      if (!analysis && isOllamaEnabled()) {
        const fallback = await generateWithOllama(prompt);
        if (fallback.ok && fallback.text) {
          analysis = fallback.text;
          provider = "ollama";
          model = fallback.model;
        } else {
          providerError = `${providerError || "GEMINI_FAILED"}; ${fallback.error || "OLLAMA_UNAVAILABLE"}`;
        }
      }
    } else if (isOllamaEnabled()) {
      const result = await generateWithOllama(prompt);
      if (result.ok && result.text) {
        analysis = result.text;
        provider = "ollama";
        model = result.model;
      } else {
        providerError = result.error || "OLLAMA_UNAVAILABLE";
      }
    } else {
      providerError = "OLLAMA_DISABLED";
    }

    if (!analysis) {
      analysis = buildLocalFraudAnalysis(context);
    }

    res.json({
      success: true,
      period: {
        month,
        year,
        label: `${String(month).padStart(2, "0")}/${year}`
      },
      riskScore,
      provider,
      model,
      configuredProvider: aiProvider,
      ollamaModelDefault: OLLAMA_MODEL,
      geminiModelDefault: GEMINI_MODEL,
      providerError,
      aiErrorMessage: provider === "local-fallback" ? mapAiErrorForAdmin(providerError, aiProvider) : null,
      counts: {
        largeTransfers: context.largeTransfers.length,
        suspiciousDescriptions: context.suspiciousDescriptions.length,
        newAccountTransfers: context.newAccountTransfers.length,
        externalLargeDeposits: context.externalLargeDeposits.length,
        multiDeviceLogins: context.multiDeviceLogins.length,
        multiCountryLogins: context.multiCountryLogins.length
      },
      analysis
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
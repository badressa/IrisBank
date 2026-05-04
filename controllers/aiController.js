const { validationResult } = require("express-validator");
const db = require("../config/db");
const { isOllamaEnabled, generateWithOllama, OLLAMA_MODEL } = require("../services/ollamaService");
const { isGeminiEnabled, generateWithGemini, GEMINI_MODEL } = require("../services/geminiService");

// ==============================
// BUILD USER CONTEXT
// ==============================
async function buildUserContext(userId) {
  const [[user]] = await db.query(
    `SELECT id, nom, prenom, email
     FROM users
     WHERE id = ?`,
    [userId]
  );

  const [accounts] = await db.query(
    `SELECT id, iban, type, solde, statut, created_at
     FROM comptes_bancaires
     WHERE user_id = ?
     ORDER BY id DESC`,
    [userId]
  );

  const [transactions] = await db.query(
    `SELECT
        t.id,
        t.type,
        t.montant,
        t.created_at,
        s.iban AS source_iban,
        d.iban AS dest_iban
     FROM transactions t
     LEFT JOIN comptes_bancaires s ON t.compte_source_id = s.id
     LEFT JOIN comptes_bancaires d ON t.compte_destination_id = d.id
     WHERE t.compte_source_id IN (
       SELECT id FROM comptes_bancaires WHERE user_id = ?
     )
     OR t.compte_destination_id IN (
       SELECT id FROM comptes_bancaires WHERE user_id = ?
     )
     ORDER BY t.created_at DESC
     LIMIT 20`,
    [userId, userId]
  );

  const totalBalance = accounts.reduce((sum, acc) => {
    return sum + Number(acc.solde || 0);
  }, 0);

  return {
    user,
    totalBalance: Number(totalBalance.toFixed(2)),
    accounts,
    recentTransactions: transactions
  };
}

// ==============================
// HELPERS
// ==============================
function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatCurrency(value) {
  return Number(value || 0).toFixed(2) + "€";
}

function summarizeAccounts(accounts) {
  if (!accounts.length) {
    return "Tu n’as actuellement aucun compte bancaire.";
  }

  return accounts
    .map((acc) => {
      return `• Compte #${acc.id} (${acc.type}) — ${acc.iban} — solde ${formatCurrency(acc.solde)} — statut ${acc.statut}`;
    })
    .join("\n");
}

function summarizeRecentTransactions(transactions) {
  if (!transactions.length) {
    return "Je ne vois aucune transaction récente sur tes comptes.";
  }

  const lines = transactions.slice(0, 5).map((tx) => {
    const date = new Date(tx.created_at).toLocaleString("fr-FR");
    let details = `• ${tx.type} de ${formatCurrency(tx.montant)} le ${date}`;

    if (tx.source_iban) {
      details += ` | source: ${tx.source_iban}`;
    }

    if (tx.dest_iban) {
      details += ` | destination: ${tx.dest_iban}`;
    }

    return details;
  });

  return lines.join("\n");
}

function getBlockedAccounts(accounts) {
  return accounts.filter((acc) => String(acc.statut).toUpperCase() === "BLOQUE");
}

function buildLocalReply(message, context) {
  const msg = normalizeText(message);
  const { user, totalBalance, accounts, recentTransactions } = context;
  const blockedAccounts = getBlockedAccounts(accounts);

  if (msg.includes("bonjour") || msg.includes("salut") || msg.includes("hello")) {
    return `Bonjour ${user?.prenom || ""} 👋 Je suis ton assistant IRISBANK. Je peux t’aider pour ton solde, tes comptes, tes transactions ou les opérations bancaires.`;
  }

  if (
    msg.includes("solde total") ||
    msg.includes("combien j'ai") ||
    msg.includes("combien ai-je") ||
    msg.includes("mon solde") ||
    msg.includes("argent")
  ) {
    return `Ton solde total sur l’ensemble de tes comptes est de ${formatCurrency(totalBalance)}.`;
  }

  if (
    msg.includes("mes comptes") ||
    msg.includes("liste des comptes") ||
    msg.includes("comptes disponibles") ||
    msg.includes("mes compte")
  ) {
    return `Voici tes comptes :\n${summarizeAccounts(accounts)}`;
  }

  if (
    msg.includes("transaction") ||
    msg.includes("transactions") ||
    msg.includes("historique") ||
    msg.includes("dernieres operations") ||
    msg.includes("dernieres transactions") ||
    msg.includes("recentes")
  ) {
    return `Voici un résumé de tes transactions récentes :\n${summarizeRecentTransactions(recentTransactions)}`;
  }

  if (msg.includes("virement")) {
    return "Pour faire un virement, sélectionne un compte source, saisis l’IBAN destination et entre un montant d’au moins 1€. Le virement échoue si le solde est insuffisant, si le compte source ou destination est bloqué, ou si l’IBAN n’existe pas.";
  }

  if (msg.includes("depot") || msg.includes("deposer")) {
    return "Pour effectuer un dépôt, choisis un compte puis entre un montant valide d’au moins 1€, avec 2 décimales maximum.";
  }

  if (msg.includes("retrait") || msg.includes("retirer")) {
    return "Pour effectuer un retrait, choisis un compte puis entre un montant valide d’au moins 1€ et au maximum 1000€. Le retrait échoue si le solde est insuffisant ou si le compte est bloqué.";
  }

  if (
    msg.includes("bloque") ||
    msg.includes("bloqué") ||
    msg.includes("compte bloque") ||
    msg.includes("compte bloqué")
  ) {
    if (!blockedAccounts.length) {
      return "Je ne vois actuellement aucun compte bloqué sur ton espace.";
    }

    const details = blockedAccounts
      .map((acc) => `• Compte #${acc.id} (${acc.type}) — ${acc.iban}`)
      .join("\n");

    return `Voici les comptes actuellement bloqués :\n${details}\n\nUn compte bloqué ne peut pas recevoir certaines opérations tant qu’il n’est pas réactivé par l’administration.`;
  }

  if (
    msg.includes("pourquoi") &&
    (msg.includes("echec") || msg.includes("refuse") || msg.includes("erreur"))
  ) {
    return "Une opération peut échouer pour plusieurs raisons : montant invalide, solde insuffisant, compte bloqué, IBAN introuvable ou token CSRF/session invalide.";
  }

  if (
    msg.includes("qui suis-je") ||
    msg.includes("mes infos") ||
    msg.includes("mon profil")
  ) {
    return `Tu es connecté en tant que ${user?.prenom || ""} ${user?.nom || ""} (${user?.email || "email inconnu"}). Tu peux modifier tes informations depuis la page Profil.`;
  }

  return `Je peux t’aider sur ces sujets :
• ton solde total
• la liste de tes comptes
• tes transactions récentes
• comment faire un dépôt, retrait ou virement
• les comptes bloqués
• les raisons d’échec d’une opération

Exemples :
- Quel est mon solde total ?
- Résume mes dernières transactions
- Comment faire un virement ?
- Est-ce que j’ai un compte bloqué ?`;
}

function parseMonthYear(inputMonth, inputYear) {
  const now = new Date();
  const month = Number(inputMonth) || (now.getMonth() + 1);
  const year = Number(inputYear) || now.getFullYear();

  if (month < 1 || month > 12) {
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  }

  return { month, year };
}

function mapAiErrorForUser(rawError, provider) {
  const raw = String(rawError || "").trim();
  if (!raw) {
    return "Le moteur IA est momentanement indisponible.";
  }

  if (raw.includes("GEMINI_HTTP_429")) {
    return "Le quota Gemini est temporairement depasse (limite minute/jour). Reessayez dans 1-2 minutes.";
  }

  if (raw.includes("GEMINI_HTTP_403") || raw.includes("GEMINI_MISSING_API_KEY")) {
    return "La configuration Gemini est invalide (cle API manquante ou non autorisee).";
  }

  if (raw.includes("GEMINI_HTTP_404")) {
    return "Le modele Gemini configure est introuvable pour cette API.";
  }

  if (raw.includes("This operation was aborted") || raw.includes("AbortError")) {
    return provider === "gemini"
      ? "Gemini a depasse le delai de reponse. Reessayez avec une requete plus courte."
      : "Ollama a depasse le delai de reponse. Verifiez que le modele est bien charge.";
  }

  if (raw.includes("OLLAMA_HTTP_")) {
    return "Ollama a renvoye une erreur HTTP. Verifiez le service local Ollama.";
  }

  if (raw.includes("GEMINI_HTTP_")) {
    return "Gemini a renvoye une erreur HTTP. Verifiez le quota et le modele configure.";
  }

  return "Le moteur IA est indisponible pour le moment. L'analyse locale est utilisee.";
}

async function buildBudgetAnalysisContext(userId, month, year) {
  // Infos personnelles de l'utilisateur
  const [[user]] = await db.query(
    `SELECT id, nom, prenom, email FROM users WHERE id = ?`,
    [userId]
  );

  // Comptes bancaires avec soldes
  const [accounts] = await db.query(
    `SELECT id, iban, type, solde, statut, created_at
     FROM comptes_bancaires
     WHERE user_id = ?
     ORDER BY id DESC`,
    [userId]
  );

  const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.solde || 0), 0);

  // Transactions recentes detaillees (50 dernieres)
  const [recentTransactions] = await db.query(
    `SELECT
        t.id,
        t.type,
        t.montant,
        t.created_at,
        s.iban AS source_iban,
        d.iban AS dest_iban
     FROM transactions t
     LEFT JOIN comptes_bancaires s ON t.compte_source_id = s.id
     LEFT JOIN comptes_bancaires d ON t.compte_destination_id = d.id
     WHERE t.compte_source_id IN (SELECT id FROM comptes_bancaires WHERE user_id = ?)
        OR t.compte_destination_id IN (SELECT id FROM comptes_bancaires WHERE user_id = ?)
     ORDER BY t.created_at DESC
     LIMIT 50`,
    [userId, userId]
  );

  const [depenses] = await db.query(
    `SELECT
      bc.nom,
      COALESCE(SUM(bh.montant), 0) AS total_depense,
      COALESCE(bl.plafond, 0) AS plafond
     FROM budget_categories bc
     LEFT JOIN budget_paiements bp ON bp.categorie_id = bc.id AND bp.user_id = ?
     LEFT JOIN budget_historique bh ON bh.paiement_id = bp.id AND bh.mois = ? AND bh.annee = ?
     LEFT JOIN budget_limites bl ON bl.categorie_id = bc.id AND bl.user_id = ?
     GROUP BY bc.id
     HAVING total_depense > 0 OR plafond > 0
     ORDER BY total_depense DESC`,
    [userId, month, year, userId]
  );

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const [depensesPrev] = await db.query(
    `SELECT
      bc.nom,
      COALESCE(SUM(bh.montant), 0) AS total_depense
     FROM budget_categories bc
     LEFT JOIN budget_paiements bp ON bp.categorie_id = bc.id AND bp.user_id = ?
     LEFT JOIN budget_historique bh ON bh.paiement_id = bp.id AND bh.mois = ? AND bh.annee = ?
     GROUP BY bc.id
     HAVING total_depense > 0`,
    [userId, prevMonth, prevYear]
  );

  const [recurrents] = await db.query(
    `SELECT
      bp.montant,
      bc.nom AS categorie
     FROM budget_paiements bp
     JOIN budget_categories bc ON bc.id = bp.categorie_id
     WHERE bp.user_id = ? AND bp.recurrent = 1 AND bp.statut = 'ACTIF'
     ORDER BY bp.montant DESC`,
    [userId]
  );

  const [monthlyTotals] = await db.query(
    `SELECT
      bh.annee,
      bh.mois,
      COALESCE(SUM(bh.montant), 0) AS total
     FROM budget_historique bh
     JOIN budget_paiements bp ON bp.id = bh.paiement_id
     WHERE bp.user_id = ?
     GROUP BY bh.annee, bh.mois
     ORDER BY bh.annee DESC, bh.mois DESC
     LIMIT 3`,
    [userId]
  );

  const totalMonth = depenses.reduce((sum, row) => sum + Number(row.total_depense || 0), 0);

  const assuranceSpent = depenses
    .filter((d) => /assurance/i.test(String(d.nom || "")))
    .reduce((sum, d) => sum + Number(d.total_depense || 0), 0);

  const marcheSpent = depenses
    .filter((d) => /marche|supermarche|courses|alimentation/i.test(String(d.nom || "")))
    .reduce((sum, d) => sum + Number(d.total_depense || 0), 0);

  const depassements = depenses
    .filter((d) => Number(d.plafond || 0) > 0 && Number(d.total_depense || 0) > Number(d.plafond || 0))
    .map((d) => ({
      categorie: d.nom,
      depense: Number(d.total_depense || 0),
      plafond: Number(d.plafond || 0),
      excedent: Number(d.total_depense || 0) - Number(d.plafond || 0)
    }));

  return {
    user: {
      prenom: user?.prenom || "",
      nom: user?.nom || "",
      email: user?.email || ""
    },
    accounts: accounts.map((a) => ({
      type: a.type,
      iban: a.iban,
      solde: Number(a.solde || 0),
      statut: a.statut
    })),
    totalBalance: Number(totalBalance.toFixed(2)),
    recentTransactions: recentTransactions.map((t) => ({
      type: t.type,
      montant: Number(t.montant || 0),
      date: new Date(t.created_at).toLocaleDateString("fr-FR"),
      source_iban: t.source_iban || null,
      dest_iban: t.dest_iban || null
    })),
    month,
    year,
    totalMonth: Number(totalMonth.toFixed(2)),
    assuranceSpent: Number(assuranceSpent.toFixed(2)),
    marcheSpent: Number(marcheSpent.toFixed(2)),
    depenses: depenses.map((d) => ({
      categorie: d.nom,
      total_depense: Number(d.total_depense || 0),
      plafond: Number(d.plafond || 0)
    })),
    depensesPrev: depensesPrev.map((d) => ({
      categorie: d.nom,
      total_depense: Number(d.total_depense || 0)
    })),
    recurrents: recurrents.map((r) => ({
      categorie: r.categorie,
      montant: Number(r.montant || 0)
    })),
    monthlyTotals: monthlyTotals.map((m) => ({
      annee: Number(m.annee),
      mois: Number(m.mois),
      total: Number(m.total || 0)
    })),
    depassements
  };
}

function buildLocalBudgetFallback(context, question) {
  const lines = [];
  const total = context.totalMonth || 0;
  const topDepenses = context.depenses.slice(0, 5);
  const topCat = topDepenses[0];
  const prevMap = new Map(context.depensesPrev.map((d) => [String(d.categorie), Number(d.total_depense || 0)]));

  const alerts = [];
  topDepenses.forEach((d) => {
    const prev = prevMap.get(String(d.categorie)) || 0;
    if (prev > 0) {
      const pct = ((Number(d.total_depense) - prev) / prev) * 100;
      if (pct >= 20) {
        alerts.push(`Vos depenses en ${d.categorie} ont augmente de ${pct.toFixed(0)}% par rapport au mois precedent.`);
      }
    }
  });

  if (topCat && total > 0) {
    const share = (Number(topCat.total_depense) / total) * 100;
    if (share >= 40) {
      alerts.push(`La categorie ${topCat.categorie} represente ${share.toFixed(0)}% de vos depenses mensuelles.`);
    }
  }

  if (alerts.length === 0) {
    alerts.push("Alerte faible: aucune hausse critique detectee sur les categories principales.");
  }

  const depassementTotal = context.depassements.reduce((s, d) => s + Number(d.excedent || 0), 0);
  const recurringTotal = context.recurrents.reduce((s, r) => s + Number(r.montant || 0), 0);
  const estimationEco = Number((depassementTotal + recurringTotal * 0.1).toFixed(2));

  const forecastBase = context.monthlyTotals.length > 0
    ? context.monthlyTotals.reduce((s, m) => s + Number(m.total || 0), 0) / context.monthlyTotals.length
    : total;
  const forecast = Number(forecastBase.toFixed(2));

  const remainingByCat = context.depenses
    .filter((d) => Number(d.plafond || 0) > 0)
    .map((d) => Number(d.plafond || 0) - Number(d.total_depense || 0));
  const minRemaining = remainingByCat.length > 0 ? Math.min(...remainingByCat) : 0;

  lines.push("Analyse automatique des depenses");
  lines.push("L'IA analyse les transactions et les classe par categories.");
  lines.push(`Total mensuel analyse: ${total.toFixed(2)} EUR.`);
  topDepenses.forEach((d) => {
    const pct = total > 0 ? (Number(d.total_depense) / total) * 100 : 0;
    lines.push(`- ${d.categorie}: ${Number(d.total_depense).toFixed(2)} EUR (${pct.toFixed(1)}%)`);
  });

  lines.push("");
  lines.push("Alertes intelligentes");
  alerts.forEach((a) => lines.push(`- ${a}`));
  context.depassements.forEach((d) => {
    lines.push(`- Plafond depasse sur ${d.categorie}: +${Number(d.excedent).toFixed(2)} EUR`);
  });

  lines.push("");
  lines.push("Conseils personnalises");
  lines.push("- Ajuster en priorite les plafonds des 3 categories les plus depensieres.");
  lines.push("- Auditer les abonnements recurrents pour supprimer ceux peu utilises.");
  lines.push("- Fixer un budget hebdomadaire sur alimentation/marche et suivre l'ecart.");
  lines.push(`- Economie potentielle estimee: ${estimationEco.toFixed(2)} EUR / mois.`);

  lines.push("");
  lines.push("Prevision de budget");
  lines.push(`- Depense probable le mois prochain: ${forecast.toFixed(2)} EUR (base historique recente).`);

  lines.push("");
  lines.push("Chatbot bancaire");
  lines.push(`- Combien ai-je depense ce mois-ci ? -> ${total.toFixed(2)} EUR.`);
  lines.push(`- Quelle categorie me coute le plus cher ? -> ${topCat ? topCat.categorie : "Aucune categorie dominante"}.`);
  if (remainingByCat.length > 0) {
    lines.push(`- Puis-je faire ce virement sans depasser mon budget ? -> Oui si le montant reste <= ${Math.max(0, minRemaining).toFixed(2)} EUR sur la categorie concernee.`);
  } else {
    lines.push("- Puis-je faire ce virement sans depasser mon budget ? -> Definir des plafonds categories pour une verification automatique.");
  }

  if (question) {
    lines.push("");
    lines.push(`Question utilisateur: ${question}`);
  }

  return lines.join("\n");
}

exports.analyzeBudget = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { month, year } = parseMonthYear(req.body?.month, req.body?.year);
    const question = String(req.body?.question || "").trim();

    const context = await buildBudgetAnalysisContext(userId, month, year);

    let analysis = "";
    let provider = "local-fallback";
    let model = "rules";
    let ollamaError = null;
    const aiProvider = String(process.env.AI_PROVIDER || "ollama").toLowerCase();

    const toutesCategories = context.depenses.map(d =>
      `${d.categorie}: ${d.total_depense.toFixed(2)}EUR${d.plafond > 0 ? ` (plafond ${d.plafond.toFixed(2)}EUR)` : ""}`
    ).join(", ");
    const depassStr = context.depassements.map(d =>
      `${d.categorie} +${d.excedent.toFixed(2)}EUR`
    ).join(", ") || "aucun";
    const prevTotaux = context.monthlyTotals.map(m => `${m.mois}/${m.annee}:${m.total.toFixed(2)}`).join(", ") || "pas d historique";
    const comptesStr = context.accounts.map(a =>
      `${a.type} (${a.iban}) solde:${a.solde.toFixed(2)}EUR statut:${a.statut}`
    ).join(" | ") || "aucun compte";
    const abonnementsStr = context.recurrents.length > 0
      ? context.recurrents.map(r => `${r.categorie}: ${r.montant.toFixed(2)}EUR/mois`).join(", ")
      : "aucun abonnement recurrent";
    const transactionsStr = context.recentTransactions.slice(0, 30).map(t => {
      let line = `[${t.date}] ${t.type} ${t.montant.toFixed(2)}EUR`;
      if (t.source_iban) line += ` de:${t.source_iban}`;
      if (t.dest_iban) line += ` vers:${t.dest_iban}`;
      return line;
    }).join("\n") || "aucune transaction";

    const prompt = [
      "Tu es un conseiller financier personnel et bancaire. Reponds en francais, de maniere claire et personnalisee.",
      `Client: ${context.user.prenom} ${context.user.nom}`,
      `Solde total: ${context.totalBalance.toFixed(2)}EUR`,
      `Comptes: ${comptesStr}`,
      "",
      `=== BUDGET ${context.month}/${context.year} ===`,
      `Total depenses du mois: ${context.totalMonth.toFixed(2)}EUR`,
      `Toutes les categories: ${toutesCategories}`,
      `Depassements de plafond: ${depassStr}`,
      `Historique 3 mois: ${prevTotaux}`,
      "",
      `=== ABONNEMENTS ET PRELEVEMENT RECURRENTS ===`,
      abonnementsStr,
      "",
      `=== 30 DERNIERES TRANSACTIONS ===`,
      transactionsStr,
      "",
      question ? `=== QUESTION DU CLIENT ===\n${question}` : "",
      "",
      "Genere une analyse structuree avec ces 5 sections exactes (titre puis contenu):",
      "Analyse automatique des depenses",
      "Alertes intelligentes",
      "Conseils personnalises",
      "Prevision de budget",
      "Chatbot bancaire (reponds: combien depense ce mois, categorie la plus chere, peut-on faire un virement sans depasser)"
    ].filter(Boolean).join("\n");

    if (aiProvider === "gemini") {
      if (isGeminiEnabled()) {
        const result = await generateWithGemini(prompt);
        if (result.ok && result.text) {
          analysis = result.text;
          provider = "gemini";
          model = result.model;
        } else {
          ollamaError = result.error || "GEMINI_UNAVAILABLE";
        }
      } else {
        ollamaError = "GEMINI_DISABLED";
      }

      if (!analysis && isOllamaEnabled()) {
        const fallbackOllama = await generateWithOllama(prompt);
        if (fallbackOllama.ok && fallbackOllama.text) {
          analysis = fallbackOllama.text;
          provider = "ollama";
          model = fallbackOllama.model;
        } else {
          ollamaError = `${ollamaError || "GEMINI_FAILED"}; ${fallbackOllama.error || "OLLAMA_UNAVAILABLE"}`;
        }
      }
    } else if (isOllamaEnabled()) {
      const result = await generateWithOllama(prompt);
      if (result.ok && result.text) {
        analysis = result.text;
        provider = "ollama";
        model = result.model;
      } else {
        ollamaError = result.error || "OLLAMA_UNAVAILABLE";
      }
    } else {
      ollamaError = "OLLAMA_DISABLED";
    }

    if (!analysis) {
      analysis = buildLocalBudgetFallback(context, question);
    }

    return res.json({
      success: true,
      provider,
      model,
      configuredProvider: aiProvider,
      ollamaModelDefault: OLLAMA_MODEL,
      geminiModelDefault: GEMINI_MODEL,
      ollamaError,
      aiErrorMessage: provider === "local-fallback"
        ? mapAiErrorForUser(ollamaError, aiProvider)
        : null,
      setupHint: provider === "local-fallback"
        ? (aiProvider === "gemini"
            ? `Gemini indisponible (${ollamaError || "erreur inconnue"}). Verifier la cle API et le quota Google AI Studio.`
            : `Ollama indisponible (${ollamaError || "erreur inconnue"}). Verifier qu'Ollama est actif et que le modele est installe.`)
        : null,
      context,
      analysis
    });
  } catch (err) {
    console.error("AI BUDGET ANALYSIS ERROR:", err);
    return res.status(500).json({ error: "Erreur analyse budget" });
  }
};

// ==============================
// AI CHAT (LOCAL / GRATUIT)
// ==============================
exports.chat = async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: errors.array()[0].msg,
        errors: errors.array()
      });
    }

    const userId = req.session.user.id;
    const { message } = req.body;

    const context = await buildUserContext(userId);
    const reply = buildLocalReply(message, context);

    return res.json({ reply });
  } catch (err) {
    console.error("AI CHAT ERROR :", err);

    return res.status(500).json({
      error: "Erreur IA"
    });
  }
};
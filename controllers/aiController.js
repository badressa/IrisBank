const { validationResult } = require("express-validator");
const db = require("../config/db");

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
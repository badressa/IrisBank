/**
 * Test script pour verifier que Gemini fonctionne correctement
 * Usage: node test-ai.js
 */
require("dotenv").config();

const { generateWithGemini, isGeminiEnabled } = require("./services/geminiService");

const PROMPT_TEST = `Tu es un conseiller financier. Reponds en francais, sans emojis.
Voici une analyse budgetaire fictive pour mai 2026:
- Total depenses: 1250.00 EUR
- Alimentation: 400 EUR (plafond 350 EUR, depasse de 50 EUR)
- Loyer: 700 EUR
- Transport: 150 EUR

Genere une analyse structuree avec ces 5 sections:
Analyse automatique des depenses
Alertes intelligentes
Conseils personnalises
Prevision de budget
Chatbot bancaire`;

async function main() {
  console.log("=== TEST GEMINI AI ===\n");
  console.log("Config:");
  console.log("  GEMINI_ENABLED :", process.env.GEMINI_ENABLED);
  console.log("  GEMINI_MODEL   :", process.env.GEMINI_MODEL);
  console.log("  GEMINI_API_KEY :", process.env.GEMINI_API_KEY ? "***" + process.env.GEMINI_API_KEY.slice(-4) : "MANQUANTE");
  console.log("  AI_PROVIDER    :", process.env.AI_PROVIDER);
  console.log("  isGeminiEnabled:", isGeminiEnabled());
  console.log();

  if (!isGeminiEnabled()) {
    console.error("ECHEC: Gemini est desactive (GEMINI_ENABLED=false)");
    process.exit(1);
  }

  console.log("Envoi requete a Gemini...\n");
  const start = Date.now();
  const result = await generateWithGemini(PROMPT_TEST);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (result.ok) {
    console.log(`OK - Reponse recue en ${elapsed}s | Modele: ${result.model}`);
    console.log(`Longueur reponse: ${result.text.length} caracteres\n`);
    console.log("--- DEBUT REPONSE ---");
    console.log(result.text);
    console.log("--- FIN REPONSE ---");
  } else {
    console.error(`ECHEC - Erreur: ${result.error} (${elapsed}s)`);
    if (result.error === "GEMINI_HTTP_429") {
      console.error("=> Quota depasse. Attendez 1 minute et reessayez.");
    } else if (result.error === "GEMINI_HTTP_400") {
      console.error("=> Requete invalide. Verifier le modele dans .env : GEMINI_MODEL=gemini-2.5-flash");
    } else if (result.error === "GEMINI_HTTP_403") {
      console.error("=> Cle API invalide ou non autorisee.");
    } else if (result.error === "GEMINI_MISSING_API_KEY") {
      console.error("=> GEMINI_API_KEY manquante dans .env");
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Erreur inattendue:", e.message);
  process.exit(1);
});

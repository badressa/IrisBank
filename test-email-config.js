/**
 * 🧪 Fichier de test pour vérifier la configuration des emails
 * 
 * Utilisation: node test-email-config.js
 */

require("dotenv").config();
const emailService = require("./services/emailService");

console.log("\n🔧 Vérification de la configuration des emails...\n");

// Vérifier les variables d'environnement
console.log(" Variables d'environnement détectées:");
console.log(`   • SMTP_HOST: ${process.env.SMTP_HOST || " NON CONFIGURÉ"}`);
console.log(`   • SMTP_PORT: ${process.env.SMTP_PORT || " NON CONFIGURÉ"}`);
console.log(`   • SMTP_SECURE: ${process.env.SMTP_SECURE || " NON CONFIGURÉ"}`);
console.log(`   • SMTP_USER: ${process.env.SMTP_USER ? "Configuré" : " NON CONFIGURÉ"}`);
console.log(`   • SMTP_PASSWORD: ${process.env.SMTP_PASSWORD ? "Configuré" : " NON CONFIGURÉ"}`);
console.log(`   • SMTP_FROM: ${process.env.SMTP_FROM || "NON CONFIGURÉ"}\n`);

// Vérifier les paramètres obligatoires
if (
  !process.env.SMTP_HOST ||
  !process.env.SMTP_PORT ||
  !process.env.SMTP_USER ||
  !process.env.SMTP_PASSWORD
) {
  console.error("ERREUR: Configuration SMTP incomplète!");
  console.log("\n Veuillez configurer votre fichier .env :");
  console.log("   SMTP_HOST=smtp.mailtrap.io");
  console.log("   SMTP_PORT=465");
  console.log("   SMTP_SECURE=true");
  console.log("   SMTP_USER=votre_user");
  console.log("   SMTP_PASSWORD=votre_password");
  console.log("   SMTP_FROM=noreply@irisbank.com\n");
  process.exit(1);
}

// Test d'envoi
console.log(" Tentative d'envoi d'un email de test...\n");

emailService
  .sendWelcomeEmail("test@example.com", "Dupont", "Jean")
  .then((result) => {
    if (result.success) {
      console.log(" EMAIL ENVOYÉ AVEC SUCCÈS!");
      console.log(`   Message ID: ${result.messageId}`);
      console.log("\n Vérifiez votre inbox sur Mailtrap ou Gmail.");
      console.log("     (L'email peut prendre quelques secondes)\n");
    } else {
      console.log(" ERREUR lors de l'envoi:");
      console.log(`   ${result.error}`);
      console.log("\n Vérifications à effectuer:");
      console.log("   1. Les identifiants SMTP sont-ils corrects?");
      console.log("   2. Avez-vous accès à internet?");
      console.log("   3. Le port 465/587 est-il accessible?\n");
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch((err) => {
    console.error("ERREUR FATALE:", err.message);
    process.exit(1);
  });

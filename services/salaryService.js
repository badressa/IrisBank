const cron = require('node-cron');
const db = require('../config/db');

const checkAndPaySalaries = async () => {
  console.log('[SALARY CRON] Vérification des salaires...', new Date().toISOString());
  try {
    const today = new Date();
    const currentDay = today.getDate();

    const [contracts] = await db.query(`
      SELECT cp.*, u.email, u.nom, u.prenom
      FROM contrats_pro cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.jour_versement <= ?
        AND (cp.dernier_versement IS NULL 
             OR MONTH(cp.dernier_versement) != MONTH(NOW()) 
             OR YEAR(cp.dernier_versement) != YEAR(NOW()))
        AND (cp.type != 'CDD' OR cp.date_fin IS NULL OR cp.date_fin >= CURDATE())
    `, [currentDay]);

    console.log(`[SALARY CRON] ${contracts.length} salaire(s) à verser`);

    for (const c of contracts) {
      try {
        // Créditer le compte
        await db.query(
          'UPDATE comptes_bancaires SET solde = solde + ? WHERE id = ?',
          [c.salaire, c.compte_id]
        );

        // Créer la transaction
        await db.query(
          "INSERT INTO transactions (type, montant, description, compte_destination_id) VALUES ('DEPOT', ?, ?, ?)",
          [c.salaire, `Salaire : ${c.employeur}`, c.compte_id]
        );

        // Notification en base
        await db.query(
          "INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'SALAIRE')",
          [c.user_id, `💰 Salaire de ${c.salaire}€ versé par ${c.employeur}`]
        );

        // Marquer comme payé
        await db.query(
          'UPDATE contrats_pro SET dernier_versement = NOW() WHERE id = ?',
          [c.id]
        );

        console.log(`[SALARY CRON] ✅ Salaire versé à user ${c.user_id} — ${c.salaire}€`);
      } catch (err) {
        console.error(`[SALARY CRON] Erreur user ${c.user_id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[SALARY CRON] Erreur globale:', err.message);
  }
};

// Tous les jours à 00h01
cron.schedule('1 0 * * *', () => {
  checkAndPaySalaries();
});

console.log('[SALARY CRON] ✅ Planificateur salaires initialisé');
module.exports = { checkAndPaySalaries };
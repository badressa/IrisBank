// services/budgetCron.js
// Prélèvements automatiques mensuels — IrisBank
//
// À ajouter dans server.js :
//   require('./services/budgetCron');
//
// Nécessite : npm install node-cron

const cron = require('node-cron');
const db = require('../config/db');
const { _effectuerPrelevement } = require('../controllers/budgetController');

// Se déclenche tous les 1er du mois à 08h00
// Format cron : minute heure jour mois jour-semaine
cron.schedule('0 8 1 * *', async () => {
  console.log('[BUDGET CRON] Démarrage des prélèvements automatiques —', new Date().toISOString());

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const today = new Date().toISOString().split('T')[0];

    // Récupérer tous les paiements récurrents actifs dont l'échéance est aujourd'hui ou dépassée
    const [paiements] = await conn.query(`
      SELECT bp.*, cb.solde, cb.user_id
      FROM budget_paiements bp
      JOIN comptes_bancaires cb ON bp.compte_source_id = cb.id
      WHERE bp.recurrent = 1
        AND bp.statut = 'ACTIF'
        AND bp.prochaine_echeance <= ?
    `, [today]);

    console.log(`[BUDGET CRON] ${paiements.length} prélèvement(s) à traiter`);

    for (const p of paiements) {
      try {
        // Vérifier que le compte est actif
        const [comptes] = await conn.query(
          'SELECT * FROM comptes_bancaires WHERE id = ? AND statut = "ACTIF"',
          [p.compte_source_id]
        );

        if (comptes.length === 0) {
          console.warn(`[BUDGET CRON] Compte ${p.compte_source_id} bloqué, paiement ${p.id} ignoré`);
          // Notifier le user
          await conn.query(`
            INSERT INTO notifications (user_id, message, type)
            VALUES (?, '⛔ Prélèvement automatique échoué : compte bloqué', 'BUDGET_ERREUR')
          `, [p.user_id]);
          continue;
        }

        const compte = comptes[0];

        // Vérifier solde suffisant
        if (compte.solde < p.montant) {
          console.warn(`[BUDGET CRON] Solde insuffisant pour paiement ${p.id}`);
          await conn.query(`
            INSERT INTO notifications (user_id, message, type)
            VALUES (?, ?, 'BUDGET_ERREUR')
          `, [p.user_id, `⛔ Prélèvement de ${p.montant}€ échoué : solde insuffisant`]);
          continue;
        }

        // Effectuer le prélèvement
        await _effectuerPrelevement(
          conn,
          p.id,
          p.user_id,
          p.compte_source_id,
          p.categorie_id,
          p.montant,
          p.description
        );

        // Mettre à jour la prochaine échéance (+ 1 mois)
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const nextDate = nextMonth.toISOString().split('T')[0];

        await conn.query(
          'UPDATE budget_paiements SET prochaine_echeance = ? WHERE id = ?',
          [nextDate, p.id]
        );

        console.log(`[BUDGET CRON] ✅ Paiement ${p.id} effectué (${p.montant}€) — prochaine échéance : ${nextDate}`);

      } catch (pErr) {
        console.error(`[BUDGET CRON] Erreur paiement ${p.id}:`, pErr.message);
      }
    }

    await conn.commit();
    console.log('[BUDGET CRON] ✅ Traitement terminé');

  } catch (err) {
    await conn.rollback();
    console.error('[BUDGET CRON] Erreur globale:', err);
  } finally {
    conn.release();
  }
});

console.log('[BUDGET CRON] ✅ Planificateur initialisé — prélèvements le 1er de chaque mois à 08h00');
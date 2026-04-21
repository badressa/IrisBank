const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Enregistrer un contrat
router.post('/add', async (req, res) => {
  try {
    const { compte_destination_id, employeur, salaire_mensuel, type_contrat, date_debut, date_fin, jour_versement } = req.body;
    const userId = req.session.user.id;

    await db.query(`
      INSERT INTO contrats_pro 
        (user_id, compte_destination_id, employeur, salaire_mensuel, type_contrat, date_debut, date_fin, jour_versement)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, compte_destination_id, employeur, salaire_mensuel, type_contrat, date_debut, type_contrat === 'CDD' ? date_fin : null, jour_versement || 1]);

    res.json({ success: true, message: 'Contrat enregistré !' });
  } catch (err) {
    console.error('addContrat error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Récupérer le contrat actif du user
router.get('/mon-contrat', async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [contrats] = await db.query(`
      SELECT cp.*, cb.iban, cb.type AS type_compte
      FROM contrats_pro cp
      JOIN comptes_bancaires cb ON cp.compte_destination_id = cb.id
      WHERE cp.user_id = ? AND cp.statut = 'ACTIF'
      ORDER BY cp.created_at DESC
      LIMIT 1
    `, [userId]);

    res.json({ success: true, data: contrats[0] || null });
  } catch (err) {
    console.error('getContrat error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Vérifier et payer le salaire du jour (appelé au chargement du dashboard)
router.get('/check-and-pay', async (req, res) => {
  try {
    const userId = req.session.user.id;
    const today = new Date();
    const currentDay = today.getDate();

    const [contracts] = await db.query(`
      SELECT * FROM contrats_pro 
      WHERE user_id = ? 
        AND statut = 'ACTIF'
        AND jour_versement <= ?
        AND (dernier_versement IS NULL 
             OR MONTH(dernier_versement) != MONTH(NOW()) 
             OR YEAR(dernier_versement) != YEAR(NOW()))
        AND (type_contrat != 'CDD' OR date_fin IS NULL OR date_fin >= CURDATE())
    `, [userId, currentDay]);

    if (contracts.length === 0) {
      return res.json({ success: true, paid: false });
    }

    const c = contracts[0];

    // Créditer le compte
    await db.query(
      'UPDATE comptes_bancaires SET solde = solde + ? WHERE id = ?',
      [c.salaire_mensuel, c.compte_destination_id]
    );

    // Créer la transaction
    await db.query(
      "INSERT INTO transactions (type, montant, description, compte_destination_id) VALUES ('DEPOT', ?, ?, ?)",
      [c.salaire_mensuel, `Salaire : ${c.employeur}`, c.compte_destination_id]
    );

    // Notification
    await db.query(
      "INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'SALAIRE')",
      [userId, `💰 Salaire de ${c.salaire_mensuel}€ versé par ${c.employeur}`]
    );

    // Marquer comme payé
    await db.query(
      'UPDATE contrats_pro SET dernier_versement = CURDATE() WHERE id = ?',
      [c.id]
    );

    res.json({ success: true, paid: true, amount: c.salaire_mensuel, employeur: c.employeur });
  } catch (err) {
    console.error('checkAndPay error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Supprimer / terminer un contrat
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.session.user.id;
    await db.query(
      "UPDATE contrats_pro SET statut = 'TERMINE' WHERE id = ? AND user_id = ?",
      [req.params.id, userId]
    );
    res.json({ success: true, message: 'Contrat terminé' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
// controllers/budgetController.js
// Module Budget IrisBank — logique métier complète

const db = require('../config/db');

// ─────────────────────────────────────────────
// CATÉGORIES
// ─────────────────────────────────────────────

// GET /budget/categories
// Retourne toutes les catégories disponibles
exports.getCategories = async (req, res) => {
  try {
    const [categories] = await db.query('SELECT * FROM budget_categories ORDER BY nom');
    res.json({ success: true, data: categories });
  } catch (err) {
    console.error('getCategories error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────
// PLAFONDS (limites mensuelles)
// ─────────────────────────────────────────────

// GET /budget/limites
// Retourne les plafonds du user connecté
exports.getLimites = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [limites] = await db.query(`
      SELECT bl.*, bc.nom, bc.icone, bc.couleur
      FROM budget_limites bl
      JOIN budget_categories bc ON bl.categorie_id = bc.id
      WHERE bl.user_id = ?
    `, [userId]);
    res.json({ success: true, data: limites });
  } catch (err) {
    console.error('getLimites error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /budget/limites
// Créer ou mettre à jour un plafond pour une catégorie
exports.setLimite = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { categorie_id, plafond } = req.body;

    if (!categorie_id || !plafond || plafond <= 0) {
      return res.status(400).json({ success: false, message: 'Données invalides' });
    }

    // INSERT ou UPDATE si déjà existant (UPSERT)
    await db.query(`
      INSERT INTO budget_limites (user_id, categorie_id, plafond)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE plafond = VALUES(plafond)
    `, [userId, categorie_id, plafond]);

    res.json({ success: true, message: 'Plafond enregistré' });
  } catch (err) {
    console.error('setLimite error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────
// PAIEMENTS
// ─────────────────────────────────────────────

// POST /budget/paiement
// Créer un paiement (unique ou récurrent)
exports.createPaiement = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const userId = req.session.user.id;
    const { compte_source_id, categorie_id, montant, description, recurrent } = req.body;

    // Validations de base
    if (!compte_source_id || !categorie_id || !montant || montant <= 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Données invalides' });
    }

    // Vérifier que le compte appartient bien au user
    const [comptes] = await conn.query(
      'SELECT * FROM comptes_bancaires WHERE id = ? AND user_id = ? AND statut = "ACTIF"',
      [compte_source_id, userId]
    );
    if (comptes.length === 0) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'Compte invalide ou bloqué' });
    }

    const compte = comptes[0];

    // Vérifier le solde suffisant
    if (compte.solde < montant) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Solde insuffisant' });
    }

    // Calculer la prochaine échéance (1er du mois suivant si récurrent)
    let prochaine_echeance = null;
    if (recurrent) {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      prochaine_echeance = nextMonth.toISOString().split('T')[0];
    }

    // Créer le paiement
    const [paiementResult] = await conn.query(`
      INSERT INTO budget_paiements
        (user_id, compte_source_id, categorie_id, montant, description, recurrent, statut, prochaine_echeance)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIF', ?)
    `, [userId, compte_source_id, categorie_id, montant, description || null, recurrent ? 1 : 0, prochaine_echeance]);

    const paiementId = paiementResult.insertId;

    // Effectuer le premier prélèvement immédiatement
    await _effectuerPrelevement(conn, paiementId, userId, compte_source_id, categorie_id, montant, description);

    await conn.commit();

    // Vérifier dépassement de plafond après paiement
    await _verifierPlafond(userId, categorie_id, montant);

    res.json({ success: true, message: recurrent ? 'Paiement récurrent créé' : 'Paiement effectué', paiementId });
  } catch (err) {
    await conn.rollback();
    console.error('createPaiement error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    conn.release();
  }
};

// GET /budget/paiements
// Liste des paiements du user (actifs + historique)
exports.getPaiements = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [paiements] = await db.query(`
      SELECT bp.*, bc.nom AS categorie_nom, bc.icone, bc.couleur,
             cb.iban
      FROM budget_paiements bp
      JOIN budget_categories bc ON bp.categorie_id = bc.id
      JOIN comptes_bancaires cb ON bp.compte_source_id = cb.id
      WHERE bp.user_id = ?
      ORDER BY bp.created_at DESC
    `, [userId]);
    res.json({ success: true, data: paiements });
  } catch (err) {
    console.error('getPaiements error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// DELETE /budget/paiement/:id
// Annuler un paiement récurrent
exports.annulerPaiement = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { id } = req.params;

    const [result] = await db.query(`
      UPDATE budget_paiements
      SET statut = 'ANNULE'
      WHERE id = ? AND user_id = ? AND statut = 'ACTIF'
    `, [id, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Paiement introuvable' });
    }

    res.json({ success: true, message: 'Paiement annulé' });
  } catch (err) {
    console.error('annulerPaiement error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────
// DASHBOARD BUDGET
// ─────────────────────────────────────────────

// GET /budget/dashboard
// Retourne les dépenses du mois en cours par catégorie
// (utilisé pour le camembert)
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const now = new Date();
    const mois = now.getMonth() + 1;
    const annee = now.getFullYear();

    // Dépenses du mois par catégorie
    const [depenses] = await db.query(`
      SELECT
        bc.id AS categorie_id,
        bc.nom,
        bc.icone,
        bc.couleur,
        COALESCE(SUM(bh.montant), 0) AS total_depense,
        COALESCE(bl.plafond, 0) AS plafond
      FROM budget_categories bc
      LEFT JOIN budget_paiements bp ON bp.categorie_id = bc.id AND bp.user_id = ?
      LEFT JOIN budget_historique bh ON bh.paiement_id = bp.id
        AND bh.mois = ? AND bh.annee = ?
      LEFT JOIN budget_limites bl ON bl.categorie_id = bc.id AND bl.user_id = ?
      GROUP BY bc.id
      HAVING total_depense > 0 OR plafond > 0
      ORDER BY total_depense DESC
    `, [userId, mois, annee, userId]);

    // Total dépensé ce mois
    const totalMois = depenses.reduce((sum, d) => sum + parseFloat(d.total_depense), 0);

    res.json({
      success: true,
      data: {
        mois,
        annee,
        depenses,
        totalMois: totalMois.toFixed(2)
      }
    });
  } catch (err) {
    console.error('getDashboard error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────
// FONCTIONS INTERNES (privées)
// ─────────────────────────────────────────────

// Effectue un prélèvement réel sur le compte
async function _effectuerPrelevement(conn, paiementId, userId, compteId, categorieId, montant, description) {
  // Débiter le compte
  await conn.query(
    'UPDATE comptes_bancaires SET solde = solde - ? WHERE id = ?',
    [montant, compteId]
  );

  // Créer la transaction dans la table existante
  const [txResult] = await conn.query(`
    INSERT INTO transactions (type, montant, description, compte_source_id, categorie_id)
    VALUES ('RETRAIT', ?, ?, ?, ?)
  `, [montant, description || 'Paiement budget', compteId, categorieId]);

  const transactionId = txResult.insertId;

  // Enregistrer dans l'historique budget
  const now = new Date();
  await conn.query(`
    INSERT INTO budget_historique (paiement_id, transaction_id, montant, mois, annee)
    VALUES (?, ?, ?, ?, ?)
  `, [paiementId, transactionId, montant, now.getMonth() + 1, now.getFullYear()]);

  // Notification dans le système existant
  await conn.query(`
    INSERT INTO notifications (user_id, message, type)
    VALUES (?, ?, 'BUDGET_PAIEMENT')
  `, [userId, `💳 Paiement de ${montant}€ effectué`]);
}

// Vérifie si le plafond mensuel est dépassé et notifie
async function _verifierPlafond(userId, categorieId, montant) {
  try {
    const now = new Date();
    const mois = now.getMonth() + 1;
    const annee = now.getFullYear();

    // Récupérer le plafond
    const [limites] = await db.query(
      'SELECT plafond FROM budget_limites WHERE user_id = ? AND categorie_id = ?',
      [userId, categorieId]
    );
    if (limites.length === 0) return; // Pas de plafond défini

    const plafond = parseFloat(limites[0].plafond);

    // Calculer le total dépensé ce mois pour cette catégorie
    const [totaux] = await db.query(`
      SELECT COALESCE(SUM(bh.montant), 0) AS total
      FROM budget_historique bh
      JOIN budget_paiements bp ON bh.paiement_id = bp.id
      WHERE bp.user_id = ? AND bp.categorie_id = ?
        AND bh.mois = ? AND bh.annee = ?
    `, [userId, categorieId, mois, annee]);

    const total = parseFloat(totaux[0].total);

    // Si dépassement → notification
    if (total > plafond) {
      const [cat] = await db.query('SELECT nom FROM budget_categories WHERE id = ?', [categorieId]);
      const nomCat = cat[0]?.nom || 'cette catégorie';

      await db.query(`
        INSERT INTO notifications (user_id, message, type)
        VALUES (?, ?, 'BUDGET_DEPASSE')
      `, [userId, `⚠️ Plafond dépassé pour ${nomCat} : ${total.toFixed(2)}€ / ${plafond.toFixed(2)}€`]);
    }
  } catch (err) {
    console.error('_verifierPlafond error:', err);
  }
}

// ─────────────────────────────────────────────
// EXPORT pour le cron job
// ─────────────────────────────────────────────
exports._effectuerPrelevement = _effectuerPrelevement;
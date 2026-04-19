// routes/budget.js
// Routes du module Budget IrisBank

const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/budgetController');
const { requireAuth } = require('../middleware/authMiddleware');

// Toutes les routes budget nécessitent d'être connecté
router.use(requireAuth);

// Catégories
router.get('/categories', budgetController.getCategories);

// Plafonds mensuels
router.get('/limites', budgetController.getLimites);
router.post('/limites', budgetController.setLimite);

// Paiements
router.post('/paiement', budgetController.createPaiement);
router.get('/paiements', budgetController.getPaiements);
router.delete('/paiement/:id', budgetController.annulerPaiement);

// Dashboard (camembert)
router.get('/dashboard', budgetController.getDashboard);

// Export PDF fin de mois
//router.get('/export-pdf', budgetController.exportPDF);

module.exports = router;
// services/budgetPDF.js
// Génération du PDF mensuel de budget — IrisBank
//
// Nécessite : npm install pdfkit
// Route : GET /budget/export-pdf

const PDFDocument = require('pdfkit');
const db = require('../config/db');

async function generateBudgetPDF(userId, res) {
  const now   = new Date();
  const mois  = now.getMonth() + 1;
  const annee = now.getFullYear();

  const moisLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  // ── Récupérer les données du user
  const [users] = await db.query('SELECT nom, prenom, email FROM users WHERE id = ?', [userId]);
  const user = users[0];

  // ── Dépenses du mois par catégorie
  const [depenses] = await db.query(`
    SELECT
      bc.nom AS categorie,
      bc.icone,
      bc.couleur,
      COALESCE(SUM(bh.montant), 0) AS total,
      COALESCE(bl.plafond, 0) AS plafond
    FROM budget_categories bc
    LEFT JOIN budget_paiements bp ON bp.categorie_id = bc.id AND bp.user_id = ?
    LEFT JOIN budget_historique bh ON bh.paiement_id = bp.id AND bh.mois = ? AND bh.annee = ?
    LEFT JOIN budget_limites bl ON bl.categorie_id = bc.id AND bl.user_id = ?
    GROUP BY bc.id
    HAVING total > 0
    ORDER BY total DESC
  `, [userId, mois, annee, userId]);

  const totalDepense = depenses.reduce((s, d) => s + parseFloat(d.total), 0);

  // ── Détail des transactions du mois
  const [transactions] = await db.query(`
    SELECT t.montant, t.description, t.created_at, bc_cat.nom AS categorie, bc_cat.icone
    FROM transactions t
    JOIN comptes_bancaires cb ON t.compte_source_id = cb.id
    LEFT JOIN budget_categories bc_cat ON t.categorie_id = bc_cat.id
    WHERE cb.user_id = ?
      AND t.type = 'RETRAIT'
      AND t.categorie_id IS NOT NULL
      AND MONTH(t.created_at) = ?
      AND YEAR(t.created_at) = ?
    ORDER BY t.created_at DESC
  `, [userId, mois, annee]);

  // ── Créer le PDF
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="IrisBank_Budget_${annee}_${String(mois).padStart(2,'0')}.pdf"`);
  doc.pipe(res);

  // ── COULEURS
  const BLUE   = '#1E3A5F';
  const ACCENT = '#2563EB';
  const GRAY   = '#64748B';
  const LIGHT  = '#F8FAFC';
  const RED    = '#EF4444';
  const GREEN  = '#22C55E';

  // ── EN-TÊTE
  doc.rect(0, 0, 595, 100).fill(BLUE);

  doc.fillColor('white')
     .fontSize(26).font('Helvetica-Bold')
     .text('IrisBank', 50, 28);

  doc.fontSize(12).font('Helvetica')
     .text(`Relevé de budget — ${moisLabel}`, 50, 62);

  doc.fillColor(ACCENT).fontSize(10)
     .text(`${user.prenom} ${user.nom} · ${user.email}`, 50, 80);

  doc.moveDown(4);

  // ── RÉSUMÉ
  doc.fillColor(BLUE).fontSize(14).font('Helvetica-Bold')
     .text('Résumé du mois', 50, 120);

  doc.moveTo(50, 138).lineTo(545, 138).strokeColor('#E2E8F0').lineWidth(1).stroke();

  // Carte résumé
  doc.rect(50, 148, 495, 60).fill(LIGHT).stroke('#E2E8F0');
  doc.fillColor(GRAY).fontSize(10).font('Helvetica')
     .text('TOTAL DÉPENSÉ', 80, 162);
  doc.fillColor(RED).fontSize(22).font('Helvetica-Bold')
     .text(`${totalDepense.toFixed(2)} €`, 80, 176);

  doc.fillColor(GRAY).fontSize(10).font('Helvetica')
     .text('CATÉGORIES', 300, 162);
  doc.fillColor(BLUE).fontSize(22).font('Helvetica-Bold')
     .text(depenses.length.toString(), 300, 176);

  doc.moveDown(5);

  // ── PAR CATÉGORIE
  doc.fillColor(BLUE).fontSize(14).font('Helvetica-Bold')
     .text('Dépenses par catégorie', 50, 228);
  doc.moveTo(50, 246).lineTo(545, 246).strokeColor('#E2E8F0').lineWidth(1).stroke();

  let y = 258;

  depenses.forEach((d, i) => {
    if (y > 700) { doc.addPage(); y = 50; }

    const total   = parseFloat(d.total);
    const plafond = parseFloat(d.plafond);
    const pct     = plafond > 0 ? Math.min((total / plafond) * 100, 100) : null;
    const depasse = plafond > 0 && total > plafond;

    // Fond alterné
    if (i % 2 === 0) doc.rect(50, y - 4, 495, 36).fill('#F8FAFC').stroke('#E2E8F0');

    // Catégorie
    doc.fillColor(BLUE).fontSize(12).font('Helvetica-Bold')
       .text(`${d.icone}  ${d.categorie}`, 65, y + 4);

    // Montant
    doc.fillColor(depasse ? RED : BLUE).fontSize(12).font('Helvetica-Bold')
       .text(`${total.toFixed(2)} €`, 420, y + 4, { align: 'right', width: 100 });

    // Plafond + barre
    if (plafond > 0) {
      doc.fillColor(GRAY).fontSize(9).font('Helvetica')
         .text(`/ ${plafond.toFixed(2)} €`, 430, y + 18);

      const barW = 200;
      const fillW = (pct / 100) * barW;
      const barColor = depasse ? RED : pct >= 75 ? '#F97316' : GREEN;

      doc.rect(65, y + 26, barW, 5).fill('#E2E8F0');
      doc.rect(65, y + 26, fillW, 5).fill(barColor);
    }

    y += 44;
  });

  // ── DÉTAIL DES TRANSACTIONS
  if (transactions.length > 0) {
    if (y > 650) { doc.addPage(); y = 50; }

    y += 10;
    doc.fillColor(BLUE).fontSize(14).font('Helvetica-Bold')
       .text('Détail des transactions', 50, y);
    y += 18;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E2E8F0').lineWidth(1).stroke();
    y += 12;

    // En-têtes tableau
    doc.fillColor(GRAY).fontSize(9).font('Helvetica-Bold')
       .text('DATE', 50, y)
       .text('CATÉGORIE', 130, y)
       .text('DESCRIPTION', 260, y)
       .text('MONTANT', 460, y);
    y += 16;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E2E8F0').stroke();
    y += 8;

    transactions.forEach((t, i) => {
      if (y > 750) { doc.addPage(); y = 50; }

      if (i % 2 === 0) doc.rect(50, y - 2, 495, 18).fill('#F8FAFC');

      const date = new Date(t.created_at).toLocaleDateString('fr-FR');
      const desc = t.description ? t.description.substring(0, 28) : '—';

      doc.fillColor('#334155').fontSize(9).font('Helvetica')
         .text(date, 50, y)
         .text(`${t.icone || ''} ${t.categorie || '—'}`, 130, y)
         .text(desc, 260, y)
         .fillColor(RED)
         .text(`-${parseFloat(t.montant).toFixed(2)} €`, 460, y);

      y += 18;
    });
  }

  // ── PIED DE PAGE
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc.fillColor(GRAY).fontSize(8).font('Helvetica')
       .text(
         `IrisBank — Document généré le ${new Date().toLocaleDateString('fr-FR')} · Page ${i + 1}/${pageCount}`,
         50, 820, { align: 'center', width: 495 }
       );
  }

  doc.end();
}

// ── Route handler à ajouter dans budgetController.js
exports.exportPDF = async (req, res) => {
  try {
    const userId = req.session.userId;
    await generateBudgetPDF(userId, res);
  } catch (err) {
    console.error('exportPDF error:', err);
    res.status(500).json({ success: false, message: 'Erreur génération PDF' });
  }
};
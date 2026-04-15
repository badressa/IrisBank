# 📧 Guide d'utilisation du système d'emails - IRISBANK

## 🚀 Quick Start avec Mailtrap (Gratuit & Recommandé)

**Mailtrap** est le plus simple pour tester les emails en développement.

### Étape 1 : Créer un compte Mailtrap
1. Allez sur https://mailtrap.io/
2. Créez un compte gratuit
3. Allez dans "Email Testing" > "Inbox"

### Étape 2 : Récupérer les identifiants
1. Cliquez sur "Demo Inbox" ou créez une nouvelle inbox
2. Cliquez sur "Integrations" > "NodeJS"
3. Copiez les identifiants :
   - **Host**: `smtp.mailtrap.io`
   - **Port**: `465` ou `587`
   - **User**: Votre utilisateur (ressemble à un numéro)
   - **Password**: Votre mot de passe

### Étape 3 : Configurer le fichier `.env`
```env
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=xxxxx
SMTP_PASSWORD=xxxxx
SMTP_FROM=noreply@irisbank.com
```

### Étape 4 : Tester
1. Démarrez votre serveur : `npm run dev`
2. Inscrivez-vous sur `/register.html`
3. Allez sur mailtrap.io et vérifiez votre inbox
4. L'email doit arriver en quelques secondes ✅

---

## 📧 Alternative : Gmail avec Mot de Passe d'Application

### Prérequis
- Compte Google avec authentification 2FA activée

### Étape 1 : Générer un mot de passe d'application
1. Allez sur https://myaccount.google.com/
2. Sélectionnez "Sécurité" > "Mots de passe d'application"
3. Choisissez "Mail" et "Windows/Mac/Linux"
4. Google génère un mot de passe de 16 caractères (sans espaces)

### Étape 2 : Configurer le `.env`
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre.email@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx
SMTP_FROM=votre.email@gmail.com
```

### Étape 3 : Tester
```bash
npm run dev
```
Inscrivez-vous et attendez l'email.

---

## 🧪 Tester l'envoi d'email manuellement

### Créer un fichier de test
Créez `/test-email.js` :

```javascript
const emailService = require("./services/emailService");

// Test envoi email
emailService.sendWelcomeEmail("test@example.com", "Dupont", "Jean")
  .then(result => {
    if (result.success) {
      console.log("✅ Email envoyé avec succès!");
      console.log("Message ID:", result.messageId);
    } else {
      console.log(" Erreur:", result.error);
    }
    process.exit(0);
  });
```

### Exécuter le test
```bash
node test-email.js
```

---

## 🔍 Vérifier les logs

Après l'inscription, vérifiez les logs du serveur :

```
✅ Serveur SMTP connecté              # Bonne connexion au serveur
📧 Email envoyé: <message-id>         # Email envoyé avec succès
❌ Erreur SMTP: ...                   # Problème de configuration
```

---

## ⚠️ Problèmes Courants

### ❌ "Erreur de connexion SMTP"
- **Vérifier**: Host et port corrects dans `.env`
- **Solution**: Tester manuellement `node test-email.js`

### ❌ "Authentification échouée"
- **Vérifier**: User et password corrects
- **Gmail**: Utilisez un mot de passe d'application, pas votre mot de passe
- **Solution**: Régénérez les identifiants sur Mailtrap

### ❌ "Email ne s'affiche pas"
- L'email n'est PAS bloquant (il part en arrière-plan)
- **Attendre**: 5-10 secondes et rafraîchir
- **Vérifier**: Spam/Junk si c'est une vraie adresse email

---

## 📝 Types d'emails disponibles

### 1. Email de bienvenue (sur inscription)
```javascript
emailService.sendWelcomeEmail(email, nom, prenom);
```

### 2. Email de réinitialisation (optionnel)
```javascript
emailService.sendPasswordResetEmail(email, nom, resetLink);
```

---

## 🔧 Ajouter d'autres types d'emails

Édlez `/services/emailService.js` pour ajouter :
- Email de confirmation de transaction
- Email de notification limite dépassée
- Email administrateur

Exemple :
```javascript
exports.sendTransactionEmail = async (email, montant, type) => {
  // Votre logique
  return transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Transaction confirmée",
    html: `<p>Transaction de ${montant}€ (${type})</p>`
  });
};
```

---

## 🎯 Configuration de Production

Pour **production**, utilisez des services professionnels :
- **SendGrid**: https://sendgrid.com/
- **Mailgun**: https://www.mailgun.com/
- **AWS SES**: https://aws.amazon.com/ses/

Mise à jour du `.env` :
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=SG.xxxxxxxxx
```

---

## 📚 Documentation complète

- **Nodemailer**: https://nodemailer.com/
- **Mailtrap**: https://mailtrap.io/
- **Gmail App Passwords**: https://support.google.com/accounts/answer/185833

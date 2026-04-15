## 🚀 DÉMARRER RAPIDEMENT AVEC LES EMAILS

### 1️⃣ Créer un compte Mailtrap (5 minutes)
- Allez sur https://mailtrap.io/ et créez un compte **gratuit**
- Récupérez vos identifiants SMTP

### 2️⃣ Configurer le `.env`
```env
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=xxxxx        # Remplacez par vos identifiants
SMTP_PASSWORD=xxxxx    # Remplacez par vos identifiants
SMTP_FROM=noreply@irisbank.com
```

### 3️⃣ Tester la configuration
```bash
node test-email-config.js
```

Vous devriez voir :
```
✅ EMAIL ENVOYÉ AVEC SUCCÈS!
   Message ID: <1234567890@mailtrap.io>
```

### 4️⃣ Démarrer le serveur
```bash
npm run dev
```

### 5️⃣ Inscrire un utilisateur
- Allez sur http://localhost:3000/register.html
- Remplissez le formulaire et inscrivez-vous
- Un email de bienvenue est envoyé automatiquement

### 6️⃣ Vérifier l'email
- Allez sur https://mailtrap.io/
- Vous verrez votre email dans l'inbox

---

📖 **Documentation complète**: Voir [EMAIL_TESTING_GUIDE.md](./EMAIL_TESTING_GUIDE.md)

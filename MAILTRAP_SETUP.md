# 🎯 COMMENT CONFIGURER MAILTRAP

## 📱 Passez par ces étapes pour tester les emails gratuitement

### ÉTAPE 1 : Créer un compte
1. Allez sur **https://mailtrap.io/** ⬅️ Cliquez ici!
2. Cliquez sur **"Sign up"** ou **"Start for free"**
3. Remplissez les champs :
   - Email
   - Mot de passe (min 12 caractères)
4. Validez votre email

### ÉTAPE 2 : Accéder à votre inbox
1. Connectez-vous sur Mailtrap
2. À gauche, cliquez sur **"Email Testing"**
3. Vous verrez **"My Inbox"** (ou créez une nouvelle)
4. Cliquez sur **"My Inbox"** ou **"Demo Inbox"**

### ÉTAPE 3 : Récupérer les identifiants SMTP
1. En haut à droite, cliquez sur **"Integrations"**
2. Sélectionnez **"Node.js"** dans la liste
3. Vous verrez un code qui ressemble à :
```javascript
const transporter = nodemailer.createTransport({
  host: "smtp.mailtrap.io",
  port: 465,
  secure: true,
  auth: {
    user: "abcdef12345",
    pass: "xyz1234567890xyz"
  }
});
```

### ÉTAPE 4 : Copier les valeurs
Notez ces 4 valeurs :
- **Host** : `smtp.mailtrap.io`
- **Port** : `465` 
- **User** : (le numéro/ID dans `user`)
- **Password** : (le mot de passe)

### ÉTAPE 5 : Mettre dans le `.env`
Ouvrez le fichier `.env` à la racine du projet et changez :
```env
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=abcdef12345
SMTP_PASSWORD=xyz1234567890xyz
SMTP_FROM=noreply@irisbank.com
```

### ÉTAPE 6 : Vérifier que ça marche
```bash
npm run test:email
```

Vous devriez voir :
```
✅ EMAIL ENVOYÉ AVEC SUCCÈS!
```

### ÉTAPE 7 : Vérifier l'email reçu
1. Retournez sur https://mailtrap.io/
2. Allez dans **"My Inbox"**
3. L'email test doit être là 📧

---

## ✅ Tout fonctionne? 

Vous pouvez maintenant :
1. Démarrer le serveur : `npm run dev`
2. Aller à http://localhost:3000/register.html
3. Vous inscrire
4. Un email vous sera envoyé automatiquement! 🎉

---

## ❓ Besoin d'aide?

**Les emails ne s'envoient pas?**
- Vérifiez que vous avez copié les bonnes valeurs de Mailtrap
- Vérifiez que les espaces et tirets sont corrects
- Relancez le serveur après chaque changement du `.env`

**Je préfère Gmail?**
- Voir [EMAIL_TESTING_GUIDE.md](./EMAIL_TESTING_GUIDE.md) section Gmail

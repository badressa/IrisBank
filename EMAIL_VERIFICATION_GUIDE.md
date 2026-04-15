# 📧 SYSTÈME DE VÉRIFICATION D'EMAIL - GUIDE COMPLET

## 🎯 Vue d'ensemble

L'utilisateur doit **vérifier son adresse email** avant de pouvoir se connecter. Voici le flow:

1. **Inscription** → Email de vérification envoyé
2. **Utilisateur clique le lien** → Email confirmé
3. **Peut maintenant se connecter** ✅

---

## 🔧 CONFIGURATION REQUISE

### 1️⃣ Ajouter les colonnes à la base de données

**IMPORTANT**: Vous devez d'abord exécuter ce script SQL ! 

**Option A - Via phpMyAdmin :**
1. Ouvrez phpMyAdmin
2. Sélectionnez votre base `banque_db`
3. Allez dans l'onglet "SQL"
4. Collez le contenu de [database/migration_email_verification.sql](./database/migration_email_verification.sql)
5. Cliquez "Exécuter"

**Option B - Via MySQL CLI :**
```bash
mysql -u root -p banque_db < database/migration_email_verification.sql
```

**Vérification :**
```sql
DESCRIBE users;
```
Vous devez voir 3 nouvelles colonnes :
- `email_verified` (TINYINT = 0 ou 1)
- `verification_token` (VARCHAR, nullable)
- `token_expiry` (DATETIME, nullable)

### 2️⃣ Configuration du `.env`

Assurez-vous que ces variables sont présentes :

```env
APP_URL=http://localhost:3000
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=bc40e6bba5039d
SMTP_PASSWORD=fb2d791d1ed381
SMTP_FROM=noreply@irisbank.com
```

---

## 🚀 TEST DU SYSTÈME

### 1️⃣ Démarrer le serveur

```bash
npm run dev
```

Vérifiez que les logs disent :
```
🚀 IRISBANK server running on port 3000
✅ Serveur SMTP connecté
```

### 2️⃣ Inscription

1. Allez à http://localhost:3000/register.html
2. Remplissez le formulaire
3. Cliquez "Créer mon compte"

**Résultat attendu :**
```
✓ Inscription réussie!
Un email de confirmation a été envoyé à email@example.com

Prochaines étapes:
1. Consultez votre boîte mail
2. Cliquez sur le lien d'activation
3. Vous pourrez alors vous connecter
```

### 3️⃣ Vérifier l'email

1. Allez sur https://mailtrap.io
2. Ouvrez votre inbox
3. L'email de vérification doit être là
4. Cliquez sur le lien rouge "✓ Vérifier mon email"

**Vous serez redirigé vers :**
```
🔐 Succès!
Email vérifié avec succès! Vous pouvez maintenant vous connecter.
```

### 4️⃣ Se connecter

1. Allez à http://localhost:3000/login.html
2. Entrez vos identifiants
3. Résultat : **Connexion réussie** et redirection vers le dashboard ✅

---

## ⚠️ Scénarios d'erreur

### ❌ Erreur lors de la vérification

**Message**: "Lien d'activation invalide"
- Possible cause: Token mal copié ou expiré
- **Solution**: Renvoyer l'email de vérification

**Message**: "Lien d'activation expiré"
- **Solution**: Il y a un formulaire pour renvoyer l'email, entrez votre adresse

### ❌ Pas d'email reçu

1. Attendre 30 secondes
2. Vérifier le dossier SPAM/Junk
3. Si toujours rien:
   - Aller à [verify-email.html](./public/verify-email.html)
   - Entrez votre email dans "Renvoyer"
   - Vérifier mailtrap

### ❌ Impossible de se connecter

**Message**: "Veuillez d'abord vérifier votre email"
1. Cliquez sur "Renvoyer l'email de confirmation"
2. Vérifiez l'email et le lien
3. Recommencez la connexion

---

## 📋 FLUX DÉTAILLÉ

### 1. Inscription
```
POST /api/auth/register
Body: {nom, prenom, email, telephone, adresse, date_naissance, password}

Response (201):
{
  "message": "Inscription réussie!",
  "email": "user@example.com",
  "requiresVerification": true
}
```

**Ce qui se passe en coulisse:**
- ✅ Validation des données
- ✅ Email unique vérifié
- ✅ Mot de passe hashé
- ✅ Utilisateur créé avec `email_verified = 0`
- ✅ Token de vérification généré (expire dans 24h)
- ✅ Email envoyé avec lien d'activation
- ❌ PAS de création de session (l'utilisateur ne peut pas se connecter directement)

### 2. Cliquer le lien d'activation

Utilisateur clique le lien de l'email :
```
http://localhost:3000/verify-email.html?token=xxxxx&userId=123
```

**Page verify-email.html:**
- Récupère le token et userId
- Les envoie au serveur
- Affiche un spinner puis le résultat

### 3. Vérifier l'email (Backend)
```
POST /api/auth/verify-email
Body: {token, userId}

Response (200):
{
  "message": "Email vérifié avec succès!",
  "verified": true
}
```

**Ce qui se passe:**
- ✅ Vérifie que le token existe
- ✅ Vérifie que le token n'a pas expiré
- ✅ Marque `email_verified = 1`
- ✅ Supprime le token (il ne peut être utilisé qu'une fois)
- ✅ Envoie email de bienvenue

### 4. Connexion avec vérification
```
POST /api/auth/login
Body: {email, password}

Response (200):
{
  "message": "Connexion réussie",
  "user": {...}
}

Response (403) si email non vérifié:
{
  "error": "Veuillez d'abord vérifier votre email",
  "requiresVerification": true,
  "email": "user@example.com"
}
```

### 5. Renvoyer l'email (si expiré)
```
POST /api/auth/resend-verification
Body: {email}

Response (200):
{
  "message": "Email de vérification renvoyé"
}
```

**Ce qui se passe:**
- ✅ Cherche l'utilisateur avec cet email
- ✅ Vérifie qu'il n'est pas déjà validé
- ✅ Génère un NOUVEAU token
- ✅ Envoie le nouvel email avec le nouveau lien

---

## 🛠️ ACTIONS ADMIN

### Marquer un utilisateur comme vérifié manuellement

Si un utilisateur a des problèmes:

```sql
UPDATE users SET email_verified = 1 WHERE id = 123;
```

### Voir les utilisateurs non vérifiés

```sql
SELECT id, email, email_verified, token_expiry FROM users WHERE email_verified = 0;
```

### Nettoyer les tokens expirés

```sql
UPDATE users SET verification_token = NULL, token_expiry = NULL 
WHERE token_expiry < NOW() AND email_verified = 1;
```

---

## 📊 Variables de base de données

| Colonne | Type | Description |
|---------|------|-------------|
| `email_verified` | TINYINT(1) | 0 = non vérifié, 1 = vérifié |
| `verification_token` | VARCHAR(255) | Token unique pour activation (64 caractères hex) |
| `token_expiry` | DATETIME | Date/heure d'expiration du token (+24h) |

---

## 🔒 Sécurité

- ✅ Tokens générés aléatoirement avec `crypto.randomBytes(32)`
- ✅ Tokens valides 24h seulement
- ✅ Token supprimé après utilisation (ne peut être utilisé qu'une fois)
- ✅ Impossible de se connecter sans vérifier l'email
- ✅ Emails envoyés via Mailtrap (test) ou SMTP sécurisé

---

## 🎨 Pages impliquées

| Page | Rôle |
|------|------|
| [register.html](./public/register.html) | Inscription + message de vérification |
| [login.html](./public/login.html) | Connexion + message si email non vérifié |
| [verify-email.html](./public/verify-email.html) | Confirmation par token + renvoyer email |

---

## 📧 Emails envoyés

### 1. Email de vérification (à l'inscription)
- **Sujet**: "Confirmez votre adresse email - IRISBANK"
- **Contient**: Lien d'activation + délai d'expiration (24h)
- **Action**: Utilisateur clique le lien

### 2. Email de bienvenue (après vérification)
- **Sujet**: "Bienvenue sur IRISBANK"
- **Contient**: Confirmation + accès au dashboard

---

## ❓ FAQ

**Q: Pourquoi je dois vérifier l'email?**  
R: C'est une mesure de sécurité et de validité d'email standard.

**Q: Combien de temps pour que l'email arrive?**  
R: Généralement quelques secondes. Si rien après 30s, vérifiez le spam.

**Q: Puis-je sauter la vérification?**  
R: Non, c'est obligatoire. (À moins que vous exécutiez `UPDATE users SET email_verified = 1`)

**Q: Le token expire quand?**  
R: 24 heures après la génération.

**Q: Je peux me voir les utilisateurs non vérifiés?**  
R: Oui, query: `SELECT * FROM users WHERE email_verified = 0;`

**Q: Comment ça marche en production?**  
R: Changez les variables SMTP dans le `.env` pour utiliser SendGrid, AWS SES ou autre service.

---

## 🚀 PRÊT?

1. ✅ Exécuter la migration SQL
2. ✅ Configurer le `.env`
3. ✅ Redémarrer `npm run dev`
4. ✅ Tester l'inscription complète
5. ✅ Vérifier l'email sur mailtrap
6. ✅ Se connecter 🎉

# ✅ SYSTÈME DE VÉRIFICATION D'EMAIL - ÉTAPES DE CONFIGURATION

## 📋 CHECKLIST

- [ ] **ÉTAPE 1**: Exécuter la migration SQL
- [ ] **ÉTAPE 2**: Redémarrer le serveur
- [ ] **ÉTAPE 3**: Tester l'inscription
- [ ] **ÉTAPE 4**: Vérifier l'email sur Mailtrap
- [ ] **ÉTAPE 5**: Se connecter

---

## 🔧 ÉTAPE 1: Migration de la base de données

### Qu'est-ce qu'une migration?
C'est ajouter 3 colonnes à la table `users`:
- `email_verified` (0 ou 1)
- `verification_token` (le token d'activation)
- `token_expiry` (quand le token expire)

### Comment l'exécuter?

**Option A: PhpMyAdmin (le plus simple)**
1. Ouvrez http://localhost/phpmyadmin/
2. À gauche → `banque_db`
3. En haut → onglet "SQL"
4. Ouvrez le fichier [database/migration_email_verification.sql](./database/migration_email_verification.sql)
5. Copiez **tout le contenu**
6. Collez dans phpMyAdmin
7. Cliquez le bouton "Exécuter" (en bas à droite)

Vous devriez voir: `Requêtes exécutées avec succès`

**Option B: Terminal MySQL**
```bash
cd c:\projets\rajit\IRISBANK
mysql -u root -p banque_db < database/migration_email_verification.sql
```

### Vérifier que ça a marché?

Dans phpMyAdmin:
```sql
DESCRIBE users;
```

Vous devez voir à **la fin** les 3 colonnes:
- `email_verified`
- `verification_token`
- `token_expiry`

---

## 🚀 ÉTAPE 2: Il faut redémarrer le serveur

Le serveur a peut-être besoin de redémarrer. Dans le terminal:

```
Appuyez sur Ctrl+C pour arrêter
```

Puis:
```bash
npm run dev
```

Vous devez voir:
```
🚀 IRISBANK server running on port 3000
✅ Serveur SMTP connecté
```

---

## 📝 ÉTAPE 3: Test - Inscription

### A. Aller à la page d'inscription
```
http://localhost:3000/register.html
```

### B. Remplir le formulaire
- **Nom**: Dupont
- **Prénom**: Jean
- **Email**: test@example.com (ou votre email)
- **Téléphone**: 0612345678
- **Adresse**: 123 Rue de Paris
- **Date de naissance**: 01/01/1990
- **Mot de passe**: SecurePass123

### C. Cliquer "Créer mon compte"

**Résultat attendu:**
```
✓ Inscription réussie!
Un email de confirmation a été envoyé à test@example.com

Prochaines étapes:
1. Consultez votre boîte mail
2. Cliquez sur le lien d'activation
3. Vous pourrez alors vous connecter
```

---

## 📧 ÉTAPE 4: Vérifier l'email

### A. Aller à Mailtrap
```
https://mailtrap.io
```

### B. Ouvrir votre Inbox
- Connectez-vous si nécessaire
- À gauche → "My Inbox"

### C. Vous devriez voir l'email
- Subject: "Confirmez votre adresse email - IRISBANK"
- Un gros bouton rouge: "✓ Vérifier mon email"

### D. Cliquer le bouton

Vous serez redirigé vers:
```
🔐 Succès!
Email vérifié avec succès! Vous pouvez maintenant vous connecter.
```

---

## 🔑 ÉTAPE 5: Se connecter

### A. Aller à la connexion
```
http://localhost:3000/login.html
```

### B. Entrez vos identifiants
- Email: test@example.com
- Mot de passe: SecurePass123

### C. Cliquer "Se connecter"

Vous êtes redirigé vers le **dashboard** = **Succès!** ✅

---

## ⚠️ Si ça n'a pas marché?

### ❌ "Erreur lors de l'inscription"
- Vérifiez les logs du serveur
- Le SMTP doit être connecté: `✅ Serveur SMTP connecté`

### ❌ "Email not found in Mailtrap"
- Attendre 30 secondes
- Vérifier le dossier SPAM
- Vérifier que `SMTP_HOST` est correct dans `.env`

### ❌ "Token invalide"
- Copier-coller le lien de l'email (ne pas le retaper)
- Si expiré (> 24h), utiliser le formulaire "Renvoyer"

### ❌ Même service après "Vérifier"
- Le serveur a peut-être pas redémarré
- `npm run dev` (Ctrl+C puis relancer)

---

## 📚 Plus d'infos

- [EMAIL_VERIFICATION_GUIDE.md](./EMAIL_VERIFICATION_GUIDE.md) - Guide complet (technique)
- [EMAIL_TESTING_GUIDE.md](./EMAIL_TESTING_GUIDE.md) - Configuration Mailtrap/Gmail

---

## ✨ C'est fini!

Une fois que vous avez testé avec succès les 5 étapes, le système fonctionne! 🎉

Les utilisateurs devront maintenant:
1. S'inscrire
2. Vérifier leur email
3. Se connecter
4. Accéder au dashboard

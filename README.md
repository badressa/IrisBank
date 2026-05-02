# IRISBANK

## Description
IRISBANK est une application bancaire développée avec Node.js et Express. Elle offre des fonctionnalités complètes pour la gestion des comptes utilisateurs, des transactions financières, de l'administration, des notifications, des profils et même une intégration d'IA.

## Fonctionnalités
- **Authentification** : Connexion et inscription sécurisées avec sessions.
- **Gestion des comptes** : Création et gestion des comptes bancaires.
- **Transactions** : Effectuer des dépôts, retraits et transferts.
- **Administration** : Interface d'administration pour gérer les utilisateurs et les opérations.
- **Notifications** : Système de notifications pour les utilisateurs.
- **Profils** : Gestion des profils utilisateurs.
- **IA** : Intégration d'outils d'intelligence artificielle pour des analyses ou recommandations.

## Technologies utilisées
- **Backend** : Node.js, Express.js
- **Base de données** : MySQL
- **Sécurité** : bcrypt (hachage des mots de passe), express-session, CSRF protection, rate limiting
- **Autres** : cookie-parser, CORS, express-validator

## Installation
1. Clonez le dépôt :
   ```
   git clone <url-du-dépôt>
   cd irisbank
   ```

2. Installez les dépendances :
   ```
   npm install
   ```

3. Configurez la base de données :
   - Créez une base de données MySQL.
   - Modifiez le fichier `config/db.js` avec vos informations de connexion.

4. Configurez les variables d'environnement :
   - Créez un fichier `.env` à la racine avec les variables nécessaires (ex. : SESSION_SECRET, informations de DB).
   - Pour Stripe en mode test, ajoutez aussi `STRIPE_SECRET_KEY` et `STRIPE_PUBLISHABLE_KEY`.

## Utilisation
Pour démarrer le serveur :
```
npm start
```
Ou en mode développement avec nodemon :
```
npx nodemon server.js
```

L'application sera accessible sur `http://localhost:3000` (ou le port configuré).

## Structure du projet
- `server.js` : Point d'entrée de l'application.
- `config/db.js` : Configuration de la base de données.
- `controllers/` : Logique métier pour chaque fonctionnalité.
- `routes/` : Définition des routes API.
- `middleware/` : Middlewares personnalisés (ex. : authentification).
- `public/` : Fichiers statiques (HTML, CSS, JS pour le frontend).

## Scripts
- `npm test` : Exécute les tests (à configurer).

## Stripe test
- L'API expose `GET /api/stripe/config` pour récupérer la clé publique Stripe côté frontend.
- L'API expose `GET /api/stripe/test-cards` pour lister quelques cartes de test utiles.
- L'API expose `POST /api/stripe/create-payment-intent` avec `amount`, `currency` et `description`.
- Exemple de carte test Stripe succès : `4242 4242 4242 4242`.

## Licence
ISC

## Auteur
Rajit 

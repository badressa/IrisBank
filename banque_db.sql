-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1
-- Généré le : mar. 21 avr. 2026 à 17:29
-- Version du serveur : 10.4.27-MariaDB
-- Version de PHP : 8.2.0

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `banque_db`
--

-- --------------------------------------------------------

--
-- Structure de la table `budget_categories`
--

CREATE TABLE `budget_categories` (
  `id` int(11) NOT NULL,
  `nom` varchar(100) NOT NULL,
  `icone` varchar(10) NOT NULL,
  `couleur` varchar(7) NOT NULL COMMENT 'Couleur HEX ex: #4CAF50',
  `description` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `budget_categories`
--

INSERT INTO `budget_categories` (`id`, `nom`, `icone`, `couleur`, `description`) VALUES
(1, 'Cours / Formation', '🎓', '#3B82F6', 'Frais de scolarité, formations, livres'),
(2, 'Sport', '🏋️', '#22C55E', 'Abonnements salle, équipements sportifs'),
(3, 'Jeux / Loisirs', '🎮', '#8B5CF6', 'Jeux vidéo, divertissements'),
(4, 'Sorties / Resto', '🍽️', '#F97316', 'Restaurants, bars, sorties'),
(5, 'Voyage', '✈️', '#06B6D4', 'Transports, hôtels, vacances'),
(6, 'Loyer / Logement', '🏠', '#6B7280', 'Loyer, charges, assurance habitation'),
(7, 'Alimentation', '🛒', '#EAB308', 'Courses, supermarché'),
(8, 'Transport', '🚗', '#EF4444', 'Carburant, transports en commun'),
(9, 'Santé', '💊', '#EC4899', 'Médecin, pharmacie, mutuelle'),
(10, 'Abonnements', '📱', '#6366F1', 'Netflix, Spotify, téléphone');

-- --------------------------------------------------------

--
-- Structure de la table `budget_historique`
--

CREATE TABLE `budget_historique` (
  `id` int(11) NOT NULL,
  `paiement_id` int(11) NOT NULL,
  `transaction_id` int(11) NOT NULL,
  `montant` decimal(10,2) NOT NULL,
  `mois` tinyint(2) NOT NULL,
  `annee` smallint(4) NOT NULL,
  `effectue_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `budget_historique`
--

INSERT INTO `budget_historique` (`id`, `paiement_id`, `transaction_id`, `montant`, `mois`, `annee`, `effectue_at`) VALUES
(1, 2, 63, '17.67', 4, 2026, '2026-04-19 18:01:12'),
(2, 3, 64, '7.90', 4, 2026, '2026-04-19 18:01:43'),
(3, 4, 65, '34.99', 4, 2026, '2026-04-19 18:02:54'),
(4, 5, 66, '17.90', 4, 2026, '2026-04-19 18:08:20'),
(5, 6, 67, '30.00', 4, 2026, '2026-04-19 18:16:48'),
(6, 7, 68, '34.21', 4, 2026, '2026-04-19 18:17:44'),
(7, 8, 69, '50.00', 4, 2026, '2026-04-19 21:06:46'),
(8, 9, 70, '649.00', 4, 2026, '2026-04-20 14:58:55');

-- --------------------------------------------------------

--
-- Structure de la table `budget_limites`
--

CREATE TABLE `budget_limites` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `categorie_id` int(11) NOT NULL,
  `plafond` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `budget_limites`
--

INSERT INTO `budget_limites` (`id`, `user_id`, `categorie_id`, `plafond`, `created_at`, `updated_at`) VALUES
(1, 28, 10, '50.00', '2026-04-19 18:02:05', '2026-04-19 18:02:05'),
(2, 28, 7, '250.00', '2026-04-19 18:02:23', '2026-04-19 18:02:23'),
(3, 28, 2, '50.00', '2026-04-19 18:03:13', '2026-04-19 18:03:13'),
(4, 28, 4, '50.00', '2026-04-19 18:17:12', '2026-04-19 18:17:12'),
(5, 28, 3, '10.00', '2026-04-19 21:06:24', '2026-04-19 21:06:24');

-- --------------------------------------------------------

--
-- Structure de la table `budget_paiements`
--

CREATE TABLE `budget_paiements` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `compte_source_id` int(11) NOT NULL,
  `categorie_id` int(11) NOT NULL,
  `montant` decimal(10,2) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `recurrent` tinyint(1) DEFAULT 0,
  `statut` enum('ACTIF','ANNULE','EFFECTUE') DEFAULT 'ACTIF',
  `prochaine_echeance` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `budget_paiements`
--

INSERT INTO `budget_paiements` (`id`, `user_id`, `compte_source_id`, `categorie_id`, `montant`, `description`, `recurrent`, `statut`, `prochaine_echeance`, `created_at`, `updated_at`) VALUES
(1, 28, 30, 10, '7.99', 'NETFLIX', 1, 'ANNULE', '2026-04-30', '2026-04-19 17:59:23', '2026-04-19 18:01:52'),
(2, 28, 30, 7, '17.67', 'FRANPRIX', 0, 'ACTIF', NULL, '2026-04-19 18:01:12', '2026-04-19 18:01:12'),
(3, 28, 30, 10, '7.90', 'NETFLIX', 1, 'ACTIF', '2026-04-30', '2026-04-19 18:01:43', '2026-04-19 18:01:43'),
(4, 28, 30, 2, '34.99', 'ON AIR', 1, 'ACTIF', '2026-04-30', '2026-04-19 18:02:54', '2026-04-19 18:02:54'),
(5, 28, 30, 2, '17.90', 'Decathlon Ballon', 0, 'ACTIF', NULL, '2026-04-19 18:08:20', '2026-04-19 18:08:20'),
(6, 28, 30, 9, '30.00', 'Medecin Generaliste', 0, 'ACTIF', NULL, '2026-04-19 18:16:48', '2026-04-19 18:16:48'),
(7, 28, 30, 4, '34.21', 'Brunch Paris', 0, 'ACTIF', NULL, '2026-04-19 18:17:44', '2026-04-19 18:17:44'),
(8, 28, 30, 3, '50.00', 'Jeux Steam', 0, 'ACTIF', NULL, '2026-04-19 21:06:46', '2026-04-19 21:06:46'),
(9, 28, 30, 6, '649.00', 'Loyer', 1, 'ACTIF', '2026-04-30', '2026-04-20 14:58:55', '2026-04-20 14:58:55');

-- --------------------------------------------------------

--
-- Structure de la table `comptes_bancaires`
--

CREATE TABLE `comptes_bancaires` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `iban` varchar(34) DEFAULT NULL,
  `type` enum('COURANT','LIVRET_A','PEL') DEFAULT NULL,
  `solde` decimal(10,2) DEFAULT 0.00,
  `statut` enum('ACTIF','BLOQUE') DEFAULT 'ACTIF',
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `comptes_bancaires`
--

INSERT INTO `comptes_bancaires` (`id`, `user_id`, `iban`, `type`, `solde`, `statut`, `created_at`) VALUES
(27, 25, 'FR76-YBNK-1267-5177-6887', 'PEL', '0.00', 'ACTIF', '2026-04-02 13:34:56'),
(21, 25, 'FR76-YBNK-0163-9514-5611', 'COURANT', '88740.00', 'ACTIF', '2026-04-01 09:32:24'),
(24, 26, 'FR76-YBNK-5772-0436-2399', 'COURANT', '100180.00', 'ACTIF', '2026-04-02 09:25:52'),
(26, 26, 'FR76-YBNK-8393-8092-1271', 'PEL', '11120.00', 'ACTIF', '2026-04-02 09:27:56'),
(28, 28, 'FR76-YBNK-7978-8367-3305', 'COURANT', '10000.00', 'ACTIF', '2026-04-19 17:28:07'),
(29, 28, 'FR76-YBNK-2981-9304-0151', 'LIVRET_A', '10000.00', 'ACTIF', '2026-04-19 17:28:10'),
(30, 28, 'FR76-YBNK-4525-3206-3021', 'PEL', '9150.34', 'ACTIF', '2026-04-19 17:28:12');

-- --------------------------------------------------------

--
-- Structure de la table `contrats_pro`
--

CREATE TABLE `contrats_pro` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `compte_destination_id` int(11) NOT NULL,
  `employeur` varchar(150) NOT NULL,
  `salaire_mensuel` decimal(10,2) NOT NULL,
  `type_contrat` enum('CDI','CDD') NOT NULL,
  `date_debut` date NOT NULL,
  `date_fin` date DEFAULT NULL,
  `jour_versement` int(11) DEFAULT 1,
  `dernier_versement` date DEFAULT NULL,
  `statut` enum('ACTIF','TERMINE') DEFAULT 'ACTIF',
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `message` text NOT NULL,
  `type` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `user_id` int(11) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `notifications`
--

INSERT INTO `notifications` (`id`, `message`, `type`, `created_at`, `user_id`) VALUES
(38, 'Nouveau compte COURANT créé pour JR Sad (FR74Q7LYMY7OIVS2CWYBND8CTY4)', 'NEW_ACCOUNT', '2026-04-01 09:21:42', 0),
(39, 'Nouveau compte COURANT créé pour JR Sad (FR76-YBNK-0163-9514-5611)', 'NEW_ACCOUNT', '2026-04-01 09:32:24', 0),
(40, '💰 Dépôt de 100000.00€ sur votre compte ****5611', 'DEPOSIT', '2026-04-01 12:13:57', 25),
(41, 'Compte #21 passé en statut BLOQUE', 'ACCOUNT_STATUS', '2026-04-01 12:58:47', 0),
(42, 'Compte supprimé par jeya Sad (FR74Q7LYMY7OIVS2CWYBND8CTY4)', 'DELETE_ACCOUNT', '2026-04-01 13:51:22', 0),
(43, 'Nouveau compte LIVRET_A créé pour jeya Sad (FR76-YBNK-4539-7796-9434)', 'NEW_ACCOUNT', '2026-04-01 14:05:53', 0),
(44, 'Nouveau compte PEL créé pour jeya Sad (FR76-YBNK-1958-7680-1497)', 'NEW_ACCOUNT', '2026-04-01 14:45:40', 0),
(45, '💰 Dépôt de 200.00€ sur votre compte ****9434', 'DEPOSIT', '2026-04-01 14:47:49', 25),
(46, '💸 Retrait de 20.00€ depuis votre compte ****9434', 'WITHDRAW', '2026-04-01 14:47:54', 25),
(47, 'Nouveau compte COURANT créé pour Alexi DELON (FR76-YBNK-5772-0436-2399)', 'NEW_ACCOUNT', '2026-04-02 09:25:52', 0),
(48, '💰 Dépôt de 200.00€ sur votre compte ****2399', 'DEPOSIT', '2026-04-02 09:26:14', 26),
(49, '💸 Retrait de 20.00€ depuis votre compte ****2399', 'WITHDRAW', '2026-04-02 09:26:24', 26),
(50, '💰 Dépôt de 100000.00€ sur votre compte ****2399', 'DEPOSIT', '2026-04-02 09:27:14', 26),
(51, 'Nouveau compte PEL créé pour Alexi DELON (FR76-YBNK-0337-6624-1248)', 'NEW_ACCOUNT', '2026-04-02 09:27:38', 0),
(52, 'Compte supprimé par Alexi DELON (FR76-YBNK-0337-6624-1248)', 'DELETE_ACCOUNT', '2026-04-02 09:27:46', 0),
(53, 'Nouveau compte PEL créé pour Alexi DELON (FR76-YBNK-8393-8092-1271)', 'NEW_ACCOUNT', '2026-04-02 09:27:56', 0),
(54, '📤 Virement de 20.00€ envoyé', 'TRANSFER', '2026-04-02 09:30:43', 25),
(55, '💰 Vous avez reçu 20.00€ de jeya Sad', 'TRANSFER_RECEIVED', '2026-04-02 09:30:43', 26),
(56, 'Compte #21 passé en statut ACTIF', 'ACCOUNT_STATUS', '2026-04-02 12:09:20', 0),
(57, 'Compte #21 passé en statut BLOQUE', 'ACCOUNT_STATUS', '2026-04-02 12:09:21', 0),
(58, 'Compte #21 passé en statut ACTIF', 'ACCOUNT_STATUS', '2026-04-02 12:15:35', 0),
(59, 'Compte #21 passé en statut BLOQUE', 'ACCOUNT_STATUS', '2026-04-02 12:15:36', 0),
(60, 'Compte #21 passé en statut ACTIF', 'ACCOUNT_STATUS', '2026-04-02 12:15:37', 0),
(61, 'Compte supprimé par jeya Sad (FR76-YBNK-1958-7680-1497)', 'DELETE_ACCOUNT', '2026-04-02 12:18:31', 0),
(62, '💸 Retrait de 160.00€ depuis votre compte ****9434', 'WITHDRAW', '2026-04-02 13:34:27', 25),
(63, 'Compte supprimé par JEya Sad (FR76-YBNK-4539-7796-9434)', 'DELETE_ACCOUNT', '2026-04-02 13:34:31', 0),
(64, 'Nouveau compte PEL créé pour JEya Sad (FR76-YBNK-1267-5177-6887)', 'NEW_ACCOUNT', '2026-04-02 13:34:56', 0),
(65, '💰 Dépôt de 160.00€ sur votre compte ****6887', 'DEPOSIT', '2026-04-02 13:36:00', 25),
(66, '💸 Retrait de 160.00€ depuis votre compte ****6887', 'WITHDRAW', '2026-04-02 13:36:11', 25),
(67, '💸 Retrait de 160.00€ depuis votre compte ****5611', 'WITHDRAW', '2026-04-02 13:36:27', 25),
(68, '📤 Virement de 100.00€ envoyé', 'TRANSFER', '2026-04-02 13:39:56', 25),
(69, '💰 Vous avez reçu 100.00€ de JEya Sad', 'TRANSFER_RECEIVED', '2026-04-02 13:39:56', 26),
(70, '📤 Virement de 1000.00€ envoyé', 'TRANSFER', '2026-04-02 13:40:22', 25),
(71, '💰 Vous avez reçu 1000.00€ de JEya Sad', 'TRANSFER_RECEIVED', '2026-04-02 13:40:22', 26),
(72, '📤 Virement de 10000.00€ envoyé', 'TRANSFER', '2026-04-02 13:40:26', 25),
(73, '💰 Vous avez reçu 10000.00€ de JEya Sad', 'TRANSFER_RECEIVED', '2026-04-02 13:40:26', 26),
(74, 'Compte #27 passé en statut BLOQUE', 'ACCOUNT_STATUS', '2026-04-02 13:43:45', 0),
(75, 'Compte #27 passé en statut ACTIF', 'ACCOUNT_STATUS', '2026-04-02 13:43:50', 0),
(76, 'Nouveau compte COURANT créé pour Nassim Lahlouh (FR76-YBNK-7978-8367-3305)', 'NEW_ACCOUNT', '2026-04-19 17:28:07', 0),
(77, 'Nouveau compte LIVRET_A créé pour Nassim Lahlouh (FR76-YBNK-2981-9304-0151)', 'NEW_ACCOUNT', '2026-04-19 17:28:10', 0),
(78, 'Nouveau compte PEL créé pour Nassim Lahlouh (FR76-YBNK-4525-3206-3021)', 'NEW_ACCOUNT', '2026-04-19 17:28:12', 0),
(79, '💰 Dépôt de 10000.00€ sur votre compte ****3021', 'DEPOSIT', '2026-04-19 17:29:13', 28),
(80, '💰 Dépôt de 10000.00€ sur votre compte ****0151', 'DEPOSIT', '2026-04-19 17:29:18', 28),
(81, '💰 Dépôt de 10000.00€ sur votre compte ****3305', 'DEPOSIT', '2026-04-19 17:29:22', 28),
(82, '💳 Paiement de 17.67€ effectué', 'BUDGET_PAIEMENT', '2026-04-19 18:01:12', 28),
(83, '💳 Paiement de 7.9€ effectué', 'BUDGET_PAIEMENT', '2026-04-19 18:01:43', 28),
(84, '💳 Paiement de 34.99€ effectué', 'BUDGET_PAIEMENT', '2026-04-19 18:02:54', 28),
(85, '💳 Paiement de 17.9€ effectué', 'BUDGET_PAIEMENT', '2026-04-19 18:08:20', 28),
(86, '⚠️ Plafond dépassé pour Sport : 52.89€ / 50.00€', 'BUDGET_DEPASSE', '2026-04-19 18:08:20', 28),
(87, '💳 Paiement de 30€ effectué', 'BUDGET_PAIEMENT', '2026-04-19 18:16:48', 28),
(88, '💳 Paiement de 34.21€ effectué', 'BUDGET_PAIEMENT', '2026-04-19 18:17:44', 28),
(89, '💳 Paiement de 50€ effectué', 'BUDGET_PAIEMENT', '2026-04-19 21:06:46', 28),
(90, '⚠️ Plafond dépassé pour Jeux / Loisirs : 50.00€ / 10.00€', 'BUDGET_DEPASSE', '2026-04-19 21:06:46', 28),
(91, '💳 Paiement de 649€ effectué', 'BUDGET_PAIEMENT', '2026-04-20 14:58:55', 28);

-- --------------------------------------------------------

--
-- Structure de la table `transactions`
--

CREATE TABLE `transactions` (
  `id` int(11) NOT NULL,
  `type` enum('DEPOT','RETRAIT','VIREMENT') DEFAULT NULL,
  `montant` decimal(10,2) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `compte_source_id` int(11) DEFAULT NULL,
  `compte_destination_id` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `categorie_id` int(11) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `transactions`
--

INSERT INTO `transactions` (`id`, `type`, `montant`, `description`, `compte_source_id`, `compte_destination_id`, `created_at`, `categorie_id`) VALUES
(46, 'DEPOT', '100000.00', NULL, NULL, 21, '2026-04-01 12:13:57', NULL),
(47, 'DEPOT', '200.00', NULL, NULL, 22, '2026-04-01 14:47:49', NULL),
(48, 'RETRAIT', '20.00', NULL, 22, NULL, '2026-04-01 14:47:54', NULL),
(49, 'DEPOT', '200.00', NULL, NULL, 24, '2026-04-02 09:26:14', NULL),
(50, 'RETRAIT', '20.00', NULL, 24, NULL, '2026-04-02 09:26:24', NULL),
(51, 'DEPOT', '100000.00', NULL, NULL, 24, '2026-04-02 09:27:14', NULL),
(52, 'VIREMENT', '20.00', NULL, 22, 26, '2026-04-02 09:30:43', NULL),
(53, 'RETRAIT', '160.00', NULL, 22, NULL, '2026-04-02 13:34:27', NULL),
(54, 'DEPOT', '160.00', NULL, NULL, 27, '2026-04-02 13:36:00', NULL),
(55, 'RETRAIT', '160.00', NULL, 27, NULL, '2026-04-02 13:36:11', NULL),
(56, 'RETRAIT', '160.00', NULL, 21, NULL, '2026-04-02 13:36:27', NULL),
(57, 'VIREMENT', '100.00', NULL, 21, 26, '2026-04-02 13:39:56', NULL),
(58, 'VIREMENT', '1000.00', NULL, 21, 26, '2026-04-02 13:40:22', NULL),
(59, 'VIREMENT', '10000.00', NULL, 21, 26, '2026-04-02 13:40:26', NULL),
(60, 'DEPOT', '10000.00', NULL, NULL, 30, '2026-04-19 17:29:13', NULL),
(61, 'DEPOT', '10000.00', NULL, NULL, 29, '2026-04-19 17:29:18', NULL),
(62, 'DEPOT', '10000.00', NULL, NULL, 28, '2026-04-19 17:29:22', NULL),
(63, 'RETRAIT', '17.67', 'FRANPRIX', 30, NULL, '2026-04-19 18:01:12', 7),
(64, 'RETRAIT', '7.90', 'NETFLIX', 30, NULL, '2026-04-19 18:01:43', 10),
(65, 'RETRAIT', '34.99', 'ON AIR', 30, NULL, '2026-04-19 18:02:54', 2),
(66, 'RETRAIT', '17.90', 'Decathlon Ballon', 30, NULL, '2026-04-19 18:08:20', 2),
(67, 'RETRAIT', '30.00', 'Medecin Generaliste', 30, NULL, '2026-04-19 18:16:48', 9),
(68, 'RETRAIT', '34.21', 'Brunch Paris', 30, NULL, '2026-04-19 18:17:44', 4),
(69, 'RETRAIT', '50.00', 'Jeux Steam', 30, NULL, '2026-04-19 21:06:46', 3),
(70, 'RETRAIT', '649.00', 'Loyer', 30, NULL, '2026-04-20 14:58:55', 6);

-- --------------------------------------------------------

--
-- Structure de la table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `nom` varchar(100) DEFAULT NULL,
  `prenom` varchar(100) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `telephone` varchar(20) DEFAULT NULL,
  `adresse` varchar(255) DEFAULT NULL,
  `date_naissance` date DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `role` enum('CLIENT','ADMIN') DEFAULT 'CLIENT',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `is_admin` tinyint(1) DEFAULT 0,
  `email_verified` tinyint(1) DEFAULT 0,
  `verification_token` varchar(255) DEFAULT NULL,
  `token_expiry` datetime DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `users`
--

INSERT INTO `users` (`id`, `nom`, `prenom`, `email`, `telephone`, `adresse`, `date_naissance`, `password_hash`, `role`, `created_at`, `is_admin`, `email_verified`, `verification_token`, `token_expiry`) VALUES
(2, 'Rajo', 'Rajit', 'rajo@gmail.com', '0612345678', 'Paris', '2000-01-01', '$2b$10$fpPnJSHqslRjrL4I4wp.EOxVNY0MqBebf161ipuoLvELbvb/1PoMO', 'ADMIN', '2026-03-04 16:18:53', 1, 0, NULL, NULL),
(26, 'DELON', 'Alexi', 'delon@gmail.com', '0678678756', '40 rue de la Paix', '2001-12-12', '$2b$10$rdgTukr9hIxiac/YsSpzW.VdUpvCQHaP3LNYejDH40.Nf2WM7XyaC', 'CLIENT', '2026-04-02 09:25:42', 0, 0, NULL, NULL),
(25, 'Sad', 'JEya', 'sad@gmail.com', '0767766775', '40 rue de la Paix', '2026-04-02', '$2b$10$2w2L4hjsx9o3PDYR/pP/M.WgIJAQQRaZcgXVqzOB.4yZpOK0cL0/2', 'CLIENT', '2026-04-01 09:21:33', 0, 0, NULL, NULL),
(27, 'Lahlouh', 'Nassim', 'greyfullbuster111@gmail.com', '0783058000', '45 avenue des rose', '1996-11-11', '$2b$10$n64SDfbJYvyXFCIeIdQzAu2ot4mRBfF5DMPjAfvnLaYAzYcr.irki', 'CLIENT', '2026-04-15 20:49:03', 0, 0, 'be994386289d8654d38226e9aaf1d8382247f6b3f99c6c228bdd8d3309e3a592', '2026-04-16 22:49:03'),
(28, 'Lahlouh', 'Nassim', 'lahlouhnassim@gmail.com', '0783050000', '32 avenue DES ROSES', '1995-03-22', '$2b$10$jMBRGZnOOUcqrgNAstkAKePC7hcQGAsFpGTeXOfH69xZSmJekA4gq', 'CLIENT', '2026-04-15 21:07:32', 0, 1, NULL, NULL),
(29, 'Lahlouh', 'Nassim', 'lahlouhnassimdev@gmail.com', '0783050000', '32 avenue du temple', '1996-12-12', '$2b$10$fmei3D8Z3UBcWxJcttJ7BeGVs3W6gzW0QkwuMzqziHrw.lehO.qri', 'CLIENT', '2026-04-16 11:14:19', 0, 1, NULL, NULL);

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `budget_categories`
--
ALTER TABLE `budget_categories`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `budget_historique`
--
ALTER TABLE `budget_historique`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `budget_limites`
--
ALTER TABLE `budget_limites`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_user_categorie` (`user_id`,`categorie_id`);

--
-- Index pour la table `budget_paiements`
--
ALTER TABLE `budget_paiements`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `comptes_bancaires`
--
ALTER TABLE `comptes_bancaires`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `iban` (`iban`),
  ADD UNIQUE KEY `unique_user_type` (`user_id`,`type`);

--
-- Index pour la table `contrats_pro`
--
ALTER TABLE `contrats_pro`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `transactions`
--
ALTER TABLE `transactions`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `budget_categories`
--
ALTER TABLE `budget_categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT pour la table `budget_historique`
--
ALTER TABLE `budget_historique`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT pour la table `budget_limites`
--
ALTER TABLE `budget_limites`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT pour la table `budget_paiements`
--
ALTER TABLE `budget_paiements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT pour la table `comptes_bancaires`
--
ALTER TABLE `comptes_bancaires`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=31;

--
-- AUTO_INCREMENT pour la table `contrats_pro`
--
ALTER TABLE `contrats_pro`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=92;

--
-- AUTO_INCREMENT pour la table `transactions`
--
ALTER TABLE `transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=71;

--
-- AUTO_INCREMENT pour la table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

const mysql = require("mysql2/promise");
require("dotenv").config();

async function testConnection() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "banque_db",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log("🔄 Tentative de connexion à la base de données...");
    const connection = await pool.getConnection();
    console.log("✅ Connexion réussie!");

    // Test pour voir toutes les tables
    const [tables] = await connection.query("SHOW TABLES;");
    console.log("\n📊 Tables disponibles:");
    console.table(tables);

    // Vérifier la table users
    const [columns] = await connection.query("DESCRIBE users;");
    console.log("\n📋 Structure de la table 'users':");
    console.table(columns);

    connection.release();
    process.exit(0);
  } catch (err) {
    console.error("❌ Erreur de connexion:", err.message);
    process.exit(1);
  }
}

testConnection();

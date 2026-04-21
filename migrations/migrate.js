// migrations/migrate.js
// Usage : node migrations/migrate.js
// Lance toutes les migrations dans l'ordre, une seule fois chacune.

const fs   = require("fs");
const path = require("path");
const db   = require("../config/db");

async function run() {
  // Table de suivi des migrations déjà appliquées
  await db.query(`
    CREATE TABLE IF NOT EXISTS \`schema_migrations\` (
      \`id\`         INT(11)      NOT NULL AUTO_INCREMENT,
      \`filename\`   VARCHAR(255) NOT NULL,
      \`applied_at\` TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`unique_filename\` (\`filename\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const migrationsDir = __dirname;
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const [rows] = await db.query(
      "SELECT id FROM schema_migrations WHERE filename = ?", [file]
    );

    if (rows.length > 0) {
      console.log(`⏭  Déjà appliquée : ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");

    const normalizedSql = sql
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split(/\r?\n/)
      .filter(line => !line.trim().startsWith("--"))
      .join("\n");

    // Exécuter chaque instruction séparément
    const statements = normalizedSql
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0);

    try {
      for (const stmt of statements) {
        await db.query(stmt);
      }

      await db.query(
        "INSERT INTO schema_migrations (filename) VALUES (?)", [file]
      );

      console.log(`✅ Migration appliquée : ${file}`);
    } catch (err) {
      console.error(`❌ Erreur sur ${file} :`, err.message);
      process.exit(1);
    }
  }

  console.log("\n🎉 Toutes les migrations sont à jour.");
  process.exit(0);
}

run().catch(err => {
  console.error("MIGRATION ERROR:", err);
  process.exit(1);
});

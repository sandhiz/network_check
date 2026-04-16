require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');

const mysql = require('mysql2/promise');

const { env } = require('../src/config/environment');

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

  const rootConnection = await mysql.createConnection({
    host: env.dbHost,
    user: env.dbUser,
    password: env.dbPassword,
    port: env.dbPort,
    multipleStatements: true
  });

  try {
    for (const file of files) {
      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      const connection = file.startsWith('001_')
        ? rootConnection
        : await mysql.createConnection({
            host: env.dbHost,
            user: env.dbUser,
            password: env.dbPassword,
            port: env.dbPort,
            database: env.dbName,
            multipleStatements: true
          });

      try {
        console.log(`Running migration ${file}`);
        await connection.query(sql);
      } finally {
        if (connection !== rootConnection) {
          await connection.end();
        }
      }
    }

    console.log('Migrations completed successfully.');
  } finally {
    await rootConnection.end();
  }
}

runMigrations().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});
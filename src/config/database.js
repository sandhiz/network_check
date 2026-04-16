const mysql = require('mysql2/promise');

const { env } = require('./environment');

let pool;

function getDatabaseConfig(includeDatabase = true) {
  return {
    host: env.dbHost,
    user: env.dbUser,
    password: env.dbPassword,
    port: env.dbPort,
    database: includeDatabase ? env.dbName : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: 'Z'
  };
}

function getPool() {
  if (!pool) {
    pool = mysql.createPool(getDatabaseConfig(true));
  }

  return pool;
}

async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

async function ensureDatabaseConnection() {
  const connection = await getPool().getConnection();
  connection.release();
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

module.exports = {
  closePool,
  ensureDatabaseConnection,
  getDatabaseConfig,
  getPool,
  query
};
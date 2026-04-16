function toNumber(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toNumber(process.env.PORT, 3000),
  dbHost: process.env.DB_HOST || 'localhost',
  dbUser: process.env.DB_USER || 'root',
  dbPassword: process.env.DB_PASSWORD || '',
  dbName: process.env.DB_NAME || 'netwatch_db',
  dbPort: toNumber(process.env.DB_PORT, 3306),
  defaultPingInterval: toNumber(process.env.DEFAULT_PING_INTERVAL, 60),
  pingTimeout: toNumber(process.env.PING_TIMEOUT, 5000),
  maxConcurrentPings: Math.max(1, toNumber(process.env.MAX_CONCURRENT_PINGS, 50)),
  schedulerTickSeconds: Math.max(1, toNumber(process.env.SCHEDULER_TICK_SECONDS, 5)),
  logRetentionDays: Math.max(1, toNumber(process.env.LOG_RETENTION_DAYS, 90)),
  maxScanHosts: Math.max(1, toNumber(process.env.MAX_SCAN_HOSTS, 256)),
  scanConcurrency: Math.max(1, toNumber(process.env.SCAN_CONCURRENCY, 32)),
  importMaxRows: Math.max(1, toNumber(process.env.IMPORT_MAX_ROWS, 1000)),
  uploadMaxFileSize: Math.max(1024 * 100, toNumber(process.env.UPLOAD_MAX_FILE_SIZE, 1024 * 1024 * 2))
};

module.exports = {
  env
};
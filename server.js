require('dotenv').config();

const http = require('http');

const { createApp } = require('./src/app');
const { ensureDatabaseConnection, closePool } = require('./src/config/database');
const { env } = require('./src/config/environment');
const { createSocketServer } = require('./src/socket/events');
const { scheduler } = require('./src/services/scheduler.service');

async function startServer() {
  await ensureDatabaseConnection();

  const app = createApp();
  const server = http.createServer(app);
  const io = createSocketServer(server, {
    getMonitorState: () => scheduler.getState()
  });

  app.set('io', io);
  app.set('scheduler', scheduler);
  scheduler.attach(io);
  await scheduler.start();

  server.listen(env.port, () => {
    console.log(`NetWatch listening on http://localhost:${env.port}`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down NetWatch.`);
    await scheduler.stop();
    io.close();
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

startServer().catch(async (error) => {
  console.error('Failed to start NetWatch:', error.message);
  await closePool();
  process.exit(1);
});
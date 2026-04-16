const express = require('express');
const path = require('path');

const hostRoutes = require('./routes/host.routes');
const logRoutes = require('./routes/log.routes');
const monitorRoutes = require('./routes/monitor.routes');
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');

function createApp() {
  const app = express();
  const publicDir = path.join(__dirname, '..', 'public');

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(publicDir));

  app.get('/health', (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString()
      }
    });
  });

  app.get('/hosts', (req, res) => {
    res.sendFile(path.join(publicDir, 'hosts.html'));
  });

  app.get('/detail', (req, res) => {
    res.sendFile(path.join(publicDir, 'detail.html'));
  });

  app.use('/api/hosts', hostRoutes);
  app.use('/api/monitor', monitorRoutes);
  app.use('/api', logRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp
};
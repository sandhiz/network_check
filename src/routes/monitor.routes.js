const express = require('express');

const {
  getMonitorState,
  pauseMonitoring,
  resumeMonitoring
} = require('../controllers/monitor.controller');

const router = express.Router();

router.get('/state', getMonitorState);
router.post('/pause', pauseMonitoring);
router.post('/resume', resumeMonitoring);

module.exports = router;
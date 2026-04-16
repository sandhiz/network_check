const express = require('express');

const { exportLogs, getLogs, getLogsByHost, getStats } = require('../controllers/log.controller');

const router = express.Router();

router.get('/logs/export', exportLogs);
router.get('/logs', getLogs);
router.get('/logs/host/:id', getLogsByHost);
router.get('/stats', getStats);

module.exports = router;
const express = require('express');
const multer = require('multer');

const { env } = require('../config/environment');

const {
  createHostRecord,
  deleteHostRecord,
  exportHostsReport,
  getHost,
  getDetectedNetworks,
  getHosts,
  importHostsRecord,
  manualPing,
  saveBulkHostsRecord,
  scanHostsInNetwork,
  toggleHostRecord,
  updateHostRecord
} = require('../controllers/host.controller');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.uploadMaxFileSize
  }
});

router.get('/', getHosts);
router.get('/export', exportHostsReport);
router.get('/scan/networks', getDetectedNetworks);
router.post('/import', upload.single('file'), importHostsRecord);
router.post('/bulk', saveBulkHostsRecord);
router.post('/scan', scanHostsInNetwork);
router.post('/', createHostRecord);
router.get('/:id', getHost);
router.put('/:id', updateHostRecord);
router.delete('/:id', deleteHostRecord);
router.post('/:id/ping', manualPing);
router.patch('/:id/toggle', toggleHostRecord);

module.exports = router;
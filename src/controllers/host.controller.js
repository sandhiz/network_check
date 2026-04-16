const { asyncHandler } = require('../middleware/async-handler');
const { createHttpError, sendSuccess } = require('../utils/http');
const { env } = require('../config/environment');
const { importHostsFromBuffer } = require('../services/import.service');
const { buildHostsCsv } = require('../services/report.service');
const { getLocalNetworks, scanNetwork } = require('../services/scan.service');
const { normalizeBoolean, normalizeText, validateHostPayload, validatePagination } = require('../utils/validators');
const {
  createHost,
  deleteHost,
  getHostById,
  insertHostsBatch,
  listHosts,
  toggleHost,
  updateHost
} = require('../services/host.service');
const { listLogs } = require('../services/log.service');
const { pingHostById } = require('../services/ping.service');
const { getHostUptimeStats } = require('../services/stats.service');
const {
  broadcastPingResult,
  broadcastScanCompleted,
  broadcastScanFailed,
  broadcastScanProgress,
  broadcastScanStarted
} = require('../socket/events');

function parseHostFilters(query) {
  const activeValue = normalizeText(query.isActive, 10);

  return {
    search: normalizeText(query.search, 100),
    status: normalizeText(query.status, 20),
    isActive: activeValue === null || activeValue === 'all' ? null : normalizeBoolean(activeValue, 1),
    groupName: normalizeText(query.groupName, 100),
    ownerTeam: normalizeText(query.ownerTeam, 100),
    ownerName: normalizeText(query.ownerName, 100)
  };
}

const getHosts = asyncHandler(async (req, res) => {
  const hosts = await listHosts(parseHostFilters(req.query));
  return sendSuccess(res, hosts);
});

const getHost = asyncHandler(async (req, res) => {
  const hostId = Number.parseInt(req.params.id, 10);
  const host = await getHostById(hostId);

  if (!host) {
    throw createHttpError(404, 'Host tidak ditemukan.');
  }

  const stats = await getHostUptimeStats(hostId);
  const recentLogs = await listLogs({
    ...validatePagination({ page: 1, pageSize: 10 }),
    hostId,
    status: req.query.status || null,
    from: null,
    to: null
  });

  return sendSuccess(res, {
    ...host,
    uptime: stats,
    recentLogs: recentLogs.rows
  });
});

const createHostRecord = asyncHandler(async (req, res) => {
  const validation = validateHostPayload(req.body);

  if (validation.errors.length) {
    throw createHttpError(400, 'Payload host tidak valid.', validation.errors);
  }

  try {
    const host = await createHost(validation.value);
    return sendSuccess(res, host, 'Host berhasil dibuat.', 201);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw createHttpError(409, 'IP address atau hostname sudah terdaftar.');
    }

    throw error;
  }
});

const updateHostRecord = asyncHandler(async (req, res) => {
  const hostId = Number.parseInt(req.params.id, 10);
  const existingHost = await getHostById(hostId);

  if (!existingHost) {
    throw createHttpError(404, 'Host tidak ditemukan.');
  }

  const validation = validateHostPayload(req.body);

  if (validation.errors.length) {
    throw createHttpError(400, 'Payload host tidak valid.', validation.errors);
  }

  try {
    const host = await updateHost(hostId, validation.value);
    return sendSuccess(res, host, 'Host berhasil diperbarui.');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw createHttpError(409, 'IP address atau hostname sudah terdaftar.');
    }

    throw error;
  }
});

const deleteHostRecord = asyncHandler(async (req, res) => {
  const hostId = Number.parseInt(req.params.id, 10);
  const affectedRows = await deleteHost(hostId);

  if (!affectedRows) {
    throw createHttpError(404, 'Host tidak ditemukan.');
  }

  return sendSuccess(res, { id: hostId }, 'Host berhasil dihapus.');
});

const toggleHostRecord = asyncHandler(async (req, res) => {
  const hostId = Number.parseInt(req.params.id, 10);
  const existingHost = await getHostById(hostId);

  if (!existingHost) {
    throw createHttpError(404, 'Host tidak ditemukan.');
  }

  const host = await toggleHost(hostId);
  return sendSuccess(res, host, host.is_active ? 'Ping otomatis host dijalankan kembali.' : 'Ping otomatis host dihentikan.');
});

const manualPing = asyncHandler(async (req, res) => {
  const hostId = Number.parseInt(req.params.id, 10);
  const result = await pingHostById(hostId);
  const io = req.app.get('io');

  if (io) {
    await broadcastPingResult(io, result);
  }

  return sendSuccess(res, result, 'Manual ping selesai dijalankan.');
});

const importHostsRecord = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw createHttpError(400, 'File import wajib diunggah.');
  }

  const result = await importHostsFromBuffer(req.file.buffer, req.file.originalname);
  return sendSuccess(res, result, 'Import host selesai dijalankan.');
});

const saveBulkHostsRecord = asyncHandler(async (req, res) => {
  const hosts = Array.isArray(req.body.hosts) ? req.body.hosts : [];
  const defaults = req.body.defaults || {};

  if (!hosts.length) {
    throw createHttpError(400, 'Daftar host yang akan disimpan kosong.');
  }

  const validHosts = [];
  const invalid = [];

  hosts.forEach((host, index) => {
    const mergedPayload = {
      description: defaults.description,
      group_name: defaults.group_name,
      owner_name: defaults.owner_name,
      owner_team: defaults.owner_team,
      ping_interval: defaults.ping_interval,
      is_active: defaults.is_active,
      ...host
    };
    const validation = validateHostPayload(mergedPayload, {
      defaultLabelFromIp: true,
      defaultPingInterval: env.defaultPingInterval,
      defaultIsActive: 1
    });

    if (validation.errors.length) {
      invalid.push({
        row: index + 1,
        ip_address: normalizeText(mergedPayload.ip_address, 191),
        errors: validation.errors
      });
      return;
    }

    validHosts.push(validation.value);
  });

  const batchResult = await insertHostsBatch(validHosts);

  return sendSuccess(res, {
    ...batchResult,
    invalidCount: invalid.length,
    invalid
  }, 'Host hasil scan berhasil diproses.');
});

const exportHostsReport = asyncHandler(async (req, res) => {
  const hosts = await listHosts(parseHostFilters(req.query));
  const csvContent = buildHostsCsv(hosts);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="netwatch-hosts-report.csv"');
  res.send(csvContent);
});

const getDetectedNetworks = asyncHandler(async (req, res) => {
  return sendSuccess(res, getLocalNetworks());
});

const scanHostsInNetwork = asyncHandler(async (req, res) => {
  const subnet = normalizeText(req.body.subnet || req.body.cidr, 50);
  const socketId = normalizeText(req.body.socketId, 120);
  const requestId = normalizeText(req.body.requestId, 120) || `scan-${Date.now()}`;
  const io = req.app.get('io');

  if (!subnet) {
    throw createHttpError(400, 'Subnet atau CIDR wajib diisi.');
  }

  try {
    const result = await scanNetwork(subnet, {
      onStart(payload) {
        broadcastScanStarted(io, socketId, {
          requestId,
          ...payload
        });
      },
      onProgress(payload) {
        broadcastScanProgress(io, socketId, {
          requestId,
          ...payload
        });
      },
      onComplete(payload) {
        broadcastScanCompleted(io, socketId, {
          requestId,
          ...payload
        });
      }
    });

    return sendSuccess(res, {
      requestId,
      ...result
    }, 'Scan subnet selesai dijalankan.');
  } catch (error) {
    broadcastScanFailed(io, socketId, {
      requestId,
      cidr: subnet,
      message: error.message || 'Scan subnet gagal dijalankan.'
    });
    throw error;
  }
});

module.exports = {
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
};
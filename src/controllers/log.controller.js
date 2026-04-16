const { asyncHandler } = require('../middleware/async-handler');
const { sendSuccess } = require('../utils/http');
const { buildLogsCsv } = require('../services/report.service');
const { normalizeText, validatePagination } = require('../utils/validators');
const { listLogs, listLogsForExport } = require('../services/log.service');
const { getGlobalStats } = require('../services/stats.service');

function parseLogFilters(query, params = {}) {
  return {
    hostId: params.hostId || (query.hostId ? Number.parseInt(query.hostId, 10) : null),
    status: normalizeText(query.status, 20),
    from: normalizeText(query.from, 30),
    to: normalizeText(query.to, 30),
    search: normalizeText(query.search, 100)
  };
}

const getLogs = asyncHandler(async (req, res) => {
  const pagination = validatePagination(req.query);
  const payload = await listLogs({
    ...pagination,
    ...parseLogFilters(req.query)
  });

  return sendSuccess(res, payload);
});

const getLogsByHost = asyncHandler(async (req, res) => {
  const pagination = validatePagination(req.query);
  const payload = await listLogs({
    ...pagination,
    ...parseLogFilters(req.query, { hostId: Number.parseInt(req.params.id, 10) })
  });

  return sendSuccess(res, payload);
});

const exportLogs = asyncHandler(async (req, res) => {
  const logs = await listLogsForExport(parseLogFilters(req.query));
  const csvContent = buildLogsCsv(logs);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="netwatch-logs-report.csv"');
  res.send(csvContent);
});

const getStats = asyncHandler(async (req, res) => {
  const stats = await getGlobalStats();
  return sendSuccess(res, stats);
});

module.exports = {
  exportLogs,
  getLogs,
  getLogsByHost,
  getStats
};
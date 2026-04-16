const { env } = require('../config/environment');
const { query } = require('../config/database');

async function createPingLog(payload) {
  await query(
    `INSERT INTO ping_logs (host_id, status, latency_ms, packet_loss, error_msg, pinged_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      payload.hostId,
      payload.status,
      payload.latencyMs,
      payload.packetLoss,
      payload.errorMessage,
      payload.pingedAt
    ]
  );
}

async function listLogs(filters) {
  const conditions = [];
  const params = [];

  if (filters.hostId) {
    conditions.push('pl.host_id = ?');
    params.push(filters.hostId);
  }

  if (filters.status) {
    conditions.push('pl.status = ?');
    params.push(filters.status);
  }

  if (filters.from) {
    conditions.push('pl.pinged_at >= ?');
    params.push(filters.from);
  }

  if (filters.to) {
    conditions.push('pl.pinged_at <= ?');
    params.push(filters.to);
  }

  if (filters.search) {
    const likeValue = `%${filters.search}%`;
    conditions.push(`(
      h.label LIKE ?
      OR h.ip_address LIKE ?
      OR COALESCE(h.owner_name, '') LIKE ?
      OR COALESCE(h.owner_team, '') LIKE ?
      OR COALESCE(h.group_name, '') LIKE ?
    )`);
    params.push(likeValue, likeValue, likeValue, likeValue, likeValue);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countRows = await query(
    `SELECT COUNT(*) AS total
     FROM ping_logs pl
     INNER JOIN hosts h ON h.id = pl.host_id
     ${whereClause}`,
    params
  );

  const rows = await query(
    `SELECT
        pl.id,
        pl.host_id,
        h.label,
        h.ip_address,
        pl.status,
        pl.latency_ms,
        pl.packet_loss,
        pl.error_msg,
        pl.pinged_at
      FROM ping_logs pl
      INNER JOIN hosts h ON h.id = pl.host_id
      ${whereClause}
      ORDER BY pl.pinged_at DESC
      LIMIT ? OFFSET ?`,
    [...params, filters.pageSize, filters.offset]
  );

  return {
    rows,
    total: countRows[0]?.total || 0,
    page: filters.page,
    pageSize: filters.pageSize
  };
}

async function listLogsForExport(filters) {
  const payload = await listLogs({
    ...filters,
    page: 1,
    pageSize: 100000,
    offset: 0
  });

  return payload.rows;
}

async function deleteExpiredLogs(retentionDays = env.logRetentionDays) {
  const safeDays = Math.max(1, Number.parseInt(retentionDays, 10) || env.logRetentionDays);
  const result = await query(
    `DELETE FROM ping_logs
     WHERE pinged_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${safeDays} DAY)`
  );

  return result.affectedRows || 0;
}

module.exports = {
  createPingLog,
  deleteExpiredLogs,
  listLogs,
  listLogsForExport
};
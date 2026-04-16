const { query } = require('../config/database');

function toPercentage(upCount, totalCount) {
  if (!totalCount) {
    return 0;
  }

  return Number(((upCount / totalCount) * 100).toFixed(2));
}

async function getGlobalStats() {
  const rows = await query(
    `SELECT
        COUNT(*) AS totalHosts,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS activeHosts,
        SUM(CASE WHEN last_status = 'up' THEN 1 ELSE 0 END) AS upCount,
        SUM(CASE WHEN last_status = 'down' THEN 1 ELSE 0 END) AS downCount,
        SUM(CASE WHEN last_status = 'unknown' THEN 1 ELSE 0 END) AS unknownCount
      FROM hosts`
  );

  return {
    totalHosts: rows[0]?.totalHosts || 0,
    activeHosts: rows[0]?.activeHosts || 0,
    upCount: rows[0]?.upCount || 0,
    downCount: rows[0]?.downCount || 0,
    unknownCount: rows[0]?.unknownCount || 0
  };
}

async function getHostUptimeStats(hostId) {
  const rows = await query(
    `SELECT
        SUM(CASE WHEN pinged_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY) AND status = 'up' THEN 1 ELSE 0 END) AS up24,
        SUM(CASE WHEN pinged_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY) THEN 1 ELSE 0 END) AS total24,
        SUM(CASE WHEN pinged_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY) AND status = 'up' THEN 1 ELSE 0 END) AS up7,
        SUM(CASE WHEN pinged_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS total7,
        SUM(CASE WHEN pinged_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY) AND status = 'up' THEN 1 ELSE 0 END) AS up30,
        SUM(CASE WHEN pinged_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS total30
      FROM ping_logs
      WHERE host_id = ?`,
    [hostId]
  );

  const result = rows[0] || {};

  return {
    last24Hours: {
      uptimePercentage: toPercentage(result.up24 || 0, result.total24 || 0),
      samples: result.total24 || 0
    },
    last7Days: {
      uptimePercentage: toPercentage(result.up7 || 0, result.total7 || 0),
      samples: result.total7 || 0
    },
    last30Days: {
      uptimePercentage: toPercentage(result.up30 || 0, result.total30 || 0),
      samples: result.total30 || 0
    }
  };
}

module.exports = {
  getGlobalStats,
  getHostUptimeStats
};
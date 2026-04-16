const { getPool, query } = require('../config/database');

const BASE_HOST_FIELDS = `
  id,
  label,
  ip_address,
  description,
  group_name,
  ping_interval,
  is_active,
  last_status,
  last_ping_at,
  last_latency,
  owner_name,
  owner_team,
  detected_hostname,
  created_at,
  updated_at
`;

function buildHostWhereClause(filters = {}) {
  const conditions = [];
  const params = [];

  if (filters.status) {
    conditions.push('last_status = ?');
    params.push(filters.status);
  }

  if (filters.isActive !== undefined && filters.isActive !== null) {
    conditions.push('is_active = ?');
    params.push(filters.isActive);
  }

  if (filters.groupName) {
    conditions.push('group_name = ?');
    params.push(filters.groupName);
  }

  if (filters.ownerTeam) {
    conditions.push('owner_team = ?');
    params.push(filters.ownerTeam);
  }

  if (filters.ownerName) {
    conditions.push('owner_name = ?');
    params.push(filters.ownerName);
  }

  if (filters.search) {
    const likeValue = `%${filters.search}%`;
    conditions.push(`(
      label LIKE ?
      OR ip_address LIKE ?
      OR COALESCE(group_name, '') LIKE ?
      OR COALESCE(owner_name, '') LIKE ?
      OR COALESCE(owner_team, '') LIKE ?
      OR COALESCE(detected_hostname, '') LIKE ?
    )`);
    params.push(likeValue, likeValue, likeValue, likeValue, likeValue, likeValue);
  }

  return {
    whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  };
}

async function listHosts(filters = {}) {
  const { whereClause, params } = buildHostWhereClause(filters);
  return query(
    `SELECT ${BASE_HOST_FIELDS}
     FROM hosts
     ${whereClause}
     ORDER BY label ASC, ip_address ASC`,
    params
  );
}

async function getHostById(hostId) {
  const rows = await query(
    `SELECT ${BASE_HOST_FIELDS}
     FROM hosts
     WHERE id = ?`,
    [hostId]
  );

  return rows[0] || null;
}

async function getHostsByIds(hostIds) {
  if (!hostIds.length) {
    return [];
  }

  const placeholders = hostIds.map(() => '?').join(', ');
  return query(
    `SELECT ${BASE_HOST_FIELDS}
     FROM hosts
     WHERE id IN (${placeholders})
     ORDER BY label ASC, ip_address ASC`,
    hostIds
  );
}

async function createHost(payload) {
  const result = await query(
    `INSERT INTO hosts (
        label,
        ip_address,
        description,
        group_name,
        ping_interval,
        is_active,
        owner_name,
        owner_team
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.label,
      payload.ip_address,
      payload.description,
      payload.group_name,
      payload.ping_interval,
      payload.is_active,
      payload.owner_name,
      payload.owner_team
    ]
  );

  return getHostById(result.insertId);
}

async function updateHost(hostId, payload) {
  await query(
    `UPDATE hosts
     SET
        label = ?,
        ip_address = ?,
        description = ?,
        group_name = ?,
        ping_interval = ?,
        is_active = ?,
        owner_name = ?,
        owner_team = ?
     WHERE id = ?`,
    [
      payload.label,
      payload.ip_address,
      payload.description,
      payload.group_name,
      payload.ping_interval,
      payload.is_active,
      payload.owner_name,
      payload.owner_team,
      hostId
    ]
  );

  return getHostById(hostId);
}

async function deleteHost(hostId) {
  const result = await query('DELETE FROM hosts WHERE id = ?', [hostId]);
  return result.affectedRows || 0;
}

async function toggleHost(hostId) {
  await query(
    `UPDATE hosts
     SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END
     WHERE id = ?`,
    [hostId]
  );

  return getHostById(hostId);
}

async function findHostsByAddresses(addresses) {
  if (!addresses.length) {
    return [];
  }

  const placeholders = addresses.map(() => '?').join(', ');
  return query(
    `SELECT ${BASE_HOST_FIELDS}
     FROM hosts
     WHERE ip_address IN (${placeholders})`,
    addresses
  );
}

async function insertHostsBatch(hostPayloads) {
  if (!hostPayloads.length) {
    return {
      inserted: [],
      skipped: [],
      insertedCount: 0,
      skippedCount: 0
    };
  }

  const seenAddresses = new Set();
  const uniquePayloads = [];
  const skipped = [];

  hostPayloads.forEach((payload) => {
    const key = payload.ip_address.toLowerCase();

    if (seenAddresses.has(key)) {
      skipped.push({
        ip_address: payload.ip_address,
        reason: 'Duplikat pada batch import atau hasil scan.'
      });
      return;
    }

    seenAddresses.add(key);
    uniquePayloads.push(payload);
  });

  const existingHosts = await findHostsByAddresses(uniquePayloads.map((payload) => payload.ip_address));
  const existingAddresses = new Set(existingHosts.map((row) => row.ip_address.toLowerCase()));
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const insertedIds = [];

    for (const payload of uniquePayloads) {
      if (existingAddresses.has(payload.ip_address.toLowerCase())) {
        skipped.push({
          ip_address: payload.ip_address,
          reason: 'IP address atau hostname sudah terdaftar.'
        });
        continue;
      }

      const [result] = await connection.execute(
        `INSERT INTO hosts (
            label,
            ip_address,
            description,
            group_name,
            ping_interval,
            is_active,
            owner_name,
            owner_team
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.label,
          payload.ip_address,
          payload.description,
          payload.group_name,
          payload.ping_interval,
          payload.is_active,
          payload.owner_name,
          payload.owner_team
        ]
      );

      insertedIds.push(result.insertId);
    }

    await connection.commit();

    return {
      inserted: await getHostsByIds(insertedIds),
      skipped,
      insertedCount: insertedIds.length,
      skippedCount: skipped.length
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listDueHosts(limit) {
  return query(
    `SELECT ${BASE_HOST_FIELDS}
     FROM hosts
     WHERE is_active = 1
       AND (
         last_ping_at IS NULL
         OR TIMESTAMPDIFF(SECOND, last_ping_at, UTC_TIMESTAMP()) >= ping_interval
       )
     ORDER BY COALESCE(last_ping_at, '1970-01-01 00:00:00') ASC
     LIMIT ?`,
    [limit]
  );
}

async function updateHostAfterPing(hostId, payload) {
  await query(
    `UPDATE hosts
     SET
        last_status = ?,
        last_ping_at = ?,
        last_latency = ?,
        detected_hostname = COALESCE(?, detected_hostname)
     WHERE id = ?`,
    [payload.status, payload.pingedAt, payload.latencyMs, payload.detectedHostname, hostId]
  );

  return getHostById(hostId);
}

module.exports = {
  createHost,
  deleteHost,
  findHostsByAddresses,
  getHostById,
  getHostsByIds,
  insertHostsBatch,
  listDueHosts,
  listHosts,
  toggleHost,
  updateHost,
  updateHostAfterPing
};
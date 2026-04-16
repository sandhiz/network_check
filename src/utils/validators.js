const net = require('net');

const { env } = require('../config/environment');

const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*$/i;

function isValidHost(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();
  return Boolean(net.isIP(trimmed) || HOSTNAME_PATTERN.test(trimmed));
}

function normalizeText(value, maxLength) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalized = String(value).trim();

  if (!normalized) {
    return null;
  }

  if (maxLength && normalized.length > maxLength) {
    return normalized.slice(0, maxLength);
  }

  return normalized;
}

function normalizeBoolean(value, fallback = 1) {
  if (value === undefined || value === null || value === '') {
    return Number(fallback ? 1 : 0);
  }

  if (typeof value === 'boolean') {
    return Number(value);
  }

  if (typeof value === 'number') {
    return Number(value ? 1 : 0);
  }

  const normalized = String(value).trim().toLowerCase();

  if (['1', 'true', 'yes', 'y', 'aktif', 'active'].includes(normalized)) {
    return 1;
  }

  if (['0', 'false', 'no', 'n', 'nonaktif', 'inactive'].includes(normalized)) {
    return 0;
  }

  return Number(fallback ? 1 : 0);
}

function validateHostPayload(payload, options = {}) {
  const errors = [];
  const ipAddress = normalizeText(payload.ip_address, 191);
  const label = normalizeText(payload.label, 100) || (options.defaultLabelFromIp && ipAddress ? ipAddress : null);
  const description = normalizeText(payload.description, 2000);
  const groupName = normalizeText(payload.group_name, 100);
  const ownerName = normalizeText(payload.owner_name, 100);
  const ownerTeam = normalizeText(payload.owner_team, 100);
  const pingInterval = Number.parseInt(
    payload.ping_interval === undefined || payload.ping_interval === null || payload.ping_interval === ''
      ? options.defaultPingInterval ?? env.defaultPingInterval
      : payload.ping_interval,
    10
  );
  const isActive = normalizeBoolean(payload.is_active, options.defaultIsActive ?? 1);

  if (!label) {
    errors.push('Label wajib diisi.');
  }

  if (!ipAddress) {
    errors.push('IP address atau hostname wajib diisi.');
  } else if (!isValidHost(ipAddress)) {
    errors.push('Format IP address atau hostname tidak valid.');
  }

  if (!Number.isFinite(pingInterval) || pingInterval < 10 || pingInterval > 3600) {
    errors.push('Ping interval harus di antara 10 sampai 3600 detik.');
  }

  return {
    errors,
    value: {
      label,
      ip_address: ipAddress,
      description,
      group_name: groupName,
      owner_name: ownerName,
      owner_team: ownerTeam,
      ping_interval: pingInterval,
      is_active: isActive
    }
  };
}

function validatePagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize, 10) || 25));
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize
  };
}

module.exports = {
  isValidHost,
  normalizeBoolean,
  normalizeText,
  validateHostPayload,
  validatePagination
};
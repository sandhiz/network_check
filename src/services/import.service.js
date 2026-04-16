const path = require('path');

const { parse } = require('csv-parse/sync');
const readXlsxFile = require('read-excel-file/node');

const { env } = require('../config/environment');
const { insertHostsBatch } = require('./host.service');
const { normalizeText, validateHostPayload } = require('../utils/validators');

const COLUMN_ALIASES = {
  label: ['label', 'name', 'nama', 'computer_name', 'device_name'],
  ip_address: ['ip', 'ip_address', 'ipaddress', 'address', 'alamat', 'hostname', 'host'],
  owner_name: ['owner', 'pemilik', 'pic', 'user', 'username'],
  owner_team: ['team', 'owner_team', 'divisi', 'department', 'departemen'],
  group_name: ['group', 'group_name', 'kategori', 'category'],
  ping_interval: ['ping_interval', 'interval', 'interval_ping', 'pinginterval'],
  description: ['description', 'deskripsi', 'desc', 'keterangan'],
  is_active: ['is_active', 'active', 'aktif', 'enabled']
};

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeRow(row) {
  return Object.entries(row).reduce((accumulator, [key, value]) => {
    accumulator[normalizeHeader(key)] = value;
    return accumulator;
  }, {});
}

function pickValue(row, aliases) {
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null && row[alias] !== '') {
      return row[alias];
    }
  }

  return undefined;
}

function isEmptyMappedRow(mappedRow) {
  return Object.values(mappedRow).every((value) => value === undefined || value === null || String(value).trim() === '');
}

function rowsFromWorksheet(worksheetRows) {
  const [headerRow, ...dataRows] = worksheetRows;

  if (!headerRow || !headerRow.length) {
    return [];
  }

  const headers = headerRow.map((header) => normalizeHeader(header));
  return dataRows.map((row) => {
    return headers.reduce((accumulator, header, index) => {
      accumulator[header] = row[index] === undefined || row[index] === null ? '' : row[index];
      return accumulator;
    }, {});
  });
}

async function importHostsFromBuffer(buffer, fileName = '') {
  const extension = path.extname(fileName).toLowerCase();
  let rows;

  if (extension === '.csv') {
    rows = parse(buffer, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
  } else if (extension === '.xlsx') {
    rows = rowsFromWorksheet(await readXlsxFile(buffer));
  } else {
    throw new Error('Format file import harus .xlsx atau .csv.');
  }

  if (!rows.length) {
    throw new Error('File import tidak memiliki baris data.');
  }

  if (rows.length > env.importMaxRows) {
    throw new Error(`Jumlah baris melebihi batas import ${env.importMaxRows} baris.`);
  }

  const validHosts = [];
  const invalid = [];

  rows.forEach((row, index) => {
    const normalized = normalizeRow(row);
    const mappedRow = {
      label: pickValue(normalized, COLUMN_ALIASES.label),
      ip_address: pickValue(normalized, COLUMN_ALIASES.ip_address),
      owner_name: pickValue(normalized, COLUMN_ALIASES.owner_name),
      owner_team: pickValue(normalized, COLUMN_ALIASES.owner_team),
      group_name: pickValue(normalized, COLUMN_ALIASES.group_name),
      ping_interval: pickValue(normalized, COLUMN_ALIASES.ping_interval),
      description: pickValue(normalized, COLUMN_ALIASES.description),
      is_active: pickValue(normalized, COLUMN_ALIASES.is_active)
    };

    if (isEmptyMappedRow(mappedRow)) {
      return;
    }

    const validation = validateHostPayload(mappedRow, {
      defaultLabelFromIp: true,
      defaultPingInterval: env.defaultPingInterval,
      defaultIsActive: 1
    });

    if (validation.errors.length) {
      invalid.push({
        row: index + 2,
        ip_address: normalizeText(mappedRow.ip_address, 191),
        errors: validation.errors
      });
      return;
    }

    validHosts.push(validation.value);
  });

  const batchResult = await insertHostsBatch(validHosts);

  return {
    totalRows: rows.length,
    validRows: validHosts.length,
    invalidCount: invalid.length,
    invalid,
    insertedCount: batchResult.insertedCount,
    skippedCount: batchResult.skippedCount,
    inserted: batchResult.inserted,
    skipped: batchResult.skipped
  };
}

module.exports = {
  importHostsFromBuffer
};
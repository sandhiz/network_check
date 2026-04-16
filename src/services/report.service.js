function escapeCsvValue(value) {
  const normalized = value === undefined || value === null ? '' : String(value);

  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function buildCsv(headers, rows) {
  const headerRow = headers.map((header) => escapeCsvValue(header.label)).join(',');
  const dataRows = rows.map((row) => headers.map((header) => escapeCsvValue(header.value(row))).join(','));
  return [headerRow, ...dataRows].join('\n');
}

function buildHostsCsv(hosts) {
  return buildCsv(
    [
      { label: 'Label', value: (row) => row.label },
      { label: 'IP Address', value: (row) => row.ip_address },
      { label: 'Owner', value: (row) => row.owner_name || '' },
      { label: 'Team', value: (row) => row.owner_team || '' },
      { label: 'Group', value: (row) => row.group_name || '' },
      { label: 'Status', value: (row) => row.last_status },
      { label: 'Monitoring Active', value: (row) => (row.is_active ? 'yes' : 'no') },
      { label: 'Ping Interval', value: (row) => row.ping_interval },
      { label: 'Detected Hostname', value: (row) => row.detected_hostname || '' },
      { label: 'Last Latency', value: (row) => row.last_latency ?? '' },
      { label: 'Last Ping At', value: (row) => row.last_ping_at ? new Date(row.last_ping_at).toISOString() : '' },
      { label: 'Description', value: (row) => row.description || '' }
    ],
    hosts
  );
}

function buildLogsCsv(logs) {
  return buildCsv(
    [
      { label: 'Timestamp', value: (row) => new Date(row.pinged_at).toISOString() },
      { label: 'Host', value: (row) => row.label },
      { label: 'IP Address', value: (row) => row.ip_address },
      { label: 'Status', value: (row) => row.status },
      { label: 'Latency (ms)', value: (row) => row.latency_ms ?? '' },
      { label: 'Packet Loss (%)', value: (row) => row.packet_loss },
      { label: 'Error Message', value: (row) => row.error_msg || '' }
    ],
    logs
  );
}

module.exports = {
  buildHostsCsv,
  buildLogsCsv
};
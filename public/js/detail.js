const detailState = {
  host: null,
  logs: [],
  subscribedHostId: null
};

function getHostIdFromQuery() {
  const search = new URLSearchParams(window.location.search);
  return Number.parseInt(search.get('id'), 10);
}

function statusBadge(status) {
  return `<span class="status-pill status-${status}">${status}</span>`;
}

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('id-ID');
}

function buildQuery(params) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      query.set(key, value);
    }
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error?.message || 'Request gagal.');
  }

  return payload.data;
}

function setDetailMessage(text, tone = 'muted') {
  const element = document.getElementById('detailMessage');
  element.textContent = text;
  element.className = `inline-message is-${tone}`;
}

function setButtonLoading(button, isLoading, loadingLabel) {
  if (!button) {
    return;
  }

  if (!button.dataset.defaultLabel) {
    button.dataset.defaultLabel = button.textContent.trim();
  }

  button.disabled = isLoading;
  button.classList.toggle('is-loading', isLoading);
  button.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  button.textContent = isLoading ? loadingLabel : button.dataset.defaultLabel;
}

async function runButtonAction(button, loadingLabel, action) {
  if (button?.dataset.busy === 'true') {
    return;
  }

  if (button) {
    button.dataset.busy = 'true';
    setButtonLoading(button, true, loadingLabel);
  }

  try {
    return await action();
  } finally {
    if (button) {
      button.dataset.busy = 'false';
      setButtonLoading(button, false);
    }
  }
}

function getCurrentLogFilters() {
  const fromValue = document.getElementById('logFromFilter').value;
  const toValue = document.getElementById('logToFilter').value;

  return {
    status: document.getElementById('logStatusFilter').value,
    from: fromValue ? new Date(fromValue).toISOString() : '',
    to: toValue ? new Date(toValue).toISOString() : ''
  };
}

function renderMetadata(host) {
  document.getElementById('detailTitle').textContent = host.label;
  document.getElementById('hostMetadata').innerHTML = `
    <div><dt>Status</dt><dd>${statusBadge(host.last_status)}</dd></div>
    <div><dt>Monitoring</dt><dd>${host.is_active ? 'Auto ping aktif' : 'Auto ping stop'}</dd></div>
    <div><dt>IP / Hostname</dt><dd>${host.ip_address}</dd></div>
    <div><dt>Pemilik</dt><dd>${host.owner_name || '-'}</dd></div>
    <div><dt>Divisi</dt><dd>${host.owner_team || '-'}</dd></div>
    <div><dt>Group</dt><dd>${host.group_name || '-'}</dd></div>
    <div><dt>Detected Hostname</dt><dd>${host.detected_hostname || '-'}</dd></div>
    <div><dt>Last Ping</dt><dd>${formatDateTime(host.last_ping_at)}</dd></div>
    <div><dt>Last Latency</dt><dd>${host.last_latency ? `${Number(host.last_latency).toFixed(2)} ms` : '-'}</dd></div>
  `;

  document.getElementById('toggleHostButton').dataset.defaultLabel = host.is_active ? 'Stop ping otomatis' : 'Start ping otomatis';
  document.getElementById('toggleHostButton').textContent = document.getElementById('toggleHostButton').dataset.defaultLabel;
}

function renderUptime(host) {
  const uptime = host.uptime || {};
  const items = [
    { label: '24 jam', value: uptime.last24Hours },
    { label: '7 hari', value: uptime.last7Days },
    { label: '30 hari', value: uptime.last30Days }
  ];

  document.getElementById('uptimeCards').innerHTML = items
    .map(
      (item) => `
        <article class="stat-card">
          <span>${item.label}</span>
          <strong>${item.value?.uptimePercentage || 0}%</strong>
          <small class="muted">${item.value?.samples || 0} sampel</small>
        </article>
      `
    )
    .join('');
}

function renderLogs(logs) {
  const tbody = document.getElementById('logsTableBody');

  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Belum ada log ping untuk host ini.</td></tr>';
    return;
  }

  tbody.innerHTML = logs
    .map(
      (log) => `
        <tr>
          <td>${formatDateTime(log.pinged_at)}</td>
          <td>${statusBadge(log.status)}</td>
          <td>${log.latency_ms ? `${Number(log.latency_ms).toFixed(2)} ms` : '-'}</td>
          <td>${log.packet_loss}%</td>
          <td>${log.error_msg || '-'}</td>
        </tr>
      `
    )
    .join('');
}

async function loadDetail(options = {}) {
  const hostId = getHostIdFromQuery();

  if (!hostId) {
    document.getElementById('logsTableBody').innerHTML = '<tr><td colspan="5" class="empty-state">Host ID tidak valid.</td></tr>';
    setDetailMessage('Host ID tidak valid.', 'error');
    return;
  }

  if (options.showLoadingMessage !== false) {
    setDetailMessage('Memuat detail host...', 'muted');
  }

  try {
    const [host, logs] = await Promise.all([
      fetchJson(`/api/hosts/${hostId}`),
      fetchJson(`/api/logs/host/${hostId}${buildQuery({ ...getCurrentLogFilters(), page: 1, pageSize: 50 })}`)
    ]);

    detailState.host = host;
    detailState.logs = logs.rows;
    renderMetadata(host);
    renderUptime(host);
    renderLogs(logs.rows);

    if (detailState.subscribedHostId !== hostId) {
      if (detailState.subscribedHostId) {
        window.NetWatchSocket.unsubscribeFromHost(detailState.subscribedHostId);
      }

      window.NetWatchSocket.subscribeToHost(hostId);
      detailState.subscribedHostId = hostId;
    }

    if (options.successMessage) {
      setDetailMessage(options.successMessage, 'success');
    } else {
      setDetailMessage(`Detail ${host.label} aktif dan sinkron dengan update realtime.`, 'muted');
    }
  } catch (error) {
    setDetailMessage(error.message, 'error');
    throw error;
  }
}

document.getElementById('manualPingButton').addEventListener('click', async () => {
  const button = document.getElementById('manualPingButton');
  const hostId = getHostIdFromQuery();

  try {
    await runButtonAction(button, 'Pinging...', async () => {
      await fetchJson(`/api/hosts/${hostId}/ping`, { method: 'POST' });
      await loadDetail({ successMessage: 'Manual ping selesai dan detail host diperbarui.' });
    });
  } catch {
    // Error message already shown by loadDetail/fetch helpers.
  }
});

document.getElementById('toggleHostButton').addEventListener('click', async () => {
  const button = document.getElementById('toggleHostButton');
  const hostId = getHostIdFromQuery();

  try {
    await runButtonAction(button, 'Memproses...', async () => {
      await fetchJson(`/api/hosts/${hostId}/toggle`, { method: 'PATCH' });
      await loadDetail({ successMessage: 'Status monitoring host berhasil diperbarui.' });
    });
  } catch {
    // Error message already shown by loadDetail/fetch helpers.
  }
});

document.getElementById('applyLogFiltersButton').addEventListener('click', async () => {
  const button = document.getElementById('applyLogFiltersButton');

  try {
    await runButtonAction(button, 'Memuat...', async () => {
      await loadDetail({ successMessage: 'Filter log diterapkan.' });
    });
  } catch {
    // Error message already shown by loadDetail/fetch helpers.
  }
});

document.getElementById('resetLogFiltersButton').addEventListener('click', async () => {
  const button = document.getElementById('resetLogFiltersButton');
  document.getElementById('logStatusFilter').value = 'all';
  document.getElementById('logFromFilter').value = '';
  document.getElementById('logToFilter').value = '';

  try {
    await runButtonAction(button, 'Reset...', async () => {
      await loadDetail({ successMessage: 'Filter log dikembalikan ke default.' });
    });
  } catch {
    // Error message already shown by loadDetail/fetch helpers.
  }
});

document.getElementById('exportHostLogsButton').addEventListener('click', () => {
  const hostId = getHostIdFromQuery();
  setDetailMessage('Menyiapkan export CSV log host...', 'muted');
  window.location.href = `/api/logs/export${buildQuery({ hostId, ...getCurrentLogFilters() })}`;
});

window.NetWatchSocket.on('host:status_detail', () => {
  void loadDetail({ showLoadingMessage: false, successMessage: 'Detail host diperbarui dari event realtime.' });
});

window.NetWatchSocket.on('error:message', (payload) => {
  setDetailMessage(payload.message, 'error');
});

window.addEventListener('beforeunload', () => {
  if (detailState.subscribedHostId) {
    window.NetWatchSocket.unsubscribeFromHost(detailState.subscribedHostId);
  }
});

void loadDetail();
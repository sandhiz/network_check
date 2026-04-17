const formElement = document.getElementById('hostForm');
const messageElement = document.getElementById('formMessage');

const hostPageState = {
  hosts: [],
  monitor: null,
  scanResults: [],
  scanCidr: null,
  detectedNetworks: [],
  activeScanId: null,
  scanProgress: {
    running: false,
    cidr: null,
    completed: 0,
    totalScanned: 0,
    percentage: 0,
    upCount: 0,
    downCount: 0,
    unknownCount: 0,
    currentIpAddress: null
  }
};

function setInlineMessage(element, text, tone = 'muted') {
  element.textContent = text;
  element.className = `inline-message is-${tone}`;
}

function setMessage(text, isError = false) {
  setInlineMessage(messageElement, text, isError ? 'error' : 'success');
}

function setMessageError(text) {
  setInlineMessage(messageElement, text, 'error');
}

function setNeutralMessage(text) {
  setInlineMessage(messageElement, text, 'muted');
}

function setScanMessage(text, isError = false) {
  setInlineMessage(document.getElementById('scanSummary'), text, isError ? 'error' : 'success');
}

function setNeutralScanMessage(text) {
  setInlineMessage(document.getElementById('scanSummary'), text, 'muted');
}

function statusBadge(status) {
  return `<span class="status-pill status-${status}">${status}</span>`;
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

function createRequestId() {
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function getCurrentHostFilters() {
  return {
    search: document.getElementById('searchFilter').value.trim(),
    status: document.getElementById('statusFilter').value,
    isActive: document.getElementById('activeFilter').value,
    groupName: document.getElementById('groupFilter').value,
    ownerTeam: document.getElementById('teamFilter').value
  };
}

function resetForm() {
  formElement.reset();
  document.getElementById('hostId').value = '';
  document.getElementById('is_active').checked = true;
  document.getElementById('ping_interval').value = 60;
  document.getElementById('formTitle').textContent = 'Tambah host baru';
  document.getElementById('cancelEdit').classList.add('hidden');
}

function fillForm(host) {
  document.getElementById('hostId').value = host.id;
  document.getElementById('label').value = host.label || '';
  document.getElementById('ip_address').value = host.ip_address || '';
  document.getElementById('owner_name').value = host.owner_name || '';
  document.getElementById('owner_team').value = host.owner_team || '';
  document.getElementById('group_name').value = host.group_name || '';
  document.getElementById('ping_interval').value = host.ping_interval || 60;
  document.getElementById('description').value = host.description || '';
  document.getElementById('is_active').checked = Boolean(host.is_active);
  document.getElementById('formTitle').textContent = `Edit host: ${host.label}`;
  document.getElementById('cancelEdit').classList.remove('hidden');
}

function populateHostFilterOptions(hosts) {
  const groupFilter = document.getElementById('groupFilter');
  const teamFilter = document.getElementById('teamFilter');
  const currentGroup = groupFilter.value;
  const currentTeam = teamFilter.value;
  const groups = Array.from(new Set(hosts.map((host) => host.group_name).filter(Boolean))).sort();
  const teams = Array.from(new Set(hosts.map((host) => host.owner_team).filter(Boolean))).sort();

  groupFilter.innerHTML = '<option value="all">Semua group</option>';
  groups.forEach((groupName) => {
    const option = document.createElement('option');
    option.value = groupName;
    option.textContent = groupName;
    groupFilter.appendChild(option);
  });

  teamFilter.innerHTML = '<option value="all">Semua team</option>';
  teams.forEach((teamName) => {
    const option = document.createElement('option');
    option.value = teamName;
    option.textContent = teamName;
    teamFilter.appendChild(option);
  });

  groupFilter.value = groups.includes(currentGroup) ? currentGroup : 'all';
  teamFilter.value = teams.includes(currentTeam) ? currentTeam : 'all';
}

function renderMonitorState() {
  const monitor = hostPageState.monitor;
  const element = document.getElementById('monitorStateText');
  const pauseButton = document.getElementById('pauseMonitorButton');
  const resumeButton = document.getElementById('resumeMonitorButton');

  if (!monitor) {
    element.textContent = 'Status monitor belum tersedia.';
    return;
  }

  element.textContent = monitor.paused
    ? 'Monitoring otomatis global sedang berhenti.'
    : 'Monitoring otomatis global sedang berjalan.';

  pauseButton.disabled = Boolean(monitor.paused) || pauseButton.dataset.busy === 'true';
  resumeButton.disabled = !monitor.paused || resumeButton.dataset.busy === 'true';
}

function renderHosts() {
  const tbody = document.getElementById('hostManagementTableBody');

  if (!hostPageState.hosts.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Tidak ada host yang cocok dengan filter.</td></tr>';
    return;
  }

  tbody.innerHTML = hostPageState.hosts
    .map(
      (host) => `
        <tr>
          <td data-label="Label">
            <strong>${host.label}</strong>
            <div class="muted">${host.group_name || 'Tanpa group'}</div>
          </td>
          <td data-label="Alamat">
            <div>${host.ip_address}</div>
            <div class="muted">${host.detected_hostname || 'Hostname belum terdeteksi'}</div>
          </td>
          <td data-label="Owner">
            <div>${host.owner_name || '-'}</div>
            <div class="muted">${host.owner_team || 'Belum diisi'}</div>
          </td>
          <td data-label="Status">
            ${statusBadge(host.last_status)}
            <div class="muted top-gap">${host.is_active ? 'Auto ping aktif' : 'Auto ping stop'}</div>
          </td>
          <td data-label="Interval">${host.ping_interval} detik</td>
          <td data-label="Aksi">
            <div class="action-row">
              <a class="ghost-button" href="/detail?id=${host.id}">Detail</a>
              <button class="ghost-button" type="button" data-action="edit" data-id="${host.id}">Edit</button>
              <button class="ghost-button" type="button" data-action="toggle" data-id="${host.id}">${host.is_active ? 'Stop ping' : 'Start ping'}</button>
              <button class="ghost-button" type="button" data-action="ping" data-id="${host.id}">Ping</button>
              <button class="danger-button" type="button" data-action="delete" data-id="${host.id}">Hapus</button>
            </div>
          </td>
        </tr>
      `
    )
    .join('');

  tbody.querySelectorAll('[data-action="edit"]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await runButtonAction(button, 'Memuat...', async () => {
          const host = await fetchJson(`/api/hosts/${button.dataset.id}`);
          fillForm(host);
          setNeutralMessage(`Form edit siap untuk ${host.label}.`);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      } catch (error) {
        setMessageError(error.message);
      }
    });
  });

  tbody.querySelectorAll('[data-action="toggle"]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await runButtonAction(button, 'Memproses...', async () => {
          await fetchJson(`/api/hosts/${button.dataset.id}/toggle`, { method: 'PATCH' });
          setMessage('Status auto ping host diperbarui.');
          await loadHosts();
        });
      } catch (error) {
        setMessageError(error.message);
      }
    });
  });

  tbody.querySelectorAll('[data-action="ping"]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await runButtonAction(button, 'Pinging...', async () => {
          await fetchJson(`/api/hosts/${button.dataset.id}/ping`, { method: 'POST' });
          setMessage('Manual ping selesai dijalankan.');
          await loadHosts();
        });
      } catch (error) {
        setMessageError(error.message);
      }
    });
  });

  tbody.querySelectorAll('[data-action="delete"]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Hapus host ini?')) {
        return;
      }

      try {
        await runButtonAction(button, 'Menghapus...', async () => {
          await fetchJson(`/api/hosts/${button.dataset.id}`, { method: 'DELETE' });
          setMessage('Host berhasil dihapus.');
          await loadHosts();
          resetForm();
        });
      } catch (error) {
        setMessageError(error.message);
      }
    });
  });
}

function renderScanProgress() {
  const panel = document.getElementById('scanProgressPanel');
  const bar = document.getElementById('scanProgressFill');
  const progress = hostPageState.scanProgress;
  const shouldShow = progress.running || progress.completed > 0;

  panel.classList.toggle('hidden', !shouldShow);

  if (!shouldShow) {
    return;
  }

  document.getElementById('scanProgressTitle').textContent = progress.running
    ? `Scan ${progress.cidr || ''} sedang berjalan...`.trim()
    : `Scan ${progress.cidr || ''} selesai.`.trim();
  document.getElementById('scanProgressPercent').textContent = `${progress.percentage}%`;
  document.getElementById('scanProgressCounter').textContent = `${progress.completed} / ${progress.totalScanned} host`;
  document.getElementById('scanProgressStats').textContent = `UP ${progress.upCount} · DOWN ${progress.downCount} · UNKNOWN ${progress.unknownCount}`;
  document.getElementById('scanProgressCurrent').textContent = progress.currentIpAddress
    ? `Host terakhir: ${progress.currentIpAddress}`
    : 'Menunggu host pertama...';
  document.getElementById('scanProgressFill').style.width = `${progress.percentage}%`;
  panel.querySelector('.scan-progress-bar').setAttribute('aria-valuenow', String(progress.percentage));
}

function resetScanProgress() {
  hostPageState.scanProgress = {
    running: false,
    cidr: null,
    completed: 0,
    totalScanned: 0,
    percentage: 0,
    upCount: 0,
    downCount: 0,
    unknownCount: 0,
    currentIpAddress: null
  };
  renderScanProgress();
}

function renderScanResults() {
  const wrap = document.getElementById('scanResultsWrap');
  const tbody = document.getElementById('scanResultsTableBody');
  const hasResults = hostPageState.scanResults.length > 0;
  const saveSelectedButton = document.getElementById('saveSelectedScanButton');

  wrap.classList.toggle('hidden', !hasResults);
  document.getElementById('selectAllScanButton').classList.toggle('hidden', !hasResults);
  saveSelectedButton.classList.toggle('hidden', !hasResults);
  saveSelectedButton.disabled = hostPageState.scanProgress.running;

  if (!hasResults) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Belum ada hasil scan.</td></tr>';
    return;
  }

  tbody.innerHTML = hostPageState.scanResults
    .map(
      (row, index) => `
        <tr>
          <td data-label="Pilih">
            <input type="checkbox" data-scan-index="${index}" ${row.already_registered ? 'disabled' : ''} ${row.selected ? 'checked' : ''}>
          </td>
          <td data-label="IP">${row.ip_address}</td>
          <td data-label="Status">${statusBadge(row.status)}</td>
          <td data-label="Latency">${row.latency === null || row.latency === undefined ? '-' : `${Number(row.latency).toFixed(2)} ms`}</td>
          <td data-label="Packet Loss">${row.packet_loss}%</td>
          <td data-label="Hostname">${row.detected_hostname || '-'}</td>
          <td data-label="Database">${row.already_registered ? `Sudah ada${row.registered_label ? ` (${row.registered_label})` : ''}` : 'Host baru'}</td>
        </tr>
      `
    )
    .join('');

  tbody.querySelectorAll('[data-scan-index]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const row = hostPageState.scanResults[Number(checkbox.dataset.scanIndex)];
      row.selected = checkbox.checked;
    });
  });
}

function populateDetectedNetworks() {
  const select = document.getElementById('detectedNetworkSelect');
  select.innerHTML = '<option value="">Pilih jaringan lokal</option>';

  hostPageState.detectedNetworks.forEach((network) => {
    const option = document.createElement('option');
    option.value = network.cidr;
    option.textContent = `${network.cidr} (${network.interfaceName} / ${network.address})`;
    select.appendChild(option);
  });
}

function updateScanBusyState(isBusy) {
  document.getElementById('scanSubnetInput').disabled = isBusy;
  document.getElementById('detectedNetworkSelect').disabled = isBusy;
  document.getElementById('selectAllScanButton').disabled = isBusy;

  if (isBusy) {
    document.getElementById('saveSelectedScanButton').disabled = true;
  }
}

async function loadHosts() {
  const hosts = await fetchJson(`/api/hosts${buildQuery(getCurrentHostFilters())}`);
  hostPageState.hosts = hosts;
  populateHostFilterOptions(hosts);
  renderHosts();
}

async function loadMonitorState() {
  hostPageState.monitor = await fetchJson('/api/monitor/state');
  renderMonitorState();
}

async function loadDetectedNetworks() {
  hostPageState.detectedNetworks = await fetchJson('/api/hosts/scan/networks');
  populateDetectedNetworks();
}

async function handleImport(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch('/api/hosts/import', {
    method: 'POST',
    body: formData
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error?.message || 'Import gagal.');
  }

  return payload.data;
}

function getScanDefaults() {
  return {
    owner_name: document.getElementById('scanOwnerDefault').value.trim(),
    owner_team: document.getElementById('scanTeamDefault').value.trim(),
    group_name: document.getElementById('scanGroupDefault').value.trim(),
    ping_interval: Number(document.getElementById('scanIntervalDefault').value || 60),
    is_active: document.getElementById('scanActiveDefault').checked,
    description: hostPageState.scanCidr ? `Hasil scan ${hostPageState.scanCidr}` : 'Hasil scan jaringan'
  };
}

async function scanNetwork() {
  const scanButton = document.getElementById('scanNetworkButton');
  const subnet = document.getElementById('scanSubnetInput').value.trim();

  if (!subnet) {
    setScanMessage('Subnet atau CIDR wajib diisi.', true);
    return;
  }

  hostPageState.activeScanId = createRequestId();
  hostPageState.scanResults = [];
  hostPageState.scanCidr = subnet;
  renderScanResults();
  resetScanProgress();
  updateScanBusyState(true);
  setNeutralScanMessage('Menyiapkan scan jaringan...');

  if (!window.NetWatchSocket.isConnected()) {
    setNeutralScanMessage('Socket realtime belum terhubung. Scan tetap berjalan, tetapi progress live bisa terlambat tampil.');
  }

  try {
    const result = await runButtonAction(scanButton, 'Scanning...', async () => fetchJson('/api/hosts/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subnet,
        requestId: hostPageState.activeScanId,
        socketId: window.NetWatchSocket.getId()
      })
    }));

    if (result.requestId !== hostPageState.activeScanId) {
      return;
    }

    hostPageState.scanCidr = result.cidr;
    hostPageState.scanResults = result.results.map((row) => ({
      ...row,
      selected: !row.already_registered
    }));
    hostPageState.scanProgress = {
      running: false,
      cidr: result.cidr,
      completed: result.totalScanned,
      totalScanned: result.totalScanned,
      percentage: 100,
      upCount: result.upCount,
      downCount: result.downCount,
      unknownCount: result.unknownCount || 0,
      currentIpAddress: result.results[result.results.length - 1]?.ip_address || null
    };
    renderScanProgress();
    renderScanResults();
    setScanMessage(`Scan ${result.cidr} selesai. ${result.upCount} host UP, ${result.downCount} host DOWN, total ${result.totalScanned} alamat dicek.`);
  } finally {
    updateScanBusyState(false);
  }
}

async function saveSelectedScanResults() {
  const selectedHosts = hostPageState.scanResults
    .filter((row) => row.selected && !row.already_registered)
    .map((row) => ({
      ip_address: row.ip_address,
      label: row.detected_hostname || row.ip_address
    }));

  if (!selectedHosts.length) {
    setScanMessage('Tidak ada hasil scan baru yang dipilih untuk disimpan.', true);
    return;
  }

  const result = await fetchJson('/api/hosts/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hosts: selectedHosts,
      defaults: getScanDefaults()
    })
  });

  setScanMessage(`Simpan hasil scan selesai. ${result.insertedCount} host baru masuk database, ${result.skippedCount} dilewati, ${result.invalidCount} invalid.`);
  await loadHosts();
}

function attachRealtimeHandlers() {
  window.NetWatchSocket.on('host:status_update', () => {
    void loadHosts();
  });

  window.NetWatchSocket.on('monitor:state', (payload) => {
    hostPageState.monitor = payload;
    renderMonitorState();
  });

  window.NetWatchSocket.on('error:message', (payload) => {
    setMessage(payload.message, true);
  });

  window.NetWatchSocket.on('scan:started', (payload) => {
    if (payload.requestId !== hostPageState.activeScanId) {
      return;
    }

    hostPageState.scanProgress = {
      running: true,
      cidr: payload.cidr,
      completed: 0,
      totalScanned: payload.totalScanned,
      percentage: 0,
      upCount: 0,
      downCount: 0,
      unknownCount: 0,
      currentIpAddress: null
    };
    renderScanProgress();
    setNeutralScanMessage(`Scan ${payload.cidr} dimulai. Menunggu hasil pertama...`);
  });

  window.NetWatchSocket.on('scan:progress', (payload) => {
    if (payload.requestId !== hostPageState.activeScanId) {
      return;
    }

    hostPageState.scanProgress = {
      running: true,
      cidr: payload.cidr,
      completed: payload.completed,
      totalScanned: payload.totalScanned,
      percentage: payload.percentage,
      upCount: payload.upCount,
      downCount: payload.downCount,
      unknownCount: payload.unknownCount,
      currentIpAddress: payload.currentResult?.ip_address || null
    };
    renderScanProgress();
    setNeutralScanMessage(`Scan ${payload.cidr} berjalan: ${payload.completed}/${payload.totalScanned} host.`);
  });

  window.NetWatchSocket.on('scan:completed', (payload) => {
    if (payload.requestId !== hostPageState.activeScanId) {
      return;
    }

    hostPageState.scanProgress = {
      running: false,
      cidr: payload.cidr,
      completed: payload.totalScanned,
      totalScanned: payload.totalScanned,
      percentage: 100,
      upCount: payload.upCount,
      downCount: payload.downCount,
      unknownCount: payload.unknownCount || 0,
      currentIpAddress: payload.results?.[payload.results.length - 1]?.ip_address || hostPageState.scanProgress.currentIpAddress
    };
    renderScanProgress();
  });

  window.NetWatchSocket.on('scan:failed', (payload) => {
    if (payload.requestId !== hostPageState.activeScanId) {
      return;
    }

    hostPageState.scanProgress.running = false;
    renderScanProgress();
    setScanMessage(payload.message || 'Scan subnet gagal dijalankan.', true);
    updateScanBusyState(false);
  });
}

formElement.addEventListener('submit', async (event) => {
  event.preventDefault();
  const saveButton = document.getElementById('saveHostButton');
  const hostId = document.getElementById('hostId').value;
  const payload = {
    label: document.getElementById('label').value,
    ip_address: document.getElementById('ip_address').value,
    owner_name: document.getElementById('owner_name').value,
    owner_team: document.getElementById('owner_team').value,
    group_name: document.getElementById('group_name').value,
    ping_interval: Number(document.getElementById('ping_interval').value),
    description: document.getElementById('description').value,
    is_active: document.getElementById('is_active').checked
  };

  try {
    await runButtonAction(saveButton, hostId ? 'Menyimpan...' : 'Membuat...', async () => {
      if (hostId) {
        await fetchJson(`/api/hosts/${hostId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        setMessage('Host berhasil diperbarui.');
      } else {
        await fetchJson('/api/hosts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        setMessage('Host berhasil dibuat.');
      }

      resetForm();
      await loadHosts();
    });
  } catch (error) {
    setMessageError(error.message);
  }
});

document.getElementById('cancelEdit').addEventListener('click', () => {
  resetForm();
  setNeutralMessage('Edit dibatalkan.');
});

document.getElementById('applyFiltersButton').addEventListener('click', () => {
  void loadHosts();
});

document.getElementById('resetFiltersButton').addEventListener('click', () => {
  document.getElementById('searchFilter').value = '';
  document.getElementById('statusFilter').value = 'all';
  document.getElementById('activeFilter').value = 'all';
  document.getElementById('groupFilter').value = 'all';
  document.getElementById('teamFilter').value = 'all';
  void loadHosts();
});

document.getElementById('triggerImportButton').addEventListener('click', () => {
  document.getElementById('importFileInput').click();
});

document.getElementById('importFileInput').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  const importButton = document.getElementById('triggerImportButton');

  if (!file) {
    return;
  }

  try {
    const result = await runButtonAction(importButton, 'Importing...', async () => handleImport(file));
    setMessage(`Import selesai. ${result.insertedCount} host baru masuk, ${result.skippedCount} dilewati, ${result.invalidCount} invalid.`);
    await loadHosts();
  } catch (error) {
    setMessageError(error.message);
  } finally {
    event.target.value = '';
  }
});

document.getElementById('exportHostsButton').addEventListener('click', () => {
  window.location.href = `/api/hosts/export${buildQuery(getCurrentHostFilters())}`;
});

document.getElementById('exportLogsButton').addEventListener('click', () => {
  const filters = getCurrentHostFilters();
  window.location.href = `/api/logs/export${buildQuery({ search: filters.search, status: filters.status })}`;
});

document.getElementById('pauseMonitorButton').addEventListener('click', async () => {
  const button = document.getElementById('pauseMonitorButton');

  try {
    await runButtonAction(button, 'Stopping...', async () => {
      await fetchJson('/api/monitor/pause', { method: 'POST' });
      await loadMonitorState();
      setMessage('Monitoring otomatis global dihentikan.');
    });
  } catch (error) {
    setMessageError(error.message);
  }
});

document.getElementById('resumeMonitorButton').addEventListener('click', async () => {
  const button = document.getElementById('resumeMonitorButton');

  try {
    await runButtonAction(button, 'Starting...', async () => {
      await fetchJson('/api/monitor/resume', { method: 'POST' });
      await loadMonitorState();
      setMessage('Monitoring otomatis global dijalankan kembali.');
    });
  } catch (error) {
    setMessageError(error.message);
  }
});

document.getElementById('detectedNetworkSelect').addEventListener('change', (event) => {
  document.getElementById('scanSubnetInput').value = event.target.value;
});

document.getElementById('scanNetworkButton').addEventListener('click', async () => {
  try {
    await scanNetwork();
  } catch (error) {
    setScanMessage(error.message, true);
  }
});

document.getElementById('selectAllScanButton').addEventListener('click', () => {
  hostPageState.scanResults = hostPageState.scanResults.map((row) => ({
    ...row,
    selected: !row.already_registered
  }));
  renderScanResults();
});

document.getElementById('saveSelectedScanButton').addEventListener('click', async () => {
  const button = document.getElementById('saveSelectedScanButton');

  try {
    await runButtonAction(button, 'Menyimpan...', async () => {
      await saveSelectedScanResults();
    });
  } catch (error) {
    setScanMessage(error.message, true);
  }
});

attachRealtimeHandlers();
resetForm();
resetScanProgress();
void Promise.all([loadHosts(), loadMonitorState(), loadDetectedNetworks()]);
const dashboardState = {
  hosts: [],
  stats: null,
  alerts: [],
  sortField: 'label',
  sortDirection: 'asc'
};

function statusBadge(status) {
  return `<span class="status-pill status-${status}">${status}</span>`;
}

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('id-ID');
}

function formatLatency(value) {
  if (value === null || value === undefined) {
    return '-';
  }

  return `${Number(value).toFixed(2)} ms`;
}

function setRefreshLoading(isLoading) {
  const button = document.getElementById('refreshDashboard');

  if (!button.dataset.defaultLabel) {
    button.dataset.defaultLabel = button.textContent.trim();
  }

  button.disabled = isLoading;
  button.classList.toggle('is-loading', isLoading);
  button.textContent = isLoading ? 'Memuat...' : button.dataset.defaultLabel;
}

function renderStats() {
  const stats = dashboardState.stats || {};
  document.getElementById('totalHosts').textContent = stats.totalHosts || 0;
  document.getElementById('upCount').textContent = stats.upCount || 0;
  document.getElementById('downCount').textContent = stats.downCount || 0;
  document.getElementById('unknownCount').textContent = stats.unknownCount || 0;
}

function populateGroupFilter(hosts) {
  const groupFilter = document.getElementById('groupFilter');
  const selected = groupFilter.value;
  const groups = Array.from(new Set(hosts.map((host) => host.group_name).filter(Boolean))).sort();

  groupFilter.innerHTML = '<option value="all">Semua group</option>';
  groups.forEach((groupName) => {
    const option = document.createElement('option');
    option.value = groupName;
    option.textContent = groupName;
    groupFilter.appendChild(option);
  });

  groupFilter.value = groups.includes(selected) ? selected : 'all';
}

function getSortValue(host, field) {
  if (field === 'last_latency') {
    return host.last_latency === null || host.last_latency === undefined ? Number.POSITIVE_INFINITY : Number(host.last_latency);
  }

  if (field === 'last_ping_at') {
    return host.last_ping_at ? new Date(host.last_ping_at).getTime() : 0;
  }

  if (field === 'last_status') {
    return { down: 0, unknown: 1, up: 2 }[host.last_status] ?? 3;
  }

  return String(host[field] || '').toLowerCase();
}

function getVisibleHosts() {
  const searchText = document.getElementById('searchInput').value.trim().toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;
  const groupFilter = document.getElementById('groupFilter').value;

  const filteredHosts = dashboardState.hosts.filter((host) => {
    const searchable = [host.label, host.ip_address, host.owner_name, host.owner_team, host.group_name, host.detected_hostname]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const matchesSearch = !searchText || searchable.includes(searchText);
    const matchesStatus = statusFilter === 'all' || host.last_status === statusFilter;
    const matchesGroup = groupFilter === 'all' || host.group_name === groupFilter;

    return matchesSearch && matchesStatus && matchesGroup;
  });

  return filteredHosts.sort((left, right) => {
    const leftValue = getSortValue(left, dashboardState.sortField);
    const rightValue = getSortValue(right, dashboardState.sortField);

    if (leftValue === rightValue) {
      return String(left.label || '').localeCompare(String(right.label || ''));
    }

    if (dashboardState.sortDirection === 'asc') {
      return leftValue > rightValue ? 1 : -1;
    }

    return leftValue < rightValue ? 1 : -1;
  });
}

function renderTableMeta(visibleCount, totalCount) {
  const sortLabel = document.querySelector(`[data-sort="${dashboardState.sortField}"]`)?.textContent || dashboardState.sortField;
  document.getElementById('dashboardTableMeta').textContent = `Menampilkan ${visibleCount} dari ${totalCount} host`;
  document.getElementById('dashboardSortMeta').textContent = `Urut ${dashboardState.sortDirection === 'asc' ? 'naik' : 'turun'} berdasarkan ${sortLabel}.`;
}

function renderSortIndicators() {
  document.querySelectorAll('.column-sort').forEach((button) => {
    const isActive = button.dataset.sort === dashboardState.sortField;
    const arrow = isActive ? (dashboardState.sortDirection === 'asc' ? ' ▲' : ' ▼') : '';
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.textContent = `${button.dataset.defaultLabel || button.textContent.replace(/\s[▲▼]$/, '')}${arrow}`;
  });
}

function renderHostsTable() {
  const tbody = document.getElementById('hostsTableBody');
  const visibleHosts = getVisibleHosts();

  renderSortIndicators();
  renderTableMeta(visibleHosts.length, dashboardState.hosts.length);

  if (!visibleHosts.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Tidak ada host yang cocok dengan filter.</td></tr>';
    return;
  }

  tbody.innerHTML = visibleHosts
    .map(
      (host) => `
        <tr>
          <td data-label="Host">
            <a class="action-link" href="/detail?id=${host.id}">${host.label}</a>
            <div class="muted">${host.detected_hostname || 'Hostname belum terdeteksi'}</div>
          </td>
          <td data-label="IP / Hostname">${host.ip_address}</td>
          <td data-label="Owner">
            <strong>${host.owner_name || '-'}</strong>
            <div class="muted">${host.owner_team || 'Belum diisi'}</div>
          </td>
          <td data-label="Group">${host.group_name || '-'}</td>
          <td data-label="Status">${statusBadge(host.last_status)}</td>
          <td data-label="Latency">${formatLatency(host.last_latency)}</td>
          <td data-label="Last Ping">${formatDateTime(host.last_ping_at)}</td>
        </tr>
      `
    )
    .join('');
}

function renderAlerts() {
  const container = document.getElementById('alerts');

  if (!dashboardState.alerts.length) {
    container.className = 'alerts-list empty-state';
    container.textContent = 'Belum ada event status.';
    return;
  }

  container.className = 'alerts-list';
  container.innerHTML = dashboardState.alerts
    .slice(0, 8)
    .map(
      (item) => `
        <article class="alert-item ${item.type === 'down' ? 'is-down' : 'is-up'}">
          <strong>${item.label}</strong>
          <div>${item.message}</div>
          <small class="muted">${formatDateTime(item.timestamp)}</small>
        </article>
      `
    )
    .join('');
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error?.message || 'Request gagal.');
  }

  return payload.data;
}

async function loadDashboard() {
  setRefreshLoading(true);

  try {
    const [hosts, stats] = await Promise.all([
      fetchJson('/api/hosts'),
      fetchJson('/api/stats')
    ]);

    dashboardState.hosts = hosts;
    dashboardState.stats = stats;
    populateGroupFilter(hosts);
    renderStats();
    renderHostsTable();
  } finally {
    setRefreshLoading(false);
  }
}

function attachRealtimeHandlers() {
  window.NetWatchSocket.on('host:status_update', (payload) => {
    const host = dashboardState.hosts.find((item) => item.id === payload.hostId);

    if (!host) {
      return;
    }

    host.last_status = payload.status;
    host.last_latency = payload.latency;
    host.last_ping_at = payload.timestamp;
    host.detected_hostname = payload.detectedHostname || host.detected_hostname;
    renderHostsTable();
  });

  window.NetWatchSocket.on('stats:update', (payload) => {
    dashboardState.stats = payload;
    renderStats();
  });

  window.NetWatchSocket.on('host:down', (payload) => {
    dashboardState.alerts.unshift({
      type: 'down',
      label: payload.label,
      message: `${payload.ip} tidak merespons ping.`,
      timestamp: payload.timestamp
    });
    renderAlerts();
  });

  window.NetWatchSocket.on('host:recovered', (payload) => {
    dashboardState.alerts.unshift({
      type: 'up',
      label: payload.label,
      message: `${payload.ip} kembali merespons.`,
      timestamp: payload.timestamp
    });
    renderAlerts();
  });
}

document.querySelectorAll('.column-sort').forEach((button) => {
  button.dataset.defaultLabel = button.textContent.trim();
  button.addEventListener('click', () => {
    if (dashboardState.sortField === button.dataset.sort) {
      dashboardState.sortDirection = dashboardState.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      dashboardState.sortField = button.dataset.sort;
      dashboardState.sortDirection = button.dataset.sort === 'last_ping_at' ? 'desc' : 'asc';
    }

    renderHostsTable();
  });
});

document.getElementById('searchInput').addEventListener('input', renderHostsTable);
document.getElementById('statusFilter').addEventListener('change', renderHostsTable);
document.getElementById('groupFilter').addEventListener('change', renderHostsTable);
document.getElementById('clearDashboardSearch').addEventListener('click', () => {
  document.getElementById('searchInput').value = '';
  document.getElementById('statusFilter').value = 'all';
  document.getElementById('groupFilter').value = 'all';
  renderHostsTable();
});
document.getElementById('refreshDashboard').addEventListener('click', () => {
  void loadDashboard();
});

attachRealtimeHandlers();
renderAlerts();
renderSortIndicators();
void loadDashboard();
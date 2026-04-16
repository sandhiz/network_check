const os = require('os');
const net = require('net');

const { env } = require('../config/environment');
const { detectHostname, probeAddress } = require('./ping.service');
const { findHostsByAddresses } = require('./host.service');

function ipv4ToInt(ipAddress) {
  return ipAddress.split('.').reduce((accumulator, octet) => ((accumulator << 8) + Number.parseInt(octet, 10)) >>> 0, 0);
}

function intToIpv4(value) {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.');
}

function prefixToMask(prefix) {
  if (prefix === 0) {
    return 0;
  }

  return (0xffffffff << (32 - prefix)) >>> 0;
}

function netmaskToPrefix(netmask) {
  const binary = ipv4ToInt(netmask).toString(2).padStart(32, '0');

  if (!/^1*0*$/.test(binary)) {
    throw new Error('Netmask interface lokal tidak valid.');
  }

  return binary.includes('0') ? binary.indexOf('0') : 32;
}

function parseCidr(input, options = {}) {
  const normalized = String(input || '').trim();
  const [address, prefixValue] = normalized.split('/');
  const prefix = Number.parseInt(prefixValue, 10);

  if (!address || !Number.isInteger(prefix) || net.isIP(address) !== 4 || prefix < 0 || prefix > 32) {
    throw new Error('Subnet harus menggunakan format IPv4 CIDR, misalnya 192.168.1.0/24.');
  }

  const mask = prefixToMask(prefix);
  const network = ipv4ToInt(address) & mask;
  const broadcast = network | (~mask >>> 0);
  const addressCount = prefix >= 31 ? (broadcast - network + 1) : Math.max(0, broadcast - network - 1);

  if (options.enforceLimit !== false && addressCount > env.maxScanHosts) {
    throw new Error(`Subnet terlalu besar. Maksimal ${env.maxScanHosts} host per scan.`);
  }

  return {
    cidr: `${intToIpv4(network)}/${prefix}`,
    network,
    broadcast,
    prefix,
    addressCount
  };
}

function buildHostAddresses(parsedCidr) {
  if (parsedCidr.prefix === 32) {
    return [intToIpv4(parsedCidr.network)];
  }

  if (parsedCidr.prefix === 31) {
    return [intToIpv4(parsedCidr.network), intToIpv4(parsedCidr.broadcast)];
  }

  const addresses = [];

  for (let current = parsedCidr.network + 1; current < parsedCidr.broadcast; current += 1) {
    addresses.push(intToIpv4(current));
  }

  return addresses;
}

async function mapWithConcurrency(items, limit, handler, onProgress) {
  const results = new Array(items.length);
  let cursor = 0;
  let completed = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      const result = await handler(items[currentIndex], currentIndex);
      results[currentIndex] = result;
      completed += 1;

      if (typeof onProgress === 'function') {
        await onProgress({
          completed,
          total: items.length,
          index: currentIndex,
          item: items[currentIndex],
          result
        });
      }
    }
  });

  await Promise.all(workers);
  return results;
}

function getLocalNetworks() {
  const interfaces = os.networkInterfaces();
  const networks = [];

  Object.entries(interfaces).forEach(([interfaceName, addresses]) => {
    addresses.forEach((addressInfo) => {
      if (!addressInfo || addressInfo.family !== 'IPv4' || addressInfo.internal || !addressInfo.address || !addressInfo.netmask) {
        return;
      }

      if (addressInfo.address.startsWith('169.254.')) {
        return;
      }

      const prefix = netmaskToPrefix(addressInfo.netmask);
      const parsed = parseCidr(`${addressInfo.address}/${prefix}`, { enforceLimit: false });
      networks.push({
        interfaceName,
        address: addressInfo.address,
        netmask: addressInfo.netmask,
        cidr: parsed.cidr,
        addressCount: parsed.addressCount,
        scanAllowed: parsed.addressCount <= env.maxScanHosts
      });
    });
  });

  return Array.from(new Map(networks.map((networkInfo) => [networkInfo.cidr, networkInfo])).values())
    .sort((left, right) => left.cidr.localeCompare(right.cidr));
}

async function scanNetwork(cidr, options = {}) {
  const parsed = parseCidr(cidr);
  const addresses = buildHostAddresses(parsed);
  const existingHosts = await findHostsByAddresses(addresses);
  const existingByAddress = new Map(existingHosts.map((host) => [host.ip_address, host]));
  const counters = {
    upCount: 0,
    downCount: 0,
    unknownCount: 0
  };

  if (typeof options.onStart === 'function') {
    await options.onStart({
      cidr: parsed.cidr,
      totalScanned: addresses.length
    });
  }

  const results = await mapWithConcurrency(addresses, Math.min(env.scanConcurrency, env.maxConcurrentPings), async (address) => {
    const probe = await probeAddress(address);
    const existingHost = existingByAddress.get(address);

    return {
      ip_address: address,
      status: probe.status,
      latency: probe.latencyMs,
      packet_loss: probe.packetLoss,
      detected_hostname: probe.alive ? await detectHostname(address) : null,
      error_msg: probe.errorMessage,
      already_registered: Boolean(existingHost),
      registered_host_id: existingHost?.id || null,
      registered_label: existingHost?.label || null
    };
  }, async ({ completed, total, result }) => {
    if (result.status === 'up') {
      counters.upCount += 1;
    } else if (result.status === 'down') {
      counters.downCount += 1;
    } else {
      counters.unknownCount += 1;
    }

    if (typeof options.onProgress === 'function') {
      await options.onProgress({
        cidr: parsed.cidr,
        completed,
        totalScanned: total,
        percentage: total ? Math.round((completed / total) * 100) : 100,
        upCount: counters.upCount,
        downCount: counters.downCount,
        unknownCount: counters.unknownCount,
        currentResult: result
      });
    }
  });

  const summary = {
    cidr: parsed.cidr,
    totalScanned: results.length,
    upCount: counters.upCount,
    downCount: counters.downCount,
    unknownCount: counters.unknownCount,
    results
  };

  if (typeof options.onComplete === 'function') {
    await options.onComplete(summary);
  }

  return summary;
}

module.exports = {
  getLocalNetworks,
  scanNetwork
};
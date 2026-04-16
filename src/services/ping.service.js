const dns = require('dns').promises;
const net = require('net');
const ping = require('ping');

const { env } = require('../config/environment');
const { getHostById, updateHostAfterPing } = require('./host.service');
const { createPingLog } = require('./log.service');

function normalizeLatency(rawValue) {
  const parsed = Number.parseFloat(rawValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePacketLoss(rawValue) {
  const parsed = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsed)) {
    return 100;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

async function detectHostname(address) {
  try {
    if (net.isIP(address)) {
      const names = await dns.reverse(address);
      return names[0] || null;
    }

    return address;
  } catch (error) {
    return null;
  }
}

async function probeAddress(address) {
  const timeoutSeconds = Math.max(1, Math.ceil(env.pingTimeout / 1000));
  const response = await ping.promise.probe(address, {
    timeout: timeoutSeconds,
    min_reply: 1
  });

  const alive = Boolean(response.alive);
  return {
    alive,
    status: alive ? 'up' : 'down',
    latencyMs: alive ? normalizeLatency(response.time) : null,
    packetLoss: normalizePacketLoss(response.packetLoss),
    errorMessage: alive ? null : (response.output || 'Ping timeout atau host tidak terjangkau.')
  };
}

async function pingHost(host) {
  const probe = await probeAddress(host.ip_address);
  const pingedAt = new Date();
  const detectedHostname = probe.alive ? await detectHostname(host.ip_address) : null;

  await createPingLog({
    hostId: host.id,
    status: probe.status,
    latencyMs: probe.latencyMs,
    packetLoss: probe.packetLoss,
    errorMessage: probe.errorMessage,
    pingedAt
  });

  const updatedHost = await updateHostAfterPing(host.id, {
    status: probe.status,
    pingedAt,
    latencyMs: probe.latencyMs,
    detectedHostname
  });

  return {
    hostId: host.id,
    label: host.label,
    ip: host.ip_address,
    ownerName: host.owner_name,
    ownerTeam: host.owner_team,
    detectedHostname: updatedHost.detected_hostname,
    previousStatus: host.last_status,
    status: probe.status,
    latency: probe.latencyMs,
    packetLoss: probe.packetLoss,
    timestamp: pingedAt.toISOString(),
    statusChanged: host.last_status !== probe.status,
    isDownEvent: probe.status === 'down' && host.last_status !== 'down',
    isRecoveredEvent: host.last_status === 'down' && probe.status === 'up'
  };
}

async function pingHostById(hostId) {
  const host = await getHostById(hostId);

  if (!host) {
    const error = new Error('Host tidak ditemukan.');
    error.statusCode = 404;
    throw error;
  }

  return pingHost(host);
}

module.exports = {
  detectHostname,
  pingHost,
  pingHostById,
  probeAddress
};
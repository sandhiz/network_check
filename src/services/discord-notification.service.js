const http = require('http');
const https = require('https');

const { env } = require('../config/environment');

const notificationCooldowns = new Map();

function formatField(value, fallback = '-') {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return String(value);
}

function formatStatus(value) {
  return formatField(value, 'unknown').toUpperCase();
}

function formatTimestamp(value) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('id-ID');
}

function getCooldownKey(hostId, eventType) {
  return `${eventType}:${hostId}`;
}

function getCooldownMs() {
  return env.discordNotificationCooldownSeconds * 1000;
}

function pruneCooldowns(now) {
  const cooldownMs = getCooldownMs();

  if (!cooldownMs || !notificationCooldowns.size) {
    return;
  }

  const maxAge = cooldownMs * 3;

  notificationCooldowns.forEach((sentAt, key) => {
    if (now - sentAt >= maxAge) {
      notificationCooldowns.delete(key);
    }
  });
}

function isInsideCooldown(hostId, eventType, now) {
  const cooldownMs = getCooldownMs();

  if (!cooldownMs) {
    return false;
  }

  pruneCooldowns(now);

  const sentAt = notificationCooldowns.get(getCooldownKey(hostId, eventType));
  return Boolean(sentAt) && now - sentAt < cooldownMs;
}

function rememberNotification(hostId, eventType, now) {
  notificationCooldowns.set(getCooldownKey(hostId, eventType), now);
}

function buildDiscordPayload(payload, options) {
  const {
    title,
    color,
    description,
    statusLabel
  } = options;

  return {
    username: 'NetWatch',
    embeds: [
      {
        title,
        color,
        description,
        fields: [
          {
            name: 'Host',
            value: formatField(payload.label),
            inline: true
          },
          {
            name: 'IP Address',
            value: formatField(payload.ip),
            inline: true
          },
          {
            name: 'Owner',
            value: formatField(payload.ownerName),
            inline: true
          },
          {
            name: 'Team',
            value: formatField(payload.ownerTeam),
            inline: true
          },
          {
            name: 'Hostname',
            value: formatField(payload.detectedHostname),
            inline: true
          },
          {
            name: 'Status',
            value: `${statusLabel}: ${formatStatus(payload.previousStatus)} -> ${formatStatus(payload.status)}`,
            inline: true
          },
          {
            name: 'Latency',
            value: payload.latency === null || payload.latency === undefined ? '-' : `${Number(payload.latency).toFixed(2)} ms`,
            inline: true
          },
          {
            name: 'Packet Loss',
            value: `${Number.isFinite(Number(payload.packetLoss)) ? Number(payload.packetLoss) : 100}%`,
            inline: true
          },
          {
            name: 'Waktu',
            value: formatTimestamp(payload.timestamp),
            inline: false
          }
        ],
        timestamp: payload.timestamp || new Date().toISOString(),
        footer: {
          text: 'Alert dikirim otomatis oleh NetWatch'
        }
      }
    ]
  };
}

function buildDiscordDownPayload(payload) {
  return buildDiscordPayload(payload, {
    title: 'NetWatch Alert: Host DOWN',
    color: 15158332,
    description: `${formatField(payload.label, 'Host tanpa label')} tidak merespons ping dan berubah ke status DOWN.`,
    statusLabel: 'Transisi'
  });
}

function buildDiscordRecoveredPayload(payload) {
  return buildDiscordPayload(payload, {
    title: 'NetWatch Alert: Host RECOVERED',
    color: 3066993,
    description: `${formatField(payload.label, 'Host tanpa label')} kembali merespons ping dan berubah ke status UP.`,
    statusLabel: 'Transisi'
  });
}

function postJson(urlString, body) {
  return new Promise((resolve, reject) => {
    const endpoint = new URL(urlString);
    const transport = endpoint.protocol === 'https:' ? https : http;
    const requestBody = JSON.stringify(body);

    const request = transport.request(
      {
        protocol: endpoint.protocol,
        hostname: endpoint.hostname,
        port: endpoint.port || undefined,
        path: `${endpoint.pathname}${endpoint.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
        },
        timeout: env.discordWebhookTimeout
      },
      (response) => {
        let responseBody = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          responseBody += chunk;
        });
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve({
              statusCode: response.statusCode,
              body: responseBody
            });
            return;
          }

          reject(new Error(`Discord webhook merespons ${response.statusCode}${responseBody ? `: ${responseBody}` : ''}`));
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error('Discord webhook timeout.'));
    });

    request.on('error', reject);
    request.write(requestBody);
    request.end();
  });
}

async function sendHostNotification(payload, eventType, payloadBuilder) {
  if (!env.discordWebhookEnabled || !env.discordWebhookUrl) {
    return {
      sent: false,
      skipped: true,
      reason: 'disabled'
    };
  }

  const now = Date.now();

  if (isInsideCooldown(payload.hostId, eventType, now)) {
    return {
      sent: false,
      skipped: true,
      reason: 'cooldown'
    };
  }

  await postJson(env.discordWebhookUrl, payloadBuilder(payload));
  rememberNotification(payload.hostId, eventType, now);

  return {
    sent: true,
    skipped: false,
    reason: 'sent'
  };
}

async function sendHostDownNotification(payload) {
  return sendHostNotification(payload, 'down', buildDiscordDownPayload);
}

async function sendHostRecoveredNotification(payload) {
  return sendHostNotification(payload, 'recovered', buildDiscordRecoveredPayload);
}

function queueHostDownNotification(payload) {
  void sendHostDownNotification(payload)
    .then((result) => {
      if (result.reason === 'disabled') {
        return;
      }

      if (result.reason === 'cooldown') {
        console.log(`[Discord] Skip alert DOWN untuk ${payload.label} (${payload.ip}) karena masih dalam cooldown.`);
        return;
      }

      console.log(`[Discord] Alert DOWN terkirim untuk ${payload.label} (${payload.ip}).`);
    })
    .catch((error) => {
      console.error(`[Discord] Gagal kirim alert DOWN untuk ${payload.label} (${payload.ip}): ${error.message}`);
    });
}

function queueHostRecoveredNotification(payload) {
  void sendHostRecoveredNotification(payload)
    .then((result) => {
      if (result.reason === 'disabled') {
        return;
      }

      if (result.reason === 'cooldown') {
        console.log(`[Discord] Skip alert RECOVERED untuk ${payload.label} (${payload.ip}) karena masih dalam cooldown.`);
        return;
      }

      console.log(`[Discord] Alert RECOVERED terkirim untuk ${payload.label} (${payload.ip}).`);
    })
    .catch((error) => {
      console.error(`[Discord] Gagal kirim alert RECOVERED untuk ${payload.label} (${payload.ip}): ${error.message}`);
    });
}

module.exports = {
  buildDiscordDownPayload,
  buildDiscordRecoveredPayload,
  queueHostDownNotification,
  queueHostRecoveredNotification,
  sendHostDownNotification,
  sendHostRecoveredNotification
};
const { Server } = require('socket.io');

const { getGlobalStats } = require('../services/stats.service');
const { pingHostById } = require('../services/ping.service');

async function broadcastPingResult(io, payload) {
  io.emit('host:status_update', {
    hostId: payload.hostId,
    status: payload.status,
    latency: payload.latency,
    packetLoss: payload.packetLoss,
    timestamp: payload.timestamp,
    detectedHostname: payload.detectedHostname,
    ownerName: payload.ownerName,
    ownerTeam: payload.ownerTeam
  });

  io.to(`host:${payload.hostId}`).emit('host:status_detail', payload);

  if (payload.isDownEvent) {
    io.emit('host:down', {
      hostId: payload.hostId,
      label: payload.label,
      ip: payload.ip,
      timestamp: payload.timestamp
    });
  }

  if (payload.isRecoveredEvent) {
    io.emit('host:recovered', {
      hostId: payload.hostId,
      label: payload.label,
      ip: payload.ip,
      timestamp: payload.timestamp
    });
  }

  io.emit('stats:update', await getGlobalStats());
}

function broadcastMonitorState(io, state) {
  io.emit('monitor:state', state);
}

function emitToSocket(io, socketId, eventName, payload) {
  if (!io || !socketId) {
    return;
  }

  io.to(socketId).emit(eventName, payload);
}

function broadcastScanStarted(io, socketId, payload) {
  emitToSocket(io, socketId, 'scan:started', payload);
}

function broadcastScanProgress(io, socketId, payload) {
  emitToSocket(io, socketId, 'scan:progress', payload);
}

function broadcastScanCompleted(io, socketId, payload) {
  emitToSocket(io, socketId, 'scan:completed', payload);
}

function broadcastScanFailed(io, socketId, payload) {
  emitToSocket(io, socketId, 'scan:failed', payload);
}

function createSocketServer(server, options = {}) {
  const io = new Server(server, {
    cors: {
      origin: '*'
    }
  });

  io.on('connection', async (socket) => {
    socket.emit('stats:update', await getGlobalStats());

    if (typeof options.getMonitorState === 'function') {
      socket.emit('monitor:state', options.getMonitorState());
    }

    socket.on('subscribe:host', ({ hostId }) => {
      socket.join(`host:${hostId}`);
    });

    socket.on('unsubscribe:host', ({ hostId }) => {
      socket.leave(`host:${hostId}`);
    });

    socket.on('ping:manual', async ({ hostId }) => {
      try {
        const result = await pingHostById(Number.parseInt(hostId, 10));
        await broadcastPingResult(io, result);
      } catch (error) {
        socket.emit('error:message', {
          message: error.message || 'Manual ping gagal.'
        });
      }
    });
  });

  return io;
}

module.exports = {
  broadcastScanCompleted,
  broadcastScanFailed,
  broadcastMonitorState,
  broadcastPingResult,
  broadcastScanProgress,
  broadcastScanStarted,
  createSocketServer
};
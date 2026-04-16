const cron = require('node-cron');

const { env } = require('../config/environment');
const { listDueHosts } = require('./host.service');
const { deleteExpiredLogs } = require('./log.service');
const { pingHost } = require('./ping.service');
const { broadcastPingResult } = require('../socket/events');

class SchedulerService {
  constructor() {
    this.io = null;
    this.dispatchTask = null;
    this.cleanupTask = null;
    this.paused = false;
    this.running = false;
    this.inFlight = new Set();
  }

  attach(io) {
    this.io = io;
  }

  async runPingCycle() {
    if (this.running || this.paused) {
      return;
    }

    this.running = true;

    try {
      const availableSlots = Math.max(0, env.maxConcurrentPings - this.inFlight.size);

      if (!availableSlots) {
        return;
      }

      const candidates = await listDueHosts(availableSlots * 2);
      const dueHosts = candidates.filter((host) => !this.inFlight.has(host.id)).slice(0, availableSlots);

      await Promise.allSettled(
        dueHosts.map(async (host) => {
          this.inFlight.add(host.id);

          try {
            const result = await pingHost(host);
            if (this.io) {
              await broadcastPingResult(this.io, result);
            }
          } finally {
            this.inFlight.delete(host.id);
          }
        })
      );
    } finally {
      this.running = false;
    }
  }

  async start() {
    if (this.dispatchTask) {
      return;
    }

    this.dispatchTask = cron.schedule(`*/${env.schedulerTickSeconds} * * * * *`, () => {
      void this.runPingCycle();
    });

    this.cleanupTask = cron.schedule('0 15 0 * * *', () => {
      void deleteExpiredLogs();
    });

    await this.runPingCycle();
  }

  getState() {
    return {
      paused: this.paused,
      running: this.running,
      inFlightCount: this.inFlight.size,
      schedulerActive: Boolean(this.dispatchTask)
    };
  }

  async pause() {
    this.paused = true;
    return this.getState();
  }

  async resume() {
    this.paused = false;
    await this.runPingCycle();
    return this.getState();
  }

  async stop() {
    if (this.dispatchTask) {
      this.dispatchTask.stop();
      this.dispatchTask = null;
    }

    if (this.cleanupTask) {
      this.cleanupTask.stop();
      this.cleanupTask = null;
    }

    this.paused = false;
  }
}

const scheduler = new SchedulerService();

module.exports = {
  scheduler
};
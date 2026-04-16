const { asyncHandler } = require('../middleware/async-handler');
const { sendSuccess } = require('../utils/http');
const { broadcastMonitorState } = require('../socket/events');
const { scheduler } = require('../services/scheduler.service');

const getMonitorState = asyncHandler(async (req, res) => {
  return sendSuccess(res, scheduler.getState());
});

const pauseMonitoring = asyncHandler(async (req, res) => {
  const state = await scheduler.pause();
  const io = req.app.get('io');

  if (io) {
    broadcastMonitorState(io, state);
  }

  return sendSuccess(res, state, 'Monitoring otomatis berhasil dihentikan.');
});

const resumeMonitoring = asyncHandler(async (req, res) => {
  const state = await scheduler.resume();
  const io = req.app.get('io');

  if (io) {
    broadcastMonitorState(io, state);
  }

  return sendSuccess(res, state, 'Monitoring otomatis berhasil dijalankan kembali.');
});

module.exports = {
  getMonitorState,
  pauseMonitoring,
  resumeMonitoring
};
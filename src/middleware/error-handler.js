function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      message: 'Endpoint tidak ditemukan.'
    }
  });
}

function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;

  if (res.headersSent) {
    return next(error);
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      message: error.message || 'Terjadi kesalahan internal.',
      details: error.details || null
    }
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
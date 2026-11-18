const isApiRequest = (req) => req.originalUrl.startsWith('/api/') || req.path.startsWith('/api/');

function notFoundHandler(req, res) {
  if (isApiRequest(req)) {
    return res.status(404).json({ message: '요청한 API를 찾을 수 없습니다.' });
  }
  res.status(404).type('text/plain; charset=utf-8').send('Not found');
}

function errorHandler(err, req, res, _next) {
  if (res.headersSent) return;
  const status = Number(err.status || err.statusCode) || 500;
  const message = typeof err.expose === 'boolean' && err.expose && err.message
    ? err.message
    : status >= 500
      ? '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      : (err.message || '요청을 처리할 수 없습니다.');
  if (isApiRequest(req)) {
    return res.status(status).json({ message });
  }
  res.status(status).type('text/plain; charset=utf-8').send(message);
}

module.exports = { notFoundHandler, errorHandler, isApiRequest };

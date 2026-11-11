const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

test('Express returns JSON 404 for unknown API routes', async () => {
  const app = require('../src/app');
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const port = server.address().port;
    const response = await fetch(`http://127.0.0.1:${port}/api/no-such-route`);
    const body = await response.json();
    assert.equal(response.status, 404);
    assert.equal(body.message, '요청한 API를 찾을 수 없습니다.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Express error handler returns JSON 500 for API failures', async () => {
  const express = require('express');
  const { notFoundHandler, errorHandler } = require('../src/middleware/httpErrors');
  const app = express();
  app.get('/api/broken', () => {
    throw Object.assign(new Error('boom'), { status: 500 });
  });
  app.use(notFoundHandler);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const port = server.address().port;
    const response = await fetch(`http://127.0.0.1:${port}/api/broken`);
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.match(body.message, /서버 오류/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

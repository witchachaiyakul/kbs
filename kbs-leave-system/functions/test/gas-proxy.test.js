const test = require('node:test');
const assert = require('node:assert/strict');
const { createGasProxy } = require('../gas-proxy');

test('forwards allowlisted API requests to Apps Script with the server secret', async () => {
  let upstreamUrl;
  let upstreamOptions;
  const proxy = createGasProxy({
    gasApiUrl: 'https://script.google.com/macros/s/test/exec',
    apiSecret: 'server-only-secret',
    fetchImpl: async (url, options) => {
      upstreamUrl = url;
      upstreamOptions = options;
      return { ok: true, json: async () => ({ success: true, data: { user: null } }) };
    }
  });

  const result = await proxy({ method: 'POST', body: { method: 'getUserByIdToken', args: ['line-token'] } });

  assert.equal(upstreamUrl, 'https://script.google.com/macros/s/test/exec');
  assert.deepEqual(JSON.parse(upstreamOptions.body), {
    kind: 'api',
    apiSecret: 'server-only-secret',
    method: 'getUserByIdToken',
    args: ['line-token']
  });
  assert.deepEqual(result, { status: 200, body: { success: true, data: { user: null } } });
});

test('rejects methods outside the API allowlist without contacting Apps Script', async () => {
  let contacted = false;
  const proxy = createGasProxy({
    gasApiUrl: 'https://script.google.com/macros/s/test/exec',
    apiSecret: 'server-only-secret',
    fetchImpl: async () => { contacted = true; }
  });

  const result = await proxy({ method: 'POST', body: { method: 'deleteAllData', args: [] } });

  assert.equal(contacted, false);
  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'INVALID_API_REQUEST');
});

test('returns a controlled error when Apps Script is unavailable', async () => {
  const proxy = createGasProxy({
    gasApiUrl: 'https://script.google.com/macros/s/test/exec',
    apiSecret: 'server-only-secret',
    fetchImpl: async () => { throw new Error('network details must not reach clients'); }
  });

  const result = await proxy({ method: 'POST', body: { method: 'apiGetStaffList', args: ['line-token'] } });

  assert.equal(result.status, 502);
  assert.deepEqual(result.body, { success: false, error: 'GAS_UNAVAILABLE' });
});
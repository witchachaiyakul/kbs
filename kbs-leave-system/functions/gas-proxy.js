const ALLOWED_METHODS = new Set([
  'getUserByIdToken',
  'registerLine',
  'apiGetStaffList',
  'apiGetAllSchedulesMap',
  'apiGetSchedule',
  'apiGetLeaveBalance',
  'apiCheckScheduleForLeave',
  'apiRecordLeave',
  'getDailyStats'
]);

function createGasProxy({ gasApiUrl, apiSecret, fetchImpl = fetch }) {
  return async function proxyRequest(request) {
    const body = request.body || {};
    if (request.method !== 'POST') {
      return { status: 405, body: { success: false, error: 'METHOD_NOT_ALLOWED' } };
    }
    if (!gasApiUrl || !apiSecret) {
      return { status: 503, body: { success: false, error: 'BACKEND_NOT_CONFIGURED' } };
    }
    if (!ALLOWED_METHODS.has(body.method) || !Array.isArray(body.args)) {
      return { status: 400, body: { success: false, error: 'INVALID_API_REQUEST' } };
    }

    try {
      const response = await fetchImpl(gasApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'api',
          apiSecret,
          method: body.method,
          args: body.args
        })
      });
      if (!response.ok) {
        return { status: 502, body: { success: false, error: 'GAS_REQUEST_FAILED' } };
      }

      const result = await response.json();
      return { status: result.success ? 200 : 400, body: result };
    } catch (error) {
      return { status: 502, body: { success: false, error: 'GAS_UNAVAILABLE' } };
    }
  };
}

module.exports = { ALLOWED_METHODS, createGasProxy };
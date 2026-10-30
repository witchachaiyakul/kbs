const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { createGasProxy } = require('./gas-proxy');

const gasApiUrl = defineSecret('GAS_API_URL');
const gasApiSecret = defineSecret('GAS_API_SECRET');

exports.gasApi = onRequest({ cors: true, secrets: [gasApiUrl, gasApiSecret] }, async (request, response) => {
  const proxyRequest = createGasProxy({
    gasApiUrl: gasApiUrl.value(),
    apiSecret: gasApiSecret.value()
  });
  const result = await proxyRequest({
    method: request.method,
    body: request.body
  });
  response.status(result.status).json(result.body);
});
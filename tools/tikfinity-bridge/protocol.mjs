import { createHmac, randomUUID } from 'node:crypto';
export function assertNodeSupported(version = process.versions.node) {
  const major = Number(version.split('.')[0]);
  if (!Number.isInteger(major) || major < 22) throw new Error('NODE_22_OR_NEWER_REQUIRED');
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('TLS_VERIFICATION_MUST_NOT_BE_DISABLED');
}
export function validateServerUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('INVALID_SERVER_URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !url.hostname) throw new Error('HTTPS_ORIGIN_ONLY_REQUIRED');
  return url.origin;
}
export function signExactBody(secret, timestamp, nonce, exactBody) {
  if (typeof secret !== 'string' || !secret || typeof exactBody !== 'string') throw new Error('INVALID_SIGNING_INPUT');
  return createHmac('sha256', secret).update(`${timestamp}\n${nonce}\n`, 'utf8').update(exactBody, 'utf8').digest('hex');
}
export function signedRequest(config, body, timestamp = String(Date.now()), nonce = randomUUID()) {
  const exactBody = JSON.stringify(body);
  return { exactBody, headers: { 'content-type': 'application/json',
    'x-review-bridge-id': config.bridgeId, 'x-review-timestamp': String(timestamp), 'x-review-nonce': nonce,
    'x-review-signature': signExactBody(config.secret, String(timestamp), nonce, exactBody) } };
}
export class HttpError extends Error {
  constructor(status) { super(`HTTP_${status}`); this.name = 'HttpError'; this.status = status; }
}
export async function readBoundedJson(response) {
  if (!response.ok) { await response.body?.cancel(); throw new HttpError(response.status); }
  if (!response.body) throw new Error('EMPTY_SERVER_RESPONSE');
  const reader = response.body.getReader(), chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 65536) { await reader.cancel(); throw new Error('OVERSIZED_SERVER_RESPONSE'); }
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { reader.releaseLock(); }
}
export async function postJson(serverUrl, path, body, auth) {
  assertNodeSupported();
  if (!['/api/review-bridge/pair', '/api/review-bridge/heartbeat', '/api/review-bridge/events'].includes(path)) throw new Error('INVALID_API_PATH');
  const origin = validateServerUrl(serverUrl);
  const signed = auth ? signedRequest(auth, body) : { exactBody: JSON.stringify(body), headers: { 'content-type': 'application/json' } };
  const response = await fetch(`${origin}${path}`, { method: 'POST', headers: signed.headers, body: signed.exactBody,
    redirect: 'error', signal: AbortSignal.timeout(10000) });
  return readBoundedJson(response);
}
export function retryDelay(attempt, random = Math.random) {
  return Math.min(30000, 1000 * 2 ** Math.min(Math.max(0, attempt), 5)) + Math.floor(random() * 250);
}

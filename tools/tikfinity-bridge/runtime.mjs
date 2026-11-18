import { lookup } from 'node:dns';
import WebSocket from 'ws';
import { normalizeTikFinityReviewEventV2, stableIdDiagnostics, validateCommands, NormalizationError } from './normalize.mjs';
import { HttpError, postJson, retryDelay } from './protocol.mjs';
import { ReceiptQueue, MAX_CONTEXT_AGE_MS, QueueOverflowError } from './queue.mjs';
import { syntheticFixtures } from './fixtures.mjs';
export const LOCAL_SOCKET_URL = 'ws://localhost:21213/';
// Restrict every DNS answer to loopback; there is no listener or control interface.
export function loopbackLookup(hostname, options, callback) {
  if (hostname !== 'localhost') return callback(new Error('LOOPBACK_ONLY_REQUIRED'));
  lookup(hostname, { ...typeof options === 'object' ? options : {}, all: true }, (error, addresses) => {
    if (error) return callback(error);
    const local = addresses.filter(value => value.address === '127.0.0.1' || value.address === '::1');
    if (!local.length || local.length !== addresses.length) return callback(new Error('NON_LOOPBACK_DNS_REJECTED'));
    if (options?.all) return callback(null, local);
    callback(null, local[0].address, local[0].family);
  });
}
export function validateHeartbeat(value, testMode) {
  if (!value || typeof value.enabled !== 'boolean') throw new Error('INVALID_HEARTBEAT_RESPONSE');
  if (testMode && value.testMode !== true) throw new Error('SERVER_ISOLATED_TEST_MODE_ACK_REQUIRED');
  if (!testMode && value.testMode === true) throw new Error('SERVER_IN_TEST_MODE_USE_SIMULATE');
  if (!value.enabled) return { ...value, enabled: false };
  if (typeof value.streamId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(value.streamId) || typeof value.roomId !== 'string' || !/^\d{5,30}$/.test(value.roomId) || !(value.occurrenceId === null || typeof value.occurrenceId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value.occurrenceId)) || !(value.galaxyGiftId === null || typeof value.galaxyGiftId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value.galaxyGiftId))) throw new Error('INVALID_HEARTBEAT_CONTEXT');
  return { streamId: value.streamId, roomId: value.roomId, occurrenceId: value.occurrenceId,
    commands: validateCommands(value.commands), enabled: true, galaxyGiftId: value.galaxyGiftId, testMode: value.testMode };
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function runBridge(config, { testMode = false, signal, log = defaultLog, post = postJson } = {}) {
  const queue = new ReceiptQueue({ log });
  const startedAt = Date.now();
  let socket, context = null, contextAt = 0, localConnected = false, stopped = false;
  let reconnectAttempt = 0, reconnectTimer, lastMessageAt = 0, errorCount = 0, ignoredCount = 0, acceptedCount = 0;
  let fatal = null, syntheticQueued = false, retryAt = 0, sendAttempt = 0;
  const summarize = () => {
    if (errorCount || ignoredCount || acceptedCount) log(testMode ? 'TEST' : 'INFO', 'RECEIPT_SUMMARY_REDACTED', { rejected: errorCount, ignored: ignoredCount, accepted: acceptedCount, queued: queue.size });
    errorCount = ignoredCount = acceptedCount = 0;
  };
  const stop = () => {
    stopped = true; clearTimeout(reconnectTimer); socket?.terminate(); localConnected = false;
  };
  signal?.addEventListener('abort', stop, { once: true });
  if (signal?.aborted) stop();
  function receive(raw, receivedAtMs = Date.now(), label) {
    if (testMode && label) log('TEST', 'SYNTHETIC_FIXTURE', { label });
    if (!context?.enabled || receivedAtMs - contextAt > MAX_CONTEXT_AGE_MS) {
      errorCount++; if (errorCount <= 3) log('ERROR', 'EVENT_REJECTED_NO_FRESH_RECEIPT_CONTEXT'); return;
    }
    try {
      const event = normalizeTikFinityReviewEventV2(raw, context);
      if (!event) { ignoredCount++; return; }
      queue.add(event, context, receivedAtMs); acceptedCount++;
    } catch (error) {
      errorCount++;
      if (error instanceof QueueOverflowError) { log('ERROR', error.message, { queued: queue.size }); fatal = error; stop(); return; }
      if (errorCount <= 3 || testMode) log(testMode ? 'TEST' : 'WARN', error instanceof NormalizationError ? error.code : 'MALFORMED_EVENT', stableIdDiagnostics(raw));
    }
  }
  function connectLocal() {
    if (stopped || testMode) return;
    log('INFO', reconnectAttempt ? 'RECONNECTING_LOCAL_LOOPBACK' : 'CONNECTING_LOCAL_LOOPBACK');
    const connection = new WebSocket(LOCAL_SOCKET_URL, { lookup: loopbackLookup, maxPayload: 65536, handshakeTimeout: 5000, perMessageDeflate: false, followRedirects: false });
    socket = connection;
    connection.on('open', () => { localConnected = true; reconnectAttempt = 0; lastMessageAt = Date.now(); log('INFO', 'LOCAL_SOCKET_CONNECTED_NOT_LIVE_VERIFIED'); });
    connection.on('message', (bytes, binary) => {
      lastMessageAt = Date.now();
      if (binary) { errorCount++; if (errorCount <= 3) log('WARN', 'BINARY_EVENT_REJECTED'); return; }
      const receivedAtMs = Date.now();
      try { receive(JSON.parse(bytes.toString('utf8')), receivedAtMs); }
      catch { errorCount++; if (errorCount <= 3) log('WARN', 'MALFORMED_JSON_REDACTED'); }
    });
    connection.on('pong', () => { lastMessageAt = Date.now(); });
    connection.on('error', () => log('WARN', 'LOCAL_SOCKET_ERROR_REDACTED'));
    connection.on('close', () => {
      localConnected = false;
      if (!stopped) { log('WARN', 'LOCAL_SOCKET_DISCONNECTED'); reconnectTimer = setTimeout(connectLocal, retryDelay(reconnectAttempt++)); }
    });
  }
  async function heartbeat() {
    const body = { localConnected, testMode, ...(!testMode && context?.roomId ? { roomId: context.roomId } : {}) };
    const response = await post(config.serverUrl, '/api/review-bridge/heartbeat', body, config);
    context = validateHeartbeat(response, testMode); contextAt = Date.now();
    if (!context.enabled) {
      queue.clear('SERVER_DISABLED_DROPPED_PENDING_EVENTS');
      if (testMode) throw new Error('SERVER_TEST_MODE_DISABLED');
      return;
    }
    const dropped = queue.prune(context);
    if (testMode && (dropped.stale || dropped.advanced)) throw new Error('SIMULATION_RECEIPTS_EXPIRED_OR_CONTEXT_ADVANCED');
  }
  try {
    // Simulator fails before touching any socket or sending an event without server acknowledgement.
    let startupAttempt = 0;
    while (!stopped) {
      try { await heartbeat(); break; }
      catch (error) {
        if (error instanceof HttpError && [401, 403].includes(error.status)) throw new Error('BRIDGE_AUTH_REJECTED_REPAIR_BY_PAIRING');
        if (/TEST_MODE|HEARTBEAT|COMMAND/.test(error.message || '')) throw error;
        if (testMode && Date.now() - startedAt > 120000) throw new Error('SIMULATION_TIMEOUT');
        log('ERROR', 'STARTUP_OUTBOUND_UNAVAILABLE_RETRYING_REDACTED');
        await sleep(retryDelay(startupAttempt++));
      }
    }
    if (stopped) return;
    if (!context.enabled && testMode) throw new Error('SERVER_TEST_BRIDGE_MUST_BE_ENABLED');
    if (testMode) log('TEST', 'SYNTHETIC_TEST_MODE_ONLY_NO_LOCAL_SOCKET_NO_LIVE_VERIFICATION');
    else connectLocal();
    while (!stopped) {
      const tickAt = Date.now();
      if (testMode && !syntheticQueued) {
        syntheticQueued = true;
        for (const fixture of syntheticFixtures(context)) receive(fixture.raw, Date.now(), fixture.label);
        summarize();
      }
      try {
        // Refresh current stream+occurrence before each retry/send; never rebind a receipt.
        await heartbeat();
        if (context.enabled && Date.now() >= retryAt) {
          const batch = queue.batch(context, testMode);
          if (batch) {
            await post(config.serverUrl, '/api/review-bridge/events', batch, config);
            // Heartbeat explicitly acknowledged server test mode; event handler must
            // independently enforce body.testMode before any real queue/vote writes.
            queue.acknowledge(batch); sendAttempt = 0; retryAt = 0;
            log(testMode ? 'TEST' : 'INFO', 'BATCH_ACCEPTED_NOT_LIVE_VERIFIED', { count: batch.events.length });
          }
        }
      } catch (error) {
        contextAt = 0; // Reject new receipts until heartbeat succeeds again.
        if (error instanceof HttpError && [401, 403].includes(error.status)) throw new Error('BRIDGE_AUTH_REJECTED_REPAIR_BY_PAIRING');
        if (/TEST_MODE|HEARTBEAT|COMMAND|SIMULATION_RECEIPTS/.test(error.message || '')) throw error;
        log('ERROR', error instanceof HttpError ? error.message : 'OUTBOUND_FAILURE_REDACTED', { queued: queue.size });
        retryAt = Date.now() + retryDelay(sendAttempt++);
      }
      const dropped = queue.prune(context);
      if (testMode && (dropped.stale || dropped.advanced)) throw new Error('SIMULATION_RECEIPTS_EXPIRED_OR_CONTEXT_ADVANCED');
      if (socket?.readyState === WebSocket.OPEN) {
        if (Date.now() - lastMessageAt > 45000) { log('WARN', 'LOCAL_SOCKET_UNRESPONSIVE_RECONNECTING'); socket.terminate(); }
        else socket.ping(); // WebSocket health only; never sends TikFinity application commands.
      }
      summarize();
      if (testMode && syntheticQueued && !queue.size) { log('TEST', 'SIMULATED_TRANSPORT_COMPLETE_BACKEND_SEMANTICS_REQUIRE_SERVER_TESTS'); break; }
      if (testMode && Date.now() - startedAt > 120000) throw new Error('SIMULATION_TIMEOUT');
      await sleep(Math.max(250, 3000 - (Date.now() - tickAt)));
    }
    if (fatal) throw fatal;
  } finally {
    stop(); signal?.removeEventListener('abort', stop);
    queue.clear('STOPPING_WITH_UNACKNOWLEDGED_EVENTS_EXPLICIT_LOSS');
    // Best effort disconnected status, never print response/errors/credentials.
    try { await post(config.serverUrl, '/api/review-bridge/heartbeat', { localConnected: false, testMode }, config); } catch { log('WARN', 'DISCONNECTED_HEARTBEAT_UNAVAILABLE'); }
  }
}
export function defaultLog(level, code, details = {}) {
  // All callers use fixed codes/counts/presence flags or package-owned synthetic labels.
  console.log(JSON.stringify({ at: new Date().toISOString(), level, code, ...details }));
}

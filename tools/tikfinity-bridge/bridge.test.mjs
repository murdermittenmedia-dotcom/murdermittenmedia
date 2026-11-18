import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { saveConfig, loadConfig, acquireRunLock, configPaths } from './config.mjs';
import { normalizeTikFinityReviewEventV2 as normalize, DEFAULT_COMMANDS, stableIdDiagnostics, isConfiguredGalaxy } from './normalize.mjs';
import { signExactBody, signedRequest, validateServerUrl, assertNodeSupported, retryDelay } from './protocol.mjs';
import { ReceiptQueue, QueueOverflowError } from './queue.mjs';
import { syntheticFixtures } from './fixtures.mjs';
import { runBridge, validateHeartbeat, LOCAL_SOCKET_URL } from './runtime.mjs';
const context = { streamId: 'test-stream', roomId: '7390000000000000000', occurrenceId: 'test-occurrence', commands: DEFAULT_COMMANDS, galaxyGiftId: 'SYNTHETIC-GALAXY', enabled: true, testMode: true };
const config = { serverUrl: 'https://example.invalid', bridgeId: 'test-bridge', secret: 'synthetic-secret-not-a-real-credential' };
const chat = (extra = {}) => ({ event: 'chat', data: { msgId: 'provider-message', userId: 'provider-user', roomId: context.roomId, uniqueId: 'actual_handle', comment: '!fire', ...extra } });
test('supports flattened and documented nested stable provider IDs', () => {
  assert.equal(normalize(chat(), context).handle, 'actual_handle');
  assert.equal(normalize({ event: 'chat', data: { common: { msgId: 'nested-message', roomId: context.roomId }, user: { id: 'nested-user', displayId: 'nested_handle' }, content: '!trash' } }, context).comment, '!trash');
  assert.equal(normalize(chat({ msgId: 123n, userId: 456n }), context).messageId, '123');
});
test('rejects absent, unsafe or conflicting IDs and wrong room; no fallback', () => {
  for (const extra of [{ msgId: undefined }, { userId: undefined }, { roomId: undefined }, { msgId: Number.MAX_SAFE_INTEGER + 1 }, { roomId: '9999999999999999999' }, { msgId: '' }, { common: { msgId: 'different' } }]) assert.throws(() => normalize(chat(extra), context));
  assert.throws(() => normalize(chat({ userId: undefined, uniqueId: 'name_only', nickname: 'Display Name' }), context));
  assert.throws(() => normalize({ event: 'gift', data: { userId: 'u', roomId: context.roomId, groupId: 'not-message', giftId: 'g', giftType: 1, repeatCount: 1, repeatEnd: true } }, context), /MESSAGE_ID/);
});
test('ordinary chat redacted; only exact commands and valid link claim travel', () => {
  assert.equal(normalize(chat({ comment: 'private ordinary comment' }), context), null);
  assert.equal(normalize(chat({ comment: '!fire extra' }), context), null);
  assert.equal(normalize(chat({ comment: '!link ABCD_1234' }), context).comment, '!link ABCD_1234');
  assert.equal(normalize(chat({ comment: '!link ABCD_1234 extra' }), context), null);
  const event = normalize(chat({ uniqueId: undefined, nickname: 'not_a_handle', avatar: 'private' }), context);
  assert.equal(event.handle, undefined); assert.equal(event.displayName, 'not_a_handle'); assert.equal(event.nickname, undefined); assert.equal(event.avatar, undefined);
  const diagnostics = JSON.stringify(stableIdDiagnostics(chat({ comment: '!link SECRET_CODE' })));
  for (const forbidden of ['SECRET_CODE', 'provider-message', 'provider-user', 'actual_handle']) assert.equal(diagnostics.includes(forbidden), false);
});
test('all seven types supported; gift messages and streak IDs separate; Galaxy ID only', () => {
  const fixtures = syntheticFixtures(context);
  const events = fixtures.flatMap(f => { try { const event = normalize(f.raw, context); return event ? [event] : []; } catch { return []; } });
  assert.equal(new Set(events.map(event => event.kind)).size, 7);
  const streak = events.find(event => event.streakId);
  assert.notEqual(streak.messageId, streak.streakId); assert.equal(streak.repeatEnd, false);
  assert.equal(streak.giftName, 'SYNTHETIC Streak'); assert.equal(streak.giftType, 1); assert.equal(streak.repeatCount, 1);
  assert.equal(isConfiguredGalaxy({ kind: 'gift', giftId: 'other', giftName: 'Galaxy' }, context.galaxyGiftId), false);
  assert.equal(isConfiguredGalaxy(events.find(event => event.giftId === context.galaxyGiftId), context.galaxyGiftId), true);
  assert.equal(isConfiguredGalaxy({ kind: 'gift', giftId: context.galaxyGiftId }, context.galaxyGiftId), false);
  assert.equal(isConfiguredGalaxy({ kind: 'gift', giftId: context.galaxyGiftId, giftName: 'Fire' }, context.galaxyGiftId), false);
  assert.equal(isConfiguredGalaxy({ kind: 'gift', giftId: context.galaxyGiftId, giftName: 'gAlAxY' }, context.galaxyGiftId), true);
  assert.equal(isConfiguredGalaxy(events.find(event => event.kind === 'gift'), null), false);
  const raw = fixtures.find(f => f.label.includes('interim 1')).raw;
  assert.throws(() => normalize({ ...raw, data: { ...raw.data, groupId: undefined } }, context), /STREAK_ID/);
});
test('exact UTF8 JSON bytes, newline ordering, fresh nonce and ms timestamp', () => {
  const body = { streamId: 'é-test', events: [], testMode: true };
  const request = signedRequest(config, body, '1730000000000', '11111111-1111-4111-8111-111111111111');
  const expected = createHmac('sha256', config.secret).update(`1730000000000\n11111111-1111-4111-8111-111111111111\n${JSON.stringify(body)}`).digest('hex');
  assert.equal(request.headers['x-review-signature'], expected);
  assert.notEqual(signExactBody(config.secret, '1730000000000', '11111111-1111-4111-8111-111111111111', JSON.stringify(body, null, 2)), expected);
  const next = signedRequest(config, body); assert.match(next.headers['x-review-nonce'], /^[0-9a-f-]{36}$/); assert.match(next.headers['x-review-timestamp'], /^\d{13}$/);
});
test('HTTPS origin only and Node22+ with bounded exponential delays', () => {
  for (const bad of ['http://example.com', 'https://u:p@example.com', 'https://example.com/path', 'https://example.com/?token=secret']) assert.throws(() => validateServerUrl(bad));
  assert.equal(validateServerUrl('https://example.com/'), 'https://example.com');
  assert.throws(() => assertNodeSupported('20.0.0')); assert.doesNotThrow(() => assertNodeSupported('22.0.0'));
  assert.equal(retryDelay(0, () => 0), 1000); assert.equal(retryDelay(100, () => 0), 30000);
  assert.equal(LOCAL_SOCKET_URL, 'ws://localhost:21213/');
});
test('bounded queue retries preserve receipt/time/context, age drops and advance prevents old votes', () => {
  const logs = [], queue = new ReceiptQueue({ capacity: 2, log: (...args) => logs.push(args) });
  queue.add(normalize(chat(), context), context, 1000, '11111111-1111-4111-8111-111111111111');
  const first = queue.batch(context, false, 1001), retry = queue.batch(context, false, 2000);
  assert.deepEqual(retry, first); assert.equal(retry.events[0].receivedAtMs, 1000);
  queue.add(normalize(chat({ msgId: 'second' }), context), context, 1000);
  assert.throws(() => queue.add(normalize(chat(), context), context, 1000), QueueOverflowError);
  assert.equal(queue.prune({ ...context, occurrenceId: 'advanced' }, 2000).advanced, 2); assert.equal(queue.size, 0);
  queue.add(normalize(chat(), context), context, 1000);
  assert.equal(queue.prune(context, 121001).stale, 1); assert.equal(logs.some(args => args[1].includes('TWO_MINUTES')), true);
});
test('simulator refuses absent server testMode acknowledgement before events', async () => {
  let sent = 0;
  await assert.rejects(() => runBridge(config, { testMode: true, log: () => {}, post: async (url, endpoint) => { if (endpoint.endsWith('/events')) sent++; return { ...context, testMode: undefined }; } }), /ACK_REQUIRED/);
  assert.equal(sent, 0);
  assert.throws(() => validateHeartbeat(context, false), /TEST_MODE/);
});
test('simulated transport passes only synthetic testMode receipts; no live socket or real queue', async () => {
  const batches = [], logs = [];
  await runBridge(config, { testMode: true, log: (...args) => logs.push(args), post: async (url, endpoint, body) => {
    if (endpoint.endsWith('/events')) { batches.push(structuredClone(body)); return { testMode: true, accepted: body.events.length }; }
    assert.equal(body.testMode, true); assert.equal(body.localConnected, false); return context;
  } });
  assert.equal(batches.length, 1); assert.equal(batches[0].testMode, true);
  assert.equal(batches[0].events.length, 20);
  assert.equal(batches[0].events.every(receipt => receipt.event.messageId.startsWith('SYNTHETIC-')), true);
  assert.equal(batches[0].events.some(receipt => receipt.event.comment?.includes('ordinary')), false);
  const duplicates = batches[0].events.filter(receipt => receipt.event.messageId === 'SYNTHETIC-galaxy-linked');
  assert.equal(duplicates.length, 2); assert.notEqual(duplicates[0].receiptId, duplicates[1].receiptId);
  assert.equal(logs.some(args => args[1] === 'SIMULATED_TRANSPORT_COMPLETE_BACKEND_SEMANTICS_REQUIRE_SERVER_TESTS'), true);
});
test('simulated outbound retry preserves receipt UUIDs/time/event and refreshes context', async () => {
  const batches = []; let heartbeats = 0;
  await runBridge(config, { testMode: true, log: () => {}, post: async (url, endpoint, body) => {
    if (endpoint.endsWith('/events')) {
      batches.push(structuredClone(body));
      if (batches.length === 1) throw new Error('synthetic outage');
      return { testMode: true };
    }
    heartbeats++; return context;
  } });
  assert.equal(batches.length, 2); assert.deepEqual(batches[1], batches[0]); assert.ok(heartbeats >= 3);
});
test('simulation fails clearly rather than replaying old occurrence after advance', async () => {
  let heartbeats = 0, events = 0;
  await assert.rejects(() => runBridge(config, { testMode: true, log: () => {}, post: async (url, endpoint) => {
    if (endpoint.endsWith('/events')) { events++; return { testMode: true }; }
    heartbeats++; return { ...context, occurrenceId: heartbeats > 1 ? 'advanced' : context.occurrenceId };
  } }), /SIMULATION_RECEIPTS_EXPIRED_OR_CONTEXT_ADVANCED/);
  assert.equal(events, 0);
});
test('local config roundtrip has owner-only Unix modes and exclusive lock', { skip: process.platform === 'win32' }, async () => {
  const previous = process.env.XDG_CONFIG_HOME, temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'tikfinity-v2-test-'));
  process.env.XDG_CONFIG_HOME = temporary;
  try {
    const value = { version: 2, ...config, deviceLabel: 'Synthetic test device' };
    await saveConfig(value); assert.deepEqual(await loadConfig(), value);
    const paths = configPaths();
    assert.equal((await fs.stat(paths.directory)).mode & 0o777, 0o700);
    assert.equal((await fs.stat(paths.file)).mode & 0o777, 0o600);
    const release = await acquireRunLock();
    try { await assert.rejects(acquireRunLock(), /ALREADY_RUNNING/); } finally { await release(); }
    await fs.chmod(paths.file, 0o644);
    await assert.rejects(loadConfig(), /NOT_OWNER_ONLY/);
  } finally {
    if (previous === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = previous;
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

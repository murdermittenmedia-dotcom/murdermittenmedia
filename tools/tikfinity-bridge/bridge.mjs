#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Writable } from 'node:stream';
import { assertNodeSupported, validateServerUrl, postJson } from './protocol.mjs';
import { configPaths, loadConfig, saveConfig, acquireRunLock } from './config.mjs';
import { runBridge } from './runtime.mjs';
const HELP = `TikFinity Review Bridge V2 (Node 22+, same Windows streaming PC)\nnode bridge.mjs pair             Interactive HTTPS website, device label, hidden code\nnode bridge.mjs run              Read local TikFinity events; outbound HTTPS only\nnode bridge.mjs --simulate       Synthetic fixtures; server testMode:true required\nnode bridge.mjs --check-config   Check runtime/config without network or secrets\nnode bridge.mjs --help\nNo credential arguments, local servers, TTS/audio or TikFinity settings control.\n`;
async function hiddenCode() {
  if (!stdin.isTTY || !stdout.isTTY) throw new Error('PAIR_REQUIRES_INTERACTIVE_TERMINAL_NO_CREDENTIAL_ARGUMENTS');
  let muted = false;
  const sink = new Writable({ write(chunk, encoding, callback) { if (!muted) stdout.write(chunk, encoding); callback(); } });
  const rl = createInterface({ input: stdin, output: sink, terminal: true });
  try {
    stdout.write('Short-lived admin pairing code (hidden): '); muted = true;
    const value = await rl.question(''); stdout.write('\n'); return value.trim();
  } finally { muted = false; rl.close(); }
}
async function pair() {
  if (!stdin.isTTY || !stdout.isTTY) throw new Error('PAIR_REQUIRES_INTERACTIVE_TERMINAL');
  const rl = createInterface({ input: stdin, output: stdout });
  let serverUrl, deviceLabel;
  try {
    serverUrl = validateServerUrl((await rl.question('Website HTTPS origin (e.g. https://murdermittenmedia.com): ')).trim());
    deviceLabel = (await rl.question('Device label (e.g. Streaming PC): ')).trim();
    if (!deviceLabel || deviceLabel.length > 80 || /[\u0000-\u001f\u007f]/.test(deviceLabel)) throw new Error('INVALID_DEVICE_LABEL');
    stdout.write(`Pair only if you trust ${serverUrl}. The bridge secret will be stored owner-restricted locally.\n`);
  } finally { rl.close(); }
  let pairingCode = await hiddenCode();
  if (!/^[A-Za-z0-9_-]{4,128}$/.test(pairingCode)) throw new Error('INVALID_PAIRING_CODE');
  const credentials = await postJson(serverUrl, '/api/review-bridge/pair', { pairingCode, deviceLabel });
  pairingCode = ''; // Avoid retaining it beyond pairing; JS strings cannot guarantee secure erasure.
  const file = await saveConfig({ version: 2, serverUrl, deviceLabel, bridgeId: credentials?.bridgeId, secret: credentials?.secret });
  console.log(`PAIRED. Config saved at ${file}. Secret and pairing code are not displayed.`);
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1) throw new Error('CREDENTIAL_AND_EXTRA_ARGUMENTS_NOT_SUPPORTED');
  const command = args[0] || '--help';
  if (['--help', 'help'].includes(command)) { stdout.write(HELP); return; }
  assertNodeSupported();
  if (command === 'pair') { await pair(); return; }
  if (['--check-config', 'check-config'].includes(command)) {
    console.log(`NODE_SUPPORTED (${process.versions.node}); LOCAL_ENDPOINT_LOOPBACK_ONLY; HTTPS_TLS_REQUIRED.`);
    try { await loadConfig(); console.log('CONFIG_VALID_OWNER_RESTRICTED; secrets not displayed; no network test performed.'); }
    catch (error) { if (error.code === 'ENOENT') throw new Error('NOT_CONFIGURED_RUN_PAIR'); throw error; }
    return;
  }
  if (!['run', '--simulate', 'simulate'].includes(command)) throw new Error('UNKNOWN_COMMAND_USE_HELP');
  const config = await loadConfig(), release = await acquireRunLock();
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try { await runBridge(config, { testMode: command !== 'run', signal: controller.signal }); }
  finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); await release(); }
}
main().catch(error => {
  // Never print arbitrary provider/network errors, raw payloads, config or stack traces.
  const safe = typeof error.message === 'string' && /^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : 'BRIDGE_FAILED_REDACTED_SEE_README';
  console.error(safe); process.exitCode = 1;
});

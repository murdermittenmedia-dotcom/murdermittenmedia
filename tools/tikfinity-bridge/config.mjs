import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateServerUrl } from './protocol.mjs';
export function configPaths() {
  const root = process.platform === 'win32' ? (process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')) : (process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'));
  const directory = path.join(root, 'MurderMittenMedia', 'TikFinityBridgeV2');
  return { directory, file: path.join(directory, 'config.json'), lock: path.join(directory, 'running.lock') };
}
function windowsRestrict(target, directory = false) {
  // Numeric Windows identity SID avoids localized names. No shell interpolation.
  const script = fileURLToPath(new URL('./restrict-config.ps1', import.meta.url));
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-Target', target, ...(directory ? ['-Directory'] : [])], { windowsHide: true, stdio: 'ignore' });
  } catch { throw new Error('WINDOWS_OWNER_ACL_FAILED'); }
  // Process-only policy bypass; machine/user execution policy is not changed.
}
async function restrict(target, directory = false) {
  if (process.platform === 'win32') windowsRestrict(target, directory);
  else await fs.chmod(target, directory ? 0o700 : 0o600);
}
export function validateConfig(value) {
  if (!value || value.version !== 2 || typeof value.bridgeId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(value.bridgeId) || typeof value.secret !== 'string' || value.secret.length < 32 || value.secret.length > 512 || typeof value.deviceLabel !== 'string' || !value.deviceLabel || value.deviceLabel.length > 80) throw new Error('INVALID_CONFIG_REPAIR_BY_PAIRING');
  return { version: 2, serverUrl: validateServerUrl(value.serverUrl), bridgeId: value.bridgeId, secret: value.secret, deviceLabel: value.deviceLabel };
}
async function checkProtected(target, directory = false) {
  const stat = await fs.lstat(target);
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile())) throw new Error('UNSAFE_CONFIG_PATH');
  if (process.platform !== 'win32' && ((stat.mode & 0o077) !== 0 || stat.uid !== process.getuid())) throw new Error('CONFIG_NOT_OWNER_ONLY');
  if (process.platform === 'win32') windowsRestrict(target, directory);
}
export async function saveConfig(value) {
  const config = validateConfig(value), { directory, file } = configPaths();
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await restrict(directory, true);
  await checkProtected(directory, true);
  try { await checkProtected(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temp = path.join(directory, `${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temp, `${JSON.stringify(config, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    await restrict(temp);
    await fs.rename(temp, file);
    await restrict(file);
  } finally { await fs.rm(temp, { force: true }); }
  return file;
}
export async function loadConfig() {
  const { directory, file } = configPaths();
  await checkProtected(directory, true);
  await checkProtected(file);
  const text = await fs.readFile(file, 'utf8');
  if (text.length > 8192) throw new Error('OVERSIZED_CONFIG');
  return validateConfig(JSON.parse(text));
}
export async function acquireRunLock() {
  const { lock } = configPaths();
  let file;
  try { file = await fs.open(lock, 'wx', 0o600); }
  catch (error) { if (error.code === 'EEXIST') throw new Error('BRIDGE_ALREADY_RUNNING_OR_STALE_LOCK_SEE_README'); throw error; }
  try { await file.writeFile(`${process.pid}\n`); await restrict(lock); }
  catch (error) { await file.close(); await fs.rm(lock, { force: true }); throw error; }
  await file.close();
  return () => fs.rm(lock, { force: true });
}

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const MIN_PASSWORD_LENGTH = 8;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > 128) return "Password must be 128 characters or fewer.";
  return null;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const derivedKey = scryptSync(password, salt, KEY_BYTES);
  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [saltHex, keyHex] = storedHash.split(":");
  if (!saltHex || !keyHex) return false;
  try {
    const expected = Buffer.from(keyHex, "hex");
    const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export { MIN_PASSWORD_LENGTH };

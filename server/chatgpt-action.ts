import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { ENV } from "./_core/env";
import { getSetting, setSetting } from "./db";

export function getChatGPTActionApiKey() {
  if (!ENV.cookieSecret) return "";
  return `mmm_${createHash("sha256").update(`${ENV.cookieSecret}:chatgpt-editorial-action:v1`).digest("hex")}`;
}

export function isValidChatGPTActionKey(value: unknown) {
  const expected = getChatGPTActionApiKey();
  return Boolean(expected && typeof value === "string" && value === expected);
}

const MCP_KEY_VERSION_SETTING = "chatgpt_mcp_key_version";

export async function getMcpApiKey() {
  if (!ENV.cookieSecret) return "";
  const version = (await getSetting(MCP_KEY_VERSION_SETTING)) ?? "1";
  return `mmm_mcp_${createHash("sha256").update(`${ENV.cookieSecret}:editorial-mcp:${version}`).digest("hex")}`;
}

export async function isValidMcpApiKey(value: unknown) {
  const expected = await getMcpApiKey();
  if (!expected || typeof value !== "string" || value.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

export async function rotateMcpApiKey() {
  await setSetting(MCP_KEY_VERSION_SETTING, `${Date.now()}-${randomBytes(12).toString("hex")}`);
  return getMcpApiKey();
}

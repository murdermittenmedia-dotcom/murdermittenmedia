import { createHash } from "node:crypto";
import { ENV } from "./_core/env";

export function getChatGPTActionApiKey() {
  if (!ENV.cookieSecret) return "";
  return `mmm_${createHash("sha256").update(`${ENV.cookieSecret}:chatgpt-editorial-action:v1`).digest("hex")}`;
}

export function isValidChatGPTActionKey(value: unknown) {
  const expected = getChatGPTActionApiKey();
  return Boolean(expected && typeof value === "string" && value === expected);
}

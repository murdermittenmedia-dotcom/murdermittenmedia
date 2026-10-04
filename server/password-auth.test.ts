import { describe, expect, it } from "vitest";
import { hashPassword, normalizeUsername, validatePassword, verifyPassword } from "./password-auth";

describe("local account password auth", () => {
  it("normalizes usernames consistently", () => {
    expect(normalizeUsername("  YLG_TWON ")).toBe("ylg_twon");
  });

  it("enforces a usable password length", () => {
    expect(validatePassword("short")).toContain("at least 8");
    expect(validatePassword("a".repeat(8))).toBeNull();
  });

  it("hashes passwords without storing the raw value and verifies them safely", () => {
    const password = "MurderMitten!2026";
    const hash = hashPassword(password);
    expect(hash).not.toContain(password);
    expect(hash.split(":")).toHaveLength(2);
    expect(verifyPassword(password, hash)).toBe(true);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });
});

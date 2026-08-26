import { describe, expect, it } from "vitest";
import { sanitizeChatAvatarUrl } from "../shared/chat-avatar";

describe("sanitizeChatAvatarUrl", () => {
  it("keeps project storage paths and secure remote images", () => {
    expect(sanitizeChatAvatarUrl("/manus-storage/avatars/user-1.webp")).toBe("/manus-storage/avatars/user-1.webp");
    expect(sanitizeChatAvatarUrl("https://cdn.example.com/avatar.webp")).toBe("https://cdn.example.com/avatar.webp");
  });

  it("rejects unsafe, empty, and oversized values", () => {
    expect(sanitizeChatAvatarUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeChatAvatarUrl("http://cdn.example.com/avatar.webp")).toBeNull();
    expect(sanitizeChatAvatarUrl("   ")).toBeNull();
    expect(sanitizeChatAvatarUrl("x".repeat(1025))).toBeNull();
    expect(sanitizeChatAvatarUrl(null)).toBeNull();
  });
});

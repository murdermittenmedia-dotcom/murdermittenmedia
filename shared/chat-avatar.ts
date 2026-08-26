export function sanitizeChatAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 1024) return null;

  if (trimmed.startsWith("/manus-storage/")) return trimmed;
  if (trimmed.startsWith("https://")) return trimmed;
  return null;
}

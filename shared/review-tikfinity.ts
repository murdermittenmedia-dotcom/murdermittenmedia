export type TikFinityReviewEvent = {
  kind: "chat" | "gift"; roomId: string; messageId: string; userId: string;
  handle?: string; displayName?: string; comment?: string; occurrenceId?: string;
  giftId?: string; giftType?: number; repeatCount?: number; repeatEnd?: boolean; streakId?: string;
};
/** Provider fields must be present. Display names never serve as user identity,
 * and timestamps/random strings never substitute for missing message IDs. */
export function normalizeTikFinityReviewEvent(message: unknown, roomId: string, occurrenceId?: string | null): TikFinityReviewEvent | null {
  if (!message || typeof message !== "object") return null;
  const raw = message as { event?: string; data?: any };
  if ((raw.event !== "chat" && raw.event !== "gift") || !raw.data || typeof raw.data !== "object") return null;
  const data = raw.data;
  const numericString = (value: unknown) => typeof value === "string" ? value : typeof value === "bigint" ? String(value) : typeof value === "number" && Number.isSafeInteger(value) ? String(value) : "";
  const userId = numericString(data.userId ?? data.user?.userId ?? data.user?.id);
  const messageId = numericString(data.msgId ?? data.common?.msgId);
  const actualRoom = numericString(data.roomId ?? data.common?.roomId) || roomId;
  if (!userId || !messageId || !/^\d{5,30}$/.test(actualRoom) || actualRoom !== roomId) throw new Error("TikFinity event missing a stable user/message/live-room ID, or belongs to another room.");
  const handle = typeof data.uniqueId === "string" ? data.uniqueId : typeof data.user?.displayId === "string" ? data.user.displayId : undefined;
  const displayName = typeof data.nickname === "string" ? data.nickname : typeof data.user?.nickname === "string" ? data.user.nickname : undefined;
  if (!handle && !displayName) throw new Error("TikFinity must provide the actual user's handle or display name.");
  const base: TikFinityReviewEvent = { kind: raw.event, roomId: actualRoom, userId, messageId, handle, displayName, occurrenceId: occurrenceId ?? undefined };
  if (raw.event === "chat") return { ...base, comment: typeof data.comment === "string" ? data.comment : typeof data.content === "string" ? data.content : "" };
  const giftId = numericString(data.giftId);
  const giftType = typeof data.giftType === "number" ? data.giftType : typeof data.gift?.type === "number" ? data.gift.type : undefined;
  if (!giftId || giftType === undefined) throw new Error("TikFinity gift is missing its gift ID/type; cannot safely resolve streak units.");
  const count = Number(data.repeatCount ?? 1);
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("Invalid cumulative gift count.");
  return { ...base, giftId, giftType, repeatCount: count, repeatEnd: data.repeatEnd === true || data.repeatEnd === 1, streakId: numericString(data.groupId) || undefined };
}

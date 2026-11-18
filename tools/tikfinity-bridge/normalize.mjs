// Documented compatibility profiles: legacy flattened TikTok-Live-Connector and
// current nested user/common fields. No captured TikFinity LIVE payloads exist yet.
export const DEFAULT_COMMANDS = Object.freeze({ fire: '!fire', trash: '!trash', link: '!link' });
export const EVENT_TYPES = Object.freeze(['chat', 'gift', 'follow', 'like', 'share', 'subscribe', 'roomUser']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
const scalarId = value => {
  if (typeof value === 'bigint') return value > 0n ? String(value) : '';
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? String(value) : '';
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value) && value !== '0' ? value : '';
};
export class NormalizationError extends Error {
  constructor(code) { super(code); this.name = 'NormalizationError'; this.code = code; }
}
// Reject conflicting identities, not just missing ones. Never alias generic id to msgId.
const requiredId = (code, values) => {
  const supplied = values.filter(value => value !== undefined && value !== null);
  const ids = supplied.map(scalarId);
  if (!ids.length || ids.some(id => !id) || new Set(ids).size !== 1) throw new NormalizationError(code);
  return ids[0];
};
const optionalText = (value, max) => typeof value === 'string' && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value) ? value : undefined;
const integer = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
export function validateCommands(commands = DEFAULT_COMMANDS) {
  if (!commands || !['fire', 'trash', 'link'].every(key => typeof commands[key] === 'string' && /^![A-Za-z][A-Za-z0-9_-]{0,31}$/.test(commands[key]))) throw new NormalizationError('INVALID_COMMAND_CONFIG');
  if (new Set(Object.values(commands).map(value => value.toLowerCase())).size !== 3) throw new NormalizationError('INVALID_COMMAND_CONFIG');
  return { fire: commands.fire, trash: commands.trash, link: commands.link };
}
export function normalizeTikFinityReviewEventV2(message, context) {
  const raw = object(message);
  if (!EVENT_TYPES.includes(raw.event)) return null;
  const data = object(raw.data), common = object(data.common), user = object(data.user);
  if (!context || !/^\d{5,30}$/.test(context.roomId || '') || !context.streamId || !(context.occurrenceId === null || typeof context.occurrenceId === 'string' && context.occurrenceId)) throw new NormalizationError('INVALID_RECEIPT_CONTEXT');
  const messageId = requiredId('MISSING_OR_CONFLICTING_MESSAGE_ID', [data.msgId, common.msgId]);
  const userId = requiredId('MISSING_OR_CONFLICTING_USER_ID', [data.userId, user.userId, user.id]);
  const roomId = requiredId('MISSING_OR_CONFLICTING_ROOM_ID', [data.roomId, common.roomId]);
  if (!/^\d{5,30}$/.test(roomId) || roomId !== context.roomId) throw new NormalizationError('ROOM_MISMATCH');
  // Nicknames/display names are never handles or identity substitutes.
  const handle = optionalText(data.uniqueId ?? user.displayId ?? user.uniqueId, 64);
  if (handle && !/^@?[A-Za-z0-9._]{1,64}$/.test(handle)) throw new NormalizationError('INVALID_HANDLE');
  const displayName = optionalText(data.nickname ?? user.nickname, 100);
  const base = { kind: raw.event, roomId, messageId, userId, occurrenceId: context.occurrenceId,
    ...(handle ? { handle: handle.replace(/^@/, '') } : {}), ...(displayName ? { displayName } : {}) };
  if (raw.event === 'chat') {
    const commands = validateCommands(context.commands);
    const content = data.comment ?? data.content;
    if (typeof content !== 'string' || content.length > 2048) throw new NormalizationError('INVALID_CHAT_CONTENT');
    const text = content.trim(), lower = text.toLowerCase();
    if (lower === commands.fire.toLowerCase()) return { ...base, comment: commands.fire };
    if (lower === commands.trash.toLowerCase()) return { ...base, comment: commands.trash };
    const parts = text.split(/\s+/);
    if (parts.length === 2 && parts[0].toLowerCase() === commands.link.toLowerCase() && /^[A-Za-z0-9_-]{4,128}$/.test(parts[1])) return { ...base, comment: `${commands.link} ${parts[1]}` };
    return null; // Ordinary TTS/chat is never transmitted or logged.
  }
  if (raw.event === 'gift') {
    const gift = object(data.gift);
    const giftId = requiredId('MISSING_OR_CONFLICTING_GIFT_ID', [data.giftId]);
    if (giftId.length > 64) throw new NormalizationError('INVALID_GIFT_ID_LENGTH');
    const types = [data.giftType, gift.type].filter(value => value !== undefined && value !== null);
    if (!types.length || types.some(value => integer(value) === undefined || value > 100) || new Set(types).size !== 1) throw new NormalizationError('INVALID_GIFT_TYPE');
    const giftType = types[0], repeatCount = integer(data.repeatCount);
    if (repeatCount === undefined || repeatCount < 1 || repeatCount > 1000) throw new NormalizationError('INVALID_REPEAT_COUNT');
    const ends = [false, true, 0, 1];
    if (data.repeatEnd !== undefined && !ends.includes(data.repeatEnd)) throw new NormalizationError('INVALID_REPEAT_END');
    if (giftType === 1 && data.repeatEnd === undefined) throw new NormalizationError('MISSING_STREAK_END');
    // groupId identifies a gift streak, NEVER the genuine provider message ID.
    const streakId = data.groupId === undefined || data.groupId === null ? undefined : requiredId('INVALID_STREAK_ID', [data.groupId]);
    if (giftType === 1 && !streakId) throw new NormalizationError('MISSING_STREAK_ID');
    const giftName = optionalText(data.giftName ?? gift.name, 128);
    return { ...base, giftId, ...(giftName ? { giftName } : {}), giftType, repeatCount,
      ...(data.repeatEnd !== undefined ? { repeatEnd: data.repeatEnd === true || data.repeatEnd === 1 } : {}), ...(streakId ? { streakId } : {}) };
  }
  if (raw.event === 'like') {
    const likeCount = integer(data.likeCount ?? data.count), totalLikeCount = integer(data.totalLikeCount ?? data.total);
    return { ...base, ...(likeCount !== undefined ? { likeCount } : {}), ...(totalLikeCount !== undefined ? { totalLikeCount } : {}) };
  }
  if (raw.event === 'roomUser') {
    // Real snapshots often lack a sender: strict user-ID policy rejects them above.
    // Never derive the sender from ranks[0]. Do not transmit contributor lists.
    const viewerCount = integer(data.viewerCount ?? data.total);
    return { ...base, ...(viewerCount !== undefined ? { viewerCount } : {}) };
  }
  return base; // Follow/share/subscribe are receipt diagnostics only, no sound or votes.
}
export function stableIdDiagnostics(message) {
  const raw = object(message), data = object(raw.data), common = object(data.common), user = object(data.user);
  return { eventType: EVENT_TYPES.includes(raw.event) ? raw.event : 'unsupported',
    messageIdPresent: !!scalarId(data.msgId ?? common.msgId), userIdPresent: !!scalarId(data.userId ?? user.userId ?? user.id),
    roomIdPresent: !!scalarId(data.roomId ?? common.roomId), handlePresent: !!optionalText(data.uniqueId ?? user.displayId ?? user.uniqueId, 64),
    giftIdPresent: !!scalarId(data.giftId), streakIdPresent: !!scalarId(data.groupId) };
}
export function isConfiguredGalaxy(event, galaxyGiftId) {
  // Extra server safety guard: name cannot authorize anything without exact ID.
  // Missing/mismatched name leaves priority pending verification; never guess an ID.
  return event.kind === 'gift' && typeof galaxyGiftId === 'string' && !!galaxyGiftId && event.giftId === galaxyGiftId
    && typeof event.giftName === 'string' && event.giftName.toLowerCase() === 'galaxy';
}

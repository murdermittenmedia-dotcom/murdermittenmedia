import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { DEFAULT_COMMANDS, normalizeTikFinityReviewEventV2, stableIdDiagnostics, isConfiguredGalaxy } from '../shared/review-tikfinity-v2';
import { signedRequest } from '../tools/tikfinity-bridge/protocol.mjs';
const context = { streamId: 'synthetic-stream', roomId: '7390000000000000000', occurrenceId: 'synthetic-occurrence', commands: DEFAULT_COMMANDS };
const base = { msgId: 'SYNTHETIC-msg', userId: 'SYNTHETIC-user', roomId: context.roomId, uniqueId: 'synthetic_viewer' };
describe('V2 documented-shape normalization: synthetic only', () => {
  it('accepts both stable documented profiles without falling back to handles', () => {
    expect(normalizeTikFinityReviewEventV2({ event: 'chat', data: { ...base, comment: '!fire' } }, context)?.comment).toBe('!fire');
    expect(normalizeTikFinityReviewEventV2({ event: 'chat', data: { common: { msgId: 'SYNTHETIC-nested', roomId: context.roomId }, user: { id: 'SYNTHETIC-user', displayId: 'synthetic_nested' }, content: '!trash' } }, context)?.handle).toBe('synthetic_nested');
    expect(() => normalizeTikFinityReviewEventV2({ event: 'chat', data: { ...base, userId: undefined, comment: '!fire' } }, context)).toThrow(/USER_ID/);
  });
  it('does not use groupId as messageId and preserves all gift streak metadata', () => {
    const data = { ...base, giftId: 'SYNTHETIC-gift', giftName: 'Galaxy', giftType: 1, repeatCount: 3, repeatEnd: true, groupId: 'SYNTHETIC-streak' };
    const event = normalizeTikFinityReviewEventV2({ event: 'gift', data }, context)!;
    expect(event).toMatchObject({ messageId: base.msgId, streakId: data.groupId, giftId: data.giftId, giftName: 'Galaxy', giftType: 1, repeatCount: 3, repeatEnd: true });
    expect(isConfiguredGalaxy(event, 'different-id')).toBe(false);
    expect(() => normalizeTikFinityReviewEventV2({ event: 'gift', data: { ...data, msgId: undefined } }, context)).toThrow(/MESSAGE_ID/);
  });
  it('drops ordinary chat and redacts actual values from diagnostics', () => {
    const message = { event: 'chat', data: { ...base, comment: 'private ordinary comment' } };
    expect(normalizeTikFinityReviewEventV2(message, context)).toBeNull();
    const diagnostics = JSON.stringify(stableIdDiagnostics(message));
    for (const value of ['private ordinary comment', base.msgId, base.userId, base.uniqueId]) expect(diagnostics).not.toContain(value);
  });
  it('requires provider room identity instead of substituting active server room', () => {
    expect(() => normalizeTikFinityReviewEventV2({ event: 'chat', data: { ...base, roomId: undefined, comment: '!fire' } }, context)).toThrow(/ROOM_ID/);
  });
  it('signs the exact JSON UTF8 bytes with timestamp newline nonce newline body', () => {
    const config = { bridgeId: 'SYNTHETIC-bridge', secret: 'SYNTHETIC-secret-not-real-credentials' };
    const body = { streamId: context.streamId, events: [], testMode: true };
    const request = signedRequest(config, body, '1730000000000', '11111111-1111-4111-8111-111111111111');
    expect(request.exactBody).toBe(JSON.stringify(body));
    const expected = createHmac('sha256', config.secret).update(`1730000000000\n11111111-1111-4111-8111-111111111111\n${request.exactBody}`, 'utf8').digest('hex');
    expect(request.headers['x-review-signature']).toBe(expected);
  });
});

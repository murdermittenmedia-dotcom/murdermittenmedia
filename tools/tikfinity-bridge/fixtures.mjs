// These are invented documented-shape examples, NOT captured TikTok/TikFinity events.
export function syntheticFixtures(context) {
  const commands = context.commands;
  const base = (msgId, userId = '9000000000000000001') => ({ msgId: `SYNTHETIC-${msgId}`, roomId: context.roomId, userId, uniqueId: 'synthetic_test_viewer' });
  const gift = (name, id, message, extra = {}) => ({ event: 'gift', data: { ...base(message), giftId: id, giftName: name, giftType: 0, repeatCount: 1, repeatEnd: true, ...extra } });
  const configured = context.galaxyGiftId || 'SYNTHETIC-UNCONFIGURED-GALAXY';
  const galaxy = gift('Galaxy', configured, 'galaxy-linked');
  return [
    { label: 'SYNTHETIC fire vote', raw: { event: 'chat', data: { ...base('fire'), comment: commands.fire } } },
    { label: 'SYNTHETIC trash/change vote', raw: { event: 'chat', data: { ...base('trash'), comment: commands.trash } } },
    { label: 'SYNTHETIC link claim intentionally fake', raw: { event: 'chat', data: { ...base('link'), comment: `${commands.link} SYNTHETIC_TEST_ONLY` } } },
    { label: 'SYNTHETIC ordinary chat ignored', raw: { event: 'chat', data: { ...base('ordinary'), comment: 'This ordinary private test text must never be transmitted' } } },
    { label: 'SYNTHETIC Corn', raw: gift('SYNTHETIC Corn', 'SYNTHETIC-CORN', 'corn') },
    { label: 'SYNTHETIC Tom the Tomato', raw: gift('SYNTHETIC Tom the Tomato', 'SYNTHETIC-TOMATO', 'tomato') },
    { label: 'SYNTHETIC Fire gift', raw: gift('SYNTHETIC Fire', 'SYNTHETIC-FIRE', 'fire-gift') },
    { label: 'SYNTHETIC Heart Me', raw: gift('SYNTHETIC Heart Me', 'SYNTHETIC-HEART', 'heart') },
    { label: 'SYNTHETIC Follow no cooldown', raw: { event: 'follow', data: base('follow') } },
    { label: 'SYNTHETIC Galaxy linked candidate requires fake server link setup', raw: galaxy },
    { label: 'SYNTHETIC duplicate Galaxy/reconnect replay same provider ID', raw: structuredClone(galaxy) },
    { label: 'SYNTHETIC Galaxy unmatched candidate', raw: { ...gift('Galaxy', configured, 'galaxy-unmatched'), data: { ...gift('Galaxy', configured, 'galaxy-unmatched').data, userId: '9000000000000000002', uniqueId: 'synthetic_unmatched_viewer' } } },
    { label: 'SYNTHETIC simultaneous second Galaxy candidate', raw: { ...gift('Galaxy', configured, 'galaxy-second'), data: { ...gift('Galaxy', configured, 'galaxy-second').data, userId: '9000000000000000003', uniqueId: 'synthetic_second_viewer' } } },
    { label: 'SYNTHETIC gift streak interim 1', raw: gift('SYNTHETIC Streak', 'SYNTHETIC-STREAK', 'streak-1', { giftType: 1, repeatCount: 1, repeatEnd: false, groupId: 'SYNTHETIC-STREAK-GROUP' }) },
    { label: 'SYNTHETIC gift streak interim 2', raw: gift('SYNTHETIC Streak', 'SYNTHETIC-STREAK', 'streak-2', { giftType: 1, repeatCount: 2, repeatEnd: false, groupId: 'SYNTHETIC-STREAK-GROUP' }) },
    { label: 'SYNTHETIC gift streak final same cumulative 2', raw: gift('SYNTHETIC Streak', 'SYNTHETIC-STREAK', 'streak-end', { giftType: 1, repeatCount: 2, repeatEnd: true, groupId: 'SYNTHETIC-STREAK-GROUP' }) },
    { label: 'SYNTHETIC Like', raw: { event: 'like', data: { ...base('like'), likeCount: 15, totalLikeCount: 15 } } },
    { label: 'SYNTHETIC Share', raw: { event: 'share', data: base('share') } },
    { label: 'SYNTHETIC Subscribe diagnostic only', raw: { event: 'subscribe', data: base('subscribe') } },
    { label: 'SYNTHETIC room snapshot with explicit sender', raw: { event: 'roomUser', data: { ...base('room'), viewerCount: 12 } } },
    { label: 'SYNTHETIC nested documented chat', raw: { event: 'chat', data: { common: { msgId: 'SYNTHETIC-nested', roomId: context.roomId }, user: { id: '9000000000000000004', displayId: 'synthetic_nested_viewer' }, content: commands.fire } } },
    { label: 'SYNTHETIC missing message ID rejected', raw: { event: 'chat', data: { roomId: context.roomId, userId: '9000000000000000001', uniqueId: 'synthetic_test_viewer', comment: commands.fire } } },
    { label: 'SYNTHETIC missing sender rejected', raw: { event: 'roomUser', data: { msgId: 'SYNTHETIC-no-sender', roomId: context.roomId, total: 12 } } },
    { label: 'SYNTHETIC groupId cannot replace msgId', raw: { event: 'gift', data: { userId: '9000000000000000001', roomId: context.roomId, giftId: configured, giftType: 1, groupId: 'SYNTHETIC-not-a-message', repeatCount: 1, repeatEnd: true } } },
    { label: 'SYNTHETIC wrong room rejected', raw: { event: 'chat', data: { ...base('wrong-room'), roomId: context.roomId === '9999999999999999999' ? '8888888888888888888' : '9999999999999999999', comment: commands.fire } } },
    { label: 'SYNTHETIC unsupported event ignored', raw: { event: 'giftBroadcast', data: base('not-a-gift') } },
  ];
}

# TikTok LIVE connection findings

The session has no enabled TikTok LIVE event connector and no TikTok/TikFinity credentials configured. This update does not claim an account connection has been verified.

TikFinity documents a local WebSocket event API at `ws://localhost:21213/`. Its desktop application must run on the same streaming computer. Messages use `{ event: "chat" | "gift" | ..., data: ... }` and refer to TikTok-Live-Connector for payload fields. Source: https://tikfinity.zerody.one/tiktok/dapi

TikTok's public developer product catalog does not establish individual LIVE poll voter access. Native poll totals must remain separate; no poll totals are merged into the Murder Mitten scoreboard. Source: https://developers.tiktok.com/products

The compatible third-party event library is unofficial, not affiliated with TikTok. Gift receipt events are distinct from gift-broadcast notices, prompts and goal updates. Streak counts are cumulative and must use repeatCount/repeatEnd and gift type; field availability is not guaranteed. Source: https://ttlc.docs.isaackogan.com/events/gifts-and-goals/

For a streak without a reliable stable group ID, defer its units until the genuine final gift receipt, deduplicate by the provider message ID, and trigger its final repeatCount units together. With a stable streak ID, apply only newly resolved cumulative units. Never invent user IDs, message IDs, gift IDs, stream identities, native poll permissions or a working account connection.

The integration requires an authenticated site administrator on the streaming computer to connect the local TikFinity event API for the actual live room. It requires no new paid server or public URL credentials. Missing stable identifiers are rejected rather than counted as unverifiable votes or gifts.

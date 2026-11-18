# TikFinity Review Bridge V2

Run this package on the **same Windows streaming PC as TikFinity**, with Node.js 22 or newer. It reads the documented `ws://localhost:21213/` Event API and sends only selected normalized receipts to the website over authenticated HTTPS. It creates no web server, never exposes a local port, does not control TikFinity settings, and has no audio/TTS implementation. No paid service or purchase is required.

**Live Verification Pending.** Compatibility is based on public documentation and synthetic fixtures. No real TikFinity payloads, active streamer, actual Galaxy purchase, Windows ACL execution, OBS recording, or real end-to-end LIVE session were available during this implementation. Passing simulator tests does not establish real gift authenticity or working queue priority.

## Windows quick start

Copy this entire folder to the streaming PC. Open PowerShell in this folder and run:

```powershell
node --version
npm install
node bridge.mjs --check-config
node bridge.mjs pair
node bridge.mjs --check-config
node bridge.mjs run
```

The first config check intentionally says `NOT_CONFIGURED_RUN_PAIR` before pairing. `pair` interactively asks for the website HTTPS origin, a device label, and the short-lived admin pairing code. The code is hidden while typing; no pairing code or secret belongs in command arguments, screenshots, shell history, environment variables or logs. Only pair with your own trusted website. The backend/admin pairing UI is integrated separately by the parent build.

Equivalent wrapper commands are:

```powershell
.\start.ps1 -Command pair
.\start.ps1 -Command check-config
.\start.ps1 -Command run
.\start.ps1 -Command simulate
```

If your local policy blocks this downloaded wrapper, use the direct `node` commands. You do not need to change machine-wide execution policy. Stop with Ctrl+C. Run only one instance: a local exclusive lock prevents live and simulated instances sharing this config. After a crash, verify in Task Manager that no bridge is running before deleting `running.lock` from the config folder. Do not remove the lock while another instance is active.

The default secret file is `%LOCALAPPDATA%\MurderMittenMedia\TikFinityBridgeV2\config.json`. The Windows helper removes inherited and explicit access rules, sets the current user as owner, and grants only that user full control. ACL failure aborts rather than storing unrestricted credentials. Administrators can still take ownership; this is permission protection, not at-rest encryption. Linux uses `$XDG_CONFIG_HOME/MurderMittenMedia/TikFinityBridgeV2` or `~/.config/MurderMittenMedia/TikFinityBridgeV2`, directory mode `0700` and file mode `0600`. Avoid synced/shared folders. Revoke the bridge in the admin UI if the PC or config is compromised; pair again for replacement credentials.

`--check-config` checks Node support, credential shape and local permissions without network traffic or displaying secrets. It does not prove the website or TikFinity is connected. Certificate validation must remain enabled. HTTPS origins only are accepted; credentials embedded in URLs, redirects and HTTP downgrade are refused.

## Exact outbound API contract

`POST /api/review-bridge/pair`, JSON body `{pairingCode, deviceLabel}`, returns `{bridgeId, secret}`. Only the pair call is unauthenticated; the backend must validate a short-lived, single-use admin-issued code. The bridge never prints the returned secret.

Both remaining endpoints use these headers:

```text
content-type: application/json
x-review-bridge-id: <bridgeId>
x-review-timestamp: <decimal epoch milliseconds>
x-review-nonce: <new UUID for each HTTP attempt>
x-review-signature: <lowercase hex HMAC-SHA256>
```

The HMAC uses the UTF-8 secret as its key and the exact transmitted UTF-8 text as its message:

```text
timestamp + '\n' + nonce + '\n' + exact JSON body
```

`JSON.stringify` runs once per HTTP attempt. The signed text is sent without reserialization. Retry attempts get fresh timestamps/nonces/signatures; event receipt UUIDs and original receipt times remain unchanged. The backend must authenticate the **raw body bytes**, enforce timestamp age and consume nonces atomically.

`POST /api/review-bridge/heartbeat` body is `{localConnected:boolean, testMode:boolean, roomId?:string}`. Response is `{streamId, roomId, occurrenceId, commands:{fire,trash,link}, enabled:boolean, galaxyGiftId:string|null, testMode:boolean}`. `occurrenceId` is a string or `null`. The simulator requires `testMode:true` explicitly from the server before emitting any fixture; normal run refuses a test-mode response. Commands default to `!fire`, `!trash`, `!link` through the shared default; enabled heartbeat responses must supply valid command settings.

`POST /api/review-bridge/events` body is `{streamId, events:[{receiptId:UUID, receivedAtMs:number, event:normalized}], testMode:boolean}`. A successful response means the backend has terminally accounted for every receipt in the batch, including duplicates/declines/diagnostic-only receipts; it must not return HTTP success for unaccounted partial work. Response JSON may contain `{results:[...]}`; there is no required events-response field. The parent backend must reject or isolate synthetic/testMode receipts **before any vote or queue mutation**, log them as simulated, and explicitly acknowledge isolated test mode in the heartbeat response. It must enforce the matching mode independently on every events request. A client flag alone is not a safety mechanism.

The normalized event contains `kind`, `roomId`, genuine provider `messageId`, provider `userId`, receipt-time `occurrenceId`, and optionally actual `handle` and `displayName`. Chat contains only a recognized vote command or link command plus its code. Gift contains `giftId`, optional diagnostic `giftName`, `giftType`, `repeatCount`, optional `repeatEnd`, and optional `streakId`; streakable gifts require explicit end state and streak ID. Likes may contain `likeCount`/`totalLikeCount`; room snapshots may contain `viewerCount`. Follow/share/subscribe carry identity/context only and cannot trigger sound, votes or priority locally.

The parent server requests an extra Galaxy safety gate: **exact admin-configured gift ID AND an actual case-insensitive gift name of `Galaxy`**. A name alone never authorizes a reward; no guessed Galaxy ID is shipped. Missing/mismatched gift names mean diagnostic/pending verification, not queue action. The local bridge forwards gift metadata and never awards priority itself. Gift streak counting, exact-once redemption, linking, paid/admin safety and ordering remain server-owned. The parent's `!link` proof uses a one-time 12-hex code, expiring in five minutes; typing a handle alone is not proof.

## Receipt and privacy behavior

Flattened fields `data.msgId`, `data.userId`, `data.roomId`, `data.uniqueId`, `data.comment`, plus documented nested `data.common.msgId`/`roomId`, `data.user.id`/`userId`, `data.user.displayId`, and `data.content` are supported. Actual `data.nickname`/`data.user.nickname` are optional display metadata, never identity or handles. Conflicting identifiers, unsafe numeric IDs, missing provider IDs, malformed gifts and wrong rooms are rejected. A timestamp, UUID, username, nickname, gift `groupId`, or server room never substitutes for missing provider identity.

All seven TikFinity-documented envelope types are considered. Real `roomUser` snapshots commonly lack a sender; those are rejected under the stable-user-ID requirement, not attributed to the top contributor. The current upstream connector renamed some subscription events; this bridge handles TikFinity's documented `subscribe` envelope only, not guessed aliases. Real captures are needed to establish installed-version compatibility.

Heartbeat/context refresh occurs about every three seconds and before event sends/retries. Receipts require context no older than 15 seconds. Stream/room/occurrence context is frozen when each event is received, never reassigned on retry. Queued events are dropped with explicit logs when the current stream/room/occurrence advances; therefore old votes cannot be rewritten as new-occurrence votes. The server must independently compare occurrence and stream transactionally because a transition may occur between the heartbeat and POST.

The in-memory queue holds at most 500 receipts, with at most 25 per batch. Overflow stops intake and exits with an explicit error rather than evicting receipts invisibly. Events older than two minutes are explicitly dropped, not replayed as fresh. Context changes drop all old-context queued events, including gifts: safety is preferred to replaying a delayed priority request into a different review. Reconcile genuine missed gifts through authorized admin controls if required.

WebSocket reconnect and outbound retries use bounded exponential delays. WebSocket protocol pings check transport health only; no TikFinity application/control commands are sent. All followers/gifts are forwarded without any per-user or gift cooldown. Provider duplicates/streak updates remain visible to server deduplication. Server rate limits are transport safeguards, not hidden gift cooldowns.

The queue is deliberately **not disk-backed**. Ctrl+C, process crashes, expiry, queue overflow or explicit server disable can lose unacknowledged receipts; graceful shutdown reports remaining queued counts, and next startup does not replay an old disk queue. A successful TCP/WS connection means local transport is connected, not that TikTok LIVE events or gifts have been verified. A health heartbeat shows local socket state; status/last accepted event is determined by the backend.

Ordinary comments never travel to the website and never appear in diagnostics. Valid link proof text travels only to the authenticated server; it is not logged locally. Logs contain fixed status/error codes, counts, presence booleans and package-owned synthetic labels, not raw IDs, handles, nicknames, comments, link codes, signatures or secrets. Raw events and server error bodies are not written to disk. If capturing terminal output yourself, apply short retention and do not add raw payload logging.

## Simulator and focused tests

The simulator uses no local socket, never injects anything into TikFinity and creates no listener. It still requires paired config and an HTTPS backend that explicitly supports isolated testMode.

```powershell
node bridge.mjs --simulate
npm test
```

From the website project root, run only the new targeted test:

```text
pnpm exec vitest run server/review-tikfinity-v2.test.ts
```

Fixtures are **synthetic, not observed**: fire/trash/change votes, a deliberately fake link proof, ignored ordinary chat, Corn, Tomato, Fire, Heart Me, Follow, Galaxy candidates for linked/unmatched/multiple requests, a repeated/reconnect Galaxy provider ID, gift streak interim/final cumulative counts, like/share/subscribe/roomUser, nested documented chat, missing message/sender identity, gift group-ID misuse, wrong room and unsupported gift-broadcast events. Synthetic IDs/handles and logs are explicitly labeled. Gift name `Galaxy` is retained exactly only to exercise the parent's extra gate; the test flag and synthetic IDs still prohibit actual awards.

This tests normalization, redaction, signing, receipt context, retry identity/time retention, stale/advanced drops, bounded overflow and test acknowledgements. It **does not prove** a linked Galaxy grant, unmatched reconciliation, concurrent redemption transaction, votes/real queue safety, or active-song preservation. Those backend semantics require parent server tests; fake fixture labels alone do not establish their outcomes.

## Live and audio checks still required

On the streaming PC, run TikFinity with its existing Event API enabled and start the paired bridge. Start a real LIVE session and confirm the admin sees current room/stream and accepted stable-ID events. Verify vote/link commands, missing-ID rejection and wrong-room rejection using safely redacted diagnostics. Disconnect/reconnect TikFinity and confirm delivery/duplicate protections. Advance and requeue a song and verify previous-occurrence votes do not carry over. Confirm the configured actual Galaxy ID from a real received payload; do not infer it from a name. An authorized real Galaxy test still needs correct user link, eligible pending song, single-use redemption, repeated/streak deduplication and no interruption of the current song.

This package leaves all TikFinity sound mappings, ALL-viewer chat TTS, points settings, filters and follow cooldown settings untouched. It does not purchase Pro. Official TikFinity's feature comparison currently lists **five free sound alerts, five Actions & Events, and 100 daily TTS snippets**.[1] The six desired triggers therefore cannot be assumed to fit six independent free sound slots. Preserve existing Corn, Tomato, Fire, Galaxy and Follow mappings where that is the user's setup; Heart Me may remain silent or use a supported shared/free rule after manually checking actual capacity. Installed/account limits should be checked again before use; all-comment TTS is not unlimited.

Use one OBS application-audio capture of the TikFinity app, or one intentional desktop-audio path—not both. In LIVE Studio use one intentional TikFinity/application audio source. Keep V1's five visual browser sources silent and retain the separate coordinated manual admin sound source. Do a local test recording to check one viewer-triggered sound/TTS feed, the working manual admin soundboard and no desktop/browser/admin echo triangle. This recording has not been performed here.

## References

[1]: https://tikfinity.zerody.one/tiktok/dapi "Official TikFinity Event API and feature comparison"
[2]: https://github.com/zerodytrash/TikTok-Live-Connector "Underlying unofficial TikTok-Live-Connector documentation"
[3]: https://ttlc.docs.isaackogan.com/events/chat-and-audience/ "Documented nested chat user and audience payloads"
[4]: https://ttlc.docs.isaackogan.com/events/gifts-and-goals/ "Documented gift metadata and cumulative streak behavior"
[5]: https://ttlc.docs.isaackogan.com/events/subscriptions-and-fans/ "Modern upstream subscription aliases and subtype cautions"

TikFinity documents the same-PC endpoint and event/data envelope in [1], and links its payload reference to [2]. Current nested-field examples and semantic cautions are in [3]–[5]. None of these sources constitute observed verification of this user's installed app or cryptographic TikTok verification.

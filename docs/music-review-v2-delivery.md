# Murder Mitten Media — Music Review V2

**Status:** Code implemented and validated in the existing project. Real TikFinity LIVE / Galaxy verification remains pending. This report does not claim that an actual gift-triggered queue jump or OBS audio recording was performed.

## Changes

| Area | Focused update |
|---|---|
| Queue tracking | Public Queue tab uses the existing committed queue. Current song, Up Next, waiting order and recent results update automatically. Only public display fields are returned by the new public endpoint. |
| Personal tracking | Browser ownership uses the existing signed opaque cookie, not fingerprinting. Signed-in account submissions appear across devices. Private recovery links use random credentials; only hashes are stored. New tracking links rotate/revoke previous links. |
| Mobile | Below 640px, Submit appears before the player/chat, with Queue nearby, tighter information blocks, 44px controls and fixed navigation clearance. Desktop and OBS designs are preserved. |
| TikFinity | Same-PC outbound HTTPS connector, admin-only expiring pairing, encrypted server credentials, signed exact-byte requests, nonce/time replay rejection, diagnostics with seven-day retention, bounded retries and honest health states. No public localhost access or port forwarding. |
| Voting | Only configured exact `!fire` and `!trash` commands count. A reliable TikTok user has one effective vote per occurrence; changing commands replaces the choice. Normal chat/TTS is not voting. Website identities/native polls remain separate. |
| Galaxy | Only the configured actual Galaxy gift ID plus actual Galaxy name qualifies. Gifts are held for admin confirmation. One-time `!link` proof binds a TikTok account to a private submission. Unmatched gifts cannot move a random song. Single-use transactions retain the current song, verified-payment eligibility, paid-priority commitments and deterministic receipt ordering. |
| Admin/audio | Pairing, health, redacted receipts and Galaxy reconciliation live in the existing admin pop-out’s Audio & Soundboard section. Existing manual soundboard, review controls and five visual sources remain. Website gift receipts no longer trigger a second copy of TikFinity-owned viewer audio. |
| Paid-only | Free submissions are blocked server-side in paid-only mode. Paid proof can create a pending entry for administrator verification; unverified entries cannot play. Existing quotas, prices and payment integrations remain. |

No marketing/email system, TikFinity Pro purchase, external paid service, domain change or new hosting was introduced. Historical submissions were preserved.

## Website routes

- Review and public Queue tab: `https://murdermittenmedia.com/review`
- Existing admin pop-out: `https://murdermittenmedia.com/admin-popout`
- Browser/account tracking: `https://murdermittenmedia.com/review/track`
- Individual private link: issued by **Copy private tracking link**, with its credential in a URL fragment. Open the complete copied link; do not publish it. The page removes the credential from the address bar before ads/analytics, disables those scripts for this route, and resolves it via POST.

These production URLs require the new checkpoint to be published. This execution validated the preview; no separate deployment tool was available. Publish the saved checkpoint through the project’s Publish control, then refresh the site/OBS sources. Existing five visual OBS URLs, dimensions and coordinated manual-sound source were not changed.

## Windows setup

1. Download and extract the supplied **MurderMittenMedia-TikFinity-Bridge-V2.zip** on the same Windows streaming PC as TikFinity. Install Node.js 22 or newer if needed.
2. Publish V2, then sign into the existing admin pop-out. Open **Audio & Soundboard → TikFinity bridge**.
3. Use the **actual LIVE room ID** from TikFinity’s real events. Generate a five-minute pairing code. Never guess a room or gift ID; if no real room is available, leave setup unconfigured until LIVE.
4. Open PowerShell inside the extracted folder:

```powershell
node --version
npm install
node bridge.mjs pair
node bridge.mjs --check-config
node bridge.mjs run
```

During `pair`, enter `https://murdermittenmedia.com`, a device label and the hidden pairing code. Never add codes/secrets to command arguments or an OBS URL. Keep one connector instance running. Close with Ctrl+C. No local server, public port or port forwarding is used. The website cannot run this same-PC connector on your behalf.

Credentials are kept in the Windows current-user-restricted config under `%LOCALAPPDATA%\MurderMittenMedia\TikFinityBridgeV2`. The Windows ACL helper fails closed; Windows execution itself is still pending verification. Server credentials are encrypted using the existing server `JWT_SECRET`. **No new environment variable is required.** Revoke the paired connector in admin if compromised; rotating `JWT_SECRET` requires re-pairing.

Health states are **Not Configured**, **Connected**, **Live Events Received**, **Reconnecting**, **Disconnected** and **Test Mode**. Connected means local transport/heartbeat, not verified gift authenticity. The admin panel explicitly shows **Live Verification Pending**.

For isolated synthetic testing, enable Test Mode in admin first and then run:

```powershell
node bridge.mjs --simulate
```

The server independently enforces isolated Test Mode. Simulated events cannot grant real votes, gifts, priority or sound. Switch back to live mode before normal `run`.

## Artist linking and Galaxy confirmation

An eligible artist opens My Submission/private tracking, chooses **Link TikTok**, then sends the generated `!link <one-time-code>` from their own TikTok LIVE account. The code expires in five minutes. Typing a handle alone is not ownership proof.

The administrator obtains the exact Galaxy ID from actual diagnostics and configures it. A matching receipt appears in Galaxy requests. Confirm the linked eligible waiting song. If unlinked, independently verify ownership, explicitly select **Admin reconciliation**, and provide an audit reason—or decline. Gifts do not pay an unpaid entry, interrupt the active song, or grant automatic publication/other permissions.

## Validation

- V1 baseline: **73 files / 393 tests passed**.
- Final project regression: **76 files / 436 tests passed**, including 24 tracking cases, 13 bridge/auth/Galaxy cases and 5 V2 normalization cases.
- Standalone connector: **12 Node tests passed**.
- `pnpm check`, `git diff --check`, and production build: **passed**. Existing bundle-size/dependency configuration warnings remain; no related broad dependency changes were made.
- Paid-only ON/OFF, daily cap, ownership/recovery, queue transitions, current/next order, requeue/completion, occurrence votes, non-Galaxy safety, matched/unmatched gifts, replay/streaks, simultaneous requests and active-song preservation: **automated service/fixture tests**, not real purchases.
- Preview screenshots checked at **375×812** and **1280×900**. The authenticated screenshot session showed account-owned terminal records; an unauthenticated browser showed no personal submissions. Anonymous public API returned HTTP 200 with only public fields. Recovery page had no audio/video/iframe, ads, analytics or Axios CDN script, and used no-referrer policy.
- An additional isolated preview environment could not render this project (preview-only blank canvas); this was not treated as successful verification. The available anonymous browser and authenticated screenshot session provided read-only access checks instead.
- One intermediate OBS isolation assertion failed because its source slice included the newly adjacent private route. The shells were separated; the final suite passes. No unresolved automated failures remain.

No real song/payment was submitted, queue reordered, stream started/ended or actual gift purchased for verification. Live two-device transition observation, a real paid checkout, Windows runtime/ACL verification, actual TikFinity payload capture and OBS recording are **pending**, not passed.

## LIVE / OBS checks still required

1. Run TikFinity and the connector on the streaming PC during an actual TikTok LIVE. Confirm real room/stream and reliable event IDs; inspect only redacted diagnostics. Documented flattened/nested payloads were implemented; installed-version compatibility was not observed live.
2. Send `!fire`, repeat it, then `!trash`; confirm one effective vote with replacement. Advance/requeue a song and confirm votes reset by occurrence. Disconnect/reconnect and confirm stale receipts do not become new-track votes.
3. Link an eligible submission with the one-time command. Receive an authorized real Galaxy, confirm actual name/ID, approve once, and verify the target waits behind current/paid commitments. Verify duplicate/streak receipts do not award again. Do not represent simulator tests as real gift verification.
4. In OBS, capture **TikFinity application audio once**, or use one intentional desktop-audio path—not both. Keep the five visual browser sources silent; preserve the separate manual admin sound source. In LIVE Studio likewise select one application-audio path. Make a local test recording with a viewer sound/TTS plus one manual soundboard effect, and listen for echo/double playback. No recording was made here.
5. TikFinity settings, all-viewer TTS, disabled points charging, voice/templates/filtering and follower-sound cooldown were not modified. Current official free comparison documents **five sound alerts**, **five Actions & Events**, and **100 daily TTS snippets**; verify actual installed/account capacity. Preserve Corn, Tomato, Fire, Galaxy and Follow. Keep Heart Me through a supported shared/free rule if available, otherwise silent support. No Pro purchase; no unlimited-TTS claim.

## Rollback and migration

Pre-V2 checkpoint: `e69e4422`. The additive migration is `drizzle/0072_windy_boomer.sql` and was generated, reviewed and applied. It adds private recovery/bridge/link/redemption tables and nullable occurrence `completionReason`; it does not recreate the queue or delete history. Reverting application code can leave these additive tables safely in place; do not delete audit/recovery data as a routine rollback.

## Exact changed-file manifest

The following manifest records source, migration metadata and connector files changed for V2. Delivery documentation is additional; credentials, runtime config, node_modules and raw provider logs are excluded from the downloadable package.

```text
 [31mM[m client/index.html
 [31mM[m client/src/App.tsx
 [31mM[m client/src/components/ReviewTikTokConnection.tsx
 [31mM[m client/src/pages/MusicReview.tsx
 [31mM[m drizzle/meta/_journal.json
 [31mM[m drizzle/schema.ts
 [31mM[m server/_core/index.ts
 [31mM[m server/db.ts
 [31mM[m server/review-occurrences.ts
 [31mM[m server/review-studio-events.test.ts
 [31mM[m server/review-studio-router.ts
 [31mM[m server/review-submission-limit.test.ts
 [31mM[m server/review-submission-limit.ts
 [31mM[m server/review-transport.ts
 [31mM[m server/routers.ts
[31m??[m client/src/components/ReviewQueueTracker.tsx
[31m??[m client/src/components/review-queue-v2.css
[31m??[m client/src/pages/ReviewTracking.tsx
[31m??[m drizzle/0072_windy_boomer.sql
[31m??[m drizzle/meta/0072_snapshot.json
[31m??[m drizzle/review-bridge-schema.ts
[31m??[m drizzle/review-tracking-schema.ts
[31m??[m server/review-bridge-http.ts
[31m??[m server/review-bridge-router.ts
[31m??[m server/review-bridge.test.ts
[31m??[m server/review-bridge.ts
[31m??[m server/review-tikfinity-v2.test.ts
[31m??[m server/review-tracking-router.ts
[31m??[m server/review-tracking.test.ts
[31m??[m server/review-tracking.ts
[31m??[m shared/review-tikfinity-v2.ts
[31m??[m shared/review-tracking.ts
[31m??[m tools/tikfinity-bridge/.gitignore
[31m??[m tools/tikfinity-bridge/README.md
[31m??[m tools/tikfinity-bridge/bridge.mjs
[31m??[m tools/tikfinity-bridge/bridge.test.mjs
[31m??[m tools/tikfinity-bridge/config.mjs
[31m??[m tools/tikfinity-bridge/fixtures.mjs
[31m??[m tools/tikfinity-bridge/normalize.d.mts
[31m??[m tools/tikfinity-bridge/normalize.mjs
[31m??[m tools/tikfinity-bridge/package-lock.json
[31m??[m tools/tikfinity-bridge/package.json
[31m??[m tools/tikfinity-bridge/protocol.d.mts
[31m??[m tools/tikfinity-bridge/protocol.mjs
[31m??[m tools/tikfinity-bridge/queue.mjs
[31m??[m tools/tikfinity-bridge/restrict-config.ps1
[31m??[m tools/tikfinity-bridge/runtime.mjs
[31m??[m tools/tikfinity-bridge/start.ps1
```

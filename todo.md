# Murder Mitten Media — TODO

- [x] Initial dark editorial website with brand identity
- [x] Hero section with animated stats (4.5M views, 45.8K followers)
- [x] About section with brand story
- [x] Stats section with animated counters
- [x] Recent content section with static posts
- [x] Connect section with social links
- [x] Footer
- [x] Upgrade to full-stack (tRPC + DB + auth)
- [x] Live Instagram feed via tRPC backend API (auto-refreshes every 5 min)
- [x] Real post thumbnails from Instagram (carousel covers + reel thumbnails)
- [x] Fallback static posts if Instagram API not configured
- [x] Promo pricing page (/promo)
  - [x] Individual packages: $10 Story, $35 24hr Post+Story, $50 Permanent+3 Stories
  - [x] Bundle deals: 2 for $75, 4 for $100, 1-Month Unlimited $313
  - [x] How to order (3-step process)
  - [x] Payment methods: CashApp $joyfuljules, PayPal MurderMittenPromo, Apple Pay 313-420-9004, Zelle, Chime
  - [x] QR codes for CashApp, PayPal, Apple Pay, Zelle
  - [x] "Buy Promo" CTA in navbar and hero
- [x] Promo CTA section on homepage
- [ ] Connect Instagram Graph API credentials for live feed (INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_USER_ID)
- [x] Add Murder Mitten Media logo to navbar, hero, and footer on all pages
- [x] Artist of the Week page
- [x] Live Stream page (YouTube live status - online/offline)
- [x] Murder Mitten Mic page (all one mic YouTube videos)
- [x] Meeting with the Mitten podcast page
- [x] Music Review Submission queue page
  - [x] DB schema: submissions table (id, artist, song, type, url/fileKey, position, status, skipped, createdAt)
  - [x] Live queue tracker showing position in line
  - [x] Current playing song display (admin-controlled)
  - [x] Submit via YouTube link or file upload
  - [x] Skip the line for $10 (CashApp/PayPal payment + admin confirm)
  - [x] Admin panel to manage queue (mark as playing, approve skips, remove)
- [x] Update navbar with all new pages
- [x] Music Wars page (Discord-linked battle competition with spin wheel and bracket)
- [x] Admin queue management panel on Music Review page
- [x] Update all pages to use shared SiteNav component
- [x] Set CEO Stew as Artist of the Week with blog article, recent songs/videos, and social links
- [x] Fix TypeScript errors in MeetingWithTheMitten.tsx
- [x] Overhaul homepage to be dynamic and showcase all content (Mic, Podcast, Music Wars, Live, Promo, Artist of Week)
- [x] Add framer-motion animations, scroll reveals, hover effects across all pages
- [x] Make site feel premium and interactive throughout
- [x] Add YouTube preview player to song catalog on Artist of the Week page (click song to preview)
- [x] Add Apple Music and Spotify profile links for CEO Stew on Artist of the Week page
- [x] Make streaming links standard for all future artist pages

## Music Wars Live Hub
- [x] DB schema: wheel_entries table (id, userId, artistName, songTitle, songUrl, paid, status, createdAt)
- [x] DB schema: chat_messages table (id, userId, username, message, room, createdAt)
- [x] DB schema: site_settings table (key, value) for free/paid toggle, live status
- [x] tRPC routers: wheel entries CRUD, chat messages, admin settings
- [x] Real-time chat with Socket.io (WebSocket)
- [x] Animated canvas spin wheel that reads names from DB
- [x] Free vs Paid entry toggle (admin panel) - existing entries stay free
- [x] User registration/login with username + email
- [x] User dashboard: submission history, current wheel position
- [x] Live YouTube stream embed on Music Wars page
- [x] Live chat alongside stream on Music Wars page
- [x] Admin spin wheel control + winner announcement

## Music Review Live Room
- [x] Live YouTube stream embed on Music Review page
- [x] Radio mode: audio-only player (YouTube audio stream) with station-style UI
- [x] Toggle between video and radio mode
- [x] Live chat on Music Review page (shared chat system)

## Music Wars Audio Battle Room
- [x] Extend user roles: add "judge" and "contestant" roles to DB schema
- [x] WebRTC peer-to-peer audio room (judges always on, contestants called up by admin)
- [x] Socket.io signaling server for WebRTC peer connections
- [x] Role-based mic access: judges = always on, contestants = when activated, viewers = listen only
- [x] Admin can activate/deactivate contestant mic from panel
- [x] Audio room participant list showing who is live
- [x] Mute/unmute controls per role
- [x] Music Review page: live YouTube stream embed + radio mode (audio-only toggle)

## Battle History & Records
- [x] DB schema: battle_records table (id, round, winnerId, loserId, winnerSong, loserSong, winnerArtist, loserArtist, battleDate, notes)
- [x] tRPC router: battle records CRUD (create, getAll, getByArtist)
- [x] Admin panel: record battle result (select winner/loser from wheel entries, auto-fill song info)
- [x] Battle history leaderboard on Music Wars page (wins, losses, songs)
- [x] Per-artist battle record card (W/L record + song history)

## User Profiles & Song Catalogue
- [x] DB schema: battle_records table (winnerId, loserId, winnerSong, loserSong, winnerArtist, loserArtist, roundNumber, battleDate, notes)
- [x] DB schema: user_songs table (userId, title, artistName, fileKey, fileUrl, duration, genre, uploadedAt, isPublic)
- [x] tRPC: getUserProfile (public - battle record + song list by userId)
- [x] tRPC: uploadSong (protected - upload audio file to S3, save metadata)
- [x] tRPC: deleteSong (protected - owner only)
- [x] tRPC: getBattleRecord (public - W/L/draws per user)
- [x] tRPC: recordBattleResult (admin - log winner/loser with songs used)
- [x] UserProfile page — ArtistStatModal popup (click any artist name)
- [x] MyProfile — own song upload form inside popup
- [x] Song catalogue: audio player inline (HTML5 audio)
- [x] Battle record table: opponent, song used, result, date
- [x] Leaderboard on Music Wars page (top W/L records)

## Artist Stat Popup Modal (click username anywhere on site)
- [x] Add instagramHandle + artistName fields to users table; push migration
- [x] Onboarding modal: shown after first login, asks for artist name + Instagram handle
- [x] tRPC: updateProfile (protected - save artistName, instagramHandle)
- [x] tRPC: getArtistStats (public - W/L record + songs by userId or artistName)
- [x] ArtistStatModal component: W/L record table, song catalogue with inline HTML5 audio player, IG link
- [x] Clickable artist names in: chat panel, wheel entries, battle history leaderboard
- [x] Song upload form in modal (own profile only): title, file upload (.mp3/.wav), or external URL

## Role Management & Voting System
- [ ] DB: extend users.role enum to include "judge" (admin | judge | user)
- [ ] DB: votes table (id, battleId, voterId, voterRole, candidate, weight, createdAt, battleRound)
- [ ] DB: active_battle table (id, contestant1, contestant2, round, status, createdAt) for tracking current battle
- [ ] tRPC: admin.listUsers — paginated list of all users with roles
- [ ] tRPC: admin.setRole — admin-only promote/demote user to judge/user
- [ ] tRPC: voting.castVote — authenticated users cast 1 vote per battle; judges cast weighted vote (weight=3)
- [ ] tRPC: voting.getResults — live vote counts per candidate for current battle
- [ ] tRPC: voting.setActiveBattle — admin sets current battle matchup (contestant1 vs contestant2)
- [ ] tRPC: voting.clearVotes — admin resets votes for new battle
- [ ] Admin panel: User Management tab — list users, search by name, promote/demote judge
- [ ] Music Wars: Audience vote panel — vote for contestant1 or contestant2, show live bar chart
- [ ] Music Wars: Judge vote panel — visible only to judges, weighted vote (counts as 3), separate display
- [ ] Music Wars: Live vote tracker — real-time Socket.io updates, show vote counts + percentages
- [ ] Judge role auto-grants mic access in audio room (no manual activation needed)
- [ ] Admin can set active battle matchup from admin panel (names + round number)

## Past Wars Tab Fix
- [ ] Past Wars tab: replace YouTube playlist embed with battle records from DB (grouped by round, showing winner/loser/songs/date)
- [ ] Past Wars tab: show "No battles recorded yet" when DB is empty, with note that admin records results after each live battle
- [ ] Past Wars tab: each battle card shows round #, date, winner (green), loser (red), songs used, clickable artist names opening ArtistStatModal

## Live Stream Offline State & Event Scheduler
- [ ] DB: add nextEventDate + nextEventTitle fields to site_settings (or reuse key-value store)
- [ ] tRPC: admin.setNextEvent — admin sets next Music Wars date/time and title
- [ ] tRPC: public.getNextEvent — returns next event date/time and title
- [ ] Music Wars stream section: when offline, show "MUSIC WARS OFFLINE" branded screen instead of broken YouTube embed
- [ ] Offline screen: show countdown timer (days/hours/minutes/seconds) to next scheduled event
- [ ] Offline screen: show next event title set by admin
- [ ] Admin panel: "Schedule Next Event" form — date/time picker + event title + YouTube stream URL (for when live)
- [ ] Admin panel: toggle isLive on/off to switch between live embed and offline screen
- [ ] When isLive=true: show YouTube embed with the configured stream URL
- [ ] When isLive=false: show offline screen with countdown

## Music Wars Entry Form MP3 Upload
- [ ] Wheel entry form: add tab toggle between "Link" (YouTube/SoundCloud URL) and "Upload MP3" (.mp3/.wav file, max 15MB)
- [ ] tRPC: wheel.submitWithFile — upload audio to S3, store fileUrl on wheel entry
- [ ] WheelEntry DB: ensure songUrl can store S3 URL from upload (already varchar 512, OK)

## Auto-Link Wheel Entry Songs to Profile
- [ ] When a logged-in user submits a wheel entry with a song (URL or uploaded MP3), auto-add it to their user_songs catalogue
- [ ] When admin records a battle result, auto-link the winning/losing songs to the respective user profiles if userId is known
- [ ] ArtistStatModal: show both catalogue songs AND songs from past battle submissions (deduplicated by title)

## Admin Wheel Controls
- [ ] Admin panel: X button on each wheel entry to remove/eliminate individual names instantly
- [ ] Admin panel: "Reset Current War" button — removes all active wheel entries + clears current vote results, but preserves battle_records and all-time leaderboard
- [ ] tRPC: wheel.removeEntry — admin removes a single wheel entry by id
- [ ] tRPC: wheel.resetCurrentWar — admin clears all wheel entries (status != 'winner') + clears active battle votes

## Music Review — Fire/Trash Voting & Artist Profiles
- [ ] DB schema: song_reactions table (id, submissionId, userId, reaction: 'fire'|'trash', createdAt) — one per user per submission
- [ ] DB: add fireCount + trashCount columns to review_submissions for career totals
- [ ] tRPC: review.react — cast fire/trash vote on a submission (one per user, locked after voting)
- [ ] tRPC: review.getReactions — get fire/trash counts for a submission
- [ ] Music Review page: 🔥 / 🗑️ buttons on currently playing song, disabled after vote cast
- [ ] Music Review page: show live fire/trash tally updating in real-time (poll every 3s)
- [ ] Music Review page: clickable artist names in queue → ArtistStatModal popup (W/L record + songs)
- [ ] ArtistStatModal: show career fire/trash totals on each song in the catalogue

## Live Vote Visibility
- [ ] Vote results panel visible to ALL viewers (not just logged-in users)
- [ ] Show individual judge votes with JUDGE badge + their name + which contestant they picked
- [ ] Show audience vote count separately from judge vote count
- [ ] tRPC: voting.getDetailedResults — returns vote breakdown with judge names/votes visible to public
- [ ] DB: store voterName on votes table so judge names can be displayed publicly

## Vote Weight Correction
- [ ] All votes (judge + audience) carry equal weight = 1
- [ ] Remove weight=3 for judges in DB and vote calculation logic
- [ ] Judge votes still shown with JUDGE badge + name for visibility, but counted as 1 vote

## Nav Label & Order Update
- [ ] Rename "Mic" → "Murder Mitten Mic Performances"
- [ ] Rename "Review" → "Live Music Reviews"
- [ ] Rename "Podcast" → "Meeting with the Mitten Podcast"
- [ ] Swap order: Live Music Reviews before Murder Mitten Mic Performances
- [ ] Nav order: Live Stream, Artist of the Week, Music Wars, Live Music Reviews, Murder Mitten Mic Performances, Meeting with the Mitten Podcast, Get Promoted

## Detroit → Michigan Text Fix
- [ ] Replace all "Detroit's hardest" / "Detroit's" / "Detroit" in page descriptions and taglines with "Michigan" throughout the site (not in addresses/history context, only in branding/descriptions)

## My Profile Nav Option
- [ ] Add "My Profile" link in nav (desktop + mobile) when user is logged in — opens ArtistStatModal for own profile
- [ ] Show username/artist name next to profile link in nav

## Profile Picture
- [ ] Add avatarUrl column to users table in schema; push migration
- [ ] tRPC: profile.uploadAvatar — upload image to S3, save URL to users.avatarUrl
- [ ] ArtistStatModal: show avatar at top, upload button when viewing own profile
- [ ] SiteNav: show avatar circle instead of letter initial when avatarUrl is set
- [ ] Chat messages: show tiny avatar next to username
- [ ] Leaderboard: show avatar next to artist name

## Wheel Auto-Remove & Queue Notifications
- [ ] Auto-remove name from wheel after it's spun (mark status "called" on spin)
- [ ] Winners auto-advance: admin "Start Next War" button copies all battle winners back to wheel as new entries
- [ ] Song play button on each wheel entry card (judges/viewers can listen inline)
- [ ] Song play button in active battle matchup panel
- [ ] Push notification to user when their name is picked: "You've been picked to compete next!"
- [ ] Queue position display for logged-in users: "There are X people ahead of you"
- [ ] Fix VotingPanel TypeScript: use contestant1/contestant2 (actual DB field names) not contestant1Votes/contestant2Votes

## Battle Song Playback System
- [ ] Wheel picks 2 contestants → their songs auto-load into BattlePlayer
- [ ] BattlePlayer: plays contestant 1 song first, then contestant 2 song back to back
- [ ] Full playback controls: play/pause, seek/scrub bar, current time / duration, volume slider
- [ ] Shows which contestant's song is currently playing with their name highlighted
- [ ] Visible to all viewers (judges + audience) simultaneously
- [ ] Admin can manually trigger playback or skip to next song
- [ ] Auto-remove picked contestants from wheel after they are loaded into BattlePlayer

## Battle Player Admin Control Clarification
- [ ] Admin-only playback controls: play/pause, seek, volume, skip to next song
- [ ] Viewers see read-only player: song name, artist, progress bar (no interaction)
- [ ] Admin playback state synced to all viewers via Socket.io (everyone hears same position)

## Admin Role Elevation
- [ ] Admin panel: User Management tab — list all users, search by name/email
- [ ] Admin can promote user → contestant → judge (and demote back)
- [ ] Judge role = full mic access in audio room (no per-session activation needed)
- [ ] Contestant role = mic access only when admin activates them
- [ ] Role badge shown next to username in chat and audio room participant list

## Reset War & User Management Fixes
- [ ] Reset Current War: clears ALL wheel entries (not just non-winners), all votes, active battle, and battle records for current session
- [ ] Admin User Panel: only shows users on the wheel OR who applied as judge (not all registered users)
- [ ] "Apply as Judge" button: visible to logged-in users on Music Wars page
- [ ] Judge application stored in DB (pending/approved/rejected)
- [ ] Admin can approve/reject judge applications from user panel
- [ ] Approved judge gets judge role and mic access

## Players Tab (Active vs Eliminated)
- [ ] Players tab on Music Wars page showing Active and Eliminated sections
- [ ] Each player card shows: artist name, current war record (W/L this session), lifetime record (all-time W/L)
- [ ] Active players: still on the wheel, sorted by wheel position
- [ ] Eliminated players: knocked out this war, sorted by elimination order
- [ ] Clicking a player name opens ArtistStatModal with full profile
- [ ] Real-time updates as players get eliminated or win battles

## Profile Picture Edit
- [ ] Profile picture upload/edit button visible in ArtistStatModal when viewing own profile
- [ ] Clicking avatar or edit button opens file picker for image upload
- [ ] Uploaded image stored in S3, URL saved to users.avatarUrl
- [ ] Avatar shown in nav, chat messages, leaderboard, and artist popup

## Audio Room Speaker Indicators & Mute Controls
- [ ] 🔊 animated speaker emoji on participant card when actively speaking (Web Audio API voice activity detection)
- [ ] 🔇 muted speaker emoji when participant is intentionally muted
- [ ] Self-mute/unmute button for all participants in the audio room
- [ ] Admin can mute or unmute any participant from the room panel
- [ ] Mute state synced via Socket.io so all viewers see current mute status

## Artist of the Week — Audio Player
- [ ] Add audio player to Artist of the Week page for direct in-browser playback
- [ ] Support MP3/audio file URL (HTML5 audio element with play/pause/scrub/volume)
- [ ] Support YouTube links (embedded iframe player)
- [ ] Admin can set both a video URL and a separate audio track URL per artist
- [ ] Audio player shows artist name, song title, and album art if available

## Reset War — Battle Records
- [ ] Reset war also deletes battle_records for the current war session (by warId/roundNumber)
- [ ] Lifetime all-time battle records are preserved (different roundNumber/warId)

## User Profile Page (Clickable from Nav)
- [ ] Fix 13 TypeScript errors in MusicReview.tsx (data type, implicit any, onSuccess refetch)
- [ ] Add profile.updateProfile procedure (name + avatarUrl upload to S3)
- [ ] Add profile.getUserStats procedure (submission counts, fire/trash totals)
- [ ] Add profile.getUserSubmissions procedure (all submissions for a user)
- [ ] Build UserProfile page: edit name, profile picture upload, playable submissions history, lifetime stats
- [ ] Wire SiteNav "My Profile" menu item to /profile route
- [ ] Add /profile route in App.tsx

## Submission Form Artist Name Auto-Fill
- [ ] Remove artist name input from MusicReview submission form — auto-use logged-in user's registered name
- [ ] Remove artist name input from MusicWars SubmissionForm — auto-use logged-in user's registered name
- [ ] Update queue.submit, queue.uploadAudio, wheel.submit server procedures to accept optional userId and auto-resolve artistName from user profile when userId is present

## Music Wars Bug Fixes
- [ ] Fix Music Wars wheel winner accuracy — winner determined by pointer position after spin, not random pick
- [ ] Fix vote reset on war clear — broadcast war:reset socket event so all clients clear local vote state
- [ ] Add songs.byArtistName tRPC procedure for name-only artists (no userId)
- [ ] Add clickable wheel slice to show artist profile preview modal
- [ ] Fix uploaded file playback - use presigned URLs so audio actually loads in player
- [ ] Fix Music Review file upload to work same as Music Wars (base64 inline upload)
- [ ] Build pop-out floating audio player that appears when a song loads/plays
- [ ] Auto-remove song from queue after it finishes playing
- [ ] Add city field to user DB schema, profile update procedure, onboarding modal, and UserProfile display

## Session 4 — May 2026
- [x] Remove artist name input from Music Wars submission form — auto-use registered profile name
- [x] Remove artist name input from Music Review submission form — auto-use registered profile name
- [x] Remove artist name input from ArtistStatModal song upload — auto-use registered profile name
- [x] Fix uploaded file playback — use presigned URLs via songs.getAudioUrl for fileKey-based songs
- [x] Fix Music Review queue play button to show for fileKey OR fileUrl (not just fileUrl)
- [x] Fix Now Playing banner play button to check fileKey OR fileUrl
- [x] Add onEnded callback support to AudioPlayerContext for auto-remove feature
- [x] Auto-mark queue submission as reviewed when admin finishes playing it
- [x] Add city field to users DB schema and migrate
- [x] Add city field to profile.update procedure
- [x] Add city field to OnboardingModal (shown on signup)
- [x] Add city field to UserProfile edit form and display
- [x] Show city in ArtistStatModal with MapPin icon
- [x] Fix wheel winner accuracy — determined by pointer position after spin (getWinnerFromRotation)
- [x] Fix vote reset on war clear — emit war:reset socket event from resetCurrentWar procedure
- [x] Add war:reset socket listener in MusicWars to refetch wheel, battle, and votes
- [x] Add io to tRPC context so procedures can emit socket events

## Session 5 — May 2026
- [ ] Fix Music Review file upload: default to "Upload File" tab, fix mobile accept attribute
- [ ] Add missing One Mics to the Mic tab
- [ ] Add missing One Mics to the Mic tab
- [ ] Build Latest News feed on home page with Instagram posts (thumbnails, full captions, links)

## Session 6 — Major Feature Sprint
- [ ] Fix desktop nav: remove ugly horizontal scroll, make clean responsive nav
- [ ] YouTube in-page player (modal embed) on MurderMittenMic
- [ ] MP3 player for uploaded audio on all pages
- [ ] Forum tab: posts, comments, Reddit-style UI
- [ ] Latest Posts tab: Instagram carousel embeds with individual post pages
- [ ] Global search: users and songs
- [ ] Live review active viewer profiles (clickable)
- [ ] Music Wars wheel: auto-assign Contestant 1 & 2, auto-add to poll, remove from wheel

## Session 7 — Preserve Style Patch Sprint
- [ ] Fix SiteNav desktop overflow: shorten labels, add More dropdown, no horizontal scroll bar
- [ ] Music Wars wheel: 1st spin = Contestant 1, 2nd spin = Contestant 2 (no "Winner" label)
- [ ] Music Wars wheel: auto-call setBattleContestants after 2nd spin (auto-add to poll)
- [ ] Music Wars wheel: remove picked artist from wheel immediately after each spin
- [ ] Add Forum page (posts + comments, matching existing dark style)
- [ ] Add Latest Posts page (Instagram embeds with individual post pages)
- [ ] Add Search page (users + songs)
- [ ] Live review active viewer profiles (clickable, shows ArtistStatModal)
- [ ] YouTube links open in in-page modal on MurderMittenMic
- [ ] Music Review default to Upload File tab (fix accept attribute for mobile)

## Session 7 Additions
- [ ] FloatingPlayer: show clickable artist name that opens ArtistStatModal
- [ ] FloatingPlayer: show Fire/Trash rating buttons for the currently playing submission
- [ ] MusicReview live queue: Fire/Trash rating buttons on currently playing song (and past played)
- [ ] Fire/Trash stats tracked on user profile (total fires, total trashes per song and career total)
- [ ] Site-wide Leaderboard page (/leaderboard): every contestant with W/L record, fire count, trash count, battle stats
- [ ] Add Leaderboard link to SiteNav More dropdown

## Session 7 — Live Page & Profile Fixes
- [ ] Fix Live page: smart redirect — if Music Wars is live go to /music-wars, if Music Review is live go to /review, else show live stream embed with chat
- [ ] Fix UserProfile "Submit Music" button 404 — wire to correct route

## Session 8 — Persistent Audio Player Redesign
- [ ] Redesign AudioPlayerContext: Personal queue (user-specific, local) + Live Radio mode (shared, admin-controlled)
- [ ] Add liveRadioState DB table + server procedures (getLiveRadioState, setLiveTrack, addToLiveQueue, skipLive, pauseLive, stopLive)
- [ ] Rewrite FloatingPlayer: Personal/Live modes, queue display, admin live radio controls panel
- [ ] Wire addToQueue() across Music Review, Music Wars, ArtistStatModal, profile tracks, search results
- [ ] Auto-remove finished songs from personal queue (ended event → remove → play next)
- [ ] Live Radio Mode: poll getLiveRadioState every 5s while in live mode, sync to admin's current track
- [ ] Admin live radio control area: add tracks, reorder, remove, skip, pause/resume, stop, set current
- [ ] Personal queue: user-specific or local state, never interrupted by admin changes
- [ ] FloatingPlayer: show Personal/Live mode indicator, Live button to jump to admin broadcast
- [ ] Bottom player: fixed viewport bottom, high z-index, enough padding on page wrapper

## Session 5 — New Pages & Features
- [x] Forum page (/forum) — posts list, category filters, create post modal, upvote/downvote
- [x] ForumPost page (/forum/:id) — full post body, comments thread, nested replies, upvote/downvote
- [x] Leaderboard page (/leaderboard) — all-time W/L, fire/trash scores, combined ranking
- [x] Search page (/search) — debounced search for artists and songs, play songs from results
- [x] LatestPosts page (/latest-posts) — Instagram feed grid with thumbnails, captions, likes/comments
- [x] FloatingPlayer redesign — Personal Queue panel (expandable track list), Live Radio mode toggle, prev/next controls
- [x] Register all new routes in App.tsx
- [x] Add Search to SiteNav More dropdown
- [x] TypeScript: 0 errors

## Session 6 — Platform Improvements

### Nav Tab Renames
- [x] Rename nav: Home, Live Now, Music Review, Murder Mitten Mic Drops, Forum, Latest News, Explore, Leaderboards, Artist of the Week, Meeting With The Mitten Podcast, Get Promoted
- [x] Update routes if needed (e.g. /latest-posts → /latest-news, /search → /explore)
- [x] Update all internal links and SiteNav

### Battle Wheel Fixes
- [x] Persist wheel state in DB (current order, remaining, picked, last selected)
- [x] Restore wheel state on page load (no reset on refresh)
- [x] Add "Reset Wheel" admin button (only manual reset)
- [x] Live sync via Socket.io: new names, removals, edits appear instantly for all viewers
- [x] Prevent duplicate picks unless wheel is reset
- [x] Allow spinning when only 1 contestant remains; auto-select final contestant
- [x] Show "All contestants have been picked." after final pick
- [x] Only disable wheel when 0 contestants remain

### Forum Audio Uploads
- [x] Allow attaching MP3/WAV/M4A/AAC to forum posts and replies
- [x] Display uploaded audio as embedded playable attachments in posts
- [x] Sync forum audio with global audio player (title, uploader, source page)
- [x] Upload progress indicators, file size limits (15MB), unsupported file handling
- [x] Secure uploads against unsafe file types

### Admin Moderation Controls
- [x] Admins can delete any forum post, reply, audio upload, comment, submission, or user content
- [x] Visible admin moderation controls only for admin accounts
- [x] Confirmation prompts before deleting content
- [x] Deleted content instantly disappears sitewide (optimistic update + socket)
- [x] Optional moderation log for deleted content and admin actions

### Music Review Rebuild
- [x] Rebuild Music Review into one complete live review page
- [x] Show live submission queue on same page as review controls
- [x] Each submission shows: artist name, song title, file/video link, submission message, user profile
- [x] Admin can instantly play audio submissions from queue (global player)
- [x] Admin can instantly watch submitted videos on same page (inline video player)
- [x] Admin can select which submission is "currently being reviewed live"
- [x] Selected submission becomes active live review item for all viewers (Socket.io)
- [x] Live synced audio feed: admin controls play/pause/replay/skip/next
- [x] All connected users stay synced to same active review content in realtime
- [x] Playback state, current song, queue updates sync live without refresh

### Global Audio Player Enhancements
- [x] Show source page (e.g. "Forum > Post Title", "Music Review") in player
- [x] Show uploader name in player
- [x] Show queue status (e.g. "2 / 5 in queue")
- [x] Fix all sync issues between embedded players and global player

## Session 7 — Critical Bug Fixes
- [x] Fix Battle Wheel: allow spin when only 1 contestant remains (auto-select as winner)
- [x] Fix all audio play buttons sitewide — none are working
- [x] Fix Music Review: admin can select submission to broadcast live to all viewers
- [x] Fix Music Review: admin play button actually plays audio in global player
- [x] Fix Music Review: live "Now Being Reviewed" banner visible to all viewers with working audio
- [x] Fix forum audio upload: invalid_format error — audioUrl validation rejects S3 path, must store fileKey and serve via /manus-storage/ URL
- [x] Add logo as home button to all pages missing it (pages that don't use SiteNav or have no back navigation)

## Session 8 — Audio Player Complete Revamp
- [x] Rebuild AudioPlayerContext: clean queue, presigned URL resolution, play/pause/skip/prev/seek/volume, onEnded auto-advance
- [x] Rewrite FloatingPlayer: persistent bottom bar, progress scrubber, volume slider, queue panel, track info
- [x] Fix MusicReview admin play button end-to-end (presigned URL resolved before broadcast)
- [x] Fix MusicWars/ArtistStatModal play buttons end-to-end
- [x] Fix Forum/ForumPost audio play buttons end-to-end (usePlayTrack hook, no native audio elements)
- [x] Fix Search page play buttons end-to-end
- [x] Fix UserProfile play buttons end-to-end
- [x] Verify all pages have working audio playback

## Session 9 — Music Review + Music Wars + Audio Fix
- [ ] Fix audio playback: usePlayTrack presigned URL resolution not loading into global player
- [ ] Music Review admin: "Load to Now Playing" button per submission
- [ ] Music Review admin: "Disable" button removes submission from active queue (soft disable, not delete)
- [ ] Music Review: inline YouTube player on same page (no new window)
- [ ] Add Music Wars to SiteNav More dropdown
- [ ] Music Wars: show contestant 1 and contestant 2 audio submissions, auto-queue both when battle starts
- [ ] Music Wars: play buttons for each contestant's submission using global player

## Session 9 Continued — Catalogue + Forum + UI
- [x] Add Music Wars to SiteNav More dropdown
- [x] Music Wars: contestant audio play buttons in VotingPanel (green for C1, red for C2)
- [x] Music Review admin: "Load" button per queue item (replaces plain play icon)
- [x] Music Review admin: inline YouTube embed in Now Being Reviewed banner
- [x] Forum audio: AudioPlayButton + clickable title link on post cards
- [x] Artist Music Catalogue: upload form on own profile (MP3 file or external link, visibility toggle, delete)
- [x] Artist Music Catalogue: viewable on any user's public profile page (/profile/:id)
- [x] UserProfile: support visiting other users' profiles via /profile/:id route

## Session 9 Continued — Catalogue + Forum + UI
- [x] Add Music Wars to SiteNav More dropdown
- [x] Music Wars: contestant audio play buttons in VotingPanel (green for C1, red for C2)
- [x] Music Review admin: "Load" button per queue item (replaces plain play icon)
- [x] Music Review admin: inline YouTube embed in Now Being Reviewed banner
- [x] Forum audio: AudioPlayButton + clickable title link on post cards
- [x] Artist Music Catalogue: upload form on own profile (MP3 file or external link, visibility toggle, delete)
- [x] Artist Music Catalogue: viewable on any user's public profile page (/profile/:id)
- [x] UserProfile: support visiting other users' profiles via /profile/:id route

## Session 10 — Audio System Overhaul (Complete)

- [x] AudioPlayButton: handles fileKey, /manus-storage/ paths, and direct https:// URLs universally
- [x] Fix ArtistStatModal: AudioPlayButton for file songs, inline YouTube embed for external links
- [x] Fix MusicReview: AudioPlayButton on all queue items (admin preview + public queue)
- [x] Fix MusicReview: admin YouTube preview opens inline embed (not new tab)
- [x] Fix MusicReview: handleSkip resolves presigned URL before broadcasting next track
- [x] Fix MusicReview: setSelectedYouTube prop passed to AdminPanel
- [x] Fix Search page: AudioPlayButton replaces hand-rolled play button
- [x] Auto-save to catalogue: queue.submit (YouTube) auto-inserts user_songs row
- [x] Auto-save to catalogue: queue.uploadAudio (MP3) auto-inserts user_songs row
- [x] Big Fire/Trash poll: full-width 🔥/🗑️ banner on Music Review for all viewers during live review
- [x] Live global Now Playing: server emits live:now_playing to ALL sockets when admin loads track
- [x] useLivePlayer hook: connects socket on every page, auto-plays live track with LIVE badge (isStream: true)
- [x] App.tsx: LivePlayerMount component mounts useLivePlayer globally on every route
- [x] MusicWars: AudioPlayButton already correct for contestant audio (handles all URL types)

## Music Review Live Radio Rebuild
- [ ] Server: resolve presigned URL server-side before broadcasting (not client-side)
- [ ] Server: radio:play event — broadcasts { trackUrl, fileKey, title, artist, submissionId, startedAt }
- [ ] Server: radio:pause event — broadcasts { pausedAt (seconds) }
- [ ] Server: radio:seek event — broadcasts { seekTo (seconds) }
- [ ] Server: radio:skip event — advances to next pending submission, broadcasts radio:play
- [ ] Server: radio:state query — returns current radio state for late-joining viewers
- [ ] Server: auto-advance — when admin marks track done, next pending track auto-loads
- [ ] Client: useLiveRadio hook — connects socket, listens for radio:* events, syncs FloatingPlayer
- [ ] Client: FloatingPlayer — LIVE badge when radio active, synced position
- [ ] MusicReview admin: big play/pause/skip/rewind controls (admin only)
- [ ] MusicReview admin: auto-advance toggle (plays next track when current ends)
- [ ] MusicReview viewer: NOW PLAYING banner with track info (no play button — audio auto-plays)
- [ ] MusicReview viewer: Fire/Trash poll visible when track is playing
- [ ] MusicReview viewer: queue list shows position, no individual play buttons
- [ ] MusicReview: past played tracks section with clickable artist names

## Music Review — Admin Controls & Live Radio Fix (Current)

- [x] Restore admin skip/pause/rewind controls on Music Review page
- [x] Make queue function as live radio — auto-advance to next track when current finishes
- [x] All listeners hear same track in sync via socket broadcast

## Clickable Artist Names & Catalogue Audio Fix

- [x] Make artist names clickable everywhere (links to /profile/:userId)
- [x] Fix music catalogue audio playback on profile page (iOS autoplay policy fix with unlockThenSwap)
- [ ] Ensure every user gets a profile page at /profile/:userId on signup

## Session 11 — iOS Audio Fix, Crown Stat, Stats Reset

- [x] Fix iOS audio playback: added unlockThenSwap to AudioPlayerContext (plays silent clip to unlock audio context, then swaps to real URL)
- [x] Updated AudioPlayButton to use unlockThenSwap for fileKey/manus-storage URLs (iOS-safe)
- [x] Updated usePlayTrack hook to use unlockThenSwap for all async URL resolution (iOS-safe)
- [x] Crown emoji stat on profile changed from "Submissions" to "Total Wins" (battle wins from battle_records)
- [x] Added totalWins field to getLifetimeStats (counts wins from battleRecords table)
- [x] Updated getStats and getStatsByUserId procedures to include totalWins in default return
- [x] Profile stats display: Crown icon first (Total Wins), then Fire Votes, Trash Votes, Submissions
- [x] Reset ALL user profile stats and catalogues: deleted all user_songs, reset fire/trash counts to 0, deleted all battle_records

## Session 11 — Music Review Live Radio Fix (True Sync)

- [x] Fix: All viewers on Music Review page automatically hear admin's currently playing track on page join
- [x] Fix: Viewers cannot independently control playback — admin controls play/pause/skip for everyone
- [x] Fix: Server broadcasts radio state (current track URL, playback position, isPlaying) to all connected clients
- [x] Fix: Late-joining viewers get current radio state immediately on socket connect and auto-play from correct position
- [x] Fix: Admin pause/resume/skip/seek actions broadcast to all viewers in real-time

## Session 12 — Live Radio Play/Pause Button (Mute/Unmute)

- [x] Add play/pause button to FloatingPlayer for live streams (acts as mute/unmute)
- [x] When viewer clicks play on a live stream, resume playback (handles tab switching)
- [x] When viewer clicks pause on a live stream, mute/pause locally (doesn't affect other viewers)
- [x] Show play icon when paused, pause icon when playing

## Session 13 — Clickable Usernames in Live Chat (Anti-Impersonation)

- [x] Make usernames clickable in all live chat messages (Music Wars, Music Review)
- [x] Clicking username opens ArtistStatModal to show real profile (battle record, songs, etc.)
- [x] Prevents fake pages using real artist names — users can verify authenticity
- [x] Music Wars ChatPanel already had clickable usernames via ArtistStatModal
- [x] Updated Music Review chat to use clickable usernames via ArtistStatModal

## Session 14 — Music Wars Radio Feed + Live Now Hub

- [x] Add Music Wars radio feed (same sync as Music Review — admin plays contestant tracks, all viewers hear synced)
- [x] Extend server radio system to support both music_review and music_wars radio streams (added wars:* site-wide broadcasts)
- [x] Add wars_radio:load, wars_radio:pause, wars_radio:resume, wars_radio:seek, wars_radio:stop socket events (already existed, now broadcast site-wide)
- [x] Update useWarsRadio hook to broadcast/sync contestant audio playback (created useWarsLivePlayer for global sync)
- [x] Add play/pause button to FloatingPlayer for Music Wars live streams (already works via isStream flag)
- [x] Update Live Now page with quick-access buttons to active radio feeds (already implemented in LiveStream.tsx)
- [x] Show "Music Review Live" button if review stream is broadcasting (already shows Join Now button)
- [x] Show "Music Wars Live" button if battle stream is broadcasting (already shows Join Now button)
- [x] Clicking button navigates to the active stream page and auto-plays the feed (auto-redirect + FloatingPlayer auto-plays)
- [x] Smart routing: only show buttons for currently active streams (already checks isLive flags)

## Session 15 — Radio Station Model (Play Buttons → Tune In)

- [x] Audit all AudioPlayButton and play button usages across the site
- [x] Replace AudioPlayButton on UserProfile catalogue with TuneInButton (redirects to /live)
- [x] Replace AudioPlayButton on ForumPost audio posts with TuneInButton redirect
- [x] Replace AudioPlayButton in MusicWars VotingPanel with TuneInButton
- [x] Replace inline AudioPlayer in ArtistOfWeek with TuneInButton
- [x] Replace AudioPlayButton in Search.tsx with TuneInButton
- [x] Replace AudioPlayButton in Forum.tsx with TuneInButton
- [x] Remove AudioPlayButton from MusicReview Now Playing card (replaced with LIVE indicator)
- [x] Remove AudioPlayButton from MusicReview Queue viewer tab (replaced with LIVE badge for playing tracks)
- [x] Added Previously Submitted Tracks section to MusicReview with AudioPlayButton (independent playback)
- [x] AudioPlayButton kept in Admin panel only (admin-only) and Previously Submitted Tracks section

## Session 16 — Music Wars Admin Audio Controls + Triple Threat Fix

- [x] Add admin "Load to Radio" buttons for each contestant in VotingPanel (admin-only)
- [x] Admin can manually broadcast contestant songs to live radio without spinning the wheel
- [x] Clicking "Load to Radio" broadcasts contestant song via wars_radio:load socket event to all viewers
- [x] Triple Threat mode: spin wheel 3 times instead of 2 when Triple Threat is ON
- [x] Triple Threat: VotingPanel shows 3 contestant cards, 3 vote buttons, 3 progress bars
- [x] Triple Threat: contestant3 fields added to activeBattle schema (contestant3Name, contestant3SongTitle, contestant3SongUrl, isTripleThreat)
- [x] Triple Threat: contestant3 added to votes candidate enum
- [x] Triple Threat: setBattleContestants procedure accepts optional contestant3Id and isTripleThreat
- [x] Triple Threat: getVoteResults counts contestant3 votes
- [x] FloatingPlayer: artist name is clickable (ArtistStatModal) for both live and non-live tracks

## Session 17 — Fix Forum & Catalogue Audio Playback

- [x] Restore AudioPlayButton to Forum.tsx (was replaced with TuneInButton by mistake)
- [x] Restore AudioPlayButton to UserProfile.tsx catalogue section (was replaced with TuneInButton by mistake)
- [x] Restore AudioPlayButton to UserProfile.tsx submission history section
- [x] Keep TuneInButton only in specific contexts (e.g., ForumPost, Search, ArtistOfWeek, MusicWars viewer)
- [x] Forum and catalogue now allow independent playback without redirecting to live radio

## Session 18 — Live Chat & Admin Controls Fixes

- [x] Fix: Live chat user list shows glitchy/flickering admin names (duplicates appearing rapidly) — changed key from socketId to userId
- [ ] Fix: Admin panel mic button should broadcast admin voice to the live radio feed (currently does nothing) — requires WebRTC audio streaming implementation
- [x] Fix: Audio room users should join auto-muted (not with hot mics) — must press Talk button to activate
- [x] Feature: Add Last Song button to all admin song controls (Music Review admin panel, Music Wars admin panel)
- [x] Feature: Last Song button puts the previous track back into the queue/deck for replay

## Admin Mic Broadcast to Radio Feed
- [x] Server: add radio:mic_broadcast socket channel for admin→listeners WebRTC signaling
- [x] Server: track active mic broadcaster per room, relay offers/answers/ICE to all room listeners
- [x] Client: useAdminMicBroadcast hook — admin captures mic, broadcasts via WebRTC to all listeners
- [x] Client: listener side in useAdminMicBroadcast — receive admin mic broadcast stream and play it
- [x] UI: Admin panel "Mic to Radio" toggle button — activates/deactivates admin mic broadcast
- [x] UI: Listener FloatingPlayer shows "🎙 Admin Live" indicator when admin mic is broadcasting

## Bug: Submission Play Buttons on Artist Profile
- [x] Bug: Submission play buttons load track into FloatingPlayer but no audio plays and no seek bar available
- [x] Fix: AudioPlayButton now prefers /manus-storage/ URL (correct key with hash) over fileKey for presigned URL resolution
- [x] Fix: unlockThenSwap now waits for canplay event before calling play() to prevent NotSupportedError

## Music Wars Live Voting UI Cleanup
- [x] Replace "Tune In" cards with a clean "Now Playing" box per contestant
- [x] Now Playing box: artist name links to their profile page
- [x] Now Playing box: show YouTube embed when submission has youtubeUrl
- [x] Now Playing box: show audio player (AudioPlayButton) when submission is file upload only
- [x] Fix voting UI to support Triple Threat (3-way battle) toggle — show 3 contestant cards when active
- [x] Fix admin controls in Live Voting section — Triple Threat toggle now co-located with Set Active Battle, 3rd contestant dropdown appears when Triple Threat is ON

## Explore Search Fix
- [x] Make Explore search case-insensitive (server-side SQL LIKE with LOWER(), client-side filter with toLowerCase())

## Search Results Audio Fix
- [x] Replace Tune In button on song search results with working AudioPlayButton

## Meeting With The Mitten Video Playback
- [x] Update Meeting With The Mitten page to play videos the same way Mic Drops does

## Admin Panel (/admin)
- [x] Admin-only route guard — redirect non-admins away from /admin
- [x] User Management tab — list all users, search, change role, ban/unban
- [x] Promo Orders tab — view all skip/promo purchases, mark fulfilled, filter by status
- [x] Analytics tab — submission counts, vote totals, top artists, site activity
- [x] Site Settings tab — Artist of the Week, featured content, announcements
- [x] Admin nav link visible only to admin role users

## Live Radio Banner & Nav LIVE Badge
- [x] Remove standalone "Live Now" nav item from SiteNav
- [x] Add pulsing red LIVE badge next to Music Reviews nav link when Music Review radio is live
- [x] Add pulsing red LIVE badge next to Music Wars nav link when Music Wars stream is live
- [x] Build LiveRadioBanner component — noticeable banner/button to join live radio when active
- [x] Add LiveRadioBanner to Music Review page
- [x] Add LiveRadioBanner to Music Wars page
- [x] Add LiveRadioBanner to Home page
- [x] Create useLiveStatus shared hook polling both live statuses every 30s

## Music Wars UI Cleanup & Admin Panel Consolidation
- [x] Consolidate all scattered admin tools into a single collapsible admin panel with organized sections
- [x] Admin panel sections: Radio (transport + Mic to Radio), Battle (Triple Threat + Set Active Battle + Clear Votes + Record Result), Entries (full list with Activate/Eliminate/Confirm/Remove), Settings (Paid/Free + Open/Closed + Reset War)
- [x] Add Mic to Radio broadcast button to Music Wars admin panel (same as Music Review)
- [x] Clean up viewer-facing UI — removed admin-only clutter from public view (Now Playing box no longer shows transport controls, VotingPanel no longer shows admin battle setup)
- [x] Condense redundant sections and improve mobile layout
- [x] MusicWarsAdminHub: collapsible red header bar, collapsed by default, 4 tabs (Radio/Battle/Entries/Settings)
- [x] MusicWarsAdminHub: shows MIC LIVE badge in header when admin mic is broadcasting

## Admin Tools — Delete User, Reset Stats, Reset Submissions
- [x] tRPC: admin.deleteUser — hard-delete a user and all their associated data (songs, votes, wheel entries, battle records, chat messages)
- [x] tRPC: admin.resetAllStats — reset all user stats: delete all battle_records, reset fireCount/trashCount on review_submissions to 0, delete all song_reactions
- [x] tRPC: admin.resetAllSubmissions — delete all review_submissions (Music Review queue), reset wheel_entries to empty, clear active_battle and votes
- [x] Admin UI: Delete User button in User Management tab (with inline confirmation: "Yes, Delete" / Cancel)
- [x] Admin UI: "Reset All Stats" button in new Danger Zone tab (requires typing "RESET STATS" to confirm)
- [x] Admin UI: "Reset All Submissions" button in Danger Zone tab (requires typing "RESET SUBMISSIONS" to confirm)

## YouTube Submissions in Radio Feed Fix
- [x] Investigated: useLivePlayer/useWarsLivePlayer were skipping YouTube URLs since <audio> can't play them
- [x] Fix: YouTube submissions now trigger a YouTube embed panel instead of being skipped
- [x] Fix: Admin loads a YouTube track → all listeners see the YouTube embed auto-pop-up in FloatingPlayer
- [x] Fix: FloatingPlayer shows YouTube embed (bottom-right overlay) when the active radio track is a YouTube submission; YouTube icon toggle button in controls
- [x] Fix: AudioPlayerContext.play() skips audio loading for YouTube tracks (just updates state, FloatingPlayer handles iframe)
- [x] Fix: useWarsRadio buildWarsAudioTrack helper detects YouTube URLs and passes youtubeUrl field
- [x] Fix: useLivePlayer and useWarsLivePlayer both pass youtubeUrl + submissionType on the AudioTrack

## Audio Fix — Live Stream Pause, Mic Broadcast, Voice+Radio Mix
- [ ] Fix: Live stream pause/stop in FloatingPlayer should only mute local audio, not broadcast a pause to all listeners
- [ ] Fix: Admin Mic → Radio broadcast pipeline not working (investigate useAdminMicBroadcast + socket server)
- [ ] Feature: Allow voice chat (WebRTC audio room) and radio feed to play simultaneously
- [ ] Feature: Add voice chat mix volume knob so users can balance voice chat vs radio volume

## Audio Fix — Live Stream Pause, Admin Mic, Voice+Radio Mix (May 2026)
- [x] Fix: Live stream pause/stop now only mutes locally (audio.muted=true) — does NOT broadcast pause to all listeners; button shows as Mute/Unmute for live streams
- [x] Fix: Admin Mic to Radio was broken because useAdminMicBroadcast never emitted room:join — server never registered the admin as a participant; fixed by emitting room:join with role=admin on socket connect
- [x] Fix: Voice chat and radio now play simultaneously — voice chat audio elements are separate from the radio audio element; no conflict
- [x] Feature: Voice Mix volume slider added to AudioRoomPanel (Music Wars) and MusicReview voice chat section — users can balance voice chat vs radio volume independently; starts at 80%, accent-red-600 slider

## Ban Enforcement & SoundCloud Removal (May 2026)
- [x] Remove SoundCloud from all link input fields and validation — YouTube links only (ArtistStatModal, MusicWars, UserProfile, routers.ts)
- [x] Enforce ban at auth layer: OAuth callback checks isBanned before issuing session cookie, redirects to /banned immediately
- [x] Enforce ban in protectedProcedure: requireUser middleware throws FORBIDDEN if ctx.user.isBanned (blocks all API calls even with existing session)
- [x] Built /banned page: dark editorial style, red ShieldOff icon, BANNED headline, appeal instructions with mailto link to murdermittenmedia@gmail.com
- [x] Wired /banned route into App.tsx

## Daily Free Promo Wheel — Daily Promo Giveaway (May 2026)
- [x] Database: wheel_of_names_entries (id, userId, name, createdAt, isActive)
- [x] Database: wheel_of_names_spins (id, spinDate, winnerId, winnerName, createdAt)
- [x] Database: wheel_of_names_paid_entries (id, userId, quantity, amountPaid, adminConfirmed, createdAt)
- [x] Server: tRPC promoWheel.submitName — add user's name to wheel (1 free entry per account, logged-in only)
- [x] Server: tRPC promoWheel.buyEntries — create paid entry request ($5 per entry, pending admin confirmation)
- [x] Server: tRPC promoWheel.getEntries — get all active entries for the current wheel
- [x] Server: tRPC promoWheel.getLastWinner — get the previous day's winner
- [x] Server: tRPC promoWheel.getTodaysSpin — get time until next 7pm spin
- [x] Server: Admin tRPC promoWheel.confirmPayment — admin confirms a paid entry, adds entries to wheel
- [x] Server: Daily 7pm auto-spin job (heartbeat) — randomly select winner from all entries, create spin record, clear entries for next day
- [x] Frontend: /daily-wheel page with spinning wheel visualization, submission form, countdown timer, previous winner display
- [x] Frontend: Paid entries modal ($5 per entry, shows pending confirmation status)
- [x] Frontend: Wheel widget on home page (mini version, links to full page)
- [x] Frontend: Wire /daily-wheel route into App.tsx

## Daily Free Promo Wheel Integration (May 2026)
- [x] Add "Daily Wheel" link to navbar menu (between Music Wars and More)
- [x] Add home button to /daily-wheel page (top-left or header)
- [x] Add wheel CTA to home page hero (right side free space) — prominent "WIN FREE PROMO TODAY" section
- [x] Build 7pm auto-spin job using heartbeat/periodic-updates: handler at /api/scheduled/daily-wheel-spin (schedule after deploy)
- [x] Add admin manual controls: "Spin Wheel" button + "Reset" button in admin panel
- [x] Admin can override auto-spin: pick a specific winner from the entry list or reset the wheel at any time

## Daily Wheel — Admin & UX Enhancements (May 2026)
- [x] Admin can manually add names to the wheel via admin panel form (without requiring payment)
- [x] Display active names list on wheel page (scrollable, shows all current entries with usernames)
- [x] Replace wheel pointer/ticker with knife SVG icon that animates during spin

## Daily Wheel Rebuild (Correct Implementation)
- [x] Update DB: daily limit enforced by getUserWheelOfNamesEntry (checks userId + today's date)
- [x] Update server: checkUserHasEnteredToday procedure (checks by userId + date)
- [x] Update server: submitName enforces 1 entry per user per day (not per all-time)
- [x] Update server: adminSpin procedure (admin-only, picks random winner, records spin, clears entries)
- [x] Update server: adminReset procedure (admin-only, clears all current entries)
- [x] Rebuild WheelOfNames page: canvas-based spinning wheel with names drawn ON segments
- [x] Wheel: knife ticker SVG fixed at right side pointing to winning segment
- [x] Wheel: admin-only Spin button (hidden from regular users)
- [x] Wheel: user submit name form (1 per day, shows "Already entered today" if used)
- [x] Wheel: show previous winner and countdown to next 7pm spin
- [x] Set up 7pm daily Heartbeat job handler (deploy first, then run: manus-heartbeat create --name daily-wheel-spin --cron "0 0 23 * * *" --path /api/scheduled/daily-wheel-spin)

## Daily Wheel — Instagram Handle (May 2026)
- [x] Wheel submission form: change name field label to "Instagram @" and validate handle format
- [x] Server: validate submitName input is a valid Instagram handle (strip leading @, alphanumeric + underscores + dots, 1-30 chars)
- [x] Display names on wheel and in entry list with @ prefix

## Daily Wheel — Buy Extra Entries Contact (May 2026)
- [x] Replace automated "Buy Extra Entries" modal with Instagram DM instructions and clickable @murdermittenmedia link

## Daily Wheel — Sign-in Button Fix (May 2026)
- [x] Fix sign-in button on /daily-wheel page giving 404 — replace hardcoded /api/oauth/login href with getLoginUrl() helper

## Admin Live Stats Dashboard (May 2026)
- [x] Add page_views table to DB schema (id, path, userId nullable, sessionId, referrer, userAgent, createdAt)
- [x] Add active_sessions table (sessionId, path, lastSeen, userId nullable)
- [x] Add server procedures: trackPageView (public), heartbeat (public), getStats (admin-only)
- [x] Add client-side page view tracker hook (fires on route change + 30s heartbeat)
- [x] Build /admin/stats page: live active users, total views today/week/all-time, top pages, recent visitors, hourly/daily charts
- [x] Add "Live Site Stats" button to admin panel header

## Music Wars — Duplicate Participant Bug (May 2026)
- [x] Fix: same user appears twice in Voice Chat / Room Participants list — deduplicate by userId in getRoomList (useAdminMicBroadcast creates a second socket)

## Admin Player Controls & Load to Radio (May 2026)
- [ ] Fix admin Wars Radio controls: last song, skip, seek, pause/resume not working correctly
- [ ] Add "Load to Radio" button on all previously submitted songs (review submissions list)
- [ ] Add "Load to Radio" button on all queue entries in the Music Wars queue

## Admin Player Controls Fix & Load to Radio Buttons
- [x] Fix MusicWarsAdminHub: pause/resume now sends actual audioPlayer.currentTime instead of hardcoded 0
- [x] Fix MusicReview AdminPanel: pause/resume now sends actual audioPlayer.currentTime instead of hardcoded 0
- [x] MusicReview AdminPanel: add "Previously Reviewed — Load to Radio" section with Load buttons for all reviewed tracks
- [x] MusicWars Entries tab: add Load to Radio (▶) button for any entry with a songUrl (active, eliminated, winner, pending)

## Wheel Spin Duplicate Date Fix
- [x] Fix createWheelOfNamesSpin to use upsert (INSERT ... ON DUPLICATE KEY UPDATE) so re-spinning today overwrites the earlier record instead of throwing a duplicate key error
- [x] Fix auto-spin scheduled job to skip if admin already manually spun today (prevents double-spin)

## Wheel Animation & Live Broadcast
- [x] Fix wheel animation to land precisely on the winner's name (calculate exact target angle)
- [x] Make spin slow and dramatic: 9 seconds total, quintic easeOut deceleration
- [x] Broadcast live spin animation to all viewers via Socket.io (wof:spin_start event with winner index + names snapshot + duration)
- [x] All connected viewers see the wheel spin in real-time simultaneously (promo_wheel Socket.io room)
- [x] 7 PM auto-spin triggers the same live animation for all connected viewers
- [x] Winner reveal: confetti burst + winner banner after wheel stops (wof:spin_result event)

## Account Type Labels (May 2026)
- [x] DB: add accountLabel column to users table (enum: fan | artist | producer | videographer | blogger | brand_owner | judge | admin | null)
- [x] DB: push migration with pnpm db:push
- [x] tRPC: profile.setAccountLabel — protected, user sets own label (fan/artist/producer/videographer/blogger/brand_owner only)
- [x] tRPC: admin.setAccountLabel — admin-only, can set any label including judge/admin
- [x] Profile page / onboarding modal: label picker dropdown with 6 user-selectable options
- [x] Admin user management panel: label column + dropdown to grant ADMIN or JUDGE label
- [x] LabelBadge component: colored pill badge for each label type (distinct colors per label)
- [x] Show LabelBadge next to username in: live chat messages, wheel entries list, battle leaderboard, ArtistStatModal, user profile header
- [x] Ensure ADMIN and JUDGE labels are visually distinct (gold/yellow) vs user labels

## Account Labels — Multi-Select + Audio Engineer (May 2026)
- [ ] DB: change accountLabel (varchar) to accountLabels (JSON array) in users table
- [ ] DB: push migration
- [ ] Add AUDIO ENGINEER to label options (user-selectable)
- [ ] tRPC: profile.setAccountLabels — accepts array of labels, validates each is user-selectable
- [ ] tRPC: admin.setAccountLabels — accepts array, can include JUDGE/ADMIN
- [ ] LabelBadge: support rendering multiple badges side by side
- [ ] Profile page: multi-select toggle UI (click to add/remove labels)
- [ ] Admin panel: multi-select for label grant
- [ ] SiteNav: render all user labels next to name
- [ ] Chat messages: render all labels next to username

## Re-queue Previously Reviewed Songs (Music Review)
- [x] tRPC: review.requeueSubmission — admin-only, sets a reviewed submission back to pending status and moves it to the end of the queue (highest position + 1)
- [x] DB helper: requeueSubmission(id) — updates status to 'pending', recalculates position
- [x] MusicReview admin panel: add ↩ Re-queue button next to each song in the "Previously Reviewed" section
- [x] On re-queue success: toast confirmation, refetch queue, broadcast queue update to all listeners

## Admin Live Radio Control Fixes
- [x] FloatingPlayer: when isAdmin && isLiveStream, show full scrubable progress bar + pause/play button (same as non-stream) instead of pulsing bar + mute-only
- [x] FloatingPlayer: when isAdmin && isLiveStream, progress click/drag should call seek() locally AND emitSeekBroadcast()
- [x] FloatingPlayer: when isAdmin && isLiveStream, play/pause button should call pause()/resume() locally AND emit broadcastRadioPause/Resume via socket
- [x] MusicReview AdminPanel: Pause/Play/Rewind buttons must also apply to admin's local player (pause(), resume(), seek(0)) in addition to broadcasting
- [x] MusicReview: remove the `if (isAdmin) return` guard from onRadioPaused/onRadioResumed/onRadioSeeked so admin's player syncs with the broadcast echo

## Login Reliability Fixes
- [x] sdk.ts: throttle lastSignedIn upsert — only write if last update was >5 min ago (in-memory cache per openId)
- [x] sdk.ts: add retry with exponential backoff for getUserInfoWithJwt on rate limit (429)
- [x] oauth.ts: redirect to returnPath after login (encode returnPath in state alongside redirectUri)
- [x] oauth.ts: show user-friendly HTML error page instead of raw JSON on callback failure
- [x] const.ts: encode current page path in state so user returns to the page they were on after login

## Mic-to-Radio & Viewer Controls Fix
- [x] Redesign mic broadcast: admin mic audio should be mixed with music using Web Audio API so listeners hear one combined stream (not a separate audio element)
- [x] FloatingPlayer viewer button: change icons from VolumeX/Pause to Play/Stop (disguised as play/stop but actually mute/unmute)
- [x] Ensure viewers have NO access to seek, progress scrub, or any playback control besides the mute button
- [x] Admin mic should not interrupt or pause the music — it overlays on top

## Queue / Votes / Now-Playing Sync Fixes
- [x] Reduce queue poll interval from 15s to 5s for faster fallback sync
- [x] Initialize liveReviewActive from DB currentPlaying on page load (so late joiners see the current song immediately)
- [x] Add socket event for vote changes so all clients see live vote counts without waiting for poll
- [x] Reduce reaction poll interval from 5s to 3s as secondary fallback
- [x] Ensure queue refetch happens immediately on radio:playing event (not just review:queue_updated)
- [x] Add a useEffect that syncs liveReviewActive from currentPlaying when liveReviewActive is null but currentPlaying exists

## Forum Audio Files Fix
- [x] ForumPost.tsx: replace ForumAudioPlayer (Tune In redirect) with AudioPlayButton so audio actually plays inline
- [x] ForumPost.tsx: ensure both post-level and comment-level audio attachments use AudioPlayButton

## Ecosystem Expansion — Gamified Live Music Platform

### Artist XP + Progression System
- [ ] DB schema: add `xp` (int), `level` (enum: bronze/verified/trending/city_motion/mitten_elite/hall_of_fame), `streak` (int), `lastActiveDate` (date) to users table
- [ ] DB schema: add `artistBadges` table (userId, badge, earnedAt)
- [x] DB helper: `awardXP(userId, amount, reason)` — adds XP, recalculates level, awards badges on milestones
- [ ] XP triggers: award XP on song upload, battle win, review submission, daily login, forum post, vote cast
- [ ] tRPC: `profile.getXPStats` — returns xp, level, streak, badges for a user
- [ ] Profile page: show XP bar, level badge, streak counter, earned badges/trophies
- [ ] Level badge component: color-coded badge (Bronze=brown, Verified=blue, Trending=orange, City Motion=purple, Mitten Elite=gold, Hall of Fame=red/crimson)

### Enhanced Leaderboard
- [ ] DB helper: `getCombinedLeaderboard` — add time filter (weekly/monthly/all-time) and city filter params
- [ ] Leaderboard page: add filter tabs (All-Time / Monthly / Weekly) and city dropdown
- [ ] Leaderboard: add momentum indicators (↑ trending up, ↓ cooling off, 🔥 exploding) based on rank change
- [ ] Leaderboard: store previous rank snapshot (weekly) to calculate rank change delta
- [ ] Leaderboard: add "Trending Now" category tab showing biggest rank movers this week

### Live Activity Feed
- [ ] DB schema: add `activityFeed` table (id, type, message, metadata JSON, createdAt)
- [ ] DB helper: `createActivityEvent(type, message, metadata)` — inserts activity event
- [ ] Activity triggers: emit events on song submission, battle start/end, review session start, forum post, new user join
- [ ] Socket: broadcast `activity:new_event` to all clients when activity event is created
- [ ] ActivityFeed component: scrolling ticker/feed showing live events with icons and timestamps
- [ ] Homepage: add live activity feed section showing recent platform events
- [ ] SiteNav or FloatingPlayer: add mini activity ticker showing latest event

### Broadcast Mode Views
- [ ] Route `/broadcast/review` — full-screen broadcast view for Music Review (large text, high contrast, current song + queue + reactions)
- [ ] Route `/broadcast/radio` — full-screen broadcast view for Radio (now playing, next up, listener count, reactions)
- [ ] Route `/broadcast/rankings` — full-screen broadcast view for Rankings (top artists, trending, heat meters)
- [ ] Route `/broadcast/wars` — full-screen broadcast view for Music Wars (matchup, voting, scores)
- [ ] Broadcast views: no nav, no footer, no floating player — clean overlay-style layout
- [ ] Broadcast views: large Anton font, high contrast (#080808 bg, white/red text), animated counters
- [ ] Broadcast views: safe margins for Instagram crop (16:9 safe zone)
- [ ] Add `/broadcast` link in admin panel for easy access during streams

### FloatingPlayer Enhancements
- [ ] FloatingPlayer: show live listener count when a live stream is active
- [ ] FloatingPlayer: add expanded mode (click to expand showing queue, reactions, chat preview)
- [ ] FloatingPlayer: animated pulsing LIVE badge when radio is live
- [ ] FloatingPlayer: show "Murder Mitten Radio" branding when in live stream mode

### Fan Supporter System
- [ ] DB schema: add `fanXP` (int), `fanLevel` (enum: supporter/top_supporter/biggest_fan/early_supporter/verified_tastemaker) to users table
- [ ] Fan XP triggers: award fan XP on vote, forum post, daily login, watching stream
- [ ] tRPC: `leaderboard.topFans` — returns top fans by XP with level badges
- [ ] Leaderboard page: add "Top Fans" tab showing fan leaderboard

### Live Platform Activity Indicators
- [ ] Homepage: animated "X users online now" counter (use socket connection count)
- [ ] Homepage: "X songs submitted today" live counter
- [ ] Music Review page: show live viewer count prominently
- [x] Site-wide: show "LIVE" badge in nav when any live session is active

## Reward Tracking / Auto-Unlock System

### Phase 1 — DB Schema
- [x] DB: add `xp` (int default 0), `level` (varchar default 'bronze'), `streak` (int default 0), `lastActiveDate` (date) to users table
- [x] DB: add `fanXP` (int default 0), `fanLevel` (varchar default 'supporter') to users table
- [x] DB: create `rewards` table (id, name, description, type: level|achievement|promo|wars|review|supporter|verified|rare, rarity: common|rare|epic|legendary|hall_of_fame, requirements JSON, isActive, requiresAdminApproval, expiresAt, createdAt)
- [x] DB: create `user_rewards` table (id, userId, rewardId, status: locked|unlocked|claimable|active|redeemed|expired|revoked, unlockedAt, claimedAt, redeemedAt, revokedAt, grantedBy, notes, earnedVia)
- [x] DB: create `user_badges` table (id, userId, badge, rarity, grantedBy, grantedAt, isVisible, expiresAt)
- [x] DB: create `xp_events` table (id, userId, amount, reason, metadata JSON, createdAt) — audit log
- [x] DB: create `reward_logs` table (id, userId, rewardId, action, performedBy, notes, createdAt)
- [x] Push all migrations with `pnpm db:push`

### Phase 2 — DB Helpers & tRPC Procedures
- [x] DB helper: `awardXP(userId, amount, reason, metadata?)` — adds XP, logs to xp_events, recalculates level, triggers checkAndUnlockRewards
- [x] DB helper: `checkAndUnlockRewards(userId, stats)` — evaluates all active rewards' requirements against user stats, auto-unlocks eligible ones, logs to reward_logs, sends notification
- [x] DB helper: `getUserRewardStats(userId)` — aggregates all stats needed for requirement checking (xp, level, wins, plays, votes, etc.)
- [x] DB helper: `getRewardsByUser(userId)` — returns unlocked + locked rewards with progress toward each
- [x] DB helper: `getBadgesByUser(userId)` — returns all visible badges for a user
- [x] tRPC: `rewards.getMyRewards` — protected, returns user's rewards with status and progress
- [x] tRPC: `rewards.getMyBadges` — protected, returns user's badges
- [x] tRPC: `rewards.claimReward` — protected, marks unlocked reward as claimable/active
- [x] tRPC: `profile.getPublicRewards(userId)` — public, returns unlocked rewards + badges for profile display
- [x] tRPC: `admin.rewards.list` — admin, list all rewards with stats
- [x] tRPC: `admin.rewards.create` — admin, create new reward with requirements JSON
- [x] tRPC: `admin.rewards.update` — admin, edit reward (name, desc, requirements, isActive, expiresAt)
- [x] tRPC: `admin.rewards.grantToUser` — admin, manually grant reward to user
- [x] tRPC: `admin.rewards.revokeFromUser` — admin, revoke reward from user with notes
- [x] tRPC: `admin.rewards.getLogs` — admin, view reward audit log
- [x] tRPC: `admin.badges.grantBadge` — admin, assign badge to user
- [x] tRPC: `admin.badges.removeBadge` — admin, remove badge from user
- [x] tRPC: `admin.xp.override` — admin, manually set or adjust user XP

### Phase 3 — XP Award Triggers
- [x] Song upload → awardXP(userId, 50, 'song_upload')
- [x] Battle win → awardXP(userId, 150, 'battle_win')
- [x] Battle participation → awardXP(userId, 25, 'battle_participation')
- [x] Review submission → awardXP(userId, 30, 'review_submission')
- [x] Fire vote received → awardXP(userId, 10, 'fire_vote_received')
- [x] Forum post → awardXP(userId, 15, 'forum_post')
- [x] Forum comment → awardXP(userId, 5, 'forum_comment')
- [x] Vote cast → awardXP(userId, 5, 'vote_cast') — fan XP
- [x] Daily login streak → awardXP(userId, 10 * streakDays, 'daily_streak')
- [ ] Referral → awardXP(userId, 100, 'referral')

### Phase 4 — RewardBadge Component & Global Display
- [x] `UserBadge` component: shows level badge + top earned badge inline next to username (compact, 16px height)
- [x] Inject UserBadge next to usernames in: live chat, forum posts, forum comments, review queue, leaderboard, Music Wars brackets, artist cards, ArtistStatModal, profile previews
- [x] Badge tooltip on hover: shows badge name, rarity, and how it was earned

### Phase 5 — Profile Reward Display
- [x] Profile page: XP progress bar (current XP / XP needed for next level)
- [x] Profile page: level badge with label (Bronze Artist, Verified Artist, etc.)
- [x] Profile page: streak counter with flame icon
- [x] Profile page: badge collection grid (unlocked badges with rarity glow)
- [x] Profile page: locked rewards section (greyed out with progress %)
- [x] Profile page: reward history tab (when earned, how earned)
- [x] Profile page: active promo rewards section

### Phase 6 — Admin Reward Control Panel
- [x] Admin panel: "Rewards" tab — list all rewards, create new, edit, pause/activate
- [x] Admin panel: reward create/edit form — name, description, type, rarity, requirements (JSON editor or form fields), requiresAdminApproval, expiresAt
- [x] Admin panel: "User Rewards" tab — search by user, see all their rewards/badges/XP, grant/revoke
- [x] Admin panel: "Reward Logs" tab — audit trail of all unlock/grant/revoke events
- [x] Admin panel: XP override form — set user XP directly with reason note
- [x] Admin panel: badge assign form — pick badge type + rarity, assign to user

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

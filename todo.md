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

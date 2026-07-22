import { boolean, date, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "judge", "contestant"]).default("user").notNull(),
  // Artist profile fields (collected on first login)
  artistName: varchar("artistName", { length: 128 }),
  instagramHandle: varchar("instagramHandle", { length: 64 }),  // without the @
  city: varchar("city", { length: 128 }),                        // hometown / city
  avatarUrl: varchar("avatarUrl", { length: 512 }),              // profile picture URL
  profileComplete: boolean("profileComplete").default(false).notNull(),
  isBanned: boolean("isBanned").default(false).notNull(),
  banReason: varchar("banReason", { length: 256 }),
  // Visible account type labels shown next to username everywhere (JSON array of strings)
  accountLabels: text("accountLabels"),  // JSON-encoded string[], e.g. '["artist","producer"]'
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  // Gamification / XP
  xp: int("xp").default(0).notNull(),
  fanXP: int("fanXP").default(0).notNull(),
  level: varchar("level", { length: 32 }).default("bronze").notNull(),  // bronze|verified|trending|city_motion|mitten_elite|hall_of_fame
  fanLevel: varchar("fanLevel", { length: 32 }).default("supporter").notNull(), // supporter|top_supporter|biggest_fan|early_supporter|verified_tastemaker
  streak: int("streak").default(0).notNull(),
  lastActiveDate: varchar("lastActiveDate", { length: 10 }),  // YYYY-MM-DD for streak tracking
  // Judge verification
  cashappPaymentReceiptUrl: varchar("cashappPaymentReceiptUrl", { length: 512 }),  // CashApp payment receipt link for judge verification
  judgeVerifiedAt: timestamp("judgeVerifiedAt"),  // when user was verified as judge
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Music review submission queue
export const reviewSubmissions = mysqlTable("review_submissions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  musicReviewSessionId: int("musicReviewSessionId"),  // Track which session this submission belongs to (optional for legacy)
  artistName: varchar("artistName", { length: 128 }).notNull(),
  songTitle: varchar("songTitle", { length: 128 }).notNull(),
  submissionType: mysqlEnum("submissionType", ["youtube", "file"]).notNull(),
  youtubeUrl: varchar("youtubeUrl", { length: 512 }),
  fileKey: varchar("fileKey", { length: 512 }),
  fileUrl: varchar("fileUrl", { length: 512 }),
  contactInfo: varchar("contactInfo", { length: 256 }),
  status: mysqlEnum("status", ["pending", "playing", "reviewed", "removed"]).default("pending").notNull(),
  skippedLine: boolean("skippedLine").default(false).notNull(),
  skipPaymentConfirmed: boolean("skipPaymentConfirmed").default(false).notNull(),
  // Paid submission fields (for 3rd+ submissions beyond the 2 free per day)
  isPaidSubmission: boolean("isPaidSubmission").default(false).notNull(),
  paidSubmissionType: mysqlEnum("paidSubmissionType", ["reentry5", "reentry10", "skip"]),  // reentry5=$5, reentry10=$10, skip=$15+skip
  paidSubmissionConfirmed: boolean("paidSubmissionConfirmed").default(false).notNull(),
  position: int("position").default(0).notNull(),
  notes: text("notes"),
  // Career reaction totals (incremented on each vote)
  fireCount: int("fireCount").default(0).notNull(),
  trashCount: int("trashCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReviewSubmission = typeof reviewSubmissions.$inferSelect;
export type InsertReviewSubmission = typeof reviewSubmissions.$inferInsert;

// Song Reactions — 🔥 or 🗑️ votes on review submissions (one per user per submission)
export const songReactions = mysqlTable("song_reactions", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").notNull(),   // references reviewSubmissions.id
  userId: int("userId").notNull(),               // references users.id
  reaction: mysqlEnum("reaction", ["fire", "trash"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SongReaction = typeof songReactions.$inferSelect;
export type InsertSongReaction = typeof songReactions.$inferInsert;

// Queue state (singleton row for current playing track + live status)
export const queueState = mysqlTable("queue_state", {
  id: int("id").autoincrement().primaryKey(),
  currentPlayingId: int("currentPlayingId"),
  isLive: boolean("isLive").default(false).notNull(),
  liveMessage: varchar("liveMessage", { length: 256 }),
  streamUrl: varchar("streamUrl", { length: 512 }),  // YouTube live URL or direct stream URL set by admin
  // Playback mode: '90sec' = cap free submissions at 90s, 'full' = play full songs, 'paid_only' = paid submissions only
  playbackMode: mysqlEnum("playbackMode", ["90sec", "full", "paid_only"]).default("90sec").notNull(),
  // Pricing (in cents) — 0 means free/disabled
  submitPriceCents: int("submitPriceCents").default(0).notNull(),       // cost to submit in paid_only mode
  skipPriceCents: int("skipPriceCents").default(1500).notNull(),        // cost to skip the line ($15 default)
  fullSongPriceCents: int("fullSongPriceCents").default(500).notNull(), // cost to upgrade free->full song ($5 default)
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QueueState = typeof queueState.$inferSelect;

// Artist of the week
export const artistOfWeek = mysqlTable("artist_of_week", {
  id: int("id").autoincrement().primaryKey(),
  artistName: varchar("artistName", { length: 128 }).notNull(),
  bio: text("bio"),
  imageUrl: varchar("imageUrl", { length: 512 }),
  instagramUrl: varchar("instagramUrl", { length: 512 }),
  youtubeUrl: varchar("youtubeUrl", { length: 512 }),
  spotifyUrl: varchar("spotifyUrl", { length: 512 }),
  featuredVideoId: varchar("featuredVideoId", { length: 64 }),
  audioTrackUrl: varchar("audioTrackUrl", { length: 512 }),  // direct MP3/audio file URL for in-browser playback
  audioTrackTitle: varchar("audioTrackTitle", { length: 128 }),  // song title for the audio player
  isActive: boolean("isActive").default(true).notNull(),
  weekOf: timestamp("weekOf").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ArtistOfWeek = typeof artistOfWeek.$inferSelect;
export type InsertArtistOfWeek = typeof artistOfWeek.$inferInsert;

// Music Wars Wheel Entries
export const wheelEntries = mysqlTable("wheel_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  artistName: varchar("artistName", { length: 128 }).notNull(),
  songTitle: varchar("songTitle", { length: 128 }).notNull(),
  songUrl: varchar("songUrl", { length: 512 }),
  contactInfo: varchar("contactInfo", { length: 256 }),
  paid: boolean("paid").default(false).notNull(),
  paymentConfirmed: boolean("paymentConfirmed").default(false).notNull(),
  status: mysqlEnum("status", ["pending", "active", "eliminated", "winner", "removed"]).default("pending").notNull(),
  wheelPosition: int("wheelPosition").default(0).notNull(),
  roundNumber: int("roundNumber").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WheelEntry = typeof wheelEntries.$inferSelect;
export type InsertWheelEntry = typeof wheelEntries.$inferInsert;

// Live Chat Messages
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  username: varchar("username", { length: 64 }).notNull(),
  message: varchar("message", { length: 500 }).notNull(),
  room: mysqlEnum("room", ["music_wars", "music_review"]).notNull(),
  isAdmin: boolean("isAdmin").default(false).notNull(),
  deleted: boolean("deleted").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// Site Settings (key-value store for admin toggles)
export const siteSettings = mysqlTable("site_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SiteSetting = typeof siteSettings.$inferSelect;

// Battle Records — tracks every Music Wars matchup result
export const battleRecords = mysqlTable("battle_records", {
  id: int("id").autoincrement().primaryKey(),
  roundNumber: int("roundNumber").default(1).notNull(),
  warSessionId: int("warSessionId").default(1).notNull(),  // increments on each war reset
  // Winner info
  winnerId: int("winnerId"),                                    // userId (null = guest)
  winnerArtistName: varchar("winnerArtistName", { length: 128 }).notNull(),
  winnerSongTitle: varchar("winnerSongTitle", { length: 128 }).notNull(),
  winnerSongUrl: varchar("winnerSongUrl", { length: 512 }),
  // Loser info
  loserId: int("loserId"),                                      // userId (null = guest)
  loserArtistName: varchar("loserArtistName", { length: 128 }).notNull(),
  loserSongTitle: varchar("loserSongTitle", { length: 128 }).notNull(),
  loserSongUrl: varchar("loserSongUrl", { length: 512 }),
  // Meta
  notes: text("notes"),                                         // judge commentary
  battleDate: timestamp("battleDate").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BattleRecord = typeof battleRecords.$inferSelect;
export type InsertBattleRecord = typeof battleRecords.$inferInsert;

// User Song Catalogue — songs uploaded or linked by registered users
export const userSongs = mysqlTable("user_songs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 128 }).notNull(),
  artistName: varchar("artistName", { length: 128 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }),                 // S3 storage key for uploaded audio
  fileUrl: varchar("fileUrl", { length: 512 }),                 // S3 URL for browser playback
  externalUrl: varchar("externalUrl", { length: 512 }),         // YouTube / SoundCloud link
  genre: varchar("genre", { length: 64 }),
  duration: int("duration"),                                    // seconds
  isPublic: boolean("isPublic").default(true).notNull(),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSong = typeof userSongs.$inferSelect;
export type InsertUserSong = typeof userSongs.$inferInsert;

// Active Battle — singleton row tracking the current live battle matchup
export const activeBattle = mysqlTable("active_battle", {
  id: int("id").autoincrement().primaryKey(),
  contestant1Name: varchar("contestant1Name", { length: 128 }).notNull(),
  contestant1SongTitle: varchar("contestant1SongTitle", { length: 128 }),
  contestant1SongUrl: varchar("contestant1SongUrl", { length: 512 }),
  contestant2Name: varchar("contestant2Name", { length: 128 }).notNull(),
  contestant2SongTitle: varchar("contestant2SongTitle", { length: 128 }),
  contestant2SongUrl: varchar("contestant2SongUrl", { length: 512 }),
  // Triple Threat — optional 3rd contestant
  contestant3Name: varchar("contestant3Name", { length: 128 }),
  contestant3SongTitle: varchar("contestant3SongTitle", { length: 128 }),
  contestant3SongUrl: varchar("contestant3SongUrl", { length: 512 }),
  isTripleThreat: boolean("isTripleThreat").default(false).notNull(),
  roundNumber: int("roundNumber").default(1).notNull(),
  status: mysqlEnum("status", ["pending", "voting", "closed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ActiveBattle = typeof activeBattle.$inferSelect;
export type InsertActiveBattle = typeof activeBattle.$inferInsert;

// Votes — one vote per user per battle (all votes equal weight=1, judges shown with JUDGE badge)
export const votes = mysqlTable("votes", {
  id: int("id").autoincrement().primaryKey(),
  battleId: int("battleId").notNull(),          // references activeBattle.id
  voterId: int("voterId").notNull(),             // references users.id
  voterName: varchar("voterName", { length: 128 }),  // display name for public judge vote visibility
  voterRole: mysqlEnum("voterRole", ["user", "judge", "admin"]).default("user").notNull(),
  candidate: mysqlEnum("candidate", ["contestant1", "contestant2", "contestant3"]).notNull(),
  weight: int("weight").default(1).notNull(),    // always 1 — all votes equal
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Vote = typeof votes.$inferSelect;
export type InsertVote = typeof votes.$inferInsert;

// Judge Applications — users who want to become judges (pending admin approval)
export const judgeApplications = mysqlTable("judge_applications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  artistName: varchar("artistName", { length: 128 }),
  reason: text("reason"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  appliedAt: timestamp("appliedAt").defaultNow().notNull(),
  reviewedAt: timestamp("reviewedAt"),
});

export type JudgeApplication = typeof judgeApplications.$inferSelect;
export type InsertJudgeApplication = typeof judgeApplications.$inferInsert;

// Live Radio — admin-controlled shared broadcast queue
export const liveRadioState = mysqlTable("live_radio_state", {
  id: int("id").autoincrement().primaryKey(),
  isActive: boolean("isActive").default(false).notNull(),
  isPaused: boolean("isPaused").default(false).notNull(),
  currentTrackId: int("currentTrackId"),   // references liveRadioQueue.id
  currentTrackStartedAt: timestamp("currentTrackStartedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LiveRadioState = typeof liveRadioState.$inferSelect;

// Live Radio Queue — ordered list of tracks for the live broadcast
export const liveRadioQueue = mysqlTable("live_radio_queue", {
  id: int("id").autoincrement().primaryKey(),
  position: int("position").default(0).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  artistName: varchar("artistName", { length: 128 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }),       // S3 key for re-signing
  externalUrl: varchar("externalUrl", { length: 512 }), // YouTube/SoundCloud
  sourceType: mysqlEnum("sourceType", ["upload", "youtube", "external"]).default("upload").notNull(),
  submissionId: int("submissionId"),   // optional link back to review_submissions
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});
export type LiveRadioQueueItem = typeof liveRadioQueue.$inferSelect;
export type InsertLiveRadioQueueItem = typeof liveRadioQueue.$inferInsert;

// Forum Posts — community discussion board
export const forumPosts = mysqlTable("forum_posts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  body: text("body").notNull(),
  category: mysqlEnum("category", ["general", "music", "battles", "news", "feedback"]).default("general").notNull(),
  pinned: boolean("pinned").default(false).notNull(),
  locked: boolean("locked").default(false).notNull(),
  viewCount: int("viewCount").default(0).notNull(),
  audioUrl: varchar("audioUrl", { length: 1024 }),
  audioTitle: varchar("audioTitle", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ForumPost = typeof forumPosts.$inferSelect;
export type InsertForumPost = typeof forumPosts.$inferInsert;

// Forum Comments — replies to forum posts
export const forumComments = mysqlTable("forum_comments", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  userId: int("userId").notNull(),
  body: text("body").notNull(),
  parentId: int("parentId"),  // null = top-level reply; set = nested reply
  audioUrl: varchar("audioUrl", { length: 1024 }),
  audioTitle: varchar("audioTitle", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ForumComment = typeof forumComments.$inferSelect;
export type InsertForumComment = typeof forumComments.$inferInsert;

// Forum Reactions — upvotes on posts and comments
export const forumReactions = mysqlTable("forum_reactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  targetType: mysqlEnum("targetType", ["post", "comment"]).notNull(),
  targetId: int("targetId").notNull(),
  reaction: mysqlEnum("reaction", ["upvote", "downvote"]).default("upvote").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ForumReaction = typeof forumReactions.$inferSelect;
export type InsertForumReaction = typeof forumReactions.$inferInsert;

// Moderation Logs — admin action audit trail
export const moderationLogs = mysqlTable("moderation_logs", {
  id: int("id").autoincrement().primaryKey(),
  adminId: int("adminId").notNull(),
  adminName: varchar("adminName", { length: 128 }).notNull(),
  action: varchar("action", { length: 64 }).notNull(),  // e.g. "delete_post", "delete_comment"
  targetType: varchar("targetType", { length: 64 }).notNull(),
  targetId: int("targetId").notNull(),
  targetPreview: varchar("targetPreview", { length: 512 }),  // snippet of deleted content
  reason: varchar("reason", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ModerationLog = typeof moderationLogs.$inferSelect;
export type InsertModerationLog = typeof moderationLogs.$inferInsert;


// Wheel of Names — Daily promo giveaway
export const wheelOfNamesEntries = mysqlTable("wheel_of_names_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  isPaid: boolean("isPaid").default(false).notNull(),  // true if added via paid entry
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type WheelOfNamesEntry = typeof wheelOfNamesEntries.$inferSelect;
export type InsertWheelOfNamesEntry = typeof wheelOfNamesEntries.$inferInsert;

// Wheel of Names Spins — daily winners
export const wheelOfNamesSpins = mysqlTable("wheel_of_names_spins", {
  id: int("id").autoincrement().primaryKey(),
  spinDate: varchar("spinDate", { length: 10 }).notNull().unique(),  // YYYY-MM-DD, one spin per day
  winnerId: int("winnerId"),
  winnerName: varchar("winnerName", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type WheelOfNamesSpin = typeof wheelOfNamesSpins.$inferSelect;
export type InsertWheelOfNamesSpin = typeof wheelOfNamesSpins.$inferInsert;

// Wheel of Names Paid Entries — $5 per additional entry
export const wheelOfNamesPaidEntries = mysqlTable("wheel_of_names_paid_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  quantity: int("quantity").notNull(),  // number of additional entries purchased
  amountPaid: int("amountPaid").notNull(),  // in cents, e.g., 500 = $5.00
  adminConfirmed: boolean("adminConfirmed").default(false).notNull(),
  confirmedAt: timestamp("confirmedAt"),
  confirmedByAdminId: int("confirmedByAdminId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type WheelOfNamesPaidEntry = typeof wheelOfNamesPaidEntries.$inferSelect;
export type InsertWheelOfNamesPaidEntry = typeof wheelOfNamesPaidEntries.$inferInsert;

// ─── Daily Prize Wheel ──────────────────────────────────────────
// One spin per user per day (date in EST). Resets automatically at midnight EST.
export const dailySpins = mysqlTable("daily_spins", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  prizeKey: varchar("prizeKey", { length: 64 }).notNull(),   // e.g. "free_story_post"
  prizeLabel: varchar("prizeLabel", { length: 128 }).notNull(), // human-readable
  spinDate: varchar("spinDate", { length: 10 }).notNull(),   // YYYY-MM-DD in EST
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  uniqUserDay: uniqueIndex("daily_spins_user_day_unique").on(t.userId, t.spinDate),
}));
export type DailySpin = typeof dailySpins.$inferSelect;
export type InsertDailySpin = typeof dailySpins.$inferInsert;

// ─── Site Analytics ───────────────────────────────────────────
export const pageViews = mysqlTable("page_views", {
  id: int("id").autoincrement().primaryKey(),
  path: varchar("path", { length: 512 }).notNull(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  userId: int("userId"),                           // null = anonymous
  referrer: varchar("referrer", { length: 512 }),
  userAgent: varchar("userAgent", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PageView = typeof pageViews.$inferSelect;
export type InsertPageView = typeof pageViews.$inferInsert;

// Heartbeat rows: upserted every 30s per session to track "active now"
export const activeSessions = mysqlTable("active_sessions", {
  sessionId: varchar("sessionId", { length: 64 }).primaryKey(),
  path: varchar("path", { length: 512 }).notNull(),
  userId: int("userId"),
  lastSeen: timestamp("lastSeen").defaultNow().notNull(),
});
export type ActiveSession = typeof activeSessions.$inferSelect;

// ─── Reward System ────────────────────────────────────────────

// Rewards — configurable reward definitions with requirements
export const rewards = mysqlTable("rewards", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["level", "achievement", "promo", "wars", "review", "supporter", "verified", "rare"]).default("achievement").notNull(),
  rarity: mysqlEnum("rarity", ["common", "rare", "epic", "legendary", "hall_of_fame"]).default("common").notNull(),
  // Requirements stored as JSON: { xp?: number, level?: string, battleWins?: number, fireVotes?: number, ... }
  requirements: text("requirements").notNull().default("{}"),
  requiresAdminApproval: boolean("requiresAdminApproval").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  isPaused: boolean("isPaused").default(false).notNull(),
  expiresAt: timestamp("expiresAt"),
  badgeIcon: varchar("badgeIcon", { length: 64 }),  // emoji or icon name
  badgeColor: varchar("badgeColor", { length: 32 }),  // hex color
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Reward = typeof rewards.$inferSelect;
export type InsertReward = typeof rewards.$inferInsert;

// User Rewards — tracks which rewards each user has and their status
export const userRewards = mysqlTable("user_rewards", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  rewardId: int("rewardId").notNull(),
  status: mysqlEnum("status", ["locked", "unlocked", "claimable", "active", "redeemed", "expired", "revoked"]).default("locked").notNull(),
  unlockedAt: timestamp("unlockedAt"),
  claimedAt: timestamp("claimedAt"),
  redeemedAt: timestamp("redeemedAt"),
  revokedAt: timestamp("revokedAt"),
  grantedBy: int("grantedBy"),  // admin userId who manually granted (null = auto)
  earnedVia: varchar("earnedVia", { length: 256 }),  // description of how it was earned
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UserReward = typeof userRewards.$inferSelect;
export type InsertUserReward = typeof userRewards.$inferInsert;

// User Badges — individual badges granted to users (can have multiples)
export const userBadges = mysqlTable("user_badges", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  badge: varchar("badge", { length: 64 }).notNull(),  // badge identifier
  label: varchar("label", { length: 64 }),  // display label
  rarity: mysqlEnum("rarity", ["common", "rare", "epic", "legendary", "hall_of_fame"]).default("common").notNull(),
  badgeIcon: varchar("badgeIcon", { length: 64 }),
  badgeColor: varchar("badgeColor", { length: 32 }),
  isVisible: boolean("isVisible").default(true).notNull(),
  grantedBy: int("grantedBy"),  // admin userId (null = auto)
  grantedAt: timestamp("grantedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
});
export type UserBadge = typeof userBadges.$inferSelect;
export type InsertUserBadge = typeof userBadges.$inferInsert;

// XP Events — audit log of every XP award
export const xpEvents = mysqlTable("xp_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: int("amount").notNull(),
  reason: varchar("reason", { length: 128 }).notNull(),  // e.g. 'song_upload', 'battle_win'
  metadata: text("metadata"),  // JSON with extra context
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type XpEvent = typeof xpEvents.$inferSelect;
export type InsertXpEvent = typeof xpEvents.$inferInsert;

// Reward Logs — audit trail for all reward actions
export const rewardLogs = mysqlTable("reward_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  rewardId: int("rewardId"),
  action: varchar("action", { length: 64 }).notNull(),  // 'unlocked', 'granted', 'revoked', 'claimed', 'redeemed'
  performedBy: int("performedBy"),  // admin userId (null = auto)
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RewardLog = typeof rewardLogs.$inferSelect;
export type InsertRewardLog = typeof rewardLogs.$inferInsert;

// Line Skip Credits — free line skips earned from Daily Wheel prizes
export const lineSkipCredits = mysqlTable("line_skip_credits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  credits: int("credits").default(0).notNull(),  // number of free line skips available
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LineSkipCredit = typeof lineSkipCredits.$inferSelect;
export type InsertLineSkipCredit = typeof lineSkipCredits.$inferInsert;

// ─── Live Cook Up ─────────────────────────────────────────────

// Live streams — one row per active/ended stream session
export const liveStreams = mysqlTable("live_streams", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  status: mysqlEnum("status", ["live", "ended"]).default("live").notNull(),
  // LiveKit room info
  livekitRoomName: varchar("livekitRoomName", { length: 128 }).notNull(),
  // RTMP ingest details (for OBS/Streamlabs users)
  ingressId: varchar("ingressId", { length: 256 }),   // LiveKit ingress ID
  rtmpUrl: varchar("rtmpUrl", { length: 512 }),        // LiveKit-issued RTMP URL
  rtmpKey: varchar("rtmpKey", { length: 256 }),        // LiveKit-issued stream key (separate from URL)
  // Stats
  viewerCount: int("viewerCount").default(0).notNull(),
  peakViewerCount: int("peakViewerCount").default(0).notNull(),
  totalGiftCoins: int("totalGiftCoins").default(0).notNull(),   // total coins received
  totalGiftUsd: int("totalGiftUsd").default(0).notNull(),       // total USD value in cents
  payoutStatus: mysqlEnum("payoutStatus", ["pending", "paid"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
});
export type LiveStream = typeof liveStreams.$inferSelect;
export type InsertLiveStream = typeof liveStreams.$inferInsert;

// Gift types — configurable gift catalog
export const giftTypes = mysqlTable("gift_types", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  emoji: varchar("emoji", { length: 8 }).notNull(),
  description: varchar("description", { length: 256 }),
  coinCost: int("coinCost").notNull(),
  usdValueCents: int("usdValueCents").notNull(),  // USD value in cents (e.g. 100 = $1.00)
  rarity: mysqlEnum("rarity", ["common", "uncommon", "rare", "epic", "legendary", "mythic"]).default("common").notNull(),
  animationType: varchar("animationType", { length: 64 }).default("float").notNull(),  // float, burst, explosion, legendary, mythic
  soundEffect: varchar("soundEffect", { length: 64 }),  // optional sound key
  isActive: boolean("isActive").default(true).notNull(),
  isLimitedTime: boolean("isLimitedTime").default(false).notNull(),
  expiresAt: timestamp("expiresAt"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type GiftType = typeof giftTypes.$inferSelect;
export type InsertGiftType = typeof giftTypes.$inferInsert;

// Gifts — sent during live streams
export const gifts = mysqlTable("gifts", {
  id: int("id").autoincrement().primaryKey(),
  liveStreamId: int("liveStreamId").notNull(),
  fromUserId: int("fromUserId").notNull(),
  toUserId: int("toUserId").notNull(),   // the streamer
  giftTypeId: int("giftTypeId").notNull(),
  coinCost: int("coinCost").notNull(),
  usdValueCents: int("usdValueCents").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Gift = typeof gifts.$inferSelect;
export type InsertGift = typeof gifts.$inferInsert;

// Coin purchases — manual approval flow
export const coinPurchases = mysqlTable("coin_purchases", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  coins: int("coins").notNull(),
  amountCents: int("amountCents").notNull(),  // USD in cents
  paymentMethod: varchar("paymentMethod", { length: 64 }),  // e.g. "cashapp", "paypal"
  paymentNote: varchar("paymentNote", { length: 256 }),  // e.g. CashApp username or note
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  approvedByAdminId: int("approvedByAdminId"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CoinPurchase = typeof coinPurchases.$inferSelect;
export type InsertCoinPurchase = typeof coinPurchases.$inferInsert;

// Coin balances — one row per user
export const coinBalances = mysqlTable("coin_balances", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  balance: int("balance").default(0).notNull(),
  totalEarned: int("totalEarned").default(0).notNull(),   // streamer: total coins received as gifts
  totalSpent: int("totalSpent").default(0).notNull(),     // viewer: total coins spent on gifts
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CoinBalance = typeof coinBalances.$inferSelect;
export type InsertCoinBalance = typeof coinBalances.$inferInsert;

// Music Review Sessions — track each live session for per-session submission limits
export const musicReviewSessions = mysqlTable("music_review_sessions", {
  id: int("id").autoincrement().primaryKey(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MusicReviewSession = typeof musicReviewSessions.$inferSelect;
export type InsertMusicReviewSession = typeof musicReviewSessions.$inferInsert;

// ─── Cashout Requests ─────────────────────────────────────────
export const cashoutRequests = mysqlTable("cashout_requests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  coins: int("coins").notNull(),                                        // coins to cash out
  usdEstimate: int("usdEstimate").notNull(),                            // estimated USD in cents
  paymentMethod: mysqlEnum("paymentMethod", ["cashapp", "paypal", "venmo", "zelle"]).notNull(),
  paymentHandle: varchar("paymentHandle", { length: 128 }).notNull(),   // e.g. $cashtag or email
  status: mysqlEnum("status", ["pending", "approved", "denied"]).default("pending").notNull(),
  adminNote: varchar("adminNote", { length: 512 }),
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CashoutRequest = typeof cashoutRequests.$inferSelect;
export type InsertCashoutRequest = typeof cashoutRequests.$inferInsert;

// ─── Notifications ────────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),                                      // recipient
  type: varchar("type", { length: 64 }).notNull(),                     // e.g. "live_stream", "cookup", "coin_approved"
  title: varchar("title", { length: 128 }).notNull(),
  body: varchar("body", { length: 512 }).notNull(),
  link: varchar("link", { length: 256 }),                              // optional deep link
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── Fire or Trash Swipe Game ─────────────────────────────────
// Reuses song_reactions table for votes but adds a dedicated game queue
export const fireTrashVotes = mysqlTable("fire_trash_votes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  submissionId: int("submissionId").notNull(),
  vote: mysqlEnum("vote", ["fire", "trash"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FireTrashVote = typeof fireTrashVotes.$inferSelect;
export type InsertFireTrashVote = typeof fireTrashVotes.$inferInsert;

// ─── Virtual Economy: Live Rewards Wallet ─────────────────────
// Separate from coinBalances — only created when viewers send gifts
export const liveRewards = mysqlTable("live_rewards", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),          // the creator
  available: int("available").default(0).notNull(),  // ready to cash out (in "reward units" = cents)
  pending: int("pending").default(0).notNull(),      // held for review / fraud check
  lifetimeEarned: int("lifetimeEarned").default(0).notNull(),
  lifetimeWithdrawn: int("lifetimeWithdrawn").default(0).notNull(),
  isFrozen: boolean("isFrozen").default(false).notNull(),
  frozenReason: varchar("frozenReason", { length: 256 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LiveReward = typeof liveRewards.$inferSelect;
export type InsertLiveReward = typeof liveRewards.$inferInsert;

// ─── Virtual Economy: Fire Vote Balances ─────────────────────
export const fireVoteBalances = mysqlTable("fire_vote_balances", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  balance: int("balance").default(0).notNull(),
  lifetimeEarned: int("lifetimeEarned").default(0).notNull(),
  lifetimeConverted: int("lifetimeConverted").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FireVoteBalance = typeof fireVoteBalances.$inferSelect;
export type InsertFireVoteBalance = typeof fireVoteBalances.$inferInsert;

// ─── Virtual Economy: Fire Vote → Coin Conversions ────────────
export const fireVoteConversions = mysqlTable("fire_vote_conversions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fireVotesBurned: int("fireVotesBurned").notNull(),
  coinsAwarded: int("coinsAwarded").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FireVoteConversion = typeof fireVoteConversions.$inferSelect;
export type InsertFireVoteConversion = typeof fireVoteConversions.$inferInsert;

// ─── Virtual Economy: Wallet Transactions (unified ledger) ────
export const walletTransactions = mysqlTable("wallet_transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  currency: mysqlEnum("currency", ["coins", "fire_votes", "live_rewards"]).notNull(),
  type: varchar("type", { length: 64 }).notNull(),  // "purchase", "gift_sent", "gift_received", "conversion", "cashout", "admin_grant", "refund"
  amount: int("amount").notNull(),                  // positive = credit, negative = debit
  balanceAfter: int("balanceAfter").notNull(),
  referenceId: int("referenceId"),                  // e.g. giftId, conversionId, cashoutId
  referenceType: varchar("referenceType", { length: 64 }),
  note: varchar("note", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertWalletTransaction = typeof walletTransactions.$inferInsert;

// ─── Virtual Economy: Economy Config ─────────────────────────
// Single-row config table for admin-configurable rates
export const economyConfig = mysqlTable("economy_config", {
  id: int("id").autoincrement().primaryKey(),
  // Revenue split
  creatorSplitPct: int("creatorSplitPct").default(70).notNull(),   // default 70%
  platformSplitPct: int("platformSplitPct").default(30).notNull(), // default 30%
  // Fire Vote conversion
  fireVoteConversionEnabled: boolean("fireVoteConversionEnabled").default(true).notNull(),
  fireVotesPerConversion: int("fireVotesPerConversion").default(50).notNull(),  // 50 FV = 10 coins
  coinsPerConversion: int("coinsPerConversion").default(10).notNull(),
  fvDailyCoinCap: int("fvDailyCoinCap").default(100).notNull(),
  fvWeeklyCoinCap: int("fvWeeklyCoinCap").default(500).notNull(),
  fvMonthlyCoinCap: int("fvMonthlyCoinCap").default(2000).notNull(),
  // Cashout
  minCashoutCents: int("minCashoutCents").default(500).notNull(),  // $5.00 minimum
  cashAppEnabled: boolean("cashAppEnabled").default(true).notNull(),
  paypalEnabled: boolean("paypalEnabled").default(true).notNull(),
  applePayEnabled: boolean("applePayEnabled").default(true).notNull(),
  // Fraud
  fraudAutoFreezeEnabled: boolean("fraudAutoFreezeEnabled").default(true).notNull(),
  fraudRapidGiftThreshold: int("fraudRapidGiftThreshold").default(10).notNull(),  // gifts in 60s
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: int("updatedBy"),
});
export type EconomyConfig = typeof economyConfig.$inferSelect;
export type InsertEconomyConfig = typeof economyConfig.$inferInsert;

// ─── Virtual Economy: Coin Packages ──────────────────────────
export const coinPackages = mysqlTable("coin_packages", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  coins: int("coins").notNull(),
  bonusCoins: int("bonusCoins").default(0).notNull(),
  priceCents: int("priceCents").notNull(),
  badge: varchar("badge", { length: 32 }),  // "most_popular", "best_value", null
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CoinPackage = typeof coinPackages.$inferSelect;
export type InsertCoinPackage = typeof coinPackages.$inferInsert;

// ─── Virtual Economy: Creator Cashout Requests ───────────────
// Separate from coin cashouts — only Live Rewards can be cashed out here
export const creatorCashouts = mysqlTable("creator_cashouts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amountCents: int("amountCents").notNull(),          // amount in cents
  paymentMethod: mysqlEnum("paymentMethod", ["cashapp", "paypal", "applepay"]).notNull(),
  paymentHandle: varchar("paymentHandle", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "paid", "on_hold", "rejected", "cancelled"]).default("pending").notNull(),
  adminNote: varchar("adminNote", { length: 512 }),
  processedAt: timestamp("processedAt"),
  processedBy: int("processedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CreatorCashout = typeof creatorCashouts.$inferSelect;
export type InsertCreatorCashout = typeof creatorCashouts.$inferInsert;

// ─── Virtual Economy: Fraud Logs ─────────────────────────────
export const fraudLogs = mysqlTable("fraud_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: varchar("type", { length: 64 }).notNull(),   // "rapid_gifting", "self_gifting", "ip_collision", "vote_farming", etc.
  riskScore: mysqlEnum("riskScore", ["low", "medium", "high", "critical"]).notNull(),
  details: text("details"),                           // JSON with context
  ipAddress: varchar("ipAddress", { length: 64 }),
  deviceFingerprint: varchar("deviceFingerprint", { length: 128 }),
  resolved: boolean("resolved").default(false).notNull(),
  resolvedBy: int("resolvedBy"),
  resolvedAt: timestamp("resolvedAt"),
  resolvedNote: varchar("resolvedNote", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FraudLog = typeof fraudLogs.$inferSelect;
export type InsertFraudLog = typeof fraudLogs.$inferInsert;

// ─── Updated Gift Types (extended with rarity + animation) ────
// NOTE: giftTypes table already exists — we alter it via migration
// The existing table gets new columns: rarity, animationType, description
// These are added via pnpm db:push (Drizzle will ALTER TABLE)

// ─── Live Sessions ────────────────────────────────────────────
// Tracks active and past livestream sessions
export const liveSessions = mysqlTable("live_sessions", {
  id: int("id").autoincrement().primaryKey(),
  creatorId: int("creatorId").notNull(),
  streamTitle: varchar("streamTitle", { length: 256 }).default("Live Stream"),
  youtubeUrl: varchar("youtubeUrl", { length: 512 }),
  isActive: boolean("isActive").default(true).notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
  peakViewers: int("peakViewers").default(0).notNull(),
  totalViewerMinutes: int("totalViewerMinutes").default(0).notNull(),
  viewerSnapshots: text("viewerSnapshots"),  // JSON array of {time, count}
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LiveSession = typeof liveSessions.$inferSelect;
export type InsertLiveSession = typeof liveSessions.$inferInsert;

// ─── Stream Summaries ─────────────────────────────────────────
// Permanent post-stream performance summaries
export const streamSummaries = mysqlTable("stream_summaries", {
  id: int("id").autoincrement().primaryKey(),
  creatorId: int("creatorId").notNull(),
  sessionId: int("sessionId"),               // FK to liveSessions
  streamTitle: varchar("streamTitle", { length: 256 }).default("Live Stream"),
  startedAt: timestamp("startedAt").notNull(),
  endedAt: timestamp("endedAt").notNull(),
  durationSeconds: int("durationSeconds").default(0).notNull(),
  totalViews: int("totalViews").default(0).notNull(),
  peakViewers: int("peakViewers").default(0).notNull(),
  avgViewers: int("avgViewers").default(0).notNull(),
  totalGifts: int("totalGifts").default(0).notNull(),
  totalCoinsGifted: int("totalCoinsGifted").default(0).notNull(),
  totalLiveRewards: int("totalLiveRewards").default(0).notNull(),  // in cents
  totalFireVotes: int("totalFireVotes").default(0).notNull(),
  totalLikes: int("totalLikes").default(0).notNull(),
  newFollowers: int("newFollowers").default(0).notNull(),
  topGifters: text("topGifters"),            // JSON: [{userId, name, coins, giftCount}]
  giftBreakdown: text("giftBreakdown"),      // JSON: [{giftName, count, coinsTotal}]
  likeBreakdown: text("likeBreakdown"),      // JSON: [{minute, count}]
  engagementSummary: text("engagementSummary"), // JSON: {chatMessages, uniqueChatters, ...}
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type StreamSummary = typeof streamSummaries.$inferSelect;
export type InsertStreamSummary = typeof streamSummaries.$inferInsert;


// Judge/Admin broadcasts during music review sessions
export const judgeStreams = mysqlTable("judge_streams", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),  // references users.id
  musicReviewSessionId: int("musicReviewSessionId"),  // optional: link to review session
  roomName: varchar("roomName", { length: 128 }).notNull(),  // LiveKit room name
  ingressId: varchar("ingressId", { length: 256 }),  // LiveKit ingress ID (null for browser-only broadcasts)
  rtmpUrl: varchar("rtmpUrl", { length: 512 }),  // RTMP server URL for OBS
  rtmpKey: varchar("rtmpKey", { length: 256 }),  // stream key for OBS
  status: mysqlEnum("status", ["active", "ended", "error"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
});

export type JudgeStream = typeof judgeStreams.$inferSelect;
export type InsertJudgeStream = typeof judgeStreams.$inferInsert;


// ─── Merch Store ─────────────────────────────────────────
// Products in the merch store
export const merchProducts = mysqlTable("merch_products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  price: int("price").notNull(),  // in cents
  imageUrl: varchar("imageUrl", { length: 512 }).notNull(),
  frontImageUrl: varchar("frontImageUrl", { length: 512 }),
  backImageUrl: varchar("backImageUrl", { length: 512 }),
  colors: text("colors").notNull(),  // JSON array: ["Black", "White"]
  sizes: text("sizes").notNull(),    // JSON array: ["S", "M", "L", "XL", "2XL", "3XL"]
  isActive: boolean("isActive").default(true).notNull(),
  isLimitedRelease: boolean("isLimitedRelease").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MerchProduct = typeof merchProducts.$inferSelect;
export type InsertMerchProduct = typeof merchProducts.$inferInsert;

// Shopping cart items
export const cartItems = mysqlTable("cart_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  productId: int("productId").notNull(),
  color: varchar("color", { length: 64 }).notNull(),
  size: varchar("size", { length: 16 }).notNull(),
  quantity: int("quantity").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = typeof cartItems.$inferInsert;

// Orders
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 256 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 256 }),
  status: mysqlEnum("status", ["pending", "completed", "failed", "cancelled"]).default("pending").notNull(),
  subtotalCents: int("subtotalCents").notNull(),
  shippingCents: int("shippingCents").notNull(),
  taxCents: int("taxCents").default(0).notNull(),
  totalCents: int("totalCents").notNull(),
  shippingAddress: text("shippingAddress"),  // JSON: {name, email, address, city, state, zip, country}
  items: text("items").notNull(),  // JSON: [{productId, productName, color, size, quantity, price}]
  confirmationEmailSent: boolean("confirmationEmailSent").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// ─── Admin Shop System ────────────────────────────────────
// Full-featured product catalog managed by admin
export const shopProducts = mysqlTable("shop_products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  subtitle: varchar("subtitle", { length: 256 }),
  slug: varchar("slug", { length: 256 }).notNull().unique(),
  description: text("description"),
  price: int("price").notNull(),           // in cents
  compareAtPrice: int("compareAtPrice"),   // original price for sale display, in cents
  category: varchar("category", { length: 128 }),
  status: mysqlEnum("status", ["draft", "active", "sold_out", "hidden"]).default("draft").notNull(),
  featured: boolean("featured").default(false).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  // Stripe IDs
  stripeProductId: varchar("stripeProductId", { length: 256 }),
  stripePriceId: varchar("stripePriceId", { length: 256 }),
  // Display
  badge: varchar("badge", { length: 128 }),   // e.g. "Limited Release", "New Drop", "Best Seller"
  shippingEstimate: varchar("shippingEstimate", { length: 128 }),  // e.g. "5–7 business days"
  // SEO
  seoTitle: varchar("seoTitle", { length: 256 }),
  seoDescription: text("seoDescription"),
  // Stats
  salesCount: int("salesCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),  // soft delete
});
export type ShopProduct = typeof shopProducts.$inferSelect;
export type InsertShopProduct = typeof shopProducts.$inferInsert;

// Product images (multiple per product, typed by role)
export const shopProductImages = mysqlTable("shop_product_images", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  url: varchar("url", { length: 512 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }),
  imageType: mysqlEnum("imageType", ["thumbnail", "front", "back", "size_chart", "gallery"]).default("gallery").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ShopProductImage = typeof shopProductImages.$inferSelect;
export type InsertShopProductImage = typeof shopProductImages.$inferInsert;

// Product variants: each color+size combination with its own inventory
export const shopVariants = mysqlTable("shop_variants", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  color: varchar("color", { length: 64 }).notNull(),
  size: varchar("size", { length: 32 }).notNull(),
  inventoryQty: int("inventoryQty").default(0).notNull(),
  sku: varchar("sku", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ShopVariant = typeof shopVariants.$inferSelect;
export type InsertShopVariant = typeof shopVariants.$inferInsert;

// ─── Golden Wheel System ──────────────────────────────────────────────────────
// Tracks Stripe-verified merch orders for wheel eligibility
export const goldenWheelOrders = mysqlTable("golden_wheel_orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  customerEmail: varchar("customerEmail", { length: 256 }).notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 256 }),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 256 }).unique().notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 256 }),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid", "failed", "refunded", "disputed"]).default("pending").notNull(),
  livemode: boolean("livemode").default(false).notNull(),
  totalCents: int("totalCents").default(0).notNull(),
  currency: varchar("currency", { length: 8 }).default("usd").notNull(),
  paidAt: timestamp("paidAt"),
  refundedAt: timestamp("refundedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GoldenWheelOrder = typeof goldenWheelOrders.$inferSelect;
export type InsertGoldenWheelOrder = typeof goldenWheelOrders.$inferInsert;

// Eligibility: one per first-time customer, granted by webhook
export const wheelEligibility = mysqlTable("wheel_eligibility", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").unique().notNull(),
  orderId: int("orderId").unique().notNull(),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 256 }).unique().notNull(),
  status: mysqlEnum("status", ["ELIGIBLE", "CLAIMED", "REVOKED"]).default("ELIGIBLE").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  claimedAt: timestamp("claimedAt"),
});
export type WheelEligibility = typeof wheelEligibility.$inferSelect;
export type InsertWheelEligibility = typeof wheelEligibility.$inferInsert;

// Prizes: configurable by admin
export const wheelPrizes = mysqlTable("wheel_prizes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  weight: int("weight").default(10).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  rewardType: mysqlEnum("rewardType", ["stripe_coupon", "promo_service", "physical_item", "cash_prize"]).notNull(),
  rewardValue: varchar("rewardValue", { length: 256 }),
  inventoryLimit: int("inventoryLimit"),
  remainingInventory: int("remainingInventory"),
  couponExpiryDays: int("couponExpiryDays").default(90),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type WheelPrize = typeof wheelPrizes.$inferSelect;
export type InsertWheelPrize = typeof wheelPrizes.$inferInsert;

// Spin results: one per eligible customer, immutable after creation
export const wheelSpins = mysqlTable("wheel_spins", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").unique().notNull(),
  eligibilityId: int("eligibilityId").unique().notNull(),
  orderId: int("orderId").unique().notNull(),
  prizeId: int("prizeId").notNull(),
  prizeNameSnapshot: varchar("prizeNameSnapshot", { length: 256 }).notNull(),
  couponCode: varchar("couponCode", { length: 128 }),
  stripeCouponId: varchar("stripeCouponId", { length: 256 }),
  status: mysqlEnum("status", ["pending_redemption", "redeemed", "flagged", "revoked"]).default("pending_redemption").notNull(),
  manuallyRedeemed: boolean("manuallyRedeemed").default(false).notNull(),
  adminNotes: text("adminNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type WheelSpin = typeof wheelSpins.$inferSelect;
export type InsertWheelSpin = typeof wheelSpins.$inferInsert;

// Idempotency: prevent duplicate webhook processing
export const processedStripeEvents = mysqlTable("processed_stripe_events", {
  stripeEventId: varchar("stripeEventId", { length: 256 }).primaryKey(),
  eventType: varchar("eventType", { length: 128 }).notNull(),
  processedAt: timestamp("processedAt").defaultNow().notNull(),
});
export type ProcessedStripeEvent = typeof processedStripeEvents.$inferSelect;

// Promo Codes (Free Shipping, Discounts, etc.)
export const promoCodes = mysqlTable("promo_codes", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  type: varchar("type", { length: 50 }).notNull(), // "free_shipping", "discount_percent", "discount_fixed"
  enabled: boolean("enabled").notNull().default(true),
  expirationDate: timestamp("expirationDate"),
  minimumSubtotal: int("minimumSubtotal"), // in cents; null = no minimum
  maximumUses: int("maximumUses").notNull().default(999),
  usageCount: int("usageCount").notNull().default(0),
  firstTimeOnly: boolean("firstTimeOnly").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PromoCode = typeof promoCodes.$inferSelect;
export type InsertPromoCode = typeof promoCodes.$inferInsert;


// Studios Directory
export const studios = mysqlTable("studios", {
  id: int("id").autoincrement().primaryKey(),
  studioName: varchar("studioName", { length: 256 }).notNull(),
  location: varchar("location", { length: 512 }).default(""), // Full address
  latitude: varchar("latitude", { length: 32 }).default(""), // Stored as string for precision
  longitude: varchar("longitude", { length: 32 }).default(""), // Stored as string for precision
  engineers: text("engineers"), // JSON array of engineer names
  contactInfo: varchar("contactInfo", { length: 512 }).default(""), // Phone, email, etc.
  instagramHandle: varchar("instagramHandle", { length: 128 }),
  twitterHandle: varchar("twitterHandle", { length: 128 }),
  facebookUrl: varchar("facebookUrl", { length: 512 }),
  websiteUrl: varchar("websiteUrl", { length: 512 }),
  youtubeChannel: varchar("youtubeChannel", { length: 512 }),
  tiktokHandle: varchar("tiktokHandle", { length: 128 }),
  description: text("description"), // Studio description/bio
  imageUrl: varchar("imageUrl", { length: 512 }), // Studio photo
  averageRating: varchar("averageRating", { length: 10 }).default("0"), // Stored as string (e.g., "4.5")
  reviewCount: int("reviewCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Studio = typeof studios.$inferSelect;
export type InsertStudio = typeof studios.$inferInsert;

// Studio Reviews
export const studioReviews = mysqlTable("studio_reviews", {
  id: int("id").autoincrement().primaryKey(),
  studioId: int("studioId").notNull(),
  userId: int("userId"), // null for guest reviews
  guestName: varchar("guestName", { length: 128 }), // For guest reviews
  guestEmail: varchar("guestEmail", { length: 320 }), // For guest reviews
  rating: int("rating").notNull(), // 1-5 stars
  title: varchar("title", { length: 256 }).notNull(),
  reviewText: text("reviewText").notNull(),
  isVerified: boolean("isVerified").default(false).notNull(), // Verified visitor
  isApproved: boolean("isApproved").default(true).notNull(), // Admin approval flag
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StudioReview = typeof studioReviews.$inferSelect;
export type InsertStudioReview = typeof studioReviews.$inferInsert;


// News & Articles (from Instagram posts)
export const articles = mysqlTable("articles", {
  id: int("id").autoincrement().primaryKey(),
  instagramPostId: varchar("instagramPostId", { length: 128 }).notNull().unique(), // Instagram post ID
  title: varchar("title", { length: 512 }).notNull(), // Generated from caption
  slug: varchar("slug", { length: 512 }).notNull().unique(), // URL-friendly slug
  caption: text("caption").notNull(), // Original Instagram caption
  content: text("content"), // Expanded article content
  thumbnailUrl: varchar("thumbnailUrl", { length: 512 }), // AI-generated or Instagram image
  instagramImageUrl: varchar("instagramImageUrl", { length: 512 }), // Original Instagram image
  mediaType: varchar("mediaType", { length: 32 }), // IMAGE, VIDEO, CAROUSEL_ALBUM
  mediaUrl: varchar("mediaUrl", { length: 512 }), // Instagram media URL
  likeCount: int("likeCount").default(0).notNull(),
  commentCount: int("commentCount").default(0).notNull(),
  permalink: varchar("permalink", { length: 512 }), // Link to Instagram post
  publishedAt: timestamp("publishedAt"), // When posted on Instagram
  isPublished: boolean("isPublished").default(true).notNull(),
  seoTitle: varchar("seoTitle", { length: 160 }), // Meta title for SEO
  seoDescription: varchar("seoDescription", { length: 160 }), // Meta description for SEO
  keywords: text("keywords"), // Comma-separated keywords for SEO
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Article = typeof articles.$inferSelect;
export type InsertArticle = typeof articles.$inferInsert;

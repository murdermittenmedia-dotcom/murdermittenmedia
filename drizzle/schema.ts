import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Music review submission queue
export const reviewSubmissions = mysqlTable("review_submissions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
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

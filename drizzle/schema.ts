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
  profileComplete: boolean("profileComplete").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Music review submission queue
export const reviewSubmissions = mysqlTable("review_submissions", {
  id: int("id").autoincrement().primaryKey(),
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReviewSubmission = typeof reviewSubmissions.$inferSelect;
export type InsertReviewSubmission = typeof reviewSubmissions.$inferInsert;

// Queue state (singleton row for current playing track + live status)
export const queueState = mysqlTable("queue_state", {
  id: int("id").autoincrement().primaryKey(),
  currentPlayingId: int("currentPlayingId"),
  isLive: boolean("isLive").default(false).notNull(),
  liveMessage: varchar("liveMessage", { length: 256 }),
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

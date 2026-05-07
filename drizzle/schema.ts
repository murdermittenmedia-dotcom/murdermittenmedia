import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
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

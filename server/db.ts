import { eq, asc, desc, ne, and, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  reviewSubmissions, InsertReviewSubmission,
  queueState, artistOfWeek, InsertArtistOfWeek,
  wheelEntries, InsertWheelEntry, WheelEntry,
  chatMessages, InsertChatMessage,
  siteSettings,
  battleRecords, InsertBattleRecord,
  userSongs, InsertUserSong,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserProfile(userId: number, data: { artistName?: string; instagramHandle?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updateData: Record<string, unknown> = { profileComplete: true };
  if (data.artistName !== undefined) updateData.artistName = data.artistName;
  if (data.instagramHandle !== undefined) {
    // Strip leading @ if present
    updateData.instagramHandle = data.instagramHandle.replace(/^@/, "");
  }
  return db.update(users).set(updateData).where(eq(users.id, userId));
}

// -- Review Queue ---------------------------------------------

export async function getQueueSubmissions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviewSubmissions)
    .where(ne(reviewSubmissions.status, "removed"))
    .orderBy(desc(reviewSubmissions.skipPaymentConfirmed), asc(reviewSubmissions.createdAt));
}

export async function addSubmission(data: InsertReviewSubmission) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(reviewSubmissions).values(data);
}

export async function updateSubmissionStatus(id: number, status: "pending" | "playing" | "reviewed" | "removed") {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(reviewSubmissions).set({ status }).where(eq(reviewSubmissions.id, id));
}

export async function confirmSkipPayment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(reviewSubmissions).set({ skipPaymentConfirmed: true }).where(eq(reviewSubmissions.id, id));
}

export async function getQueueState() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(queueState).limit(1);
  return rows[0] ?? null;
}

export async function setCurrentPlaying(submissionId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db.select().from(queueState).limit(1);
  if (existing.length === 0) {
    await db.insert(queueState).values({ currentPlayingId: submissionId, isLive: true });
  } else {
    await db.update(queueState).set({ currentPlayingId: submissionId });
  }
}

export async function setLiveStatus(isLive: boolean, message?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db.select().from(queueState).limit(1);
  if (existing.length === 0) {
    await db.insert(queueState).values({ isLive, liveMessage: message ?? null });
  } else {
    await db.update(queueState).set({ isLive, liveMessage: message ?? null });
  }
}

// -- Artist of the Week ---------------------------------------

export async function getActiveArtistOfWeek() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(artistOfWeek)
    .where(eq(artistOfWeek.isActive, true))
    .orderBy(desc(artistOfWeek.weekOf))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAllArtistsOfWeek() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(artistOfWeek).orderBy(desc(artistOfWeek.weekOf));
}

export async function upsertArtistOfWeek(data: InsertArtistOfWeek) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(artistOfWeek).set({ isActive: false });
  return db.insert(artistOfWeek).values({ ...data, isActive: true });
}

// -- Wheel Entries (Music Wars) --------------------------------

export async function getActiveWheelEntries() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(wheelEntries)
    .where(eq(wheelEntries.status, "active"))
    .orderBy(asc(wheelEntries.wheelPosition), asc(wheelEntries.createdAt));
}

export async function getAllWheelEntries() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(wheelEntries)
    .orderBy(asc(wheelEntries.wheelPosition), asc(wheelEntries.createdAt));
}

export async function addWheelEntry(data: InsertWheelEntry) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(wheelEntries).values(data);
}

export async function updateWheelEntryStatus(id: number, status: WheelEntry["status"]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(wheelEntries).set({ status }).where(eq(wheelEntries.id, id));
}

export async function confirmWheelPayment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(wheelEntries).set({ paymentConfirmed: true, status: "active" }).where(eq(wheelEntries.id, id));
}

export async function getUserWheelEntries(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(wheelEntries)
    .where(eq(wheelEntries.userId, userId))
    .orderBy(desc(wheelEntries.createdAt));
}

// -- Site Settings (key-value) --------------------------------

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(siteSettings)
    .values({ key, value })
    .onDuplicateKeyUpdate({ set: { value } });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(siteSettings);
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

// -- Chat Messages --------------------------------------------

export async function getChatMessages(room: "music_wars" | "music_review", limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(chatMessages)
    .where(and(
      eq(chatMessages.room, room),
      eq(chatMessages.deleted, false),
    ))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
  return rows.reverse();
}

export async function deleteChatMessage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(chatMessages).set({ deleted: true }).where(eq(chatMessages.id, id));
}

// -- Battle Records -------------------------------------------

export async function createBattleRecord(data: InsertBattleRecord) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(battleRecords).values(data);
}

export async function getAllBattleRecords(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(battleRecords)
    .orderBy(desc(battleRecords.battleDate))
    .limit(limit);
}

export async function getBattleRecordsByArtistName(artistName: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(battleRecords)
    .where(or(
      eq(battleRecords.winnerArtistName, artistName),
      eq(battleRecords.loserArtistName, artistName),
    ))
    .orderBy(desc(battleRecords.battleDate));
}

export async function getBattleRecordsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(battleRecords)
    .where(or(
      eq(battleRecords.winnerId, userId),
      eq(battleRecords.loserId, userId),
    ))
    .orderBy(desc(battleRecords.battleDate));
}

// Compute W/L/draw stats for an artist by name
export async function getArtistStats(artistName: string) {
  const records = await getBattleRecordsByArtistName(artistName);
  const wins = records.filter(r => r.winnerArtistName === artistName).length;
  const losses = records.filter(r => r.loserArtistName === artistName).length;
  return { wins, losses, total: records.length, records };
}

// Leaderboard: all artists ranked by wins, includes latest winning song
export async function getBattleLeaderboard() {
  const db = await getDb();
  if (!db) return [];
  const allRecords = await db.select().from(battleRecords).orderBy(desc(battleRecords.battleDate));
  const stats: Record<string, {
    artistName: string;
    wins: number;
    losses: number;
    userId?: number | null;
    latestWinSong?: string | null;
    latestWinSongUrl?: string | null;
  }> = {};
  for (const r of allRecords) {
    if (!stats[r.winnerArtistName]) {
      stats[r.winnerArtistName] = { artistName: r.winnerArtistName, wins: 0, losses: 0, userId: r.winnerId };
    }
    stats[r.winnerArtistName].wins++;
    // Track most recent winning song (records are desc by date, so first win encountered is latest)
    if (!stats[r.winnerArtistName].latestWinSong) {
      stats[r.winnerArtistName].latestWinSong = r.winnerSongTitle;
      stats[r.winnerArtistName].latestWinSongUrl = r.winnerSongUrl ?? null;
    }
    if (!stats[r.loserArtistName]) {
      stats[r.loserArtistName] = { artistName: r.loserArtistName, wins: 0, losses: 0, userId: r.loserId };
    }
    stats[r.loserArtistName].losses++;
  }
  return Object.values(stats).sort((a, b) => b.wins - a.wins || a.losses - b.losses);
}

// -- User Songs (Catalogue) -----------------------------------

export async function addUserSong(data: InsertUserSong) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(userSongs).values(data);
  return result;
}

export async function getUserSongs(userId: number, includePrivate = false) {
  const db = await getDb();
  if (!db) return [];
  const conditions = includePrivate
    ? [eq(userSongs.userId, userId)]
    : [eq(userSongs.userId, userId), eq(userSongs.isPublic, true)];
  return db.select().from(userSongs)
    .where(and(...conditions))
    .orderBy(desc(userSongs.uploadedAt));
}

export async function deleteUserSong(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(userSongs).where(and(eq(userSongs.id, id), eq(userSongs.userId, userId)));
}

export async function updateUserSongVisibility(id: number, userId: number, isPublic: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(userSongs).set({ isPublic }).where(and(eq(userSongs.id, id), eq(userSongs.userId, userId)));
}

// Full artist profile: user info + battle stats + songs
export async function getArtistProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!userRows.length) return null;
  const user = userRows[0];
  const artistName = user.artistName || user.name || "Unknown Artist";
  const [stats, songs] = await Promise.all([
    getArtistStats(artistName),
    getUserSongs(userId, false),
  ]);
  return { user, artistName, stats, songs };
}

import { eq, asc, desc, ne, and, or, sql, isNotNull, inArray, count, sum, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, User, users,
  reviewSubmissions, InsertReviewSubmission,
  queueState, artistOfWeek, InsertArtistOfWeek,
  wheelEntries, InsertWheelEntry, WheelEntry,
  chatMessages, InsertChatMessage,
  siteSettings,
  battleRecords, InsertBattleRecord,
  userSongs, InsertUserSong,
  votes, InsertVote,
  activeBattle, InsertActiveBattle,
  songReactions, InsertSongReaction,
  judgeApplications, InsertJudgeApplication, JudgeApplication,
  liveRadioState, liveRadioQueue, InsertLiveRadioQueueItem,
  forumPosts, InsertForumPost,
  forumComments, InsertForumComment,
  forumReactions,
  moderationLogs,
  wheelOfNamesEntries, InsertWheelOfNamesEntry,
  wheelOfNamesSpins, InsertWheelOfNamesSpin,
  wheelOfNamesPaidEntries, InsertWheelOfNamesPaidEntry,
  pageViews, InsertPageView,
  activeSessions,
  rewards, Reward,
  userRewards, UserReward,
  userBadges,
  xpEvents,
  rewardLogs,
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

export async function updateUserProfile(userId: number, data: { artistName?: string; instagramHandle?: string; city?: string; avatarUrl?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updateData: Record<string, unknown> = { profileComplete: true };
  if (data.artistName !== undefined) updateData.artistName = data.artistName;
  if (data.instagramHandle !== undefined) {
    // Strip leading @ if present
    updateData.instagramHandle = data.instagramHandle.replace(/^@/, "");
  }
  if (data.city !== undefined) updateData.city = data.city.trim();
  if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
  return db.update(users).set(updateData).where(eq(users.id, userId));
}

// -- Review Queue ---------------------------------------------

export async function getQueueSubmissions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviewSubmissions)
    .where(ne(reviewSubmissions.status, "removed"))
    .orderBy(
      desc(reviewSubmissions.skipPaymentConfirmed), // skip-line always first
      asc(reviewSubmissions.position),              // admin drag-reorder
      asc(reviewSubmissions.createdAt)              // fallback: submission time
    );
}

/** Bulk-update position values for queue reordering (admin drag-and-drop) */
export async function reorderQueueSubmissions(orderedIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Update each submission's position to match its index in the new order
  await Promise.all(
    orderedIds.map((id, index) =>
      db.update(reviewSubmissions)
        .set({ position: index + 1 })
        .where(eq(reviewSubmissions.id, id))
    )
  );
}

export async function getReviewedSubmissions(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviewSubmissions)
    .where(eq(reviewSubmissions.status, "reviewed"))
    .orderBy(desc(reviewSubmissions.updatedAt))
    .limit(limit);
}

export async function addSubmission(data: InsertReviewSubmission) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Auto-assign position to end of queue so new submissions always go to the bottom.
  // Skip-line submissions still jump to the front via skipPaymentConfirmed ordering.
  const rows = await db
    .select({ maxPos: sql<number>`MAX(${reviewSubmissions.position})` })
    .from(reviewSubmissions)
    .where(ne(reviewSubmissions.status, "removed"));
  const maxPos = rows[0]?.maxPos ?? 0;
  const position = (data.position && data.position > 0) ? data.position : maxPos + 1;
  return db.insert(reviewSubmissions).values({ ...data, position });
}

export async function updateSubmissionStatus(id: number, status: "pending" | "playing" | "reviewed" | "removed") {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // When marking a song as playing, first reset any other songs currently marked as playing back to pending.
  // This prevents multiple songs from showing a LIVE badge simultaneously.
  if (status === "playing") {
    await db.update(reviewSubmissions)
      .set({ status: "pending" })
      .where(and(eq(reviewSubmissions.status, "playing"), ne(reviewSubmissions.id, id)));
  }
  return db.update(reviewSubmissions).set({ status }).where(eq(reviewSubmissions.id, id));
}

export async function confirmSkipPayment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(reviewSubmissions).set({ skipPaymentConfirmed: true }).where(eq(reviewSubmissions.id, id));
}

/** Re-queue a previously reviewed submission: reset to pending and move to end of queue */
export async function requeueSubmission(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Find the highest current position so we can append to the end
  const rows = await db
    .select({ maxPos: sql<number>`MAX(${reviewSubmissions.position})` })
    .from(reviewSubmissions)
    .where(ne(reviewSubmissions.status, "removed"));
  const maxPos = rows[0]?.maxPos ?? 0;
  return db.update(reviewSubmissions)
    .set({ status: "pending", position: maxPos + 1, updatedAt: new Date() })
    .where(eq(reviewSubmissions.id, id));
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

export async function setLiveStatus(isLive: boolean, message?: string, streamUrl?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db.select().from(queueState).limit(1);
  const updateData: Record<string, unknown> = { isLive, liveMessage: message ?? null };
  if (streamUrl !== undefined) updateData.streamUrl = streamUrl;
  if (existing.length === 0) {
    await db.insert(queueState).values({ isLive, liveMessage: message ?? null, streamUrl: streamUrl ?? null });
  } else {
    await db.update(queueState).set(updateData);
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

// -- User Management (admin) -----------------------------------

export async function getAllUsers(limit = 200): Promise<User[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(asc(users.createdAt)).limit(limit);
}

export async function setUserRole(userId: number, role: "user" | "admin" | "judge" | "contestant") {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(users).set({ role }).where(eq(users.id, userId));
}

// -- Account Label ------------------------------------------

export const USER_SELECTABLE_LABELS = ["fan", "artist", "producer", "videographer", "blogger", "brand_owner", "audio_engineer"] as const;
export const ALL_LABELS = ["fan", "artist", "producer", "videographer", "blogger", "brand_owner", "audio_engineer", "judge", "admin"] as const;
export type AccountLabel = typeof ALL_LABELS[number];

/** Serialize labels array to JSON string for DB storage */
function serializeLabels(labels: AccountLabel[]): string {
  return JSON.stringify(labels);
}

/** Deserialize labels from DB JSON string */
export function parseAccountLabels(raw: string | null | undefined): AccountLabel[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((l): l is AccountLabel => (ALL_LABELS as readonly string[]).includes(l));
  } catch {
    return [];
  }
}

export async function setAccountLabels(userId: number, labels: typeof USER_SELECTABLE_LABELS[number][]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Filter to only user-selectable labels, deduplicate
  const valid = Array.from(new Set(labels.filter((l): l is typeof USER_SELECTABLE_LABELS[number] =>
    (USER_SELECTABLE_LABELS as readonly string[]).includes(l)
  )));
  return db.update(users).set({ accountLabels: serializeLabels(valid) }).where(eq(users.id, userId));
}

export async function setAccountLabelsAdmin(userId: number, labels: AccountLabel[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const valid = Array.from(new Set(labels.filter((l): l is AccountLabel =>
    (ALL_LABELS as readonly string[]).includes(l)
  )));
  return db.update(users).set({ accountLabels: serializeLabels(valid) }).where(eq(users.id, userId));
}

// -- Active Battle (admin-controlled matchup) ------------------

export async function getActiveBattle() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(activeBattle).orderBy(desc(activeBattle.createdAt)).limit(1);
  return rows[0] ?? null;
}

export async function setActiveBattle(data: {
  contestant1Name: string;
  contestant1SongTitle?: string | null;
  contestant1SongUrl?: string | null;
  contestant2Name: string;
  contestant2SongTitle?: string | null;
  contestant2SongUrl?: string | null;
  contestant3Name?: string | null;
  contestant3SongTitle?: string | null;
  contestant3SongUrl?: string | null;
  isTripleThreat?: boolean;
  roundNumber?: number;
  status?: "pending" | "voting" | "closed";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Always insert a new battle row (each battle is a new record)
  const result = await db.insert(activeBattle).values({
    contestant1Name: data.contestant1Name,
    contestant1SongTitle: data.contestant1SongTitle ?? null,
    contestant1SongUrl: data.contestant1SongUrl ?? null,
    contestant2Name: data.contestant2Name,
    contestant2SongTitle: data.contestant2SongTitle ?? null,
    contestant2SongUrl: data.contestant2SongUrl ?? null,
    contestant3Name: data.contestant3Name ?? null,
    contestant3SongTitle: data.contestant3SongTitle ?? null,
    contestant3SongUrl: data.contestant3SongUrl ?? null,
    isTripleThreat: data.isTripleThreat ?? false,
    roundNumber: data.roundNumber ?? 1,
    status: data.status ?? "pending",
  });
  return result;
}

export async function updateActiveBattleStatus(id: number, status: "pending" | "voting" | "closed") {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(activeBattle).set({ status }).where(eq(activeBattle.id, id));
}

// -- Votes -----------------------------------------------------

export async function castVote(data: InsertVote & { voterName?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Upsert: one vote per voter per battle — delete existing then insert
  await db.delete(votes).where(
    and(eq(votes.battleId, data.battleId), eq(votes.voterId, data.voterId))
  );
  return db.insert(votes).values(data);
}

export async function getUserVote(battleId: number, voterId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(votes)
    .where(and(eq(votes.battleId, battleId), eq(votes.voterId, voterId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getVoteResults(battleId: number) {
  const db = await getDb();
  if (!db) return {
    contestant1: 0, contestant2: 0, contestant3: 0, total: 0,
    judgeVotes: [] as Array<{ name: string; role: string; candidate: string }>,
    audienceContestant1: 0, audienceContestant2: 0, audienceContestant3: 0,
  };
  const allVotes = await db.select().from(votes).where(eq(votes.battleId, battleId));
  let c1 = 0, c2 = 0, c3 = 0, audienceC1 = 0, audienceC2 = 0, audienceC3 = 0;
  const judgeVotes: Array<{ name: string; role: string; candidate: string }> = [];
  for (const v of allVotes) {
    const isJudge = v.voterRole === "judge" || v.voterRole === "admin";
    if (v.candidate === "contestant1") { c1++; if (!isJudge) audienceC1++; }
    else if (v.candidate === "contestant2") { c2++; if (!isJudge) audienceC2++; }
    else if (v.candidate === "contestant3") { c3++; if (!isJudge) audienceC3++; }
    if (isJudge) {
      judgeVotes.push({ name: v.voterName ?? "Judge", role: v.voterRole, candidate: v.candidate });
    }
  }
  return {
    contestant1: c1,
    contestant2: c2,
    contestant3: c3,
    total: allVotes.length,
    judgeVotes,
    audienceContestant1: audienceC1,
    audienceContestant2: audienceC2,
    audienceContestant3: audienceC3,
  };
}

export async function clearBattleVotes(battleId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(votes).where(eq(votes.battleId, battleId));
}

// -- Song Reactions (🔥 / 🗑️ for Music Review) ----------------

export async function castSongReaction(submissionId: number, userId: number, reaction: "fire" | "trash") {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Check if user already voted on this submission
  const existing = await db.select().from(songReactions)
    .where(and(eq(songReactions.submissionId, submissionId), eq(songReactions.userId, userId)))
    .limit(1);
  if (existing.length > 0) {
    throw new Error("Already voted on this submission");
  }
  // Insert reaction
  await db.insert(songReactions).values({ submissionId, userId, reaction });
  // Increment the career counter on the submission
  if (reaction === "fire") {
    await db.update(reviewSubmissions)
      .set({ fireCount: sql`${reviewSubmissions.fireCount} + 1` })
      .where(eq(reviewSubmissions.id, submissionId));
  } else {
    await db.update(reviewSubmissions)
      .set({ trashCount: sql`${reviewSubmissions.trashCount} + 1` })
      .where(eq(reviewSubmissions.id, submissionId));
  }
  return { success: true };
}

export async function getUserSongReaction(submissionId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(songReactions)
    .where(and(eq(songReactions.submissionId, submissionId), eq(songReactions.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getSongReactionCounts(submissionId: number) {
  const db = await getDb();
  if (!db) return { fire: 0, trash: 0 };
  const rows = await db.select().from(reviewSubmissions)
    .where(eq(reviewSubmissions.id, submissionId))
    .limit(1);
  if (!rows.length) return { fire: 0, trash: 0 };
  return { fire: rows[0].fireCount, trash: rows[0].trashCount };
}

// ── Judge Applications ────────────────────────────────────────────────────────

export async function applyAsJudge(userId: number, artistName: string | null, reason: string | null) {
  const db = await getDb();
  if (!db) return;
  // Upsert: if already applied, update reason
  const existing = await db.select().from(judgeApplications).where(eq(judgeApplications.userId, userId)).limit(1);
  if (existing.length > 0) {
    await db.update(judgeApplications)
      .set({ artistName: artistName ?? undefined, reason: reason ?? undefined, status: "pending", reviewedAt: null })
      .where(eq(judgeApplications.userId, userId));
  } else {
    await db.insert(judgeApplications).values({
      userId,
      artistName: artistName ?? null,
      reason: reason ?? null,
      status: "pending",
    });
  }
}

export async function getPendingJudgeApplications() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(judgeApplications).where(eq(judgeApplications.status, "pending")).orderBy(judgeApplications.appliedAt);
}

export async function reviewJudgeApplication(applicationId: number, status: "approved" | "rejected") {
  const db = await getDb();
  if (!db) return;
  await db.update(judgeApplications)
    .set({ status, reviewedAt: new Date() })
    .where(eq(judgeApplications.id, applicationId));
  // If approved, promote user to judge role
  if (status === "approved") {
    const apps = await db.select().from(judgeApplications).where(eq(judgeApplications.id, applicationId)).limit(1);
    if (apps.length > 0) {
      await db.update(users).set({ role: "judge" }).where(eq(users.id, apps[0].userId));
    }
  }
}

export async function getUserJudgeApplication(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(judgeApplications).where(eq(judgeApplications.userId, userId)).limit(1);
  return rows[0] ?? null;
}

// ── Relevant Users (wheel participants + judge applicants only) ───────────────

export async function getRelevantUsers() {
  const db = await getDb();
  if (!db) return [];
  // Get user IDs from active wheel entries
  const wheelRows = await db.select({ userId: wheelEntries.userId }).from(wheelEntries)
    .where(and(
      isNotNull(wheelEntries.userId),
      inArray(wheelEntries.status, ["active", "pending", "eliminated", "winner"])
    ));
  const wheelUserIds = Array.from(new Set(wheelRows.map(r => r.userId).filter((id): id is number => id !== null)));

  // Get user IDs from judge applications
  const appRows = await db.select({ userId: judgeApplications.userId }).from(judgeApplications);
  const appUserIds = appRows.map(r => r.userId);

  const allIds = Array.from(new Set([...wheelUserIds, ...appUserIds]));
  if (allIds.length === 0) return [];

  const userRows = await db.select().from(users).where(inArray(users.id, allIds));

  // Attach judge application status to each user
  const appMap = new Map<number, JudgeApplication>();
  const allApps = await db.select().from(judgeApplications).where(inArray(judgeApplications.userId, allIds));
  allApps.forEach(a => appMap.set(a.userId, a));

  return userRows.map(u => ({
    ...u,
    judgeApplication: appMap.get(u.id) ?? null,
  }));
}

// ── Players With Stats (for Players tab) ─────────────────────────────────────

export async function getPlayersWithStats() {
  const db = await getDb();
  if (!db) return [];

  const entries = await db.select().from(wheelEntries)
    .where(inArray(wheelEntries.status, ["active", "pending", "eliminated", "winner"]))
    .orderBy(wheelEntries.wheelPosition);

  if (entries.length === 0) return [];

  // Get all battle records
  const allBattles = await db.select().from(battleRecords);

  return entries.map(entry => {
    const artistName = entry.artistName;

    // Lifetime stats (all battles ever)
    const lifetimeWins = allBattles.filter(b => b.winnerArtistName === artistName).length;
    const lifetimeLosses = allBattles.filter(b => b.loserArtistName === artistName).length;

    // Current war stats — battles where this entry's roundNumber matches
    const currentWar = allBattles.filter(b =>
      (b.winnerArtistName === artistName || b.loserArtistName === artistName) &&
      b.roundNumber === (entry.roundNumber ?? 1)
    );
    const currentWins = currentWar.filter(b => b.winnerArtistName === artistName).length;
    const currentLosses = currentWar.filter(b => b.loserArtistName === artistName).length;

    return {
      ...entry,
      lifetimeWins,
      lifetimeLosses,
      currentWins,
      currentLosses,
    };
  });
}

// ── Full War Reset (clears current war: wheel entries, votes, active battle, current session battle records) ───

export async function fullWarReset() {
  const db = await getDb();
  if (!db) return;

  // Get current war session ID
  const currentSessionStr = await getSetting("current_war_session");
  const currentSession = parseInt(currentSessionStr ?? "1", 10) || 1;

  // Delete battle records from the current session only
  await db.delete(battleRecords).where(eq(battleRecords.warSessionId, currentSession));

  // Remove all wheel entries
  await db.delete(wheelEntries);

  // Clear all votes
  await db.delete(votes);

  // Close active battle
  const battle = await getActiveBattle();
  if (battle) await updateActiveBattleStatus(battle.id, "closed");

  // Increment war session counter so next war has a new ID
  await setSetting("current_war_session", String(currentSession + 1));
}

export async function getCurrentWarSession(): Promise<number> {
  const val = await getSetting("current_war_session");
  return parseInt(val ?? "1", 10) || 1;
}

// -- Profile Page: Submission History & Lifetime Stats --------

export async function getSubmissionsByArtistName(artistName: string, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviewSubmissions)
    .where(eq(reviewSubmissions.artistName, artistName))
    .orderBy(desc(reviewSubmissions.createdAt))
    .limit(limit);
}

export async function getLifetimeStats(artistName: string) {
  const db = await getDb();
  if (!db) return { totalSubmissions: 0, totalFire: 0, totalTrash: 0, reviewed: 0, totalWins: 0 };
  const subs = await db.select().from(reviewSubmissions)
    .where(eq(reviewSubmissions.artistName, artistName));
  // Count battle wins
  const battleWins = await db.select().from(battleRecords)
    .where(eq(battleRecords.winnerArtistName, artistName));
  return {
    totalSubmissions: subs.length,
    totalFire: subs.reduce((acc, s) => acc + (s.fireCount ?? 0), 0),
    totalTrash: subs.reduce((acc, s) => acc + (s.trashCount ?? 0), 0),
    reviewed: subs.filter(s => s.status === "reviewed").length,
    totalWins: battleWins.length,
  };
}

// -- Live Radio -----------------------------------------------

export async function getLiveRadioState() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(liveRadioState).limit(1);
  return rows[0] ?? null;
}

export async function getLiveRadioQueue() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(liveRadioQueue).orderBy(asc(liveRadioQueue.position), asc(liveRadioQueue.addedAt));
}

export async function addToLiveRadioQueue(data: InsertLiveRadioQueueItem) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Get max position
  const rows = await db.select().from(liveRadioQueue).orderBy(desc(liveRadioQueue.position)).limit(1);
  const nextPos = (rows[0]?.position ?? -1) + 1;
  return db.insert(liveRadioQueue).values({ ...data, position: nextPos });
}

export async function removeFromLiveRadioQueue(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(liveRadioQueue).where(eq(liveRadioQueue.id, id));
}

export async function clearLiveRadioQueue() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(liveRadioQueue);
}

export async function setLiveRadioCurrentTrack(trackId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db.select().from(liveRadioState).limit(1);
  const data = {
    isActive: trackId !== null,
    isPaused: false,
    currentTrackId: trackId,
    currentTrackStartedAt: trackId !== null ? new Date() : null,
  };
  if (existing.length === 0) {
    await db.insert(liveRadioState).values(data);
  } else {
    await db.update(liveRadioState).set(data);
  }
}

export async function setLiveRadioPaused(isPaused: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db.select().from(liveRadioState).limit(1);
  if (existing.length === 0) {
    await db.insert(liveRadioState).values({ isPaused });
  } else {
    await db.update(liveRadioState).set({ isPaused });
  }
}

export async function stopLiveRadio() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db.select().from(liveRadioState).limit(1);
  const data = { isActive: false, isPaused: false, currentTrackId: null, currentTrackStartedAt: null };
  if (existing.length === 0) {
    await db.insert(liveRadioState).values(data);
  } else {
    await db.update(liveRadioState).set(data);
  }
}

// -- Forum ----------------------------------------------------

export async function getForumPosts(category?: string, limit = 30, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  type ForumCategory = "general" | "music" | "battles" | "news" | "feedback";
  const validCategories: ForumCategory[] = ["general", "music", "battles", "news", "feedback"];
  const isValidCategory = category && category !== "all" && validCategories.includes(category as ForumCategory);
  const conditions = isValidCategory
    ? [eq(forumPosts.category, category as ForumCategory)]
    : [];
  const rows = await db.select({
    post: forumPosts,
    author: { id: users.id, name: users.name, artistName: users.artistName, avatarUrl: users.avatarUrl, role: users.role },
  })
    .from(forumPosts)
    .leftJoin(users, eq(forumPosts.userId, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(forumPosts.pinned), desc(forumPosts.createdAt))
    .limit(limit)
    .offset(offset);
  return rows;
}

export async function getForumPostById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({
    post: forumPosts,
    author: { id: users.id, name: users.name, artistName: users.artistName, avatarUrl: users.avatarUrl, role: users.role },
  })
    .from(forumPosts)
    .leftJoin(users, eq(forumPosts.userId, users.id))
    .where(eq(forumPosts.id, id))
    .limit(1);
  if (rows.length === 0) return null;
  // Increment view count
  await db.update(forumPosts).set({ viewCount: sql`${forumPosts.viewCount} + 1` }).where(eq(forumPosts.id, id));
  return rows[0];
}

export async function createForumPost(data: InsertForumPost) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(forumPosts).values(data);
  return result;
}

export async function deleteForumPost(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Delete comments first
  await db.delete(forumComments).where(eq(forumComments.postId, id));
  await db.delete(forumReactions).where(and(eq(forumReactions.targetType, "post"), eq(forumReactions.targetId, id)));
  return db.delete(forumPosts).where(eq(forumPosts.id, id));
}

export async function getForumComments(postId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    comment: forumComments,
    author: { id: users.id, name: users.name, artistName: users.artistName, avatarUrl: users.avatarUrl, role: users.role },
  })
    .from(forumComments)
    .leftJoin(users, eq(forumComments.userId, users.id))
    .where(eq(forumComments.postId, postId))
    .orderBy(asc(forumComments.createdAt));
  return rows;
}

export async function createForumComment(data: InsertForumComment) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(forumComments).values(data);
}

export async function deleteForumComment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(forumReactions).where(and(eq(forumReactions.targetType, "comment"), eq(forumReactions.targetId, id)));
  return db.delete(forumComments).where(eq(forumComments.id, id));
}

export async function reactToForumItem(userId: number, targetType: "post" | "comment", targetId: number, reaction: "upvote" | "downvote") {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Upsert: if same reaction exists, remove it (toggle); if different, update
  const existing = await db.select().from(forumReactions)
    .where(and(
      eq(forumReactions.userId, userId),
      eq(forumReactions.targetType, targetType),
      eq(forumReactions.targetId, targetId),
    )).limit(1);
  if (existing.length > 0) {
    if (existing[0].reaction === reaction) {
      // Toggle off
      await db.delete(forumReactions).where(eq(forumReactions.id, existing[0].id));
      return { action: "removed" };
    } else {
      await db.update(forumReactions).set({ reaction }).where(eq(forumReactions.id, existing[0].id));
      return { action: "updated" };
    }
  }
  await db.insert(forumReactions).values({ userId, targetType, targetId, reaction });
  return { action: "added" };
}

export async function getForumReactionCounts(targetType: "post" | "comment", targetIds: number[]) {
  const db = await getDb();
  if (!db) return {};
  if (targetIds.length === 0) return {};
  const rows = await db.select({
    targetId: forumReactions.targetId,
    reaction: forumReactions.reaction,
    count: sql<number>`count(*)`,
  })
    .from(forumReactions)
    .where(and(
      eq(forumReactions.targetType, targetType),
      inArray(forumReactions.targetId, targetIds),
    ))
    .groupBy(forumReactions.targetId, forumReactions.reaction);
  const result: Record<number, { upvote: number; downvote: number }> = {};
  for (const row of rows) {
    if (!result[row.targetId]) result[row.targetId] = { upvote: 0, downvote: 0 };
    result[row.targetId][row.reaction] = Number(row.count);
  }
  return result;
}

export async function getUserForumReactions(userId: number, targetType: "post" | "comment", targetIds: number[]) {
  const db = await getDb();
  if (!db) return {};
  if (targetIds.length === 0) return {};
  const rows = await db.select().from(forumReactions)
    .where(and(
      eq(forumReactions.userId, userId),
      eq(forumReactions.targetType, targetType),
      inArray(forumReactions.targetId, targetIds),
    ));
  return Object.fromEntries(rows.map(r => [r.targetId, r.reaction]));
}

// -- Search ---------------------------------------------------

export async function searchUsers(query: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const q = `%${query.toLowerCase()}%`;
  return db.select({
    id: users.id,
    name: users.name,
    artistName: users.artistName,
    city: users.city,
    avatarUrl: users.avatarUrl,
    instagramHandle: users.instagramHandle,
    role: users.role,
  })
    .from(users)
    .where(or(
      sql`LOWER(${users.artistName}) LIKE ${q}`,
      sql`LOWER(${users.name}) LIKE ${q}`,
    ))
    .limit(limit);
}

export async function searchSongs(query: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const q = `%${query.toLowerCase()}%`;
  return db.select({
    id: userSongs.id,
    title: userSongs.title,
    artistName: userSongs.artistName,
    genre: userSongs.genre,
    fileKey: userSongs.fileKey,
    externalUrl: userSongs.externalUrl,
    isPublic: userSongs.isPublic,
    userId: userSongs.userId,
  })
    .from(userSongs)
    .where(and(
      eq(userSongs.isPublic, true),
      or(
        sql`LOWER(${userSongs.title}) LIKE ${q}`,
        sql`LOWER(${userSongs.artistName}) LIKE ${q}`,
      ),
    ))
    .limit(limit);
}

// -- Combined Leaderboard ------------------------------------

export async function getCombinedLeaderboard() {
  const db = await getDb();
  if (!db) return [];

  // Get all battle records
  const battles = await db.select().from(battleRecords).orderBy(desc(battleRecords.battleDate));

  // Get all reviewed submissions with fire/trash counts
  const submissions = await db.select({
    id: reviewSubmissions.id,
    artistName: reviewSubmissions.artistName,
    songTitle: reviewSubmissions.songTitle,
    fireCount: reviewSubmissions.fireCount,
    trashCount: reviewSubmissions.trashCount,
    userId: reviewSubmissions.userId,
  }).from(reviewSubmissions)
    .where(eq(reviewSubmissions.status, "reviewed"));

  // Aggregate by artist name
  const artistMap: Record<string, {
    artistName: string;
    userId?: number | null;
    wins: number;
    losses: number;
    totalFire: number;
    totalTrash: number;
    totalBattles: number;
    totalReviews: number;
    score: number;
  }> = {};

  const ensureArtist = (name: string, userId?: number | null) => {
    const key = name.toLowerCase().trim();
    if (!artistMap[key]) {
      artistMap[key] = { artistName: name, userId: userId ?? null, wins: 0, losses: 0, totalFire: 0, totalTrash: 0, totalBattles: 0, totalReviews: 0, score: 0 };
    }
    // Update userId if we have one and the existing entry doesn't
    if (userId && !artistMap[key].userId) artistMap[key].userId = userId;
    return artistMap[key];
  };

  for (const b of battles) {
    const winner = ensureArtist(b.winnerArtistName, b.winnerId);
    winner.wins++;
    winner.totalBattles++;
    const loser = ensureArtist(b.loserArtistName, b.loserId);
    loser.losses++;
    loser.totalBattles++;
  }

  for (const s of submissions) {
    const a = ensureArtist(s.artistName, s.userId);
    a.totalFire += s.fireCount ?? 0;
    a.totalTrash += s.trashCount ?? 0;
    a.totalReviews++;
  }

  // Score = wins*10 + fire*2 - trash*1
  for (const key of Object.keys(artistMap)) {
    const a = artistMap[key];
    a.score = a.wins * 10 + a.totalFire * 2 - a.totalTrash;
  }

  return Object.values(artistMap).sort((a, b) => b.score - a.score);
}

// -- Wheel Spin State Persistence ----------------------------
// Persists which contestant has been picked (spin 1) so state survives page refreshes.
// Key: "wheel_spin_state"
// Value: JSON { spinCount: 0|1, contestant1Id: number|null, contestant1Name: string|null }
export interface WheelSpinState {
  spinCount: 0 | 1;
  contestant1Id: number | null;
  contestant1Name: string | null;
}
export async function getWheelSpinState(): Promise<WheelSpinState> {
  const raw = await getSetting("wheel_spin_state");
  if (!raw) return { spinCount: 0, contestant1Id: null, contestant1Name: null };
  try { return JSON.parse(raw) as WheelSpinState; }
  catch { return { spinCount: 0, contestant1Id: null, contestant1Name: null }; }
}
export async function setWheelSpinState(state: WheelSpinState): Promise<void> {
  await setSetting("wheel_spin_state", JSON.stringify(state));
}
export async function clearWheelSpinState(): Promise<void> {
  await setSetting("wheel_spin_state", JSON.stringify({ spinCount: 0, contestant1Id: null, contestant1Name: null }));
}


// -- Moderation Logs -----------------------------------------
export async function createModerationLog(data: {
  adminId: number;
  adminName: string;
  action: string;
  targetType: string;
  targetId: number;
  targetPreview?: string;
  reason?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(moderationLogs).values({
    adminId: data.adminId,
    adminName: data.adminName,
    action: data.action,
    targetType: data.targetType,
    targetId: data.targetId,
    targetPreview: data.targetPreview ?? null,
    reason: data.reason ?? null,
  });
}

export async function getModerationLogs(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(moderationLogs)
    .orderBy(desc(moderationLogs.createdAt))
    .limit(limit);
}

// ─── Admin: Ban / Unban User ──────────────────────────────────────────────────
export async function banUser(userId: number, reason: string | null): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ isBanned: true, banReason: reason ?? null }).where(eq(users.id, userId));
}

export async function unbanUser(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ isBanned: false, banReason: null }).where(eq(users.id, userId));
}

// ─── Admin: Promo Orders ──────────────────────────────────────────────────────
export async function getSkipLineOrders(limit = 200) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(reviewSubmissions)
    .where(eq(reviewSubmissions.skippedLine, true))
    .orderBy(desc(reviewSubmissions.createdAt))
    .limit(limit);
}

export async function getWheelPaidOrders(limit = 200) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(wheelEntries)
    .where(eq(wheelEntries.paid, true))
    .orderBy(desc(wheelEntries.createdAt))
    .limit(limit);
}

// ─── Admin: Analytics ────────────────────────────────────────────────────────
export async function getAdminAnalytics() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [totalUsers] = await db.select({ count: count() }).from(users);
  const [totalSubmissions] = await db.select({ count: count() }).from(reviewSubmissions);
  const [pendingSubmissions] = await db.select({ count: count() }).from(reviewSubmissions).where(eq(reviewSubmissions.status, "pending"));
  const [reviewedSubmissions] = await db.select({ count: count() }).from(reviewSubmissions).where(eq(reviewSubmissions.status, "reviewed"));
  const [totalVotes] = await db.select({ count: count() }).from(votes);
  const [totalBattles] = await db.select({ count: count() }).from(battleRecords);
  const [totalWheelEntries] = await db.select({ count: count() }).from(wheelEntries);
  const [totalSongs] = await db.select({ count: count() }).from(userSongs);
  const [totalForumPosts] = await db.select({ count: count() }).from(forumPosts);
  const [skipOrders] = await db.select({ count: count() }).from(reviewSubmissions).where(eq(reviewSubmissions.skippedLine, true));
  const [confirmedSkipOrders] = await db.select({ count: count() }).from(reviewSubmissions).where(and(eq(reviewSubmissions.skippedLine, true), eq(reviewSubmissions.skipPaymentConfirmed, true)));
  const [paidWheelEntries] = await db.select({ count: count() }).from(wheelEntries).where(eq(wheelEntries.paid, true));
  const [confirmedWheelPayments] = await db.select({ count: count() }).from(wheelEntries).where(eq(wheelEntries.paymentConfirmed, true));

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [recentSignups] = await db.select({ count: count() }).from(users).where(gte(users.createdAt, sevenDaysAgo));

  const topArtists = await db
    .select({
      artistName: reviewSubmissions.artistName,
      totalFire: sum(reviewSubmissions.fireCount),
      totalTrash: sum(reviewSubmissions.trashCount),
      submissionCount: count(reviewSubmissions.id),
    })
    .from(reviewSubmissions)
    .groupBy(reviewSubmissions.artistName)
    .orderBy(desc(sum(reviewSubmissions.fireCount)))
    .limit(10);

  const topBattleWinners = await db
    .select({
      artistName: battleRecords.winnerArtistName,
      wins: count(battleRecords.id),
    })
    .from(battleRecords)
    .groupBy(battleRecords.winnerArtistName)
    .orderBy(desc(count(battleRecords.id)))
    .limit(10);

  return {
    users: { total: totalUsers.count, recentSignups: recentSignups.count },
    submissions: { total: totalSubmissions.count, pending: pendingSubmissions.count, reviewed: reviewedSubmissions.count },
    votes: { total: totalVotes.count },
    battles: { total: totalBattles.count },
    wheelEntries: { total: totalWheelEntries.count },
    songs: { total: totalSongs.count },
    forumPosts: { total: totalForumPosts.count },
    promoOrders: {
      skipTotal: skipOrders.count,
      skipConfirmed: confirmedSkipOrders.count,
      wheelPaidTotal: paidWheelEntries.count,
      wheelPaidConfirmed: confirmedWheelPayments.count,
    },
    topArtists,
    topBattleWinners,
  };
}

// -- Admin Danger Zone helpers --------------------------------

/** Hard-delete a user and all their associated data. */
export async function deleteUser(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Delete in dependency order to avoid FK issues
  await db.delete(votes).where(eq(votes.voterId, userId));
  await db.delete(songReactions).where(eq(songReactions.userId, userId));
  await db.delete(userSongs).where(eq(userSongs.userId, userId));
  await db.delete(wheelEntries).where(eq(wheelEntries.userId, userId));
  await db.delete(reviewSubmissions).where(eq(reviewSubmissions.userId, userId));
  await db.delete(judgeApplications).where(eq(judgeApplications.userId, userId));
  await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

/**
 * Reset all stats site-wide:
 * - Delete all battle records (all war sessions)
 * - Delete all votes
 * - Reset fire/trash counts on all review submissions to 0
 * - Delete all song reactions
 */
export async function resetAllStats(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(battleRecords);
  await db.delete(votes);
  await db.delete(songReactions);
  await db.update(reviewSubmissions).set({ fireCount: 0, trashCount: 0 });
}

/**
 * Reset all submissions site-wide:
 * - Delete all Music Review queue submissions
 * - Delete all wheel entries
 * - Close the active battle
 * - Clear all votes
 * - Reset queue state (no current playing track)
 */
export async function resetAllSubmissions(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(reviewSubmissions);
  await db.delete(wheelEntries);
  await db.delete(votes);
  // Close active battle if any
  const battle = await getActiveBattle();
  if (battle) await updateActiveBattleStatus(battle.id, "closed");
  // Reset queue state
  await db.update(queueState).set({ currentPlayingId: null, isLive: false });
}


// ─── Wheel of Names Helpers ───────────────────────────────────

export async function addWheelOfNamesEntry(userId: number, name: string, isPaid = false) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(wheelOfNamesEntries).values({
    userId,
    name,
    isPaid,
  });
}

export async function getWheelOfNamesEntries() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(wheelOfNamesEntries);
}

export async function getUserWheelOfNamesEntry(userId: number) {
  const db = await getDb();
  if (!db) return null;
  // Check if user has a FREE entry created today (entries are cleared daily at 7pm)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const result = await db.select().from(wheelOfNamesEntries)
    .where(and(
      eq(wheelOfNamesEntries.userId, userId),
      eq(wheelOfNamesEntries.isPaid, false),
      gte(wheelOfNamesEntries.createdAt, todayStart)
    ))
    .limit(1);
  return result[0] || null;
}

export async function clearWheelOfNamesEntries() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(wheelOfNamesEntries);
}

export async function getLastWheelOfNamesWinner() {
  const db = await getDb();
  if (!db) return null;
  const spins = await db.select().from(wheelOfNamesSpins)
    .orderBy(desc(wheelOfNamesSpins.spinDate))
    .limit(1);
  return spins[0] || null;
}

export async function createWheelOfNamesSpin(spinDate: string, winnerId: number | null, winnerName: string | null) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Use upsert so re-spinning on the same day overwrites the earlier record
  return db.insert(wheelOfNamesSpins).values({
    spinDate,
    winnerId,
    winnerName,
  }).onDuplicateKeyUpdate({
    set: { winnerId, winnerName },
  });
}

export async function getTodaysWheelOfNamesSpin() {
  const db = await getDb();
  if (!db) return null;
  const today = new Date().toISOString().split('T')[0];
  const result = await db.select().from(wheelOfNamesSpins)
    .where(eq(wheelOfNamesSpins.spinDate, today))
    .limit(1);
  return result[0] || null;
}

export async function createWheelOfNamesPaidEntryRequest(userId: number, quantity: number, amountPaid: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(wheelOfNamesPaidEntries).values({
    userId,
    quantity,
    amountPaid,
    adminConfirmed: false,
  });
}

export async function getPendingWheelOfNamesPaidEntries() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(wheelOfNamesPaidEntries)
    .where(eq(wheelOfNamesPaidEntries.adminConfirmed, false));
}

export async function confirmWheelOfNamesPaidEntry(entryId: number, adminId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  
  const entry = await db.select().from(wheelOfNamesPaidEntries)
    .where(eq(wheelOfNamesPaidEntries.id, entryId))
    .limit(1);
  
  if (!entry || entry.length === 0) throw new Error("Paid entry not found");

  const paidEntry = entry[0];

  // Update the paid entry as confirmed
  await db.update(wheelOfNamesPaidEntries)
    .set({
      adminConfirmed: true,
      confirmedAt: new Date(),
      confirmedByAdminId: adminId,
    })
    .where(eq(wheelOfNamesPaidEntries.id, entryId));

  // Add the paid entries to the wheel
  const user = await getUserById(paidEntry.userId);

  if (user) {
    for (let i = 0; i < paidEntry.quantity; i++) {
      await addWheelOfNamesEntry(paidEntry.userId, user.name || `User ${paidEntry.userId}`, true);
    }
  }

  return paidEntry;
}

export async function removeWheelOfNamesEntry(entryId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(wheelOfNamesEntries).where(eq(wheelOfNamesEntries.id, entryId));
}

// ─── Site Analytics ───────────────────────────────────────────

export async function trackPageView(data: {
  path: string;
  sessionId: string;
  userId?: number | null;
  referrer?: string | null;
  userAgent?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(pageViews).values({
    path: data.path,
    sessionId: data.sessionId,
    userId: data.userId ?? null,
    referrer: data.referrer ?? null,
    userAgent: data.userAgent ?? null,
  });
}

export async function upsertActiveSession(data: {
  sessionId: string;
  path: string;
  userId?: number | null;
}) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(activeSessions)
    .values({ sessionId: data.sessionId, path: data.path, userId: data.userId ?? null, lastSeen: new Date() })
    .onDuplicateKeyUpdate({ set: { path: data.path, lastSeen: new Date(), userId: data.userId ?? null } });
}

export async function pruneStaleActiveSessions(thresholdMs = 90_000) {
  const db = await getDb();
  if (!db) return;
  const cutoff = new Date(Date.now() - thresholdMs);
  await db.delete(activeSessions).where(sql`${activeSessions.lastSeen} < ${cutoff}`);
}

export async function getActiveSessions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(activeSessions).orderBy(desc(activeSessions.lastSeen));
}

export async function getSiteStats() {
  const db = await getDb();
  if (!db) return null;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Total page views
  const [totalViews] = await db.select({ count: count() }).from(pageViews);
  const [todayViews] = await db.select({ count: count() }).from(pageViews).where(gte(pageViews.createdAt, todayStart));
  const [weekViews] = await db.select({ count: count() }).from(pageViews).where(gte(pageViews.createdAt, weekStart));

  // Unique sessions
  const [totalSessions] = await db.select({ count: sql<number>`COUNT(DISTINCT ${pageViews.sessionId})` }).from(pageViews);
  const [todaySessions] = await db.select({ count: sql<number>`COUNT(DISTINCT ${pageViews.sessionId})` }).from(pageViews).where(gte(pageViews.createdAt, todayStart));

  // Logged-in vs anonymous
  const [loggedInViews] = await db.select({ count: count() }).from(pageViews).where(isNotNull(pageViews.userId));

  // Top pages (last 7 days)
  const topPages = await db
    .select({ path: pageViews.path, views: count() })
    .from(pageViews)
    .where(gte(pageViews.createdAt, weekStart))
    .groupBy(pageViews.path)
    .orderBy(desc(count()))
    .limit(10);

  // Hourly views for today (last 24 hours)
  const hourlyRows = await db
    .select({
      hour: sql<number>`HOUR(${pageViews.createdAt})`,
      views: count(),
    })
    .from(pageViews)
    .where(gte(pageViews.createdAt, todayStart))
    .groupBy(sql`HOUR(${pageViews.createdAt})`)
    .orderBy(sql`HOUR(${pageViews.createdAt})`);

  // Daily views for last 30 days
  const dailyRows = await db
    .select({
      day: sql<string>`DATE(${pageViews.createdAt})`,
      views: count(),
    })
    .from(pageViews)
    .where(gte(pageViews.createdAt, monthStart))
    .groupBy(sql`DATE(${pageViews.createdAt})`)
    .orderBy(sql`DATE(${pageViews.createdAt})`);

  // Recent page views (last 50)
  const recentViews = await db
    .select()
    .from(pageViews)
    .orderBy(desc(pageViews.createdAt))
    .limit(50);

  // Active now (sessions with heartbeat in last 90s)
  const cutoff90s = new Date(Date.now() - 90_000);
  const activeSess = await db.select().from(activeSessions).where(gte(activeSessions.lastSeen, cutoff90s));

  return {
    views: {
      total: totalViews.count,
      today: todayViews.count,
      week: weekViews.count,
      loggedIn: loggedInViews.count,
    },
    sessions: {
      total: Number(totalSessions.count),
      today: Number(todaySessions.count),
    },
    activeNow: activeSess,
    topPages,
    hourlyToday: hourlyRows,
    dailyMonth: dailyRows,
    recentViews,
  };
}

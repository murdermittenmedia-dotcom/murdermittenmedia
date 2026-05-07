import { eq, asc, desc, ne, and, or, sql, isNotNull, inArray } from "drizzle-orm";
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
    .orderBy(desc(reviewSubmissions.skipPaymentConfirmed), asc(reviewSubmissions.createdAt));
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
    contestant1: 0, contestant2: 0, total: 0,
    judgeVotes: [] as Array<{ name: string; role: string; candidate: string }>,
    audienceContestant1: 0, audienceContestant2: 0,
  };
  const allVotes = await db.select().from(votes).where(eq(votes.battleId, battleId));
  let c1 = 0, c2 = 0, audienceC1 = 0, audienceC2 = 0;
  const judgeVotes: Array<{ name: string; role: string; candidate: string }> = [];
  for (const v of allVotes) {
    const isJudge = v.voterRole === "judge" || v.voterRole === "admin";
    if (v.candidate === "contestant1") { c1++; if (!isJudge) audienceC1++; }
    else { c2++; if (!isJudge) audienceC2++; }
    if (isJudge) {
      judgeVotes.push({ name: v.voterName ?? "Judge", role: v.voterRole, candidate: v.candidate });
    }
  }
  return {
    contestant1: c1,
    contestant2: c2,
    total: allVotes.length,
    judgeVotes,
    audienceContestant1: audienceC1,
    audienceContestant2: audienceC2,
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
  if (!db) return { totalSubmissions: 0, totalFire: 0, totalTrash: 0, reviewed: 0 };
  const subs = await db.select().from(reviewSubmissions)
    .where(eq(reviewSubmissions.artistName, artistName));
  return {
    totalSubmissions: subs.length,
    totalFire: subs.reduce((acc, s) => acc + (s.fireCount ?? 0), 0),
    totalTrash: subs.reduce((acc, s) => acc + (s.trashCount ?? 0), 0),
    reviewed: subs.filter(s => s.status === "reviewed").length,
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
  const q = `%${query}%`;
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
      sql`${users.artistName} LIKE ${q}`,
      sql`${users.name} LIKE ${q}`,
    ))
    .limit(limit);
}

export async function searchSongs(query: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const q = `%${query}%`;
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
        sql`${userSongs.title} LIKE ${q}`,
        sql`${userSongs.artistName} LIKE ${q}`,
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
    userId: sql<number | null>`NULL`,
  }).from(reviewSubmissions)
    .where(eq(reviewSubmissions.status, "reviewed"));

  // Aggregate by artist name
  const artistMap: Record<string, {
    artistName: string;
    wins: number;
    losses: number;
    totalFire: number;
    totalTrash: number;
    totalBattles: number;
    totalReviews: number;
    score: number;
  }> = {};

  const ensureArtist = (name: string) => {
    const key = name.toLowerCase().trim();
    if (!artistMap[key]) {
      artistMap[key] = { artistName: name, wins: 0, losses: 0, totalFire: 0, totalTrash: 0, totalBattles: 0, totalReviews: 0, score: 0 };
    }
    return artistMap[key];
  };

  for (const b of battles) {
    ensureArtist(b.winnerArtistName).wins++;
    ensureArtist(b.winnerArtistName).totalBattles++;
    ensureArtist(b.loserArtistName).losses++;
    ensureArtist(b.loserArtistName).totalBattles++;
  }

  for (const s of submissions) {
    const a = ensureArtist(s.artistName);
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

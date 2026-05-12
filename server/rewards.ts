/**
 * Reward System DB Helpers
 * Handles XP awarding, level calculation, reward auto-unlock, badge management
 */
import { eq, and, desc, asc, inArray, sql, gte, isNull } from "drizzle-orm";
import { getDb } from "./db";
import {
  users, rewards, userRewards, userBadges, xpEvents, rewardLogs, battleRecords,
  reviewSubmissions, songReactions, forumPosts, forumComments, votes,
} from "../drizzle/schema";
import { notifyOwner } from "./_core/notification";

// ─── Level Thresholds ────────────────────────────────────────────────────────
export const ARTIST_LEVELS = [
  { level: "bronze",        minXP: 0,     label: "Bronze Artist",         color: "#CD7F32", icon: "🥉" },
  { level: "verified",      minXP: 500,   label: "Verified Artist",       color: "#C0C0C0", icon: "✅" },
  { level: "trending",      minXP: 1500,  label: "Trending Artist",       color: "#FFD700", icon: "📈" },
  { level: "city_motion",   minXP: 3000,  label: "City in Motion",        color: "#FF6B00", icon: "🏙️" },
  { level: "mitten_elite",  minXP: 6000,  label: "Mitten Elite",          color: "#D10000", icon: "🔥" },
  { level: "hall_of_fame",  minXP: 12000, label: "Hall of Fame",          color: "#9B59B6", icon: "🏆" },
] as const;

export const FAN_LEVELS = [
  { level: "supporter",           minXP: 0,    label: "Supporter",              color: "#6B7280", icon: "👋" },
  { level: "top_supporter",       minXP: 100,  label: "Top Supporter",          color: "#3B82F6", icon: "⭐" },
  { level: "biggest_fan",         minXP: 300,  label: "Biggest Fan",            color: "#8B5CF6", icon: "💜" },
  { level: "early_supporter",     minXP: 600,  label: "Early Supporter",        color: "#F59E0B", icon: "🌟" },
  { level: "verified_tastemaker", minXP: 1200, label: "Verified Tastemaker",    color: "#10B981", icon: "🎯" },
] as const;

export type ArtistLevel = typeof ARTIST_LEVELS[number]["level"];
export type FanLevel = typeof FAN_LEVELS[number]["level"];

export function calcArtistLevel(xp: number): ArtistLevel {
  let level: ArtistLevel = "bronze";
  for (const tier of ARTIST_LEVELS) {
    if (xp >= tier.minXP) level = tier.level;
  }
  return level;
}

export function calcFanLevel(fanXP: number): FanLevel {
  let level: FanLevel = "supporter";
  for (const tier of FAN_LEVELS) {
    if (fanXP >= tier.minXP) level = tier.level;
  }
  return level;
}

export function getArtistLevelInfo(level: string) {
  return ARTIST_LEVELS.find(l => l.level === level) ?? ARTIST_LEVELS[0];
}

export function getFanLevelInfo(level: string) {
  return FAN_LEVELS.find(l => l.level === level) ?? FAN_LEVELS[0];
}

export function getNextArtistLevel(xp: number) {
  for (let i = ARTIST_LEVELS.length - 1; i >= 0; i--) {
    if (xp < ARTIST_LEVELS[i].minXP) continue;
    const next = ARTIST_LEVELS[i + 1];
    if (!next) return null; // already max level
    return { level: next, xpNeeded: next.minXP - xp, xpRequired: next.minXP };
  }
  return null;
}

// ─── XP Award ────────────────────────────────────────────────────────────────

export type XpReason =
  | "song_upload" | "battle_win" | "battle_participation" | "review_submission"
  | "fire_vote_received" | "forum_post" | "forum_comment" | "vote_cast"
  | "daily_streak" | "referral" | "admin_grant" | "radio_play" | "review_win";

const XP_AMOUNTS: Record<XpReason, number> = {
  song_upload:          50,
  battle_win:           150,
  battle_participation: 25,
  review_submission:    30,
  fire_vote_received:   10,
  forum_post:           15,
  forum_comment:        5,
  vote_cast:            5,   // fan XP
  daily_streak:         10,  // per streak day (multiplied by caller)
  referral:             100,
  admin_grant:          0,   // amount passed explicitly
  radio_play:           20,
  review_win:           75,
};

/**
 * Award XP to a user, update their level, log the event, and trigger reward checks.
 * For fan actions (vote_cast), awards fanXP instead of artist XP.
 */
export async function awardXP(
  userId: number,
  reason: XpReason,
  opts: { amount?: number; metadata?: Record<string, unknown> } = {}
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const amount = opts.amount ?? XP_AMOUNTS[reason];
  if (amount === 0) return;

  const isFanXP = reason === "vote_cast";

  // Log the XP event
  await db.insert(xpEvents).values({
    userId,
    amount,
    reason,
    metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
  });

  // Update user XP and level atomically
  if (isFanXP) {
    await db.execute(sql`
      UPDATE users
      SET fanXP = fanXP + ${amount}
      WHERE id = ${userId}
    `);
    // Recalculate fanLevel
    const rows = await db.select({ fanXP: users.fanXP }).from(users).where(eq(users.id, userId)).limit(1);
    if (rows[0]) {
      const newFanLevel = calcFanLevel(rows[0].fanXP + amount);
      await db.update(users).set({ fanLevel: newFanLevel }).where(eq(users.id, userId));
    }
  } else {
    await db.execute(sql`
      UPDATE users
      SET xp = xp + ${amount}
      WHERE id = ${userId}
    `);
    // Recalculate artist level
    const rows = await db.select({ xp: users.xp }).from(users).where(eq(users.id, userId)).limit(1);
    if (rows[0]) {
      const newXP = (rows[0].xp ?? 0) + amount;
      const newLevel = calcArtistLevel(newXP);
      await db.update(users).set({ level: newLevel }).where(eq(users.id, userId));
    }
  }

  // Trigger reward check (non-blocking)
  checkAndUnlockRewards(userId).catch(err => console.error("[Rewards] checkAndUnlock error:", err));
}

// ─── User Stats for Reward Requirements ──────────────────────────────────────

export interface UserRewardStats {
  xp: number;
  fanXP: number;
  level: string;
  fanLevel: string;
  streak: number;
  battleWins: number;
  battleParticipations: number;
  reviewSubmissions: number;
  fireVotesReceived: number;
  forumPosts: number;
  forumComments: number;
  votesCast: number;
  radioPlays: number;
}

export async function getUserRewardStats(userId: number): Promise<UserRewardStats> {
  const db = await getDb();
  if (!db) return { xp: 0, fanXP: 0, level: "bronze", fanLevel: "supporter", streak: 0, battleWins: 0, battleParticipations: 0, reviewSubmissions: 0, fireVotesReceived: 0, forumPosts: 0, forumComments: 0, votesCast: 0, radioPlays: 0 };

  const [userRow] = await db.select({ xp: users.xp, fanXP: users.fanXP, level: users.level, fanLevel: users.fanLevel, streak: users.streak }).from(users).where(eq(users.id, userId)).limit(1);
  if (!userRow) return { xp: 0, fanXP: 0, level: "bronze", fanLevel: "supporter", streak: 0, battleWins: 0, battleParticipations: 0, reviewSubmissions: 0, fireVotesReceived: 0, forumPosts: 0, forumComments: 0, votesCast: 0, radioPlays: 0 };

  const [winsRow] = await db.select({ c: sql<number>`COUNT(*)` }).from(battleRecords).where(eq(battleRecords.winnerId, userId));
  const [partRow] = await db.select({ c: sql<number>`COUNT(*)` }).from(battleRecords).where(sql`(${battleRecords.winnerId} = ${userId} OR ${battleRecords.loserId} = ${userId})`);
  const [subsRow] = await db.select({ c: sql<number>`COUNT(*)` }).from(reviewSubmissions).where(eq(reviewSubmissions.userId, userId));
  const [fireRow] = await db.select({ c: sql<number>`COUNT(*)` }).from(songReactions).where(and(eq(songReactions.reaction, "fire"), sql`${songReactions.submissionId} IN (SELECT id FROM review_submissions WHERE userId = ${userId})`));
  const [postsRow] = await db.select({ c: sql<number>`COUNT(*)` }).from(forumPosts).where(eq(forumPosts.userId, userId));
  const [commRow] = await db.select({ c: sql<number>`COUNT(*)` }).from(forumComments).where(eq(forumComments.userId, userId));
  const [votesRow] = await db.select({ c: sql<number>`COUNT(*)` }).from(votes).where(eq(votes.voterId, userId));

  // Radio plays: count xp_events with reason='radio_play'
  const [radioRow] = await db.select({ c: sql<number>`COUNT(*)` }).from(xpEvents).where(and(eq(xpEvents.userId, userId), eq(xpEvents.reason, "radio_play")));

  return {
    xp: userRow.xp ?? 0,
    fanXP: userRow.fanXP ?? 0,
    level: userRow.level ?? "bronze",
    fanLevel: userRow.fanLevel ?? "supporter",
    streak: userRow.streak ?? 0,
    battleWins: Number(winsRow?.c ?? 0),
    battleParticipations: Number(partRow?.c ?? 0),
    reviewSubmissions: Number(subsRow?.c ?? 0),
    fireVotesReceived: Number(fireRow?.c ?? 0),
    forumPosts: Number(postsRow?.c ?? 0),
    forumComments: Number(commRow?.c ?? 0),
    votesCast: Number(votesRow?.c ?? 0),
    radioPlays: Number(radioRow?.c ?? 0),
  };
}

// ─── Requirements Evaluation ─────────────────────────────────────────────────

export interface RewardRequirements {
  xp?: number;
  fanXP?: number;
  level?: string;
  fanLevel?: string;
  streak?: number;
  battleWins?: number;
  battleParticipations?: number;
  reviewSubmissions?: number;
  fireVotesReceived?: number;
  forumPosts?: number;
  forumComments?: number;
  votesCast?: number;
  radioPlays?: number;
}

export function evaluateRequirements(req: RewardRequirements, stats: UserRewardStats): boolean {
  const levelOrder = ARTIST_LEVELS.map(l => l.level);
  const fanLevelOrder = FAN_LEVELS.map(l => l.level);

  if (req.xp !== undefined && stats.xp < req.xp) return false;
  if (req.fanXP !== undefined && stats.fanXP < req.fanXP) return false;
  if (req.level !== undefined && levelOrder.indexOf(stats.level as ArtistLevel) < levelOrder.indexOf(req.level as ArtistLevel)) return false;
  if (req.fanLevel !== undefined && fanLevelOrder.indexOf(stats.fanLevel as FanLevel) < fanLevelOrder.indexOf(req.fanLevel as FanLevel)) return false;
  if (req.streak !== undefined && stats.streak < req.streak) return false;
  if (req.battleWins !== undefined && stats.battleWins < req.battleWins) return false;
  if (req.battleParticipations !== undefined && stats.battleParticipations < req.battleParticipations) return false;
  if (req.reviewSubmissions !== undefined && stats.reviewSubmissions < req.reviewSubmissions) return false;
  if (req.fireVotesReceived !== undefined && stats.fireVotesReceived < req.fireVotesReceived) return false;
  if (req.forumPosts !== undefined && stats.forumPosts < req.forumPosts) return false;
  if (req.forumComments !== undefined && stats.forumComments < req.forumComments) return false;
  if (req.votesCast !== undefined && stats.votesCast < req.votesCast) return false;
  if (req.radioPlays !== undefined && stats.radioPlays < req.radioPlays) return false;
  return true;
}

/** Calculate progress percentage toward a reward (0-100) */
export function calcRewardProgress(req: RewardRequirements, stats: UserRewardStats): number {
  const checks: number[] = [];
  if (req.xp) checks.push(Math.min(stats.xp / req.xp, 1));
  if (req.fanXP) checks.push(Math.min(stats.fanXP / req.fanXP, 1));
  if (req.battleWins) checks.push(Math.min(stats.battleWins / req.battleWins, 1));
  if (req.battleParticipations) checks.push(Math.min(stats.battleParticipations / req.battleParticipations, 1));
  if (req.reviewSubmissions) checks.push(Math.min(stats.reviewSubmissions / req.reviewSubmissions, 1));
  if (req.fireVotesReceived) checks.push(Math.min(stats.fireVotesReceived / req.fireVotesReceived, 1));
  if (req.forumPosts) checks.push(Math.min(stats.forumPosts / req.forumPosts, 1));
  if (req.forumComments) checks.push(Math.min(stats.forumComments / req.forumComments, 1));
  if (req.votesCast) checks.push(Math.min(stats.votesCast / req.votesCast, 1));
  if (req.streak) checks.push(Math.min(stats.streak / req.streak, 1));
  if (checks.length === 0) return 100;
  return Math.round((checks.reduce((a, b) => a + b, 0) / checks.length) * 100);
}

// ─── Auto-Unlock Engine ───────────────────────────────────────────────────────

/**
 * Check all active rewards against user stats and auto-unlock any that are newly eligible.
 * Called after every XP award.
 */
export async function checkAndUnlockRewards(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Get all active, non-paused, non-expired rewards
  const now = new Date();
  const allRewards = await db.select().from(rewards).where(
    and(
      eq(rewards.isActive, true),
      eq(rewards.isPaused, false),
      sql`(${rewards.expiresAt} IS NULL OR ${rewards.expiresAt} > ${now})`
    )
  );

  if (allRewards.length === 0) return;

  // Get user's existing reward records
  const existing = await db.select().from(userRewards).where(eq(userRewards.userId, userId));
  const existingMap = new Map(existing.map(r => [r.rewardId, r]));

  // Skip rewards already unlocked/claimable/active/redeemed
  const eligibleRewards = allRewards.filter(r => {
    const ex = existingMap.get(r.id);
    if (!ex) return true; // never seen before
    return ex.status === "locked"; // only re-evaluate locked ones
  });

  if (eligibleRewards.length === 0) return;

  const stats = await getUserRewardStats(userId);

  for (const reward of eligibleRewards) {
    let req: RewardRequirements = {};
    try { req = JSON.parse(reward.requirements || "{}"); } catch { continue; }

    if (!evaluateRequirements(req, stats)) continue;

    // Skip if requires admin approval — mark as claimable pending approval
    const newStatus = reward.requiresAdminApproval ? "claimable" : "unlocked";
    const existing = existingMap.get(reward.id);

    if (existing) {
      await db.update(userRewards)
        .set({ status: newStatus, unlockedAt: now })
        .where(and(eq(userRewards.userId, userId), eq(userRewards.rewardId, reward.id)));
    } else {
      await db.insert(userRewards).values({
        userId,
        rewardId: reward.id,
        status: newStatus,
        unlockedAt: now,
        earnedVia: "auto",
      });
    }

    // Log the unlock
    await db.insert(rewardLogs).values({
      userId,
      rewardId: reward.id,
      action: "unlocked",
      notes: `Auto-unlocked: ${reward.name}`,
    });

    // Notify owner for high-value rewards
    if (reward.rarity === "legendary" || reward.rarity === "hall_of_fame") {
      notifyOwner({
        title: `🏆 Legendary Reward Unlocked`,
        content: `User #${userId} just unlocked "${reward.name}" (${reward.rarity})`,
      }).catch(() => {});
    }
  }
}

// ─── Reward CRUD ─────────────────────────────────────────────────────────────

export async function getAllRewards() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rewards).orderBy(asc(rewards.type), asc(rewards.name));
}

export async function getRewardById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(rewards).where(eq(rewards.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createReward(data: {
  name: string;
  description?: string;
  type: "level" | "achievement" | "promo" | "wars" | "review" | "supporter" | "verified" | "rare";
  rarity: "common" | "rare" | "epic" | "legendary" | "hall_of_fame";
  requirements: RewardRequirements;
  requiresAdminApproval?: boolean;
  expiresAt?: Date;
  badgeIcon?: string;
  badgeColor?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(rewards).values({
    name: data.name,
    description: data.description,
    type: data.type,
    rarity: data.rarity,
    requirements: JSON.stringify(data.requirements),
    requiresAdminApproval: data.requiresAdminApproval ?? false,
    expiresAt: data.expiresAt,
    badgeIcon: data.badgeIcon,
    badgeColor: data.badgeColor,
  });
}

export async function updateReward(id: number, data: Partial<{
  name: string;
  description: string;
  requirements: RewardRequirements;
  isActive: boolean;
  isPaused: boolean;
  requiresAdminApproval: boolean;
  expiresAt: Date | null;
  badgeIcon: string;
  badgeColor: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updateData: Record<string, unknown> = { ...data };
  if (data.requirements) updateData.requirements = JSON.stringify(data.requirements);
  return db.update(rewards).set(updateData).where(eq(rewards.id, id));
}

// ─── User Reward Helpers ──────────────────────────────────────────────────────

export async function getUserRewards(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    userReward: userRewards,
    reward: rewards,
  })
    .from(userRewards)
    .innerJoin(rewards, eq(userRewards.rewardId, rewards.id))
    .where(eq(userRewards.userId, userId))
    .orderBy(desc(userRewards.unlockedAt));
  return rows;
}

export async function getPublicUserRewards(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    userReward: userRewards,
    reward: rewards,
  })
    .from(userRewards)
    .innerJoin(rewards, eq(userRewards.rewardId, rewards.id))
    .where(and(
      eq(userRewards.userId, userId),
      sql`${userRewards.status} IN ('unlocked', 'claimable', 'active', 'redeemed')`
    ))
    .orderBy(desc(userRewards.unlockedAt));
  return rows;
}

export async function adminGrantReward(adminId: number, userId: number, rewardId: number, notes?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const now = new Date();
  const existing = await db.select().from(userRewards).where(and(eq(userRewards.userId, userId), eq(userRewards.rewardId, rewardId))).limit(1);
  if (existing.length > 0) {
    await db.update(userRewards).set({ status: "unlocked", unlockedAt: now, grantedBy: adminId, notes: notes ?? null }).where(and(eq(userRewards.userId, userId), eq(userRewards.rewardId, rewardId)));
  } else {
    await db.insert(userRewards).values({ userId, rewardId, status: "unlocked", unlockedAt: now, grantedBy: adminId, earnedVia: "admin_grant", notes: notes ?? null });
  }
  await db.insert(rewardLogs).values({ userId, rewardId, action: "granted", performedBy: adminId, notes: notes ?? null });
}

export async function adminRevokeReward(adminId: number, userId: number, rewardId: number, notes?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const now = new Date();
  await db.update(userRewards).set({ status: "revoked", revokedAt: now, notes: notes ?? null }).where(and(eq(userRewards.userId, userId), eq(userRewards.rewardId, rewardId)));
  await db.insert(rewardLogs).values({ userId, rewardId, action: "revoked", performedBy: adminId, notes: notes ?? null });
}

export async function claimReward(userId: number, rewardId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const now = new Date();
  await db.update(userRewards).set({ status: "active", claimedAt: now }).where(and(eq(userRewards.userId, userId), eq(userRewards.rewardId, rewardId), sql`${userRewards.status} IN ('unlocked', 'claimable')`));
  await db.insert(rewardLogs).values({ userId, rewardId, action: "claimed" });
}

export async function getRewardLogs(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rewardLogs).orderBy(desc(rewardLogs.createdAt)).limit(limit);
}

// ─── Badge Helpers ────────────────────────────────────────────────────────────

export async function getUserBadges(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db.select().from(userBadges).where(and(
    eq(userBadges.userId, userId),
    eq(userBadges.isVisible, true),
    sql`(${userBadges.expiresAt} IS NULL OR ${userBadges.expiresAt} > ${now})`
  )).orderBy(desc(userBadges.grantedAt));
}

export async function adminGrantBadge(adminId: number, userId: number, data: {
  badge: string;
  label?: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "hall_of_fame";
  badgeIcon?: string;
  badgeColor?: string;
  expiresAt?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(userBadges).values({ ...data, userId, grantedBy: adminId });
  await db.insert(rewardLogs).values({ userId, action: "badge_granted", performedBy: adminId, notes: `Badge: ${data.badge}` });
}

export async function adminRemoveBadge(adminId: number, badgeId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [badge] = await db.select().from(userBadges).where(eq(userBadges.id, badgeId)).limit(1);
  if (!badge) throw new Error("Badge not found");
  await db.update(userBadges).set({ isVisible: false }).where(eq(userBadges.id, badgeId));
  await db.insert(rewardLogs).values({ userId: badge.userId, action: "badge_removed", performedBy: adminId, notes: `Badge ID: ${badgeId}` });
}

// ─── Admin XP Override ────────────────────────────────────────────────────────

export async function adminSetXP(adminId: number, userId: number, xp: number, notes?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const newLevel = calcArtistLevel(xp);
  await db.update(users).set({ xp, level: newLevel }).where(eq(users.id, userId));
  await db.insert(xpEvents).values({ userId, amount: xp, reason: "admin_grant", metadata: JSON.stringify({ adminId, notes }) });
  await db.insert(rewardLogs).values({ userId, action: "xp_override", performedBy: adminId, notes: notes ?? `XP set to ${xp}` });
  // Re-check rewards
  checkAndUnlockRewards(userId).catch(() => {});
}

// ─── Streak Tracking ──────────────────────────────────────────────────────────

export async function updateStreak(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const [user] = await db.select({ streak: users.streak, lastActiveDate: users.lastActiveDate }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return 0;

  const last = user.lastActiveDate;
  if (last === today) return user.streak ?? 0; // already counted today

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const newStreak = last === yesterdayStr ? (user.streak ?? 0) + 1 : 1;
  await db.update(users).set({ streak: newStreak, lastActiveDate: today }).where(eq(users.id, userId));

  // Award streak XP (10 * streak days, capped at 100)
  const streakXP = Math.min(newStreak * 10, 100);
  await awardXP(userId, "daily_streak", { amount: streakXP, metadata: { streak: newStreak } });

  return newStreak;
}

// ─── Reward Progress for Profile ─────────────────────────────────────────────

export async function getRewardsWithProgress(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const allRewards = await db.select().from(rewards).where(eq(rewards.isActive, true)).orderBy(asc(rewards.rarity), asc(rewards.name));
  const userRewardRows = await db.select().from(userRewards).where(eq(userRewards.userId, userId));
  const userRewardMap = new Map(userRewardRows.map(r => [r.rewardId, r]));
  const stats = await getUserRewardStats(userId);

  return allRewards.map(reward => {
    let req: RewardRequirements = {};
    try { req = JSON.parse(reward.requirements || "{}"); } catch { /* ignore */ }
    const userReward = userRewardMap.get(reward.id);
    const status = userReward?.status ?? "locked";
    const progress = calcRewardProgress(req, stats);
    return { reward, userReward: userReward ?? null, status, progress, requirements: req };
  });
}

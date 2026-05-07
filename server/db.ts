import { eq, asc, desc, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  reviewSubmissions, InsertReviewSubmission,
  queueState, artistOfWeek, InsertArtistOfWeek,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
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
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
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

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ── Review Queue ─────────────────────────────────────────────

export async function getQueueSubmissions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviewSubmissions)
    .where(ne(reviewSubmissions.status, "removed"))
    .orderBy(
      desc(reviewSubmissions.skipPaymentConfirmed),
      asc(reviewSubmissions.createdAt)
    );
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

// ── Artist of the Week ───────────────────────────────────────

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

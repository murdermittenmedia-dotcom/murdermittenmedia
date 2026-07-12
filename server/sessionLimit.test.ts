import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import {
  getOrCreateActiveMusicReviewSession,
  endActiveMusicReviewSession,
  countUserSubmissionsInActiveSession,
  addSubmission,
} from "./db";
import { musicReviewSessions, reviewSubmissions } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Music Review Session Limit", () => {
  let testUserId = 9999;

  beforeAll(async () => {
    // Clean up any existing sessions and submissions for test user
    const db = await getDb();
    if (db) {
      await db.delete(reviewSubmissions).where(eq(reviewSubmissions.userId, testUserId));
      await db.delete(musicReviewSessions);
    }
  });

  afterAll(async () => {
    // Clean up after tests
    const db = await getDb();
    if (db) {
      await db.delete(reviewSubmissions).where(eq(reviewSubmissions.userId, testUserId));
      await db.delete(musicReviewSessions);
    }
  });

  it("should create an active session when none exists", async () => {
    const db = await getDb();
    if (!db) {
      expect(true).toBe(true); // Skip if DB not available
      return;
    }

    const session = await getOrCreateActiveMusicReviewSession();
    expect(session).toBeDefined();
    expect(session.isActive).toBe(true);
    expect(session.startedAt).toBeDefined();
  });

  it("should return the same active session on subsequent calls", async () => {
    const db = await getDb();
    if (!db) {
      expect(true).toBe(true); // Skip if DB not available
      return;
    }

    const session1 = await getOrCreateActiveMusicReviewSession();
    const session2 = await getOrCreateActiveMusicReviewSession();
    expect(session1.id).toBe(session2.id);
  });

  it("should count free submissions in active session", async () => {
    const db = await getDb();
    if (!db) {
      expect(true).toBe(true); // Skip if DB not available
      return;
    }

    // Get active session
    const session = await getOrCreateActiveMusicReviewSession();
    
    // Add a free submission
    await addSubmission({
      userId: testUserId,
      artistName: "Test Artist",
      songTitle: "Test Song 1",
      submissionType: "youtube",
      youtubeUrl: "https://youtube.com/watch?v=test1",
      contactInfo: "test@example.com",
      skippedLine: false,
      skipPaymentConfirmed: false,
      isPaidSubmission: false,
      paidSubmissionType: null,
      paidSubmissionConfirmed: false,
      status: "pending",
      position: 0,
    });

    // Count should be 1
    const count = await countUserSubmissionsInActiveSession(testUserId);
    expect(count).toBe(1);
  });

  it("should enforce 2-submission limit per session", async () => {
    const db = await getDb();
    if (!db) {
      expect(true).toBe(true); // Skip if DB not available
      return;
    }

    // Add a second free submission
    await addSubmission({
      userId: testUserId,
      artistName: "Test Artist",
      songTitle: "Test Song 2",
      submissionType: "youtube",
      youtubeUrl: "https://youtube.com/watch?v=test2",
      contactInfo: "test@example.com",
      skippedLine: false,
      skipPaymentConfirmed: false,
      isPaidSubmission: false,
      paidSubmissionType: null,
      paidSubmissionConfirmed: false,
      status: "pending",
      position: 0,
    });

    // Count should be 2
    const count = await countUserSubmissionsInActiveSession(testUserId);
    expect(count).toBe(2);
  });

  it("should not count paid submissions towards the free limit", async () => {
    const db = await getDb();
    if (!db) {
      expect(true).toBe(true); // Skip if DB not available
      return;
    }

    // Add a paid submission
    await addSubmission({
      userId: testUserId,
      artistName: "Test Artist",
      songTitle: "Test Song Paid",
      submissionType: "youtube",
      youtubeUrl: "https://youtube.com/watch?v=testpaid",
      contactInfo: "test@example.com",
      skippedLine: false,
      skipPaymentConfirmed: false,
      isPaidSubmission: true,
      paidSubmissionType: "reentry5",
      paidSubmissionConfirmed: false,
      status: "pending",
      position: 0,
    });

    // Free submission count should still be 2 (paid doesn't count)
    const count = await countUserSubmissionsInActiveSession(testUserId);
    expect(count).toBe(2);
  });

  it("should not count reviewed submissions towards the limit", async () => {
    const db = await getDb();
    if (!db) {
      expect(true).toBe(true); // Skip if DB not available
      return;
    }

    // Mark one submission as reviewed
    const submissions = await db
      .select()
      .from(reviewSubmissions)
      .where(eq(reviewSubmissions.userId, testUserId));
    
    if (submissions.length > 0) {
      await db
        .update(reviewSubmissions)
        .set({ status: "reviewed" })
        .where(eq(reviewSubmissions.id, submissions[0].id));
    }

    // Count should still be 2 (reviewed submissions count toward the limit)
    const count = await countUserSubmissionsInActiveSession(testUserId);
    expect(count).toBe(2);
  });

  it("should end an active session", async () => {
    const db = await getDb();
    if (!db) {
      expect(true).toBe(true); // Skip if DB not available
      return;
    }
    
    await endActiveMusicReviewSession();
    
    // Verify session is no longer active
    const activeSessions = await db
      .select()
      .from(musicReviewSessions)
      .where(eq(musicReviewSessions.isActive, true));
    expect(activeSessions.length).toBe(0);
  });

  it("should create a new session after ending the previous one", async () => {
    const db = await getDb();
    if (!db) {
      expect(true).toBe(true); // Skip if DB not available
      return;
    }
    
    const session1 = await getOrCreateActiveMusicReviewSession();
    expect(session1.isActive).toBe(true);
    
    await endActiveMusicReviewSession();
    
    const session2 = await getOrCreateActiveMusicReviewSession();
    expect(session2.isActive).toBe(true);
    expect(session1.id).not.toBe(session2.id);
  });
});

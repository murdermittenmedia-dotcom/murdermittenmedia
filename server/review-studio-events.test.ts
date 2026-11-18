import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { and, eq, gt } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeReviewTestDatabase,
  resetReviewTestMemory,
} from "./review-test-database";

const memory = vi.hoisted(() => ({
  tables: {} as Record<string, any[]>,
  writes: 0,
  failAt: 0,
}));
vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => makeReviewTestDatabase(memory),
}));

import {
  getDb,
  getSongReactionCounts,
  getUserSongReaction,
  requeueSubmission,
  setSetting,
  startReviewQueueTrack,
  completeAndAdvanceReviewQueue,
} from "./db";
import {
  getOccurrenceReactionCounts,
  recordWebsiteReviewVote,
  reviewActor,
} from "./review-occurrences";
import {
  appendReviewEvent,
  dispatchReviewJournal,
  getReviewEventFeed,
  publishReviewEvent,
  setReviewLivePublisher,
} from "./review-studio-events";
import {
  ingestTikTokReviewEvent,
  reviewStudioRouter,
  tiktokEventInput,
} from "./review-studio-router";
import { createLimitedReviewSubmission } from "./review-submission-limit";
import {
  normalizeTikFinityReviewEvent,
  type TikFinityReviewEvent,
} from "../shared/review-tikfinity";
import {
  parseReviewCommentVote,
  REVIEW_STUDIO_DEFAULTS,
  reviewActivityText,
  type ReviewLiveEvent,
} from "../shared/review-studio";
import {
  reviewLiveEvents,
  reviewOccurrenceVotes,
  reviewTikTokDeliveries,
} from "../drizzle/schema";
import { setReviewTransportPublisher } from "./review-transport";

const roomId = "7390123456789012345";
const voter = {
  id: 101,
  username: "actualartist",
  instagramHandle: "otherhandle",
  artistName: "Actual Artist",
  name: "Actual Name",
  role: "user",
};
const journal = (type?: string) =>
  memory.tables.review_live_events.filter(row => !type || row.type === type);
const giftEvents = () =>
  journal("gift_received").map(row => ({
    ...JSON.parse(row.payload),
    sequence: row.sequence,
  }));
const chat = (
  messageId: string,
  comment = "FIRE",
  overrides: Partial<TikFinityReviewEvent> = {}
): TikFinityReviewEvent => ({
  kind: "chat",
  roomId,
  messageId,
  userId: "7001002003004005006",
  handle: "realviewer",
  comment,
  ...overrides,
});
const providerGift = (
  messageId: string,
  repeatCount: number,
  overrides: Record<string, unknown> = {}
) => ({
  event: "gift",
  data: {
    roomId,
    userId: "7001002003004005006",
    msgId: messageId,
    uniqueId: "realgifter",
    giftId: "5655",
    giftType: 1,
    repeatCount,
    ...overrides,
  },
});
const ingestGift = (
  messageId: string,
  repeatCount: number,
  overrides: Record<string, unknown> = {}
) => {
  const event = normalizeTikFinityReviewEvent(
    providerGift(messageId, repeatCount, overrides),
    roomId
  );
  if (!event) throw new Error("Expected provider gift to normalize");
  return ingestTikTokReviewEvent(event);
};

beforeEach(async () => {
  vi.stubEnv("DATABASE_URL", "memory://isolated-regression-only");
  resetReviewTestMemory(memory);
  memory.tables.users.push(voter);
  setReviewTransportPublisher(async () => {});
  await setReviewLivePublisher(() => {});
  // Real production settings helpers execute against the same adapter.
  await setSetting(
    "review_studio_settings",
    JSON.stringify({
      tiktokEnabled: true,
      tiktokRoomId: roomId,
      giftMappings: [{ giftId: "5655", soundId: "air-horn" }],
      sounds: [
        {
          ...REVIEW_STUDIO_DEFAULTS.sounds[0],
          url: "https://example.test/owned-air-horn.mp3",
        },
      ],
    })
  );
});
afterEach(() => vi.restoreAllMocks());

describe("production occurrence-scoped website voting", () => {
  it("records FIRE once, leaves repeat FIRE unchanged, and switches to TRASH with one vote_changed event", async () => {
    const received: ReviewLiveEvent[] = [];
    await setReviewLivePublisher(event => received.push(event));
    const started = await startReviewQueueTrack(1);
    expect(await getSongReactionCounts(1)).toMatchObject({ fire: 0, trash: 0 });
    expect(
      await recordWebsiteReviewVote(
        1,
        voter.id,
        "fire",
        started.reviewOccurrenceId!
      )
    ).toMatchObject({ changed: true });
    expect(await getSongReactionCounts(1)).toMatchObject({ fire: 1, trash: 0 });
    const afterFirst = structuredClone(memory.tables);
    expect(
      await recordWebsiteReviewVote(
        1,
        voter.id,
        "fire",
        started.reviewOccurrenceId!
      )
    ).toMatchObject({ changed: false });
    expect(memory.tables).toEqual(afterFirst);
    expect(
      await recordWebsiteReviewVote(
        1,
        voter.id,
        "trash",
        started.reviewOccurrenceId!
      )
    ).toMatchObject({ changed: true });
    expect(await getSongReactionCounts(1)).toMatchObject({ fire: 0, trash: 1 });
    expect(memory.tables.review_occurrence_votes).toMatchObject([
      {
        userId: 101,
        reaction: "trash",
        revision: 2,
        displayName: "@actualartist",
      },
    ]);
    expect(memory.tables.song_reactions).toMatchObject([
      { userId: 101, reaction: "trash" },
    ]);
    expect(journal("valid_vote_recorded")).toHaveLength(1);
    expect(journal("vote_changed")).toHaveLength(1);
    expect(received.map(event => event.type)).toEqual([
      "valid_vote_recorded",
      "vote_changed",
    ]);
    expect(received[1]).toMatchObject({
      actor: reviewActor(voter),
      reaction: "trash",
      occurrenceId: started.reviewOccurrenceId,
    });
    expect(reviewActivityText(received[1])).toContain(
      "@actualartist voted TRASH!"
    );
  });

  it("requeue/restart of the same song resets eligibility while retaining the completed occurrence and results", async () => {
    const first = await startReviewQueueTrack(1);
    await recordWebsiteReviewVote(
      1,
      voter.id,
      "trash",
      first.reviewOccurrenceId!
    );
    await completeAndAdvanceReviewQueue(1);
    const completed = structuredClone(
      memory.tables.review_occurrences.find(
        row => row.id === first.reviewOccurrenceId
      )
    );
    expect(completed).toMatchObject({
      fire: 0,
      trash: 1,
      completedAtMs: expect.any(Number),
    });
    expect(memory.tables.review_submissions[0]).toMatchObject({
      status: "reviewed",
      totalVoteCount: 1,
    });
    await requeueSubmission(1);
    const second = await startReviewQueueTrack(1);
    expect(second.reviewOccurrenceId).not.toBe(first.reviewOccurrenceId);
    expect(await getOccurrenceReactionCounts(1)).toMatchObject({
      fire: 0,
      trash: 0,
      occurrenceId: second.reviewOccurrenceId,
    });
    expect(await getUserSongReaction(1, voter.id)).toBeNull();
    await expect(
      recordWebsiteReviewVote(1, voter.id, "fire", first.reviewOccurrenceId!)
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      await recordWebsiteReviewVote(
        1,
        voter.id,
        "fire",
        second.reviewOccurrenceId!
      )
    ).toMatchObject({ changed: true });
    expect(await getSongReactionCounts(1)).toMatchObject({ fire: 1, trash: 0 });
    expect(
      memory.tables.review_occurrences.find(
        row => row.id === first.reviewOccurrenceId
      )
    ).toEqual(completed);
    expect(
      memory.tables.review_occurrence_votes.filter(
        row => row.platformUserId === String(voter.id)
      )
    ).toMatchObject([
      { occurrenceId: first.reviewOccurrenceId, reaction: "trash" },
      { occurrenceId: second.reviewOccurrenceId, reaction: "fire" },
    ]);
  });

  it("counts only real judge joins and does not count the regular voter's legacy reaction as a judge vote", async () => {
    memory.tables.users.push({
      id: 102,
      username: "paneljudge",
      artistName: "Panel Judge",
      name: "Judge",
      avatarUrl: null,
      role: "judge",
    });
    await startReviewQueueTrack(1);
    await recordWebsiteReviewVote(1, voter.id, "fire");
    await recordWebsiteReviewVote(1, 102, "trash");
    expect(await getSongReactionCounts(1)).toMatchObject({
      fire: 1,
      trash: 1,
      judgeFire: 0,
      judgeTrash: 1,
      judgeVotes: [{ userId: 102, username: "Panel Judge", reaction: "trash" }],
    });
  });

  it("rejects unknown accounts, noncurrent songs and ended occurrences without writing votes or events", async () => {
    await startReviewQueueTrack(1);
    const before = structuredClone(memory.tables);
    await expect(recordWebsiteReviewVote(1, 999, "fire")).rejects.toMatchObject(
      { code: "UNAUTHORIZED" }
    );
    await expect(
      recordWebsiteReviewVote(2, voter.id, "fire")
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(memory.tables).toEqual(before);
    await completeAndAdvanceReviewQueue(1);
    const after = structuredClone(memory.tables);
    await expect(
      recordWebsiteReviewVote(1, voter.id, "fire")
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(memory.tables).toEqual(after);
  });

  it("rolls back votes, legacy mirrors, totals and journal if the final event insert fails", async () => {
    const received: ReviewLiveEvent[] = [];
    await setReviewLivePublisher(event => received.push(event));
    await startReviewQueueTrack(1);
    const before = structuredClone(memory.tables);
    memory.failAt = memory.writes + 4;
    await expect(recordWebsiteReviewVote(1, voter.id, "fire")).rejects.toThrow(
      "Injected database failure"
    );
    expect(memory.tables).toEqual(before);
    expect(received).toHaveLength(0);
    memory.failAt = 0;
    await recordWebsiteReviewVote(1, voter.id, "fire");
    expect(await getSongReactionCounts(1)).toMatchObject({ fire: 1, trash: 0 });
  });
});

describe("production journal storage and accepted-submission actors", () => {
  it("persists monotonic event sequences, deduplicates event IDs and replays only events strictly after the cursor", async () => {
    const received: ReviewLiveEvent[] = [];
    await setReviewLivePublisher(event => received.push(event));
    const db = (await getDb())!;
    const first = await appendReviewEvent(db, {
      id: randomUUID(),
      type: "song_started",
      occurrenceId: "journal-occ",
      submissionId: 1,
    });
    const secondInput = {
      id: randomUUID(),
      type: "song_completed" as const,
      occurrenceId: "journal-occ",
      submissionId: 1,
    };
    const second = await appendReviewEvent(db, secondInput);
    expect(first?.sequence).toBe(1);
    expect(second?.sequence).toBe(2);
    expect(await appendReviewEvent(db, secondInput)).toBeNull();
    const third = await appendReviewEvent(db, {
      id: randomUUID(),
      type: "queue_changed",
      occurrenceId: null,
      submissionId: null,
    });
    expect(third!.sequence).toBeGreaterThan(second!.sequence);
    expect(await getReviewEventFeed()).toMatchObject({
      latestSequence: third!.sequence,
      events: [],
    });
    const replay = await getReviewEventFeed(first!.sequence);
    expect(replay.events.map(event => event.id)).toEqual([
      second!.id,
      third!.id,
    ]);
    expect(await getReviewEventFeed(third!.sequence)).toMatchObject({
      events: [],
    });
    await dispatchReviewJournal();
    await dispatchReviewJournal();
    expect(received.map(event => event.id)).toEqual([
      first!.id,
      second!.id,
      third!.id,
    ]);
  });

  it("enforces primary and per-occurrence identity keys, ignoring only duplicate inserts explicitly marked ignore", async () => {
    const db = (await getDb())!;
    await db
      .insert(reviewTikTokDeliveries)
      .values({ id: "same-provider-delivery", timestampMs: 1 });
    expect(
      (
        await db
          .insert(reviewTikTokDeliveries)
          .ignore()
          .values({ id: "same-provider-delivery", timestampMs: 2 })
      )[0].affectedRows
    ).toBe(0);
    await expect(
      Promise.resolve(
        db
          .insert(reviewTikTokDeliveries)
          .values({ id: "same-provider-delivery", timestampMs: 3 })
      )
    ).rejects.toThrow("Duplicate key");
    const value = {
      occurrenceId: "occ-a",
      platform: "website" as const,
      platformUserId: "same-user",
      displayName: "Actual Artist",
      reaction: "fire" as const,
    };
    await db.insert(reviewOccurrenceVotes).values(value);
    await expect(
      Promise.resolve(db.insert(reviewOccurrenceVotes).values(value))
    ).rejects.toThrow("Duplicate key");
    await db
      .insert(reviewOccurrenceVotes)
      .values({ ...value, occurrenceId: "occ-b" });
    expect(
      await db
        .select({
          voter: reviewOccurrenceVotes.platformUserId,
          occurrence: reviewOccurrenceVotes.occurrenceId,
        })
        .from(reviewOccurrenceVotes)
        .where(
          and(
            eq(reviewOccurrenceVotes.platformUserId, "same-user"),
            eq(reviewOccurrenceVotes.occurrenceId, "occ-b")
          )
        )
    ).toEqual([{ voter: "same-user", occurrence: "occ-b" }]);
    expect(
      await db
        .select({ id: reviewLiveEvents.eventId })
        .from(reviewLiveEvents)
        .where(gt(reviewLiveEvents.sequence, 0))
    ).toEqual([]);
  });

  it("accepts a real guest submission with its submitted artist name rather than manufacturing a handle", async () => {
    const received: ReviewLiveEvent[] = [];
    await setReviewLivePublisher(event => received.push(event));
    const id = await createLimitedReviewSubmission(
      {
        artistName: "Actual Guest Artist",
        songTitle: "Guest Track",
        submissionType: "youtube",
        youtubeUrl: "https://youtu.be/guesttrack1",
      },
      {
        day: "2026-11-17",
        deviceHash: "guest-device",
        keys: ["guest-device", "guest-ip"],
      }
    );
    const event = received.find(entry => entry.type === "submission_accepted");
    expect(event).toMatchObject({
      actor: "Actual Guest Artist",
      songTitle: "Guest Track",
      submissionId: id,
      occurrenceId: null,
    });
    expect(reviewActivityText(event!)).toContain(
      "Actual Guest Artist submitted a song!"
    );
    expect(reviewActivityText(event!)).not.toContain("@Actual Guest Artist");
    expect(memory.tables.review_submission_owners).toMatchObject([
      { submissionId: id, deviceHash: "guest-device" },
    ]);
    expect(journal("submission_accepted")).toHaveLength(1);
  });

  it("uses the actual account actor helper when an authenticated artist submits", async () => {
    const id = await createLimitedReviewSubmission(
      {
        userId: voter.id,
        artistName: "Submitted Artist Label",
        songTitle: "Account Track",
        submissionType: "youtube",
      },
      {
        day: "2026-11-17",
        deviceHash: "account-device",
        keys: ["account-device"],
      }
    );
    expect(JSON.parse(journal("submission_accepted")[0].payload)).toMatchObject(
      {
        submissionId: id,
        actor: reviewActor(voter),
        songTitle: "Account Track",
      }
    );
    expect(reviewActor({ instagramHandle: "@actualguest" })).toBe(
      "@actualguest"
    );
    expect(reviewActor({ artistName: "Artist Without Handle" })).toBe(
      "Artist Without Handle"
    );
    expect(
      reviewActivityText({
        id: "no-actor",
        sequence: 0,
        timestamp: 0,
        type: "submission_accepted",
        occurrenceId: null,
        submissionId: id,
      })
    ).toBeNull();
  });
});

describe("strict production TikFinity provider normalization", () => {
  it("preserves stable provider IDs, nested identity fields, bigint IDs and the supplied occurrence", () => {
    const input = {
      event: "chat",
      data: {
        user: {
          id: 7001002003004005006n,
          displayId: "actualviewer",
          nickname: "Actual Viewer",
        },
        common: { msgId: "7390999888777666555", roomId },
        content: "🔥",
      },
    };
    const event = normalizeTikFinityReviewEvent(
      input,
      roomId,
      "actual-occurrence"
    );
    expect(event).toMatchObject({
      kind: "chat",
      userId: "7001002003004005006",
      messageId: "7390999888777666555",
      roomId,
      handle: "actualviewer",
      displayName: "Actual Viewer",
      occurrenceId: "actual-occurrence",
      comment: "🔥",
    });
    expect(
      normalizeTikFinityReviewEvent(input, roomId, "actual-occurrence")
    ).toEqual(event);
  });

  it.each([
    { userId: undefined },
    { msgId: undefined },
    { userId: 9007199254740992 },
    { msgId: 9007199254740992 },
    { roomId: "7390123456789012346" },
    { uniqueId: undefined, nickname: undefined },
  ])(
    "rejects unstable IDs, wrong rooms or fabricated display-only identity: %j",
    overrides => {
      expect(() =>
        normalizeTikFinityReviewEvent(
          {
            event: "chat",
            data: {
              roomId,
              userId: "stable-user",
              msgId: "stable-message",
              uniqueId: "actualviewer",
              comment: "FIRE",
              ...overrides,
            },
          },
          roomId
        )
      ).toThrow();
    }
  );

  it("does not accept display names or timestamps as fallback identity or message IDs", () => {
    expect(() =>
      normalizeTikFinityReviewEvent(
        {
          event: "chat",
          data: {
            nickname: "Actual Name",
            msgId: "real-message",
            comment: "FIRE",
          },
        },
        roomId
      )
    ).toThrow();
    expect(() =>
      normalizeTikFinityReviewEvent(
        {
          event: "chat",
          data: {
            userId: "real-user",
            nickname: "Actual Name",
            timestamp: Date.now(),
            comment: "FIRE",
          },
        },
        roomId
      )
    ).toThrow();
  });

  it.each(["poll", "pollUpdate", "nativePoll", "like", "follow", "member"])(
    "ignores provider event %s rather than treating native totals or engagement as votes",
    event => {
      expect(
        normalizeTikFinityReviewEvent(
          {
            event,
            data: {
              roomId,
              userId: "real-user",
              msgId: "real-message",
              uniqueId: "actualviewer",
              fire: 200,
              trash: 100,
            },
          },
          roomId
        )
      ).toBeNull();
    }
  );

  it.each([
    { giftId: undefined },
    { giftType: undefined },
    { repeatCount: 0 },
    { repeatCount: 1.5 },
    { repeatCount: "nonsense" },
  ])("rejects incomplete gift receipts: %j", overrides => {
    expect(() =>
      normalizeTikFinityReviewEvent(
        providerGift("gift-message", 2, overrides),
        roomId
      )
    ).toThrow();
  });

  it("normalizes group IDs, cumulative counts and numeric final-streak flags without inventing IDs", () => {
    expect(
      normalizeTikFinityReviewEvent(
        providerGift("gift-message", 7, { groupId: 123456789n, repeatEnd: 1 }),
        roomId
      )
    ).toMatchObject({
      streakId: "123456789",
      repeatCount: 7,
      repeatEnd: true,
      messageId: "gift-message",
    });
  });
});

describe("production TikTok ingress voting and permissions", () => {
  it.each(["FIRE", "!fire", "🔥 🔥", "ＦＩＲＥ!"])(
    "parses only the explicit FIRE command %s",
    comment => {
      expect(parseReviewCommentVote(comment)).toBe("fire");
    }
  );
  it.each(["TRASH", "!trash", "🗑️ 🗑️"])(
    "parses only the explicit TRASH command %s",
    comment => {
      expect(parseReviewCommentVote(comment)).toBe("trash");
    }
  );
  it.each([
    "that beat is fire",
    "fire truck",
    "FIRE TRASH",
    "🔥 🗑️",
    "firefighter",
    "trash talk",
    "I vote fire",
    "",
  ])(
    'ignores unrelated or ambiguous comment "%s" without a vote, receipt or event',
    async comment => {
      await startReviewQueueTrack(1);
      const before = structuredClone(memory.tables);
      expect(parseReviewCommentVote(comment)).toBeNull();
      expect(
        await ingestTikTokReviewEvent(chat(`ignored-${randomUUID()}`, comment))
      ).toMatchObject({ accepted: false });
      expect(memory.tables).toEqual(before);
    }
  );

  it("deduplicates provider messages and stable voters, switches reaction, and keeps website/TikTok accounts distinct", async () => {
    const current = await startReviewQueueTrack(1);
    await recordWebsiteReviewVote(1, voter.id, "fire");
    const first = chat("chat-first", "FIRE", {
      userId: String(voter.id),
      occurrenceId: current.reviewOccurrenceId!,
    });
    expect(await ingestTikTokReviewEvent(first)).toMatchObject({
      accepted: true,
    });
    expect(await ingestTikTokReviewEvent(first)).toMatchObject({
      accepted: false,
      duplicate: true,
    });
    expect(
      await ingestTikTokReviewEvent({
        ...first,
        messageId: "chat-repeat",
        displayName: "Changed Display Name",
      })
    ).toMatchObject({ accepted: false });
    expect(
      await ingestTikTokReviewEvent({
        ...first,
        messageId: "chat-switch",
        comment: "TRASH",
      })
    ).toMatchObject({ accepted: true });
    expect(await getSongReactionCounts(1)).toMatchObject({ fire: 1, trash: 1 });
    expect(
      memory.tables.review_occurrence_votes.map(row => [
        row.platform,
        row.platformUserId,
        row.reaction,
      ])
    ).toEqual([
      ["website", String(voter.id), "fire"],
      ["tiktok", String(voter.id), "trash"],
    ]);
    expect(journal("valid_vote_recorded")).toHaveLength(2);
    expect(journal("vote_changed")).toHaveLength(1);
    expect(JSON.parse(journal("vote_changed")[0].payload)).toMatchObject({
      actor: "@realviewer",
      reaction: "trash",
    });
  });

  it("rejects stale occurrences and cross-room ingress transactionally", async () => {
    const current = await startReviewQueueTrack(1);
    const before = structuredClone(memory.tables);
    await expect(
      ingestTikTokReviewEvent(
        chat("stale-vote", "FIRE", { occurrenceId: "previous-occurrence" })
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      ingestTikTokReviewEvent(
        chat("wrong-room", "FIRE", { roomId: "7390123456789012346" })
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(memory.tables).toEqual(before);
    expect(
      await ingestTikTokReviewEvent(
        chat("stale-vote", "FIRE", {
          occurrenceId: current.reviewOccurrenceId!,
        })
      )
    ).toMatchObject({ accepted: true });
  });

  it("requires an enabled connection to the actual room, and a real actor", async () => {
    await setSetting(
      "review_studio_settings",
      JSON.stringify({ tiktokEnabled: false, tiktokRoomId: roomId })
    );
    await expect(
      ingestTikTokReviewEvent(chat("disabled-vote"))
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await setSetting(
      "review_studio_settings",
      JSON.stringify({ tiktokEnabled: true, tiktokRoomId: roomId })
    );
    await expect(
      ingestTikTokReviewEvent(
        chat("actorless-vote", "FIRE", {
          handle: undefined,
          displayName: undefined,
        })
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it.each([null, { id: 1, role: "user" }, { id: 2, role: "judge" }])(
    "enforces actual admin middleware on TikTok ingress for %j",
    async user => {
      const caller = reviewStudioRouter.createCaller({
        user,
        req: {},
        res: {},
      } as any);
      const before = structuredClone(memory.tables);
      await expect(
        caller.ingestTikTok(chat("non-admin-message"))
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(memory.tables).toEqual(before);
    }
  );

  it("exposes the protected studio router through appRouter and rejects native-poll payloads", async () => {
    const source = readFileSync(
      new URL("./routers.ts", import.meta.url),
      "utf8"
    );
    expect(source).toMatch(/reviewStudio:\s*reviewStudioRouter/);
    expect(
      tiktokEventInput.safeParse({
        kind: "poll",
        roomId,
        messageId: "native-poll",
        userId: "provider-user",
        fire: 500,
        trash: 200,
      }).success
    ).toBe(false);
    const caller = reviewStudioRouter.createCaller({
      user: { id: 1, role: "admin" },
      req: {},
      res: {},
    } as any);
    expect(await caller.status()).toMatchObject({
      nativePollMergingSupported: false,
    });
    expect(
      await caller.ingestTikTok({
        kind: "gift",
        roomId,
        messageId: "admin-gift",
        userId: "real-gifter",
        handle: "actualgifter",
        giftId: "5655",
        giftType: 0,
      })
    ).toMatchObject({ accepted: true, units: 1 });
  });
});

describe("production TikTok gift receipt and streak deduplication", () => {
  it("waits for the final streak receipt without a group ID and triggers cumulative final units once", async () => {
    await startReviewQueueTrack(1);
    expect(
      await ingestGift("streak-progress", 2, { repeatEnd: false })
    ).toMatchObject({
      accepted: false,
      reason: "Waiting for final streak receipt",
    });
    expect(giftEvents()).toHaveLength(0);
    expect(
      await ingestGift("streak-final", 5, { repeatEnd: true })
    ).toMatchObject({ accepted: true, units: 5 });
    expect(
      await ingestGift("streak-final", 5, { repeatEnd: true })
    ).toMatchObject({ accepted: false, duplicate: true });
    expect(giftEvents()).toMatchObject([
      {
        units: 5,
        giftId: "5655",
        actor: "@realgifter",
        soundId: "air-horn",
        soundUrl: "https://example.test/owned-air-horn.mp3",
        submissionId: 1,
      },
    ]);
    expect(memory.tables.review_gift_streaks).toHaveLength(0);
  });

  it("uses groupId cumulative deltas, rejects repeated or decreasing counts, and deduplicates messages before updating streaks", async () => {
    const group = { groupId: "real-streak-group" };
    expect(await ingestGift("group-1", 1, group)).toMatchObject({
      accepted: true,
      units: 1,
    });
    expect(await ingestGift("group-2", 4, group)).toMatchObject({
      accepted: true,
      units: 3,
    });
    expect(await ingestGift("group-2", 9, group)).toMatchObject({
      accepted: false,
      duplicate: true,
    });
    expect(memory.tables.review_gift_streaks[0].unitsSeen).toBe(4);
    expect(await ingestGift("group-same", 4, group)).toMatchObject({
      accepted: false,
      reason: "No new gift units",
    });
    expect(await ingestGift("group-lower", 2, group)).toMatchObject({
      accepted: false,
      reason: "No new gift units",
    });
    expect(
      await ingestGift("group-final", 6, { ...group, repeatEnd: true })
    ).toMatchObject({ accepted: true, units: 2 });
    expect(memory.tables.review_gift_streaks).toMatchObject([{ unitsSeen: 6 }]);
    expect(giftEvents().map(event => event.units)).toEqual([1, 3, 2]);
  });

  it("counts separate message IDs as distinct gifts at the same instant with no hidden cooldown", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1800000000000);
    const received: ReviewLiveEvent[] = [];
    await setReviewLivePublisher(event => received.push(event));
    expect(await ingestGift("distinct-a", 1, { giftType: 0 })).toMatchObject({
      accepted: true,
      units: 1,
    });
    expect(await ingestGift("distinct-b", 1, { giftType: 0 })).toMatchObject({
      accepted: true,
      units: 1,
    });
    expect(await ingestGift("distinct-c", 1, { giftType: 0 })).toMatchObject({
      accepted: true,
      units: 1,
    });
    expect(await ingestGift("distinct-b", 1, { giftType: 0 })).toMatchObject({
      accepted: false,
      duplicate: true,
    });
    expect(giftEvents().map(event => event.units)).toEqual([1, 1, 1]);
    expect(
      received.filter(event => event.type === "gift_received")
    ).toHaveLength(3);
    expect(new Set(received.map(event => event.timestamp))).toEqual(
      new Set([1800000000000])
    );
  });

  it("keeps independent groups, users and gift types separate while retaining real unmapped gift receipts", async () => {
    await ingestGift("independent-a", 2, { groupId: "group-a" });
    await ingestGift("independent-b", 2, { groupId: "group-b" });
    await ingestGift("independent-user", 2, {
      groupId: "group-a",
      userId: "different-real-user",
      nickname: "Different Artist",
      uniqueId: undefined,
    });
    await ingestGift("unmapped-gift", 1, { giftId: "99999", giftType: 0 });
    expect(giftEvents().map(event => event.units)).toEqual([2, 2, 2, 1]);
    expect(giftEvents()[2].actor).toBe("Different Artist");
    expect(giftEvents()[3]).toMatchObject({ giftId: "99999" });
    expect(giftEvents()[3].soundId).toBeUndefined();
    expect(memory.tables.review_gift_streaks).toHaveLength(3);
  });

  it("rolls back delivery and group counters when journaling fails, so retry counts the gift exactly once", async () => {
    const before = structuredClone(memory.tables);
    memory.failAt = memory.writes + 3;
    await expect(
      ingestGift("retryable-gift", 3, { groupId: "retry-group" })
    ).rejects.toThrow("Injected database failure");
    expect(memory.tables).toEqual(before);
    memory.failAt = 0;
    expect(
      await ingestGift("retryable-gift", 3, { groupId: "retry-group" })
    ).toMatchObject({ accepted: true, units: 3 });
    expect(
      await ingestGift("retryable-gift", 3, { groupId: "retry-group" })
    ).toMatchObject({ accepted: false, duplicate: true });
    expect(giftEvents().map(event => event.units)).toEqual([3]);
  });
});

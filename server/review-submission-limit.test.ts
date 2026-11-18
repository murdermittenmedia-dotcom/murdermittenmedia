import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Column, getTableName, is, SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { InsertReviewSubmission } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  createActivityEvent: vi.fn(),
  getQueueState: vi.fn(),
}));
vi.mock("./db", () => dbMocks);

import {
  createLimitedReviewSubmission,
  getReviewSubmissionAllowance,
  REVIEW_DAILY_LIMIT_MESSAGE,
} from "./review-submission-limit";
import {
  getReviewIdentity,
  hashReviewIdentity,
  reviewDay,
  reviewRequestIp,
  type ReviewIdentity,
} from "./review-submission-identity";

type Row = Record<string, any>;
type State = { tables: Record<string, Row[]>; nextId: Record<string, number> };
const dialect = new MySqlDialect();
let state: State;
let failNextInsert: string | undefined;
let transactionQueue: Promise<unknown>;
let activeTransactions: number;
let maximumActiveTransactions: number;

// Only database mechanics are simulated. Real Drizzle predicates/projections
// and schema tables are interpreted; quota decisions remain in the service.
// Reject unsupported SQL instead of accidentally treating it as a match.
function matches(row: Row, table: string, condition?: SQL): boolean {
  if (!condition) return true;
  const query = dialect.sqlToQuery(condition);
  const greater = /^`([^`]+)`\.`([^`]+)` > \?$/.exec(query.sql);
  if (greater) {
    if (greater[1] !== table || query.params.length !== 1) throw new Error("Unsupported journal comparison");
    return Number(row[greater[2]]) > Number(query.params[0]);
  }
  let paramIndex = 0;
  const checks: boolean[] = [];
  const rest = query.sql.replace(
    /`([^`]+)`\.`([^`]+)`\s*(?:=\s*(\?)|in\s*\(([\s?,]+)\))/gi,
    (_term, source: string, column: string, equality: string, list: string) => {
      if (source !== table) throw new Error(`Unsupported cross-table predicate: ${query.sql}`);
      if (equality) checks.push(row[column] === query.params[paramIndex++]);
      else {
        const count = [...list.matchAll(/\?/g)].length;
        checks.push(query.params.slice(paramIndex, paramIndex + count).includes(row[column]));
        paramIndex += count;
      }
      return "";
    },
  );
  if (!checks.length || rest.replace(/\band\b/gi, "").replace(/[()\s]/g, "") || paramIndex !== query.params.length) {
    throw new Error(`Unsupported predicate: ${query.sql}`);
  }
  return checks.every(Boolean);
}

function makeAdapter(readState: () => State, transactional = false): any {
  const rowsFor = (table: string) => {
    const rows = readState().tables[table];
    if (!rows) throw new Error(`Unsupported table: ${table}`);
    return rows;
  };
  const requireTransaction = () => {
    if (!transactional) throw new Error("Quota/queue/ownership operations must be transactional");
  };
  return {
    select(fields?: Record<string, Column | SQL>) {
      let table = "", condition: SQL | undefined, maximum = Infinity, ordering: SQL[] = [];
      const builder = {
        from(value: any) { table = getTableName(value); return builder; },
        where(value: SQL) { condition = value; return builder; },
        limit(value: number) { maximum = value; return builder; },
        orderBy(...value: SQL[]) { ordering = value; return builder; },
        for(value: string) {
          requireTransaction();
          if (value !== "update") throw new Error(`Unsupported lock: ${value}`);
          return builder;
        },
        then(resolve: any, reject: any) {
          return Promise.resolve().then(() => {
            const rows = rowsFor(table).filter(row => matches(row, table, condition));
            rows.sort((a, b) => {
              for (const order of ordering) {
                const sql = dialect.sqlToQuery(order).sql;
                const column = sql.match(/`[^`]+`\.`([^`]+)`/)?.[1];
                if (column && a[column] !== b[column]) return (a[column] > b[column] ? 1 : -1) * (/desc/i.test(sql) ? -1 : 1);
              }
              return 0;
            });
            if (!fields) return structuredClone(rows.slice(0, maximum));
            const entries = Object.entries(fields);
            const aggregates = entries.filter(([, field]) => is(field, SQL));
            if (aggregates.length) {
              if (entries.length !== 1) throw new Error("Unsupported mixed aggregate projection");
              const [alias, field] = aggregates[0];
              const query = dialect.sqlToQuery(field as SQL);
              const aggregate = /^MAX\(`([^`]+)`\.`([^`]+)`\)$/i.exec(query.sql);
              if (!aggregate || aggregate[1] !== table || query.params.length) {
                throw new Error(`Unsupported aggregate: ${query.sql}`);
              }
              return [{ [alias]: rows.length ? Math.max(...rows.map(row => Number(row[aggregate[2]]))) : null }];
            }
            return rows.slice(0, maximum).map(row => Object.fromEntries(entries.map(([alias, field]) => {
              if (!is(field, Column) || getTableName(field.table) !== table) throw new Error("Unsupported projection");
              return [alias, row[field.name]];
            })));
          }).then(resolve, reject);
        },
      };
      return builder;
    },
    insert(value: any) {
      const table = getTableName(value);
      let values: Row | Row[], duplicateUpdate: Row | undefined, execution: Promise<unknown> | undefined;
      let ignoreDuplicate = false;
      const builder = {
        ignore() { ignoreDuplicate = true; return builder; },
        values(next: Row | Row[]) { values = next; return builder; },
        onDuplicateKeyUpdate(options: { set: Row }) { duplicateUpdate = options.set; return builder; },
        then(resolve: any, reject: any) {
          execution ??= Promise.resolve().then(() => {
            const rows = rowsFor(table);
            if (!["notifications", "review_live_events"].includes(table)) requireTransaction();
            if (failNextInsert === table) {
              failNextInsert = undefined;
              throw new Error(`Injected ${table} insert failure`);
            }
            let insertId = 0;
            for (const next of Array.isArray(values) ? values : [values]) {
              if (table === "review_live_events") {
                if (rows.some(row => row.eventId === next.eventId)) {
                  if (ignoreDuplicate) continue;
                  throw new Error("Duplicate event receipt");
                }
                const sequence = readState().nextId[table]++;
                rows.push({ ...next, sequence });
                insertId = sequence;
                continue;
              }
              if (table === "review_daily_quotas") {
                const existing = rows.find(row => row.day === next.day && row.identityHash === next.identityHash);
                if (existing) {
                  if (!duplicateUpdate) throw new Error("Duplicate quota day/identity");
                  Object.assign(existing, duplicateUpdate);
                  continue;
                }
              } else if (table === "review_submission_owners") {
                if (rows.some(row => row.submissionId === next.submissionId)) throw new Error("Duplicate owner");
                if (!rowsFor("review_submissions").some(row => row.id === next.submissionId)) throw new Error("Owner without submission");
                rows.push({ ...next });
                continue;
              } else if (!["review_submissions", "notifications"].includes(table)) {
                throw new Error(`Unsupported insert: ${table}`);
              }
              insertId = readState().nextId[table]++;
              rows.push({ ...(table === "review_submissions" ? { status: "pending", position: 0 } : {}), ...next, id: insertId });
            }
            return [{ insertId, affectedRows: 1 }];
          });
          return execution.then(resolve, reject);
        },
      };
      return builder;
    },
    update(value: any) {
      const table = getTableName(value);
      let values: Row;
      const builder = {
        set(next: Row) { values = next; return builder; },
        async where(condition: SQL) {
          requireTransaction();
          if (table !== "review_daily_quotas") throw new Error(`Unsupported update: ${table}`);
          let affectedRows = 0;
          for (const row of rowsFor(table)) {
            if (matches(row, table, condition)) { Object.assign(row, values); affectedRows++; }
          }
          return [{ affectedRows }];
        },
      };
      return builder;
    },
    transaction<T>(operation: (tx: any) => Promise<T>): Promise<T> {
      if (transactional) throw new Error("Nested transactions are unsupported");
      // Snapshot only after the previous transaction settles. Commit atomically;
      // rejection discards every quota/submission/owner write and frees the queue.
      const result = transactionQueue.then(async () => {
        activeTransactions++;
        maximumActiveTransactions = Math.max(maximumActiveTransactions, activeTransactions);
        const snapshot = structuredClone(readState());
        try {
          const result = await operation(makeAdapter(() => snapshot, true));
          state = snapshot;
          return result;
        } finally { activeTransactions--; }
      });
      transactionQueue = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}

function context(peer = "203.0.113.10", cookie?: string, forwarded?: string | string[]): TrpcContext {
  return {
    req: {
      socket: { remoteAddress: peer }, ip: peer, protocol: "https", hostname: "review.example.test",
      headers: { ...(cookie ? { cookie: `mmm_review_device=${cookie}` } : {}), ...(forwarded ? { "x-forwarded-for": forwarded } : {}) },
    } as TrpcContext["req"],
    res: { cookie: vi.fn() } as unknown as TrpcContext["res"],
    user: null, io: null,
  };
}
function newDevice(ip = "203.0.113.10") {
  const ctx = context(ip);
  const identity = getReviewIdentity(ctx);
  const token = vi.mocked(ctx.res.cookie).mock.calls[0][1] as string;
  return { identity, token };
}
function identityFor(token: string, ip: string): ReviewIdentity {
  return getReviewIdentity(context(ip, token));
}
function song(type: "youtube" | "file" = "youtube", extra: Partial<InsertReviewSubmission> = {}): InsertReviewSubmission {
  return {
    artistName: "Test Artist", songTitle: `Test ${type} song`, submissionType: type,
    ...(type === "youtube" ? { youtubeUrl: "https://youtu.be/testvideo01" } : { fileKey: "test/song.mp3", fileUrl: "https://files.example.test/song.mp3" }),
    ...extra,
  };
}
const quotaRows = () => state.tables.review_daily_quotas;
const submissions = () => state.tables.review_submissions;
const owners = () => state.tables.review_submission_owners;
async function expectLimited(identity: ReviewIdentity, data = song()) {
  await expect(createLimitedReviewSubmission(data, identity)).rejects.toMatchObject({
    code: "TOO_MANY_REQUESTS", message: REVIEW_DAILY_LIMIT_MESSAGE,
  });
}

beforeEach(() => {
  vi.stubEnv("JWT_SECRET", "fake-review-test-signing-secret-not-a-production-key");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-08-14T16:00:00Z"));
  state = {
    tables: { review_daily_quotas: [], review_submissions: [], review_submission_owners: [], queue_state: [{ id: 1 }], users: [], notifications: [], review_live_events: [] },
    nextId: { review_daily_quotas: 1, review_submissions: 1, notifications: 1, review_live_events: 1 },
  };
  transactionQueue = Promise.resolve();
  failNextInsert = undefined;
  activeTransactions = 0;
  maximumActiveTransactions = 0;
  dbMocks.getDb.mockReset().mockResolvedValue(makeAdapter(() => state));
  dbMocks.getQueueState.mockReset().mockImplementation(async () => state.tables.queue_state[0]);
  dbMocks.createActivityEvent.mockReset().mockResolvedValue(undefined);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("real createLimitedReviewSubmission daily quota behavior", () => {
  it("paid-only blocks free insertion atomically, accepts pending paid proof, and restores free flow when switched off", async () => {
    const { identity } = newDevice();
    state.tables.queue_state[0].playbackMode = "paid_only";
    state.tables.queue_state[0].submitPriceCents = 0;
    const before = structuredClone(state);
    await expect(createLimitedReviewSubmission(song(), identity)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state).toEqual(before);
    await createLimitedReviewSubmission(song("youtube", { isPaidSubmission: true, paidSubmissionConfirmed: false, paidSubmissionType: "reentry5", cashappPaymentReceiptUrl: "https://cash.app/verified-proof" }), identity);
    expect(submissions()[0]).toMatchObject({ status: "pending", isPaidSubmission: true, paidSubmissionConfirmed: false });
    state.tables.queue_state[0].playbackMode = "90sec";
    await createLimitedReviewSubmission(song("file"), identity);
    expect(submissions()).toHaveLength(2);
    expect(quotaRows().every(row => row.submissions === 2)).toBe(true);
  });

  it("caps a shared IP at two even when every request uses a different signed device", async () => {
    const identities = [newDevice(), newDevice(), newDevice()].map(device => device.identity);
    expect(new Set(identities.map(identity => identity.deviceHash)).size).toBe(3);
    await createLimitedReviewSubmission(song(), identities[0]);
    await createLimitedReviewSubmission(song(), identities[1]);
    const before = structuredClone(state);
    await expectLimited(identities[2]);
    expect(state).toEqual(before);
    expect(submissions()).toHaveLength(2);
    expect(owners().map(owner => owner.deviceHash)).toEqual(identities.slice(0, 2).map(identity => identity.deviceHash));
    expect(quotaRows().find(row => row.identityHash === hashReviewIdentity("ip", "203.0.113.10"))?.submissions).toBe(2);
    await expect(getReviewSubmissionAllowance(identities[2])).resolves.toMatchObject({ limit: 2, used: 2, remaining: 0, resetTimezone: "America/Detroit" });
    expect(dbMocks.createActivityEvent).toHaveBeenCalledTimes(2);
  });

  it("caps a reused signed device at two across different public IPs", async () => {
    const device = newDevice();
    const identities = ["203.0.113.11", "203.0.113.12", "203.0.113.13"].map(ip => identityFor(device.token, ip));
    expect(new Set(identities.map(identity => identity.deviceHash)).size).toBe(1);
    await createLimitedReviewSubmission(song(), identities[0]);
    await createLimitedReviewSubmission(song(), identities[1]);
    await expectLimited(identities[2]);
    expect(submissions()).toHaveLength(2);
    expect(quotaRows().find(row => row.identityHash === device.identity.deviceHash)?.submissions).toBe(2);
    expect(quotaRows().some(row => row.identityHash === hashReviewIdentity("ip", "203.0.113.13"))).toBe(false);
  });

  it.each(["youtube", "file"] as const)("shares one cap for mixed YouTube/file entries (third is %s), including paid add-ons", async thirdType => {
    const { identity } = newDevice();
    await createLimitedReviewSubmission(song("youtube"), identity);
    await createLimitedReviewSubmission(song("file"), identity);
    await expectLimited(identity, song(thirdType, {
      skippedLine: true, skipPaymentConfirmed: true, fullSongRequested: true,
      isPaidSubmission: true, paidSubmissionConfirmed: true, paidSubmissionType: "reentry10",
    }));
    expect(submissions().map(row => row.submissionType)).toEqual(["youtube", "file"]);
    expect(submissions().map(row => row.position)).toEqual([1, 2]);
    expect(quotaRows().map(row => row.submissions)).toEqual([2, 2]);
  });

  it.each(["pending", "playing", "reviewed", "removed", "deleted"] as const)("does not refund capacity when both submissions are %s", async status => {
    const { identity } = newDevice();
    await createLimitedReviewSubmission(song(), identity);
    await createLimitedReviewSubmission(song("file"), identity);
    // Simulate an admin lifecycle change/removal, without touching private quotas.
    if (status === "deleted") state.tables.review_submissions = [];
    else submissions().forEach(row => { row.status = status; });
    await expectLimited(identity);
    await expect(getReviewSubmissionAllowance(identity)).resolves.toMatchObject({ used: 2, remaining: 0 });
    expect(quotaRows().map(row => row.submissions)).toEqual([2, 2]);
  });

  it.each(["same identity", "shared IP", "shared device"] as const)("admits exactly two of three concurrent requests: %s", async mode => {
    const device = newDevice();
    const identities = mode === "shared IP" ? [device.identity, newDevice().identity, newDevice().identity]
      : mode === "shared device" ? ["203.0.113.21", "203.0.113.22", "203.0.113.23"].map(ip => identityFor(device.token, ip))
      : [device.identity, device.identity, device.identity];
    const results = await Promise.allSettled(identities.map((identity, index) => createLimitedReviewSubmission(song(index === 1 ? "file" : "youtube"), identity)));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(2);
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ code: "TOO_MANY_REQUESTS", message: REVIEW_DAILY_LIMIT_MESSAGE });
    expect(submissions()).toHaveLength(2);
    expect(new Set(submissions().map(row => row.id)).size).toBe(2);
    expect(submissions().map(row => row.position)).toEqual([1, 2]);
    expect(owners()).toHaveLength(2);
    expect(quotaRows().every(row => row.submissions <= 2)).toBe(true);
    expect(maximumActiveTransactions).toBe(1);
    expect(activeTransactions).toBe(0);
    expect(dbMocks.createActivityEvent).toHaveBeenCalledTimes(2);
  });

  it.each(["review_submissions", "review_submission_owners"])("rolls back a failed %s insert without consuming any quota or leaving an orphan", async table => {
    const { identity } = newDevice();
    const empty = structuredClone(state);
    failNextInsert = table;
    await expect(createLimitedReviewSubmission(song(), identity)).rejects.toThrow(`Injected ${table} insert failure`);
    expect(state).toEqual(empty);
    expect(dbMocks.createActivityEvent).not.toHaveBeenCalled();
    await expect(getReviewSubmissionAllowance(identity)).resolves.toMatchObject({ used: 0, remaining: 2 });
    await createLimitedReviewSubmission(song(), identity);
    const once = structuredClone(state);
    failNextInsert = table;
    await expect(createLimitedReviewSubmission(song("file"), identity)).rejects.toThrow("insert failure");
    expect(state).toEqual(once);
    await expect(getReviewSubmissionAllowance(identity)).resolves.toMatchObject({ used: 1, remaining: 1 });
    await createLimitedReviewSubmission(song("file"), identity);
    await expectLimited(identity);
    expect(submissions()).toHaveLength(2);
    expect(owners()).toHaveLength(2);
    expect(quotaRows().map(row => row.submissions)).toEqual([2, 2]);
    expect(dbMocks.createActivityEvent).toHaveBeenCalledTimes(2);
  });

  it("resets the same signed-device/IP allowance only at the next Michigan day", async () => {
    vi.setSystemTime(new Date("2026-08-15T03:59:59.999Z"));
    const device = newDevice();
    expect(device.identity.day).toBe("2026-08-14");
    await createLimitedReviewSubmission(song(), device.identity);
    await createLimitedReviewSubmission(song(), device.identity);
    await expectLimited(device.identity);
    vi.setSystemTime(new Date("2026-08-15T04:00:00Z"));
    const nextDay = identityFor(device.token, "203.0.113.10");
    expect(nextDay.day).toBe("2026-08-15");
    expect(nextDay.keys).toEqual(device.identity.keys);
    await expect(getReviewSubmissionAllowance(nextDay)).resolves.toMatchObject({ used: 0, remaining: 2 });
    await createLimitedReviewSubmission(song("file"), nextDay);
    await createLimitedReviewSubmission(song(), nextDay);
    await expectLimited(nextDay);
    expect(submissions()).toHaveLength(4);
    expect(quotaRows().filter(row => row.day === "2026-08-14").map(row => row.submissions)).toEqual([2, 2]);
    expect(quotaRows().filter(row => row.day === "2026-08-15").map(row => row.submissions)).toEqual([2, 2]);
  });

  it("allows independent device/IP pairs and uses the pending tail plus the actual admin notification tables", async () => {
    submissions().push({ id: 90, position: 7, status: "pending" }, { id: 91, position: 99, status: "reviewed" });
    state.tables.users.push({ id: 7, role: "admin" }, { id: 8, role: "user" });
    const first = newDevice("203.0.113.30").identity;
    const second = newDevice("203.0.113.31").identity;
    const id = await createLimitedReviewSubmission(song(), first);
    await createLimitedReviewSubmission(song("file"), second);
    expect(submissions().slice(-2).map(row => row.position)).toEqual([8, 9]);
    expect(owners()[0]).toEqual({ submissionId: id, deviceHash: first.deviceHash });
    expect(state.tables.notifications).toHaveLength(2);
    expect(state.tables.notifications[0]).toMatchObject({ userId: 7, type: "admin_new_submission", link: "/admin-popout" });
    expect(dbMocks.createActivityEvent).toHaveBeenCalledWith("review", "Test Artist entered the review queue", { detail: "Test youtube song" });
  });
});

describe("real review request identity helpers", () => {
  it.each(["10.0.0.2", "::ffff:192.168.1.2", "fd00::2"])("ignores a spoofed left XFF address through private proxy %s", peer => {
    const device = newDevice();
    const first = context(peer, device.token, "198.51.100.99, 203.0.113.44");
    const second = context(peer, device.token, ["192.0.2.123", "203.0.113.44"]);
    expect(reviewRequestIp(first.req)).toBe("203.0.113.44");
    expect(reviewRequestIp(second.req)).toBe("203.0.113.44");
    expect(getReviewIdentity(first).keys).toEqual(getReviewIdentity(second).keys);
  });

  it("ignores all XFF and Express req.ip spoofing for a direct public peer", () => {
    const ctx = context("203.0.113.45", undefined, "198.51.100.1, 192.0.2.2");
    Object.defineProperty(ctx.req, "ip", { value: "192.0.2.200" });
    expect(reviewRequestIp(ctx.req)).toBe("203.0.113.45");
    expect(getReviewIdentity(ctx).keys).toContain(hashReviewIdentity("ip", "203.0.113.45"));
  });

  it.each([
    ["::ffff:203.0.113.46", undefined, "203.0.113.46"],
    ["::FFFF:203.0.113.46", undefined, "203.0.113.46"],
    ["10.0.0.2", "198.51.100.1, ::ffff:203.0.113.46", "203.0.113.46"],
    ["2001:0DB8:0000:0000:0000:0000:0000:0001", undefined, "2001:db8::1"],
  ])("normalizes request address %s with XFF %s", (peer, forwarded, expected) => {
    expect(reviewRequestIp(context(peer, undefined, forwarded).req)).toBe(expected);
  });

  it("rejects an unverifiable IP instead of inventing a shared identity", () => {
    const ctx = context("");
    expect(() => reviewRequestIp(ctx.req)).toThrow("client IP could not be verified");
  });

  it("mints a signed cookie once, reuses it on later requests, and caches the device within a request", () => {
    const ctx = context();
    const first = getReviewIdentity(ctx);
    const token = vi.mocked(ctx.res.cookie).mock.calls[0][1] as string;
    expect(token).toMatch(/^[a-f0-9]{64}\.[a-f0-9]{64}$/);
    expect(ctx.res.cookie).toHaveBeenCalledWith("mmm_review_device", token, expect.objectContaining({ httpOnly: true, secure: true, path: "/", sameSite: "none" }));
    expect(getReviewIdentity(ctx)).toEqual(first);
    expect(ctx.res.cookie).toHaveBeenCalledTimes(1);
    const subsequent = context("203.0.113.10", token);
    expect(getReviewIdentity(subsequent)).toEqual(first);
    expect(subsequent.res.cookie).not.toHaveBeenCalled();
  });

  it.each(["device", "signature", "missing signature", "malformed signature"] as const)("replaces a cookie with a tampered %s rather than reusing its device", tamper => {
    const device = newDevice();
    const [id, signature] = device.token.split(".");
    const flip = (value: string) => `${value[0] === "a" ? "b" : "a"}${value.slice(1)}`;
    const token = tamper === "device" ? `${flip(id)}.${signature}`
      : tamper === "signature" ? `${id}.${flip(signature)}`
      : tamper === "missing signature" ? id : `${id}.not-a-valid-signature`;
    const ctx = context("203.0.113.10", token);
    const replacement = getReviewIdentity(ctx);
    expect(replacement.deviceHash).not.toBe(device.identity.deviceHash);
    expect(ctx.res.cookie).toHaveBeenCalledTimes(1);
    const replacementToken = vi.mocked(ctx.res.cookie).mock.calls[0][1] as string;
    expect(replacementToken).not.toBe(device.token);
    expect(getReviewIdentity(context("203.0.113.10", replacementToken))).toEqual(replacement);
  });

  it.each([
    ["2026-03-08T04:59:59.999Z", "2026-03-07"],
    ["2026-03-08T05:00:00Z", "2026-03-08"],
    ["2026-03-08T06:59:59Z", "2026-03-08"],
    ["2026-03-08T07:00:00Z", "2026-03-08"],
    ["2026-03-09T03:59:59.999Z", "2026-03-08"],
    ["2026-03-09T04:00:00Z", "2026-03-09"],
    ["2026-11-01T03:59:59.999Z", "2026-10-31"],
    ["2026-11-01T04:00:00Z", "2026-11-01"],
    ["2026-11-01T05:30:00Z", "2026-11-01"],
    ["2026-11-01T06:30:00Z", "2026-11-01"],
    ["2026-11-02T04:59:59.999Z", "2026-11-01"],
    ["2026-11-02T05:00:00Z", "2026-11-02"],
  ])("uses the Michigan calendar day across 23/25-hour DST days: %s", (instant, expected) => {
    expect(reviewDay(new Date(instant))).toBe(expected);
  });
});

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
const memory = vi.hoisted(() => ({ payment: {} as any, song: {} as any, writes: 0, skip: vi.fn(), transport: vi.fn() }));
const dialect = new MySqlDialect();
const database: any = {
  select() { let table: string; const builder: any = { from(value: any) { table = getTableName(value); return builder; }, where() { return builder; }, limit() { return builder; }, for() { return builder; }, then(resolve: any, reject: any) { return Promise.resolve([structuredClone(table === "review_addon_payments" ? memory.payment : memory.song)]).then(resolve, reject); } }; return builder; },
  update(value: any) { let next: any; const builder: any = { set(data: any) { next = data; return builder; }, async where() { memory.writes++; Object.assign(getTableName(value) === "review_addon_payments" ? memory.payment : memory.song, next); return [{ affectedRows: 1 }]; } }; return builder; },
  async transaction(fn: any) { return fn(database); },
};
vi.mock("./db", () => ({ getDb: async () => database, confirmSkipPayment: (...args: any[]) => memory.skip(...args) }));
vi.mock("./review-transport", () => ({ mutateReviewQueue: async (fn: any) => { memory.transport(); return fn(); } }));
import { fulfillReviewAddOn } from "./review-addon-payment";
import { getReviewAddOnPrice } from "./review-submission-router";
import { ReviewSubmissionAddOns } from "../client/src/components/ReviewSubmissionAddOns";
import { readFileSync } from "node:fs";
const session = (overrides: any = {}): any => ({ id: "cs_test_review_addon", mode: "payment", payment_status: "paid", amount_total: 1500, currency: "usd", metadata: { kind: "music_review_addon", submission_id: "11", addon_kind: "full_song_skip" }, ...overrides });
beforeEach(() => {
  memory.payment = { id: 7, submissionId: 11, stripeSessionId: "cs_test_review_addon", kind: "full_song_skip", amountCents: 1500, appliedAt: null };
  memory.song = { id: 11, status: "pending", isPaidSubmission: false, skippedLine: false, skipPaymentConfirmed: false, paidSubmissionConfirmed: false };
  memory.writes = 0; memory.skip.mockReset(); memory.transport.mockReset();
});
afterEach(() => vi.unstubAllGlobals());
describe("verified Music Review add-ons", () => {
  it("uses $10 skips and the configured full-song price without inventing a bundle price", () => {
    expect(getReviewAddOnPrice("skip", 500)).toBe(1000);
    expect(getReviewAddOnPrice("full_song", 700)).toBe(700);
    expect(getReviewAddOnPrice("full_song_skip", 700)).toBe(1700);
  });
  it("applies full playback and priority without changing free eligibility, creating a track or granting extra submissions", async () => {
    const result = await fulfillReviewAddOn(session());
    expect(result).toEqual({ success: true, submissionId: 11, alreadyApplied: false });
    expect(memory.song).toMatchObject({ isPaidSubmission: false, paidSubmissionConfirmed: true, fullSongRequested: true, skippedLine: true });
    expect(memory.skip).toHaveBeenCalledWith(11);
    expect(memory.payment.appliedAt).toBeInstanceOf(Date);
  });
  it("repeated return/webhook confirmations do not reapply the payment", async () => {
    await fulfillReviewAddOn(session());
    const writes = memory.writes;
    const result = await fulfillReviewAddOn(session());
    expect(result.alreadyApplied).toBe(true);
    expect(memory.writes).toBe(writes);
  });
  it.each([
    { payment_status: "unpaid" }, { amount_total: 1000 }, { currency: "eur" }, { mode: "subscription" },
    { metadata: { kind: "music_review_addon", submission_id: "99", addon_kind: "full_song_skip" } },
    { metadata: { kind: "music_review_addon", submission_id: "11", addon_kind: "skip" } },
  ])("rejects unpaid, wrong-amount, wrong-currency and mismatched track payments before writing (%j)", async (invalid) => {
    await expect(fulfillReviewAddOn(session(invalid))).rejects.toThrow("Stripe has not verified");
    expect(memory.writes).toBe(0);
    expect(memory.skip).not.toHaveBeenCalled();
  });
  it("a skip-only purchase never grants full-song access or makes a free track ineligible", async () => {
    Object.assign(memory.payment, { kind: "skip", amountCents: 1000 });
    await fulfillReviewAddOn(session({ amount_total: 1000, metadata: { kind: "music_review_addon", submission_id: "11", addon_kind: "skip" } }));
    expect(memory.song.paidSubmissionConfirmed).toBe(false);
    expect(memory.song.isPaidSubmission).toBe(false);
  });
  it("never requeues a track that finished before payment was received", async () => {
    memory.song.status = "reviewed";
    await fulfillReviewAddOn(session());
    expect(memory.song.status).toBe("reviewed");
    expect(memory.skip).not.toHaveBeenCalled();
  });
  it("offers Cash App/Stripe and full song + skip only in 90-second mode", () => {
    vi.stubGlobal("React", React);
    const props = { choice: { kind: "skip" as const, method: "Stripe" as const, receiptUrl: "" }, onChange: vi.fn(), fullSongPriceCents: 500 };
    const preview = renderToStaticMarkup(React.createElement(ReviewSubmissionAddOns, { ...props, mode: "90sec" }));
    expect(preview).toContain("Full song + line skip"); expect(preview).toContain("$15.00"); expect(preview).toContain("Cash App"); expect(preview).toContain("Stripe");
    const full = renderToStaticMarkup(React.createElement(ReviewSubmissionAddOns, { ...props, mode: "full" }));
    expect(full).not.toContain("Full song + line skip"); expect(full).toContain("Add a line skip");
  });
  it("keeps add-on ownership checks server-side and fulfills from signed Stripe webhooks", () => {
    const router = readFileSync("server/review-submission-router.ts", "utf8");
    expect((router.match(/getOwnedReviewSubmission\(ctx/g) ?? []).length).toBe(3);
    const webhook = readFileSync("server/stripe-webhook.ts", "utf8");
    expect(webhook).toContain('session.metadata?.kind === "music_review_addon"');
    expect(webhook).toContain("fulfillReviewAddOn(session)");
  });
});

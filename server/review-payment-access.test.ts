import { describe, expect, it } from "vitest";
import { hasApprovedFullSongAccess, isReviewSubmissionEligible } from "../shared/review-payment-access";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("review payment permissions and entitlements", () => {
  it("does not grant full-song access based on an unverified payment request", () => {
    expect(hasApprovedFullSongAccess({ isPaidSubmission: true, paidSubmissionConfirmed: false })).toBe(false);
    expect(hasApprovedFullSongAccess({ isPaidSubmission: false, paidSubmissionConfirmed: true })).toBe(true);
    expect(isReviewSubmissionEligible({ isPaidSubmission: true, paidSubmissionConfirmed: false })).toBe(false);
    expect(isReviewSubmissionEligible({ isPaidSubmission: true, paidSubmissionConfirmed: true })).toBe(true);
    expect(isReviewSubmissionEligible({ isPaidSubmission: false })).toBe(true);
  });
  it("rejects ordinary users attempting to approve payments, remove tracks, or reorder the line", async () => {
    const caller = appRouter.createCaller({ user: { id: 99, role: "user", openId: "regular-user" }, req: {}, res: {} } as unknown as TrpcContext);
    await expect(caller.queue.approvePayment({ id: 1, kind: "skip" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.queue.approvePayment({ id: 1, kind: "full_song" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.queue.reorder({ orderedIds: [1, 2] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.queue.updateStatus({ id: 1, status: "removed" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

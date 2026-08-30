import { describe, expect, it } from "vitest";

function isReviewPlusActive(membership: { status: "active" | "expired" | "canceled"; currentPeriodEnd: Date | null } | null, now = Date.now()) {
  return !!membership && membership.status === "active" && (!membership.currentPeriodEnd || membership.currentPeriodEnd.getTime() > now);
}

describe("Review+ entitlement", () => {
  it("treats an active membership without an expiry as active", () => {
    expect(isReviewPlusActive({ status: "active", currentPeriodEnd: null })).toBe(true);
  });

  it("treats a future period end as active", () => {
    expect(isReviewPlusActive({ status: "active", currentPeriodEnd: new Date(2_000) }, 1_000)).toBe(true);
  });

  it("rejects expired, canceled, and past-period memberships", () => {
    expect(isReviewPlusActive({ status: "expired", currentPeriodEnd: null })).toBe(false);
    expect(isReviewPlusActive({ status: "canceled", currentPeriodEnd: null })).toBe(false);
    expect(isReviewPlusActive({ status: "active", currentPeriodEnd: new Date(1_000) }, 2_000)).toBe(false);
    expect(isReviewPlusActive(null)).toBe(false);
  });
});

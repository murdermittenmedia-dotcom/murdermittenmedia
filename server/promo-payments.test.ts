import { describe, expect, it } from "vitest";
import { getPromoPackageLabel, getPromoPackagePriceCents } from "./promo-payments";

describe("promo payment catalog", () => {
  it("keeps the public promo package prices in cents", () => {
    expect(getPromoPackagePriceCents("repost")).toBe(500);
    expect(getPromoPackagePriceCents("perm-post")).toBe(10000);
    expect(getPromoPackagePriceCents("monthly-pass")).toBe(50000);
  });

  it("rejects unknown package identifiers without charging", () => {
    expect(getPromoPackagePriceCents("not-a-package")).toBeNull();
  });

  it("provides stable customer-facing labels", () => {
    expect(getPromoPackageLabel("7day-pinned")).toBe("7 Day Pinned Post");
    expect(getPromoPackageLabel("unknown")).toBe("unknown");
  });
});

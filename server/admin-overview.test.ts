import { describe, expect, it } from "vitest";
import { getAdminOverviewMetrics } from "../client/src/lib/adminOverview";

describe("admin overview metrics", () => {
  it("derives real queue and workload metrics without fake defaults", () => {
    const metrics = getAdminOverviewMetrics(
      {
        state: { isLive: true },
        submissions: [
          { status: "pending" },
          { status: "queued" },
          { status: "pending" },
        ],
        currentPlaying: { songTitle: "No Sleep", artistName: "YLG" },
      },
      {
        users: { total: 187, recentSignups: 4 },
        submissions: { paid: 2 },
        promoOrders: { skipTotal: 6, skipConfirmed: 4 },
      },
    );

    expect(metrics).toEqual({
      queueCount: 3,
      pendingCount: 2,
      paidWorkload: 2,
      skipTotal: 6,
      pendingSkipOrders: 2,
      memberCount: 187,
      recentSignups: 4,
      isLive: true,
      currentTitle: "No Sleep",
      currentArtist: "YLG",
    });
  });

  it("stays safe and clearly offline when data is unavailable", () => {
    expect(getAdminOverviewMetrics(undefined, undefined)).toEqual({
      queueCount: 0,
      pendingCount: 0,
      paidWorkload: 0,
      skipTotal: 0,
      pendingSkipOrders: 0,
      memberCount: null,
      recentSignups: 0,
      isLive: false,
      currentTitle: null,
      currentArtist: null,
    });
  });
});

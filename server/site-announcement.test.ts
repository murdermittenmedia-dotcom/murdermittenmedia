import { describe, expect, it } from "vitest";
import { broadcastSiteAnnouncement, setSiteAnnouncementBroadcaster } from "./site-announcement";

describe("site announcement broadcaster", () => {
  it("delivers publish and clear events through the registered realtime bridge", () => {
    const received: unknown[] = [];
    setSiteAnnouncementBroadcaster((announcement) => received.push(announcement));

    broadcastSiteAnnouncement({
      title: "Tonight at 8",
      message: "Music Reviews are live.",
      actionLabel: "Tune in",
      actionUrl: "/review",
      publishedAt: 1_789_000_000_000,
    });
    broadcastSiteAnnouncement(null);

    expect(received).toEqual([
      {
        title: "Tonight at 8",
        message: "Music Reviews are live.",
        actionLabel: "Tune in",
        actionUrl: "/review",
        publishedAt: 1_789_000_000_000,
      },
      null,
    ]);

    setSiteAnnouncementBroadcaster(null);
  });
});

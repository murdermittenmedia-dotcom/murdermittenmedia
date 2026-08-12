import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const { publicLookup, ownerLookup, updatePage, recordEvent, analyticsLookup, pageById, allPages } = vi.hoisted(() => ({
  publicLookup: vi.fn(async (slug: string) => ({
    page: { id: 22, slug, isPublished: true },
    items: [],
  })),
  ownerLookup: vi.fn(),
  updatePage: vi.fn(),
  recordEvent: vi.fn(),
  analyticsLookup: vi.fn(),
  pageById: vi.fn(),
  allPages: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getPublicLinkPageBySlug: publicLookup, getLinkPageByUserId: ownerLookup, updateLinkPage: updatePage, recordLinkAnalyticsEvent: recordEvent, getLinkAnalytics: analyticsLookup, getLinkPageById: pageById, getAllLinkPages: allPages };
});

function context(user: TrpcContext["user"] = null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("linkPages", () => {
  beforeEach(() => {
    publicLookup.mockClear();
    ownerLookup.mockReset();
    updatePage.mockReset();
    recordEvent.mockReset();
    analyticsLookup.mockReset();
    pageById.mockReset();
    allPages.mockReset();
  });
  it("normalizes public slugs before lookup", async () => {
    const caller = appRouter.createCaller(context());
    const result = await caller.linkPages.publicBySlug({ slug: "Artist-Page" });

    expect(publicLookup).toHaveBeenCalledWith("artist-page");
    expect(result?.page.slug).toBe("artist-page");
  });

  it("rejects invalid public slugs before querying", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.linkPages.publicBySlug({ slug: "no" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(publicLookup).not.toHaveBeenCalled();
  });

  it("requires authentication for the owner editor", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.linkPages.mine()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.linkPages.uploadAvatar({ pageId: 22, base64: "aGVsbG8=", mimeType: "image/png" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("tracks only published pages and valid page items", async () => {
    const caller = appRouter.createCaller(context());
    await caller.linkPages.trackAnalytics({ slug: "Artist-Page", eventType: "click", visitorId: "visitor-123456", deviceType: "mobile", referrerHost: "instagram.com" });
    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ pageId: 22, itemId: null, eventType: "click", visitorId: "visitor-123456" }));

    publicLookup.mockResolvedValueOnce({ page: { id: 22, slug: "artist-page", isPublished: true }, items: [{ id: 7 }] });
    await caller.linkPages.trackAnalytics({ slug: "artist-page", itemId: 22, eventType: "click", visitorId: "visitor-123456", deviceType: "mobile" });
    expect(recordEvent).toHaveBeenCalledTimes(1);
  });

  it("allows owners to read their own analytics but blocks other users", async () => {
    ownerLookup.mockResolvedValue({ page: { id: 22, userId: 7, slug: "artist" }, items: [] });
    analyticsLookup.mockResolvedValue({ summary: { views: 4, clicks: 2, uniqueVisitors: 3, liveViewers: 1, clickThroughRate: 50 }, daily: [], topLinks: [], referrers: [], devices: [] });
    pageById.mockResolvedValue({ page: { id: 22, userId: 7, slug: "artist" }, items: [] });
    const owner = { id: 7, role: "user", name: "Artist", openId: "artist", email: "artist@example.com", loginMethod: "manus", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } as NonNullable<TrpcContext["user"]>;
    const other = { ...owner, id: 8, openId: "other" };
    await expect(appRouter.createCaller(context(owner)).linkPages.analytics({ days: 7 })).resolves.toMatchObject({ analytics: { summary: { clicks: 2 } } });
    await expect(appRouter.createCaller(context(other)).linkPages.analytics({ pageId: 22, days: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows admins to list pages and inspect selected page analytics", async () => {
    allPages.mockResolvedValue([{ id: 22, userId: 7, slug: "artist", displayName: "Artist", isPublished: true }]);
    pageById.mockResolvedValue({ page: { id: 22, userId: 7, slug: "artist" }, items: [] });
    analyticsLookup.mockResolvedValue({ summary: { views: 10, clicks: 4, uniqueVisitors: 7, liveViewers: 2, clickThroughRate: 40 }, daily: [], topLinks: [], referrers: [], devices: [] });
    const admin = { id: 1, role: "admin", name: "Admin", openId: "admin", email: "admin@example.com", loginMethod: "manus", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } as NonNullable<TrpcContext["user"]>;
    const caller = appRouter.createCaller(context(admin));
    await expect(caller.linkPages.adminPages()).resolves.toHaveLength(1);
    await expect(caller.linkPages.analytics({ pageId: 22, days: 30 })).resolves.toMatchObject({ analytics: { summary: { liveViewers: 2 } } });
  });

  it("persists owner-selected colors and publication state", async () => {
    ownerLookup.mockResolvedValue({ page: { id: 22, slug: "artist" }, items: [] });
    updatePage.mockResolvedValue({ page: { id: 22 }, items: [] });
    const user = { id: 7, role: "user", name: "Artist", openId: "artist", email: "artist@example.com", loginMethod: "manus", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } as NonNullable<TrpcContext["user"]>;
    const caller = appRouter.createCaller(context(user));

    await caller.linkPages.update({ pageId: 22, textColor: "#fefefe", buttonColor: "#ff3344", isPublished: true });

    expect(updatePage).toHaveBeenCalledWith(22, 7, expect.objectContaining({ textColor: "#fefefe", buttonColor: "#ff3344", isPublished: true }));
  });
});

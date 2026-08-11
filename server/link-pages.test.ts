import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const { publicLookup, ownerLookup, updatePage } = vi.hoisted(() => ({
  publicLookup: vi.fn(async (slug: string) => ({
    page: { slug, isPublished: true },
    items: [],
  })),
  ownerLookup: vi.fn(),
  updatePage: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getPublicLinkPageBySlug: publicLookup, getLinkPageByUserId: ownerLookup, updateLinkPage: updatePage };
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

  it("persists owner-selected text and button colors", async () => {
    ownerLookup.mockResolvedValue({ page: { id: 22, slug: "artist" }, items: [] });
    updatePage.mockResolvedValue({ page: { id: 22 }, items: [] });
    const user = { id: 7, role: "user", name: "Artist", openId: "artist", email: "artist@example.com", loginMethod: "manus", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } as NonNullable<TrpcContext["user"]>;
    const caller = appRouter.createCaller(context(user));

    await caller.linkPages.update({ pageId: 22, textColor: "#fefefe", buttonColor: "#ff3344" });

    expect(updatePage).toHaveBeenCalledWith(22, 7, expect.objectContaining({ textColor: "#fefefe", buttonColor: "#ff3344" }));
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const { publicLookup } = vi.hoisted(() => ({
  publicLookup: vi.fn(async (slug: string) => ({
    page: { slug, isPublished: true },
    items: [],
  })),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getPublicLinkPageBySlug: publicLookup };
});

function context(user: TrpcContext["user"] = null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("linkPages", () => {
  beforeEach(() => publicLookup.mockClear());
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
  });
});

import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ requests: [] as any[], handlers: null as any, isPending: false, invalidations: [] as string[] }));
vi.mock("../client/src/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ queue: {
    getReactions: { invalidate: async () => { mock.invalidations.push("votes"); } },
    getAll: { invalidate: async () => { mock.invalidations.push("queue"); } },
    getReviewed: { invalidate: async () => { mock.invalidations.push("history"); } },
  } }),
  queue: { getReactions: { useQuery: () => ({ data: { occurrenceId: "00000000-0000-4000-8000-000000000002", fire: 120, trash: 30, adminFire: 100, adminTrash: 10 } }) } },
  reviewStudio: { addVotes: { useMutation: (handlers: unknown) => { mock.handlers = handlers; return { isPending: mock.isPending, mutate: (request: unknown) => mock.requests.push(request) }; } } },
} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { ReviewAdminVotes, parseAdminVoteAmount } from "../client/src/components/ReviewAdminVotes";
const song = { id: 7, artistName: "Artist", songTitle: "Track", reviewOccurrenceId: "00000000-0000-4000-8000-000000000002" };
let tree: ReactTestRenderer;
const getButton = (text: string) => tree.root.findAllByType("button").find(button => button.children.some(child => child === text))!;
beforeEach(() => {
  (globalThis as any).React = React;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mock.requests.length = 0; mock.invalidations.length = 0; mock.handlers = null; mock.isPending = false;
});
describe("admin vote control UI", () => {
  it("accepts arbitrary positive safe whole numbers without a small preset-only cap", () => {
    expect(parseAdminVoteAmount("1234567890")).toBe(1234567890);
    expect(parseAdminVoteAmount(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    for (const value of ["", "0", "-1", "1.5", "Infinity", "1e6", String(Number.MAX_SAFE_INTEGER + 1)]) expect(parseAdminVoteAmount(value)).toBeNull();
    const html = renderToStaticMarkup(React.createElement(ReviewAdminVotes, { song, isLive: true }));
    expect(html).toContain("Votes to add"); expect(html).toContain("100 admin-added"); expect(html).toContain("Add Fire"); expect(html).toContain("Add Trash");
  });
  it("sends one occurrence-bound addition even on a synchronous double-click", async () => {
    await act(async () => { tree = create(React.createElement(ReviewAdminVotes, { song, isLive: true })); });
    await act(async () => { tree.root.findByType("input").props.onChange({ target: { value: "2500" } }); });
    await act(async () => { const button = getButton("Add Fire"); button.props.onClick(); button.props.onClick(); });
    expect(mock.requests).toHaveLength(1);
    expect(mock.requests[0]).toMatchObject({ submissionId: 7, occurrenceId: song.reviewOccurrenceId, amount: 2500, reaction: "fire" });
    expect(mock.requests[0].requestId).toMatch(/^[a-f0-9-]{36}$/);
    await act(async () => { mock.handlers.onSuccess({ duplicate: false }, mock.requests[0]); });
    expect(mock.invalidations).toEqual(["votes", "queue", "history"]);
    await act(async () => { getButton("Add Trash").props.onClick(); });
    expect(mock.requests).toHaveLength(2); expect(mock.requests[1].requestId).not.toBe(mock.requests[0].requestId);
    await act(async () => tree.unmount());
  });
  it("reuses the same request ID after an uncertain network failure", async () => {
    await act(async () => { tree = create(React.createElement(ReviewAdminVotes, { song, isLive: true })); });
    await act(async () => { getButton("Add Fire").props.onClick(); });
    const request = mock.requests[0];
    await act(async () => { mock.handlers.onError({ message: "Network failed", data: { code: "TIMEOUT" } }, request); });
    await act(async () => { getButton("Retry the same addition safely").props.onClick(); });
    expect(mock.requests).toHaveLength(2); expect(mock.requests[1]).toEqual(request);
    await act(async () => tree.unmount());
  });
  it("does not enable additions when offline or without a loaded song", () => {
    for (const props of [{ song, isLive: false }, { song: null, isLive: true }]) {
      const html = renderToStaticMarkup(React.createElement(ReviewAdminVotes, props));
      expect(html).toContain("Go live and play a song"); expect(html).toContain('disabled=""');
    }
  });
});

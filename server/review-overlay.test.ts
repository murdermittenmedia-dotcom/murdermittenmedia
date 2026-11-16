import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { selectReviewOverlayState, type OverlayTrack } from "../shared/review-overlay";
import { getReviewOverlayLayout, ReviewOverlayDisplay } from "../client/src/pages/ReviewOverlay";
import { readFileSync } from "node:fs";

const track = (id: number, overrides: Partial<OverlayTrack> = {}): OverlayTrack => ({
  id, status: "pending", artistName: `Artist ${id}`, songTitle: `Song ${id}`, position: id,
  userId: id, fireCount: 12, trashCount: 3, ...overrides,
});
afterEach(() => vi.unstubAllGlobals());

describe("transparent live review overlay", () => {
  it("provides explicit horizontal and vertical links while leaving the original link vertical", () => {
    expect(getReviewOverlayLayout("?layout=horizontal")).toBe("horizontal");
    expect(getReviewOverlayLayout("?layout=vertical")).toBe("vertical");
    expect(getReviewOverlayLayout("")).toBe("vertical");
    expect(getReviewOverlayLayout("?layout=unknown")).toBe("vertical");
    vi.stubGlobal("React", React);
    const html = renderToStaticMarkup(React.createElement(ReviewOverlayDisplay, { state: selectReviewOverlayState(undefined, []), layout: "horizontal" }));
    expect(html).toContain("review-overlay-layout-horizontal");
    expect(html).not.toMatch(/<(audio|video|iframe|button|input)\b/);
  });
  it("shows only the next three eligible waiting tracks in the committed admin order", () => {
    const current = track(9, { status: "playing" });
    const state = selectReviewOverlayState({ state: { isLive: true }, currentPlaying: current, submissions: [
      track(3, { position: 2 }), track(2, { position: 1 }), track(1, { isPaidSubmission: true, paidSubmissionConfirmed: false }),
      current, track(4, { status: "reviewed" }), track(5, { position: 3 }), track(6, { position: 4 }),
    ] }, []);
    expect(state.current?.id).toBe(9);
    expect(state.next.map((song) => song.id)).toEqual([2, 3, 5]);
    expect(state.inLine).toBe(4);
  });
  it("chooses the actual last completed song by reviewedAt, not later edits", () => {
    const state = selectReviewOverlayState(undefined, [
      track(1, { status: "reviewed", reviewedAt: new Date(1000), updatedAt: new Date(9999) }),
      track(2, { status: "reviewed", reviewedAt: new Date(2000) }),
      track(3, { status: "removed", reviewedAt: new Date(3000) }),
      track(4, { status: "pending", reviewedAt: new Date(4000) }),
    ]);
    expect(state.previous?.id).toBe(2);
  });
  it("never calls an offline loaded song now playing, or repeats a requeued current track as previous", () => {
    const current = track(1, { status: "playing" });
    const state = selectReviewOverlayState({ state: { isLive: false }, currentPlaying: current, submissions: [] }, [
      track(1, { status: "reviewed", reviewedAt: new Date(2000) }), track(2, { status: "reviewed", reviewedAt: new Date(1000) }),
    ]);
    expect(state.current).toBeNull();
    expect(state.previous?.id).toBe(2);
  });
  it("renders current-song votes, clickable artist, queue and history but no players or controls", () => {
    vi.stubGlobal("React", React);
    const state = selectReviewOverlayState({ state: { isLive: true }, currentPlaying: track(1, { status: "playing" }), submissions: [track(2)] }, [track(3, { status: "reviewed" })]);
    const html = renderToStaticMarkup(React.createElement(ReviewOverlayDisplay, { state, votes: { fire: 42, trash: 7 } }));
    expect(html).toContain('href="/profile/1"');
    expect(html).toContain('data-testid="overlay-fire">42');
    expect(html).toContain('data-testid="overlay-trash">7');
    expect(html).toContain("Song 2");
    expect(html).toContain("Song 3");
    expect(html).not.toMatch(/<(audio|video|iframe|button|input)\b/);
  });
  it("stacks Now Playing, Next Up and Previously Queued in one narrow column", () => {
    vi.stubGlobal("React", React);
    const html = renderToStaticMarkup(React.createElement(ReviewOverlayDisplay, { state: selectReviewOverlayState(undefined, []) }));
    expect(html.indexOf("Now playing")).toBeLessThan(html.indexOf("Next up · 3 tracks"));
    expect(html.indexOf("Next up · 3 tracks")).toBeLessThan(html.indexOf("Previously queued"));
    const css = readFileSync("client/src/pages/review-overlay.css", "utf8");
    const stack = css.match(/\.review-overlay-strip\s*\{([^}]+)\}/)?.[1];
    expect(stack).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(stack).toContain("max-width: 440px");
  });
  it("resets displayed votes when there is no current song", () => {
    vi.stubGlobal("React", React);
    const html = renderToStaticMarkup(React.createElement(ReviewOverlayDisplay, { state: selectReviewOverlayState(undefined, []), votes: { fire: 99, trash: 50 } }));
    expect(html).toContain('data-testid="overlay-fire">0');
    expect(html).toContain('data-testid="overlay-trash">0');
    expect(html).toContain("Review is offline");
  });
  it("isolates the overlay from the normal audio/chrome shell and paints transparent roots", () => {
    const app = readFileSync("client/src/App.tsx", "utf8");
    const shell = app.slice(app.indexOf("if (isTransparentOverlay) {"), app.indexOf("\n  return (", app.indexOf("if (isTransparentOverlay) {")));
    expect(shell).toContain("<ReviewOverlay />");
    expect(shell).not.toMatch(/LivePlayerMount|AudioPlayerProvider|PageTrackerMount|Toaster|SiteAnnouncementNotice/);
    const css = readFileSync("client/src/pages/review-overlay.css", "utf8");
    expect(css).toContain('html[data-review-overlay="true"] #root');
    expect(css).toContain("background: transparent !important");
  });
});

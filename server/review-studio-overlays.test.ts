import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getReviewOverlaySource,
  isReviewOverlayActivity,
  REVIEW_OVERLAY_ACTIVITY_MS,
  ReviewOverlayDisplay,
  type ReviewOverlaySource,
} from "../client/src/pages/ReviewOverlay";
import {
  REVIEW_SOURCE_PATHS,
  type ReviewLiveEvent,
} from "../shared/review-studio";
import type {
  OverlayTrack,
  ReviewOverlayState,
} from "../shared/review-overlay";

const track = (id: number): OverlayTrack => ({
  id,
  songTitle: `Track ${id}`,
  artistName: `Artist ${id}`,
  status: "pending",
});
const state: ReviewOverlayState = {
  isLive: true,
  current: { ...track(1), status: "playing" },
  next: [track(2), track(3), track(4)],
  previous: { ...track(5), status: "reviewed" },
  inLine: 7,
};
const event = (overrides: Partial<ReviewLiveEvent> = {}): ReviewLiveEvent => ({
  id: "event-1",
  sequence: 1,
  timestamp: 1,
  type: "valid_vote_recorded",
  occurrenceId: "occurrence-1",
  submissionId: 1,
  actor: "@actualartist",
  reaction: "fire",
  ...overrides,
});
const render = (
  source: ReviewOverlaySource,
  activity?: ReviewLiveEvent,
  submissionAlertsEnabled = true
) =>
  renderToStaticMarkup(
    React.createElement(ReviewOverlayDisplay, {
      source,
      state,
      votes: { fire: 42, trash: 7 },
      activity,
      submissionAlertsEnabled,
    })
  );
beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());

describe("independent transparent review visual sources", () => {
  it("uses the shared five visual paths without classifying soundboard audio as visual", () => {
    for (const source of [
      "now",
      "queue",
      "previous",
      "header",
      "submissions",
    ] as const) {
      expect(getReviewOverlaySource(REVIEW_SOURCE_PATHS[source])).toBe(source);
      expect(
        getReviewOverlaySource(`${REVIEW_SOURCE_PATHS[source]}/?preview=1`)
      ).toBe(source);
      const html = render(source);
      expect(html).toContain(`review-overlay-source-${source}`);
      expect(html).not.toMatch(/<(audio|video|iframe|button|input)\b/);
    }
    expect(getReviewOverlaySource(REVIEW_SOURCE_PATHS.soundboard)).toBeNull();
    expect(
      getReviewOverlaySource("/broadcast/overlay?layout=horizontal")
    ).toBeNull();
  });
  it("combines artist/song with FIRE/TRASH without the other cards", () => {
    const html = render("now");
    expect(html).toContain("Track 1");
    expect(html).toContain("Artist 1");
    expect(html).toContain('data-testid="overlay-fire">42');
    expect(html).toContain('data-testid="overlay-trash">7');
    expect(html).not.toContain("Track 2");
    expect(html).not.toContain("PREVIOUSLY PLAYED");
  });
  it("shows next three and waiting total but no current track", () => {
    const html = render("queue");
    expect(html).toContain("7 in line");
    for (const id of [2, 3, 4]) expect(html).toContain(`Track ${id}`);
    expect(html).not.toContain("Track 1");
    expect(html).not.toContain("overlay-fire");
  });
  it("shows exactly one most recent completion and no votes or scrolling markup", () => {
    const html = render("previous");
    expect(html).toContain("PREVIOUSLY PLAYED");
    expect(html).toContain("Track 5");
    expect(html).toContain("Artist 5");
    expect(html).not.toMatch(
      /final-votes|overlay-fire|overlay-trash|ticker|carousel|marquee/i
    );
    expect(html).not.toContain("Track 1");
  });
  it("keeps permanent header and exact logo visible during real, safely escaped activity", () => {
    const html = render(
      "header",
      event({ actor: "<img src=x onerror=alert(1)>" })
    );
    for (const text of [
      "LIVE MUSIC REVIEWS",
      "HOSTED BY YLG TWON",
      "SUBMIT YOUR SONG — LINK IN BIO",
      "/manus-storage/mmm_logo_8689da6b.png",
    ])
      expect(html).toContain(text);
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt; voted FIRE!");
    expect(html).not.toContain("<img src=x");
    expect(render("header")).toContain("CAST YOUR VOTE!");
  });
  it("filters to accepted submissions and meaningful vote events only", () => {
    expect(isReviewOverlayActivity(event(), "header")).toBe(true);
    expect(
      isReviewOverlayActivity(
        event({ type: "vote_changed", reaction: "trash" }),
        "header"
      )
    ).toBe(true);
    expect(
      isReviewOverlayActivity(
        event({ type: "submission_accepted" }),
        "submissions"
      )
    ).toBe(true);
    for (const type of [
      "song_started",
      "song_completed",
      "queue_changed",
      "gift_received",
      "manual_sound_triggered",
      "studio_settings_changed",
    ] as const)
      expect(isReviewOverlayActivity(event({ type }), "header")).toBe(false);
    expect(isReviewOverlayActivity(event({ actor: "" }), "header")).toBe(false);
    expect(
      isReviewOverlayActivity(event({ reaction: undefined }), "header")
    ).toBe(false);
    expect(isReviewOverlayActivity(event(), "submissions")).toBe(false);
    expect(isReviewOverlayActivity(event(), "now")).toBe(false);
  });
  it("standalone alerts are empty when idle/disabled and display actual submission details", () => {
    const submission = event({
      type: "submission_accepted",
      songTitle: "Actual track",
      artistName: "Actual artist",
    });
    expect(render("submissions")).not.toContain("New song submitted");
    expect(render("submissions", submission, false)).not.toContain(
      "Actual track"
    );
    const html = render("submissions", submission);
    expect(html).toContain("Actual track");
    expect(html).toContain("@actualartist");
    expect(html).toContain("Actual artist");
  });
  it("retains five-second FIFO/dedup behavior, no-margin sizing and lazy visual-only manager contracts", () => {
    expect(REVIEW_OVERLAY_ACTIVITY_MS).toBe(5000);
    const page = readFileSync("client/src/pages/ReviewOverlay.tsx", "utf8");
    expect(page).toContain("seen.current.has(event.id)");
    expect(page).toContain("[...queue, event]");
    expect(page).toContain("queue.slice(1)");
    expect(page).toContain("reviewStudio.previous.useQuery");
    expect(page).toContain("reviewOccurrenceId");
    expect(page).not.toContain("dangerouslySetInnerHTML");
    const css = readFileSync("client/src/pages/review-overlay.css", "utf8");
    expect(css).toMatch(
      /review-overlay-canvas\.review-overlay-source\s*\{[^}]*padding: 0;/
    );
    for (const height of [250, 300, 150, 190, 140])
      expect(css).toContain(`height: ${height}px`);
    expect(css).toContain("prefers-reduced-motion: no-preference");
    const manager = readFileSync(
      "client/src/components/ReviewOverlayLink.tsx",
      "utf8"
    );
    expect(manager).toMatch(/\{preview &&\s*\(?\s*<VisualPreview/);
    expect(manager).toContain("{open && <OverlayManagerContents");
    expect(manager).toMatch(
      /setSettings\.mutate\(\{\s*submissionAlertsEnabled:/
    );
    expect(manager).not.toContain("REVIEW_SOURCE_PATHS.soundboard");
  });
});

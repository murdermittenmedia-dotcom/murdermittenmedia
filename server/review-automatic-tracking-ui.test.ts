import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrivateReviewTrackingItem } from "../shared/review-tracking";
const mock = vi.hoisted(() => ({ snapshot: null as any }));
vi.mock("../client/src/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ reviewTracking: { mine: { cancel: async () => {}, invalidate: async () => {} } } }),
  queue: { approvePayment: { useMutation: () => ({ isPending: false, mutate: () => {} }) } },
  reviewSubmission: { uploadPaymentProof: { useMutation: () => ({ mutateAsync: async () => ({ receiptUrl: "" }) }) } },
  reviewTracking: { mine: { useQuery: () => ({ data: mock.snapshot, dataUpdatedAt: Date.now(), isError: false, isLoading: false, refetch: async () => {} }) } },
} }));
vi.mock("../client/src/hooks/useReviewLiveEvents", () => ({ useReviewLiveEvents: () => ({}) }));
import { ReviewPaymentApprovals } from "../client/src/components/ReviewPaymentApprovals";
import { ReviewPaymentProof } from "../client/src/components/ReviewPaymentProof";
import { shouldOpenReviewSubmissionPrompt } from "../shared/review-submission-prompt";
import { ReviewQueueTracker, ReviewTrackingCard } from "../client/src/components/ReviewQueueTracker";
const item = (patch: Partial<PrivateReviewTrackingItem> = {}): PrivateReviewTrackingItem => ({
  key: "q_opaque-owned-only", submissionId: 5, artistName: "Owned Artist", songTitle: "Owned Track", status: "waiting", label: "Waiting", position: 3, positionLabel: "#3", numberAhead: 3,
  queueEligible: true, queueEligibilityReason: "eligible", ...patch,
});
beforeEach(() => {
  (globalThis as any).React = React;
  mock.snapshot = { observedAtMs: Date.now(), expiresAtMs: Date.now() + 15_000, availability: "live", isLive: true, current: null, upNext: null, submissions: [item()] };
});

describe("automatic personal review tracking", () => {
  it("renders real position and songs ahead without copy-link or TikTok actions", () => {
    const html = renderToStaticMarkup(React.createElement(ReviewQueueTracker, { showEmpty: false }));
    expect(html).toContain("Owned Track"); expect(html).toContain("#3"); expect(html).toContain("Songs in front of you");
    expect(html).not.toMatch(/Copy private tracking link|Link TikTok|!link|Galaxy|clipboard/);
    expect(html).toContain("whenever you return to this review page");
  });
  it("keeps a payment-pending record visible but does not invent an eligible position", () => {
    const html = renderToStaticMarkup(React.createElement(ReviewTrackingCard, { item: item({ queueEligible: false, queueEligibilityReason: "awaiting_payment_confirmation", position: null, numberAhead: null }), liveFacts: true }));
    expect(html).toContain("Awaiting payment confirmation"); expect(html).not.toContain("#3");
  });
  it("suppresses cached position facts while offline and collapses old results", () => {
    mock.snapshot.availability = "offline"; mock.snapshot.isLive = false;
    mock.snapshot.submissions.push(item({ key: "q_completed", submissionId: 2, songTitle: "Old Track", status: "completed", label: "Completed", position: null, numberAhead: null, queueEligible: false, queueEligibilityReason: "not_in_queue" }));
    const html = renderToStaticMarkup(React.createElement(ReviewQueueTracker));
    expect(html).not.toContain("#3"); expect(html).toContain("<details"); expect(html).toContain("Your recent results");
  });
  it("remembers every paid success ID and offers manual screenshot payments without a second tracking step", () => {
    const source = readFileSync(new URL("../client/src/pages/MusicReview.tsx", import.meta.url), "utf8");
    const paidCallbacks = source.match(/setSubmittedTrackId\(data.submissionId\);\s*setSubmitted\(true\);\s*setSubmissionPromptOpen\(false\);\s*if \(data.isPaid\)/g);
    expect(paidCallbacks).toHaveLength(2);
    expect(source).toContain("setSubmittedTrackId(result.submissionId)");
    expect(source).toContain('["Cash App", "PayPal", "Stripe"]');
    expect(source).toContain("<ReviewPaymentProof");
    const formStart = source.indexOf("const renderSubmissionForm =");
    const formEnd = source.indexOf("if (isAdminPopout)", formStart);
    const form = source.slice(formStart, formEnd);
    expect(form).toContain("<ReviewQueueTracker");
    expect(form).toContain('className="review-v2-submission-tracking"');
    expect(form.indexOf("<ReviewQueueTracker")).toBeGreaterThan(form.indexOf("Submit Track →"));
    const mainStart = source.indexOf("{/* ── MAIN SINGLE-COLUMN CONTENT");
    const feedTop = source.slice(mainStart, source.indexOf("{/* ── ADMIN SESSION CONTROLS", mainStart));
    expect(feedTop).not.toContain("<ReviewQueueTracker");
    expect(source.match(/<ReviewQueueTracker/g)).toHaveLength(1);
    expect(source).not.toContain('className="review-v2-mine-placement"');
    expect(source.match(/else if \(data.success\) \{\s*setTab\("submit"\);/g)).toHaveLength(2);
    expect(source).toContain('setPaidSubmitSuccess(result.alreadyCreated ? "already-created" : "stripe");\n          setTab("submit");');
    const tracker = readFileSync(new URL("../client/src/components/ReviewQueueTracker.tsx", import.meta.url), "utf8");
    expect(tracker).toContain("refetchOnMount: \"always\""); expect(tracker).not.toContain("issueRecovery"); expect(tracker).not.toContain("reviewBridge");
  });
});


describe("submission popup and payment screenshot display", () => {
  it("prompts on every public entry but never in OBS or controls-only windows", () => {
    expect(shouldOpenReviewSubmissionPrompt("/review")).toBe(true);
    expect(shouldOpenReviewSubmissionPrompt("/review", "?tab=submit")).toBe(true);
    expect(shouldOpenReviewSubmissionPrompt("/review", "?mode=broadcast")).toBe(false);
    for (const path of ["/admin-popout", "/broadcast/obs", "/broadcast/overlay", "/broadcast/review"]) expect(shouldOpenReviewSubmissionPrompt(path)).toBe(false);
    const source = readFileSync(new URL("../client/src/pages/MusicReview.tsx", import.meta.url), "utf8");
    expect(source).toContain("shouldOpenReviewSubmissionPrompt(window.location.pathname, window.location.search)");
    expect(source).toContain('tab === "submit" && !submissionPromptOpen && renderSubmissionForm()');
    expect(source).toContain("{renderSubmissionForm()}");
    expect(source.match(/id="submit-track"/g)).toHaveLength(1);
    expect(source).toContain("Not now — listen to the review");
    expect(source).not.toContain("Skip Track");
    expect(source).not.toContain("skip-info");
  });
  it("displays PayPal screenshot selection and an optional—not required—receipt URL", () => {
    const html = renderToStaticMarkup(React.createElement(ReviewPaymentProof, { method: "PayPal", receiptUrl: "", onChange: () => {}, amountCents: 1500 }));
    expect(html).toContain("paypal.me/MurderMittenPromo"); expect(html).toContain("Payment screenshot");
    expect(html).toContain("No separate receipt URL needed"); expect(html).toContain('accept="image/png,image/jpeg,image/webp');
    expect(html).not.toContain("required="); expect(html).toContain("$15.00");
  });
  it("shows the uploaded screenshot and method in admin while excluding completed payments", () => {
    const url = "/manus-storage/review-payment-proofs/00000000-0000-4000-8000-000000000001.png";
    const html = renderToStaticMarkup(React.createElement(ReviewPaymentApprovals, { submissions: [
      { id: 5, artistName: "Owned Artist", songTitle: "Owned Track", status: "pending", skippedLine: false, skipPaymentConfirmed: false, isPaidSubmission: true, paidSubmissionConfirmed: false, paymentMethod: "PayPal", cashappPaymentReceiptUrl: url },
      { id: 6, artistName: "Done", songTitle: "Do not show", status: "reviewed", skippedLine: false, skipPaymentConfirmed: false, isPaidSubmission: true, paidSubmissionConfirmed: false },
    ] }));
    expect(html).toContain('src="' + url + '"'); expect(html).toContain("Payment method: PayPal");
    expect(html).toContain("Approve paid entry"); expect(html).not.toContain("Do not show");
  });
});

import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import {
  getMyReviewTracking,
  getPublicReviewTrackingQueue,
  issueReviewRecovery,
  resolveReviewRecovery,
  REVIEW_RECOVERY_TOKEN_PATTERN,
} from "./review-tracking";

// Do not let shared proxies cache a visitor's private response or recovery link.
const trackingProcedure = publicProcedure.use(async ({ ctx, next }) => {
  ctx.res.setHeader("Cache-Control", "no-store, private");
  ctx.res.setHeader("Referrer-Policy", "no-referrer");
  return next();
});
export const reviewTrackingRouter = router({
  publicQueue: trackingProcedure.query(() => getPublicReviewTrackingQueue()),
  mine: trackingProcedure.query(({ ctx }) => getMyReviewTracking(ctx)),
  issueRecovery: trackingProcedure
    .input(z.object({ submissionId: z.number().int().positive() }))
    .mutation(({ ctx, input }) => issueReviewRecovery(ctx, input.submissionId)),
  // tRPC mutation = POST. Never put recovery tokens into GET query/cache URLs.
  resolve: trackingProcedure
    .input(z.object({ token: z.string().regex(REVIEW_RECOVERY_TOKEN_PATTERN) }))
    .mutation(({ input }) => resolveReviewRecovery(input.token)),
});

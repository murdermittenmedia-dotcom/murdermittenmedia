import express, { type Express } from "express";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authenticateReviewBridge, cleanupReviewBridgeDiagnostics, pairReviewBridge, processReviewBridgeReceipt, reviewBridgeHeartbeat } from "./review-bridge";

const eventSchema = z.object({
  kind: z.enum(["chat", "gift", "follow", "like", "share", "subscribe", "roomUser"]),
  roomId: z.string().regex(/^\d{5,30}$/), messageId: z.string().min(1).max(128),
  userId: z.string().min(1).max(128).optional(), handle: z.string().max(100).optional(), displayName: z.string().max(128).optional(),
  comment: z.string().max(2000).optional(), occurrenceId: z.string().max(64).nullable().optional(),
  giftId: z.string().max(64).optional(), giftName: z.string().max(128).optional(), giftType: z.number().int().min(0).max(100).optional(),
  repeatCount: z.number().int().min(1).max(1000).optional(), repeatEnd: z.boolean().optional(), likeCount: z.number().int().nonnegative().optional(), totalLikeCount: z.number().int().nonnegative().optional(), viewerCount: z.number().int().nonnegative().optional(), streakId: z.string().max(128).optional(),
}).strict();
const batchSchema = z.object({ streamId: z.string().uuid(), testMode: z.boolean(),
  events: z.array(z.object({ receiptId: z.string().uuid(), receivedAtMs: z.number().int().positive(), event: eventSchema })).min(1).max(100) }).strict();
const buckets = new Map<string, { since: number; used: number }>();
function rate(key: string, maximum: number) {
  const now = Date.now(); const old = buckets.get(key);
  if (!old || now - old.since >= 60_000) buckets.set(key, { since: now, used: 1 });
  else if (++old.used > maximum) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Bridge request capacity reached; retry this same event batch shortly." });
  if (buckets.size > 1000) for (const [id, bucket] of Array.from(buckets.entries())) if (now - bucket.since > 60_000) buckets.delete(id);
}
export function registerReviewBridgeHttp(app: Express) {
  app.use("/api/review-bridge", express.text({ type: "application/json", limit: "128kb" }), async (req, res, next) => {
    if (req.method !== "POST") { res.status(405).json({ error: "Use POST for bridge requests." }); return; }
    if (process.env.NODE_ENV === "production" && !req.secure && req.headers["x-forwarded-proto"] !== "https") { res.status(400).json({ error: "Encrypted HTTPS transport is required." }); return; }
    res.setHeader("Cache-Control", "no-store");
    try {
      const body = typeof req.body === "string" ? req.body : "";
      let payload: unknown;
      try { payload = JSON.parse(body); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Send a valid JSON payload." }); }
      if (req.path === "/pair") {
        rate(`pair:${req.ip ?? req.socket.remoteAddress}`, 6);
        const input = z.object({ pairingCode: z.string().regex(/^[a-f0-9]{24}$/i), deviceLabel: z.string().trim().min(1).max(80) }).strict().parse(payload);
        res.json(await pairReviewBridge(input.pairingCode, input.deviceLabel)); return;
      }
      const device = await authenticateReviewBridge(req.headers, body);
      rate(`device:${device.id}`, 300); // Batch capacity protects the server, not a gift/user cooldown.
      if (req.path === "/heartbeat") {
        const input = z.object({ localConnected: z.boolean(), testMode: z.boolean(), roomId: z.string().regex(/^\d{5,30}$/).optional() }).strict().parse(payload);
        res.json(await reviewBridgeHeartbeat(device, input));
      } else if (req.path === "/events") {
        const input = batchSchema.parse(payload); const results = [];
        for (const receipt of input.events) results.push(await processReviewBridgeReceipt(device, input.streamId, receipt.receivedAtMs, receipt.event, input.testMode));
        res.json({ results });
      } else { res.status(404).json({ error: "Unknown bridge endpoint." }); return; }
      void cleanupReviewBridgeDiagnostics().catch(() => {});
    } catch (error) {
      const code = error instanceof TRPCError ? error.code : error instanceof z.ZodError ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR";
      const statuses: Record<string, number> = { UNAUTHORIZED: 401, FORBIDDEN: 403, BAD_REQUEST: 400, CONFLICT: 409, TOO_MANY_REQUESTS: 429, INTERNAL_SERVER_ERROR: 500 };
      const status = statuses[code] ?? 400;
      if (status === 429) res.setHeader("Retry-After", "2");
      // Do not log signed bodies, pairing codes, signatures, tokens, or provider IDs.
      res.status(status).json({ error: error instanceof TRPCError ? error.message : status === 400 ? "Invalid bridge fields." : "Bridge unavailable; retry later." });
    }
  });
  app.use("/api/review-bridge", (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(413).json({ error: "Bridge payload exceeds the 128 KB limit." });
  });
}

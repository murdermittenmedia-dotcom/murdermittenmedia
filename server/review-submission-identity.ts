import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { parse } from "cookie";
import type { TrpcContext } from "./_core/context";
import { getSessionCookieOptions } from "./_core/cookies";

const COOKIE = "mmm_review_device";
const secret = () => {
  const key = process.env.JWT_SECRET;
  if (!key) throw new Error("Review identity signing is not configured");
  return key;
};
const sign = (value: string) => createHmac("sha256", secret()).update(value).digest("hex");
export const hashReviewIdentity = (kind: string, value: string) => sign(`review:${kind}:${value}`);

export function reviewDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
function normalizeIp(value: string) {
  const ip = value.trim().replace(/^::ffff:/i, "");
  if (isIP(ip) === 6) return new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  return isIP(ip) ? ip : null;
}
/** Only accept forwarded IPs through the hosting gateway/private proxy, and use
 * the rightmost appended address. A caller-supplied leftmost XFF is not trusted. */
export function reviewRequestIp(req: TrpcContext["req"]) {
  const peer = normalizeIp(req.socket?.remoteAddress ?? "");
  const privateProxy = peer && (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(peer) || /^172\.(1[6-9]|2\d|3[01])\./.test(peer) || peer === "::1" || /^(fc|fd|fe80:)/i.test(peer));
  if (privateProxy) {
    const header = req.headers["x-forwarded-for"];
    const forwarded = (Array.isArray(header) ? header.join(",") : header ?? "").split(",").map(normalizeIp).filter((ip): ip is string => !!ip);
    if (forwarded.length) return forwarded[forwarded.length - 1];
  }
  const ip = normalizeIp(req.ip ?? "");
  if (peer || ip) return peer ?? ip!;
  throw new Error("The client IP could not be verified. Please try again.");
}
export type ReviewIdentity = { day: string; deviceHash: string; keys: string[] };
export function getReviewIdentity(ctx: TrpcContext): ReviewIdentity {
  const request = ctx.req as TrpcContext["req"] & { reviewDevice?: string };
  let device = request.reviewDevice;
  if (!device) {
    let token = "";
    try { token = parse(request.headers.cookie ?? "")[COOKIE] ?? ""; } catch {}
    const [id, signature] = token.split(".");
    if (/^[a-f0-9]{64}$/.test(id ?? "") && /^[a-f0-9]{64}$/.test(signature ?? "")) {
      const expected = sign(id);
      if (timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) device = id;
    }
    if (!device) {
      device = randomBytes(32).toString("hex");
      ctx.res.cookie(COOKIE, `${device}.${sign(device)}`, { ...getSessionCookieOptions(request), maxAge: 365 * 24 * 60 * 60 * 1000 });
    }
    request.reviewDevice = device;
  }
  const deviceHash = hashReviewIdentity("device", device);
  const keys = [deviceHash, hashReviewIdentity("ip", reviewRequestIp(request))];
  if (ctx.user) keys.push(hashReviewIdentity("user", String(ctx.user.id)));
  return { day: reviewDay(), deviceHash, keys: keys.sort() };
}

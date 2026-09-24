import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Beat Pro trial invitation workflow", () => {
  it("uses a reusable 30-day Stripe trial link that renews annually", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
    expect(schema).toContain('beatProTrialInvites = mysqlTable("beat_pro_trial_invites"');
    expect(schema).toContain('beatProTrialRedemptions = mysqlTable("beat_pro_trial_redemptions"');
    expect(schema).toContain('userId: int("userId").notNull().unique()');
    expect(schema).toContain('"trialing", "active", "past_due", "canceled", "inactive"');
    expect(router).toContain("createProducerProTrialInvite: adminProcedure");
    expect(router).not.toContain("recipientEmail: z.string().trim().email().max(320), origin: z.string().url()");
    expect(router).toContain('recipientEmail: "shared-link"');
    expect(router).toContain("startTrialInviteCheckout: protectedProcedure");
    expect(router).toContain("trial_end: Math.floor(Date.now() / 1000) + BEAT_PRO_TRIAL_DAYS * 24 * 60 * 60");
    expect(router).toContain('payment_method_collection: "always"');
    expect(router).toContain("beat_pro_trial_redemption_id");
    expect(router).toContain("BEAT_PRO_ANNUAL_PRICE_CENTS");
    expect(router).toContain("This account has already used its Beat Pro trial.");
    expect(router).toContain("cancelSubscription: protectedProcedure");
    expect(router).toContain("cancel_at_period_end: true");
    expect(router).toContain('createProCheckout: protectedProcedure');
    expect(router).toContain('trial_period_days: BEAT_PRO_TRIAL_DAYS');
    expect(router).toContain('payment_method_collection: "always"');
  });

  it("keeps trial access active through the paid period and exposes self-service cancellation", () => {
    const service = readFileSync(resolve(process.cwd(), "server/beat-marketplace-service.ts"), "utf8");
    const producer = readFileSync(resolve(process.cwd(), "client/src/pages/BeatProducer.tsx"), "utf8");
    const admin = readFileSync(resolve(process.cwd(), "client/src/pages/AdminPanel.tsx"), "utf8");
    const invite = readFileSync(resolve(process.cwd(), "client/src/pages/BeatProInvite.tsx"), "utf8");
    expect(service).toContain('membership.status !== "active" && membership.status !== "trialing"');
    expect(service).toContain("beatProTrialRedemptions");
    expect(service).toContain("trialEndsAt");
    expect(service).toContain("cancelAtPeriodEnd");
    expect(producer).toContain("Cancel at period end");
    expect(admin).toContain("Create shareable trial link");
    expect(invite).toContain("Shareable invitation");
    expect(producer).toContain("$0 today · $50/year after 30 days");
    expect(invite).toContain("Start 30-day trial · $50/year after");
    expect(invite).toContain("Each account can use a Beat Pro trial once");
  });
});

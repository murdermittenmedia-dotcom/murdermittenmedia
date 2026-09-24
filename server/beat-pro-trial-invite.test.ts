import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Beat Pro trial invitation workflow", () => {
  it("uses an email-bound, 30-day Stripe trial that renews monthly", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
    expect(schema).toContain('beatProTrialInvites = mysqlTable("beat_pro_trial_invites"');
    expect(schema).toContain('"trialing", "active", "past_due", "canceled", "inactive"');
    expect(router).toContain("createProducerProTrialInvite: adminProcedure");
    expect(router).toContain("recipientEmail: z.string().trim().email()");
    expect(router).toContain("startTrialInviteCheckout: protectedProcedure");
    expect(router).toContain("trial_period_days: 30");
    expect(router).toContain('payment_method_collection: "always"');
    expect(router).toContain("beat_pro_trial_invite_id");
    expect(router).toContain("cancelSubscription: protectedProcedure");
    expect(router).toContain("cancel_at_period_end: true");
  });

  it("keeps trial access active through the paid period and exposes self-service cancellation", () => {
    const service = readFileSync(resolve(process.cwd(), "server/beat-marketplace-service.ts"), "utf8");
    const producer = readFileSync(resolve(process.cwd(), "client/src/pages/BeatProducer.tsx"), "utf8");
    const admin = readFileSync(resolve(process.cwd(), "client/src/pages/AdminPanel.tsx"), "utf8");
    const invite = readFileSync(resolve(process.cwd(), "client/src/pages/BeatProInvite.tsx"), "utf8");
    expect(service).toContain('membership.status !== "active" && membership.status !== "trialing"');
    expect(service).toContain("trialEndsAt");
    expect(service).toContain("cancelAtPeriodEnd");
    expect(producer).toContain("Cancel at period end");
    expect(admin).toContain("Create trial link");
    expect(invite).toContain("Start my 30-day trial");
    expect(invite).toContain("Cancel anytime");
  });
});

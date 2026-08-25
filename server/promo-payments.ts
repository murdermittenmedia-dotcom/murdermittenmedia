export const PROMO_PACKAGE_PRICES_CENTS: Record<string, number> = {
  repost: 500,
  story: 2000,
  "day-post": 5000,
  "perm-post": 10000,
  "dual-perm": 12500,
  "7day-pinned": 30000,
  "monthly-pass": 50000,
};

export const PROMO_PACKAGE_LABELS: Record<string, string> = {
  repost: "Repost",
  story: "Story Post",
  "day-post": "24 Hour Page Post",
  "perm-post": "Permanent Page Post",
  "dual-perm": "2 Permanent Page Posts",
  "7day-pinned": "7 Day Pinned Post",
  "monthly-pass": "Monthly Unlimited Promo Pass",
};

export function getPromoPackagePriceCents(packageId: string): number | null {
  return PROMO_PACKAGE_PRICES_CENTS[packageId] ?? null;
}

export function getPromoPackageLabel(packageId: string): string {
  return PROMO_PACKAGE_LABELS[packageId] ?? packageId;
}

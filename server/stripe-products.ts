/**
 * Stripe Products Configuration
 * Define all promo packages and their Stripe product/price mappings
 */

export const PROMO_PACKAGES = [
  {
    id: "repost",
    name: "Repost",
    description: "We press the repost button on your existing post",
    price: 500, // in cents: $5.00
    currency: "usd",
  },
  {
    id: "story",
    name: "Story Post",
    description: "24-hour Instagram Story feature",
    price: 2000, // $20.00
    currency: "usd",
  },
  {
    id: "day-post",
    name: "24 Hour Page Post",
    description: "Featured on our page for 24 hours",
    price: 5000, // $50.00
    currency: "usd",
  },
  {
    id: "perm-post",
    name: "Permanent Page Post",
    description: "Posted permanently to our page",
    price: 10000, // $100.00
    currency: "usd",
  },
  {
    id: "dual-perm",
    name: "2 Permanent Page Posts",
    description: "2 permanent posts to our page",
    price: 15000, // $150.00
    currency: "usd",
  },
  {
    id: "7day-pinned",
    name: "7 Day Pinned Post",
    description: "Your post is pinned at the top of our profile for 7 days",
    price: 30000, // $300.00
    currency: "usd",
  },
  {
    id: "monthly-pass",
    name: "Monthly Unlimited Promo Pass",
    description: "Unlimited reposts, story posts, 24-hour page posts, and priority scheduling",
    price: 50000, // $500.00
    currency: "usd",
  },
];

export function getPackageById(packageId: string) {
  return PROMO_PACKAGES.find((pkg) => pkg.id === packageId);
}

export function formatPrice(priceInCents: number): string {
  return `$${(priceInCents / 100).toFixed(2)}`;
}

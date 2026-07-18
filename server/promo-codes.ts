import { getDb } from "./db";
import { promoCodes } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Validates a promo code and returns whether it qualifies for free shipping
 * Server-side validation — never trust frontend
 */
export async function validateFreeShippingPromoCode(
  code: string | null | undefined,
  cartSubtotalCents: number,
  userId?: number
): Promise<{
  isValid: boolean;
  code?: string;
  message?: string;
}> {
  if (!code) {
    return { isValid: false };
  }

  const db = await getDb();
  if (!db) {
    return { isValid: false, message: "Database unavailable" };
  }

  const normalizedCode = code.trim().toUpperCase();

  try {
    const promo = await db
      .select()
      .from(promoCodes)
      .where(eq(promoCodes.code, normalizedCode))
      .limit(1);

    if (!promo || promo.length === 0) {
      return { isValid: false, message: "Promo code not found" };
    }

    const promoRecord = promo[0];

    // Check if enabled
    if (!promoRecord.enabled) {
      return { isValid: false, message: "This promo code is no longer active" };
    }

    // Check if expired
    if (
      promoRecord.expirationDate &&
      new Date(promoRecord.expirationDate) < new Date()
    ) {
      return { isValid: false, message: "This promo code has expired" };
    }

    // Check minimum subtotal
    if (
      promoRecord.minimumSubtotal &&
      cartSubtotalCents < promoRecord.minimumSubtotal
    ) {
      const minPrice = (promoRecord.minimumSubtotal / 100).toFixed(2);
      return {
        isValid: false,
        message: `Minimum order $${minPrice} required for this code`,
      };
    }

    // Check usage limit
    if (promoRecord.usageCount >= promoRecord.maximumUses) {
      return { isValid: false, message: "This promo code has reached its usage limit" };
    }

    // Check first-time-only restriction
    if (promoRecord.firstTimeOnly && userId) {
      // TODO: Check if user has made a previous purchase
      // For now, skip this check — implement after order history is available
    }

    // All checks passed
    return { isValid: true, code: normalizedCode };
  } catch (error) {
    console.error("[Promo Code Validation Error]", error);
    return { isValid: false, message: "Error validating promo code" };
  }
}

/**
 * Increments usage count after a successful payment
 * Called by the Stripe webhook after payment is confirmed
 */
export async function incrementPromoCodeUsage(code: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(promoCodes)
      .set({
        usageCount: sql`${promoCodes.usageCount} + 1`,
      })
      .where(eq(promoCodes.code, code.toUpperCase()));

    return true;
  } catch (error) {
    console.error("[Promo Code Usage Increment Error]", error);
    return false;
  }
}

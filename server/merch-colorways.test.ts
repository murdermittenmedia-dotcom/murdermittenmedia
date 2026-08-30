import { describe, expect, it } from "vitest";
import { MERCH_SHIRT_COLORWAYS, MERCH_SHIRT_COLORWAY_NAMES } from "../shared/merch-colorways";
import { MERCH_BLADE_CLOSEUP_IMAGES } from "../shared/merch-blade-images";
import { getDb, getShopProductBySlug } from "./db";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const adminShopSource = readFileSync(resolve(process.cwd(), "client/src/pages/AdminShop.tsx"), "utf8");

describe("merch shirt colorways", () => {
  it("keeps Stripe merch checkout receipt email configured", () => {
    const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    expect(routerSource).toContain("payment_intent_data:");
    expect(routerSource).toContain("receipt_email: user.email ?? undefined");
  });
  it("lists all ten reference colorways in display order", () => {
    expect(MERCH_SHIRT_COLORWAYS).toHaveLength(10);
    expect(MERCH_SHIRT_COLORWAY_NAMES).toEqual([
      "Michigan",
      "Olive",
      "Black Cement",
      "Bordeaux",
      "Grape",
      "Military Blue",
      "Cherry",
      "Platinum",
      "Red Black Cream",
      "Taupe Haze",
    ]);
  });

  it("maps every Blade Tee colorway to a dedicated close-up asset", () => {
    expect(Object.keys(MERCH_BLADE_CLOSEUP_IMAGES)).toEqual(MERCH_SHIRT_COLORWAY_NAMES);
    for (const url of Object.values(MERCH_BLADE_CLOSEUP_IMAGES)) {
      expect(url).toMatch(/^\/manus-storage\/mitten-made-blade-.+\.(?:jpg|png)$/);
    }
  });

  it("keeps the admin low-stock warning threshold visible", () => {
    expect(adminShopSource).toContain("stock > 0 && stock <= 5");
    expect(adminShopSource).toContain("Low Stock");
    expect(adminShopSource).toContain("Low stock");
  });

  it("keeps every colorway backed by a shirt color and descriptor", () => {
    for (const colorway of MERCH_SHIRT_COLORWAYS) {
      expect(colorway.number).toMatch(/^0[1-9]|10$/);
      expect(colorway.shirtColor.length).toBeGreaterThan(0);
      expect(colorway.designColors.length).toBeGreaterThan(0);
      expect(colorway.inspiredBy.length).toBeGreaterThan(0);
    }
  });

  it("keeps the renamed Blade Tee at $27.99 and separate from the Spirit tee", async () => {
    const db = await getDb();
    if (!db) return;

    const bladeTee = await getShopProductBySlug("three-color-system-tee");
    const spiritTee = await getShopProductBySlug("spirit-of-the-mitten-tee");

    expect(bladeTee).toMatchObject({
      name: "MITTEN MADE BLADE TEE",
      price: 2799,
      badge: "New Arrival",
      slug: "three-color-system-tee",
    });
    expect(spiritTee).toMatchObject({
      name: "Spirit of The Mitten Tee",
      slug: "spirit-of-the-mitten-tee",
    });
  });
});

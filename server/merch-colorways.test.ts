import { describe, expect, it } from "vitest";
import { MERCH_SHIRT_COLORWAYS, MERCH_SHIRT_COLORWAY_NAMES } from "../shared/merch-colorways";
import { getDb, getShopProductBySlug } from "./db";

describe("merch shirt colorways", () => {
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
      slug: "three-color-system-tee",
    });
    expect(spiritTee).toMatchObject({
      name: "Spirit of The Mitten Tee",
      slug: "spirit-of-the-mitten-tee",
    });
  });
});

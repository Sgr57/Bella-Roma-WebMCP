import { describe, it, expect } from "vitest";
import { PRODUCTS, getProductById, COUPONS, getCouponDiscount } from "../products";

describe("PRODUCTS", () => {
  it("contains at least 6 products", () => {
    expect(PRODUCTS.length).toBeGreaterThanOrEqual(6);
  });

  it("each product has required fields", () => {
    for (const p of PRODUCTS) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(["espresso", "filtro", "decaf", "latte"]).toContain(p.category);
      expect(p.price).toBeGreaterThan(0);
      expect(p.description).toBeTruthy();
      expect(p.emoji).toBeTruthy();
    }
  });

  it("product ids are unique", () => {
    const ids = PRODUCTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getProductById", () => {
  it("returns the product when found", () => {
    expect(getProductById("espresso")?.name).toBe("Espresso Classico");
  });
  it("returns undefined when not found", () => {
    expect(getProductById("ghost")).toBeUndefined();
  });
});

describe("getCouponDiscount", () => {
  it("returns 10% for BENVENUTO", () => {
    expect(getCouponDiscount("BENVENUTO", 10)).toBe(1);
  });
  it("returns 20% for STUDENTI capped at 5 EUR", () => {
    expect(getCouponDiscount("STUDENTI", 10)).toBe(2);
    expect(getCouponDiscount("STUDENTI", 100)).toBe(5);
  });
  it("is case-insensitive", () => {
    expect(getCouponDiscount("benvenuto", 10)).toBe(1);
  });
  it("returns null for invalid code", () => {
    expect(getCouponDiscount("NOPE", 10)).toBeNull();
  });
});

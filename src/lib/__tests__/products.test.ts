import { describe, it, expect } from "vitest";
import {
  PRODUCTS,
  getProductById,
  getProductsByType,
  COUPONS,
  getCouponDiscount,
} from "../products";

const VALID_TYPES = new Set(["drink", "food", "beans", "capsule", "milk_option"]);

describe("PRODUCTS catalog", () => {
  it("contains exactly 27 entries (13 drink + 4 food + 3 beans + 2 capsule + 5 milk)", () => {
    expect(PRODUCTS.length).toBe(27);
    expect(getProductsByType("drink").length).toBe(13);
    expect(getProductsByType("food").length).toBe(4);
    expect(getProductsByType("beans").length).toBe(3);
    expect(getProductsByType("capsule").length).toBe(2);
    expect(getProductsByType("milk_option").length).toBe(5);
  });

  it("each product has required fields", () => {
    for (const p of PRODUCTS) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(VALID_TYPES.has(p.type)).toBe(true);
      expect(typeof p.available).toBe("boolean");
      expect(p.description).toBeTruthy();
      expect(p.emoji).toBeTruthy();
    }
  });

  it("product ids are unique", () => {
    const ids = PRODUCTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("milk-soy is out of stock with alternatives", () => {
    const soy = getProductById("milk-soy");
    expect(soy?.available).toBe(false);
    expect(soy?.alternatives).toEqual(
      expect.arrayContaining(["milk-oat", "milk-almond"]),
    );
  });

  it("pairings references exist in catalog", () => {
    for (const p of PRODUCTS) {
      for (const id of p.pairings ?? []) {
        expect(getProductById(id), `pairing ${id} of ${p.id}`).toBeDefined();
      }
    }
  });

  it("related_products references exist", () => {
    for (const p of PRODUCTS) {
      for (const id of p.related_products ?? []) {
        expect(getProductById(id), `related ${id} of ${p.id}`).toBeDefined();
      }
    }
  });

  it("options.milk.values reference real milk_option products", () => {
    for (const p of PRODUCTS) {
      const milkVals = p.options?.milk?.values ?? [];
      for (const id of milkVals) {
        const m = getProductById(id);
        expect(m?.type, `milk option ${id} on ${p.id}`).toBe("milk_option");
      }
    }
  });

  it("alternatives references exist", () => {
    for (const p of PRODUCTS) {
      for (const id of p.alternatives ?? []) {
        expect(getProductById(id), `alternative ${id} of ${p.id}`).toBeDefined();
      }
    }
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

describe("getProductsByType", () => {
  it("filters by type", () => {
    expect(getProductsByType("drink").every((p) => p.type === "drink")).toBe(true);
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

void COUPONS;

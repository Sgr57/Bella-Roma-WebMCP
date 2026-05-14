import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore } from "../cart";

describe("cart store", () => {
  beforeEach(() => {
    useCartStore.getState().reset();
  });

  it("starts empty", () => {
    const s = useCartStore.getState();
    expect(s.items).toEqual([]);
    expect(s.coupon).toBeNull();
    expect(s.subtotal()).toBe(0);
    expect(s.total()).toBe(0);
  });

  it("addItem adds a new line with product defaults applied", () => {
    useCartStore.getState().addItem("espresso", 2);
    const s = useCartStore.getState();
    expect(s.items).toHaveLength(1);
    expect(s.items[0]).toEqual({
      productId: "espresso",
      quantity: 2,
      options: { sweetness: "normal" },
    });
  });

  it("addItem merges quantity if product already in cart", () => {
    useCartStore.getState().addItem("espresso", 2);
    useCartStore.getState().addItem("espresso", 1);
    expect(useCartStore.getState().items).toEqual([
      {
        productId: "espresso",
        quantity: 3,
        options: { sweetness: "normal" },
      },
    ]);
  });

  it("addItem returns false for unknown product", () => {
    const ok = useCartStore.getState().addItem("ghost", 1);
    expect(ok).toBe(false);
  });

  it("removeItem deletes the line", () => {
    useCartStore.getState().addItem("espresso", 2);
    useCartStore.getState().removeItem("espresso");
    expect(useCartStore.getState().items).toEqual([]);
  });

  it("applyCoupon stores coupon code in uppercase", () => {
    useCartStore.getState().addItem("espresso", 2);
    const ok = useCartStore.getState().applyCoupon("benvenuto");
    expect(ok).toBe(true);
    expect(useCartStore.getState().coupon).toBe("BENVENUTO");
  });

  it("applyCoupon returns false for invalid", () => {
    const ok = useCartStore.getState().applyCoupon("NOPE");
    expect(ok).toBe(false);
    expect(useCartStore.getState().coupon).toBeNull();
  });

  it("subtotal sums items", () => {
    useCartStore.getState().addItem("espresso", 2); // 3.00
    useCartStore.getState().addItem("cappuccino", 1); // 2.50
    expect(useCartStore.getState().subtotal()).toBe(5.5);
  });

  it("total subtracts coupon discount", () => {
    useCartStore.getState().addItem("espresso", 2); // 3.00
    useCartStore.getState().applyCoupon("BENVENUTO"); // -0.30
    expect(useCartStore.getState().total()).toBeCloseTo(2.7, 2);
  });

  it("checkout returns success and clears cart", () => {
    useCartStore.getState().addItem("espresso", 2);
    const res = useCartStore.getState().checkout();
    expect(res.ok).toBe(true);
    expect(res.total).toBe(3.0);
    expect(useCartStore.getState().items).toEqual([]);
  });

  it("checkout fails on empty cart", () => {
    const res = useCartStore.getState().checkout();
    expect(res.ok).toBe(false);
  });

  it("logToolCall appends to activity log", () => {
    useCartStore.getState().logToolCall("add_to_cart", { product_id: "espresso", quantity: 2 }, "ok");
    expect(useCartStore.getState().activity).toHaveLength(1);
    expect(useCartStore.getState().activity[0].tool).toBe("add_to_cart");
  });

  it("reset clears everything", () => {
    useCartStore.getState().addItem("espresso", 1);
    useCartStore.getState().applyCoupon("BENVENUTO");
    useCartStore.getState().logToolCall("x", {}, "y");
    useCartStore.getState().reset();
    const s = useCartStore.getState();
    expect(s.items).toEqual([]);
    expect(s.coupon).toBeNull();
    expect(s.activity).toEqual([]);
  });

  it("addItem with different options creates a distinct line", () => {
    useCartStore.getState().addItem("cappuccino", 1);
    useCartStore.getState().addItem("cappuccino", 1, { size: "L" });
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(2);
    // first call: full defaults (M, milk-whole, normal)
    expect(items[0]).toEqual({
      productId: "cappuccino",
      quantity: 1,
      options: { size: "M", milk: "milk-whole", sweetness: "normal" },
    });
    // second call: L overrides default size; milk + sweetness still defaulted
    expect(items[1]).toEqual({
      productId: "cappuccino",
      quantity: 1,
      options: { size: "L", milk: "milk-whole", sweetness: "normal" },
    });
  });

  it("addItem with identical options merges quantity", () => {
    useCartStore.getState().addItem("cappuccino", 1, { size: "L", milk: "milk-oat" });
    useCartStore.getState().addItem("cappuccino", 2, { milk: "milk-oat", size: "L" });
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(3);
  });

  it("subtotal includes size and milk modifiers", () => {
    // cappuccino base 2.50, size L = +0.50, milk-oat = +0.50 -> 3.50
    useCartStore.getState().addItem("cappuccino", 2, { size: "L", milk: "milk-oat" });
    expect(useCartStore.getState().subtotal()).toBeCloseTo(7.0, 2);
  });

  it("subtotal handles size S and default milk gracefully", () => {
    // americano base 2.20, size S = +0 -> 2.20
    useCartStore.getState().addItem("americano", 1, { size: "S" });
    expect(useCartStore.getState().subtotal()).toBeCloseTo(2.2, 2);
  });
});

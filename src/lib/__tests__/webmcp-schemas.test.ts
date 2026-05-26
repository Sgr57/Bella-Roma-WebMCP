import { describe, it, expect, beforeEach } from "vitest";
import {
  buildProductCard,
  buildProductList,
  buildCart,
  buildMutationResult,
} from "../webmcp-schemas";
import { getProductById, PRODUCTS } from "../products";
import { useCartStore } from "../../store/cart";

describe("webmcp-schemas builders", () => {
  beforeEach(() => {
    useCartStore.getState().reset();
  });

  describe("buildProductCard", () => {
    it("returns product_card with full customization for cappuccino", () => {
      const card = buildProductCard(getProductById("cappuccino")!);
      expect(card.kind).toBe("product_card");
      expect(card.product.id).toBe("cappuccino");
      expect(card.product.image_url).toContain("/cappuccino.webp");
      expect(card.product.attributes.intensity).toEqual({ value: 6, scale: 10 });
      expect(card.product.customization?.milk).toBeDefined();
      expect(card.product.customization?.milk.options).toHaveLength(5);
      const soy = card.product.customization!.milk.options.find((o) => o.id === "milk-soy");
      expect(soy?.available).toBe(false);
      expect(soy?.alternatives).toEqual(["milk-oat", "milk-almond"]);
      expect(card.product.next_actions[0]).toMatchObject({
        tool: "add_to_cart",
        args_template: expect.objectContaining({ product_id: "cappuccino", quantity: 1 }),
      });
    });

    it("returns product_card without customization for filtro-etiopia", () => {
      const card = buildProductCard(getProductById("filtro-etiopia")!);
      expect(card.product.customization).toBeUndefined();
      expect(card.product.related_products).toEqual([
        {
          id: "beans-etiopia-250g",
          name: "Chicchi Etiopia 250g",
          price: 12.0,
          image_url: expect.stringContaining("/beans-etiopia-250g.webp"),
          relation: "take_home",
        },
      ]);
    });

    it("returns product_card with empty next_actions for milk_option", () => {
      const card = buildProductCard(getProductById("milk-whole")!);
      expect(card.product.next_actions).toEqual([]);
    });
  });

  describe("buildProductList", () => {
    it("returns product_list with items and query_summary", () => {
      const list = buildProductList(
        PRODUCTS.filter((p) => p.category === "filtro"),
        "categoria=filtro",
      );
      expect(list.kind).toBe("product_list");
      expect(list.query_summary).toBe("categoria=filtro");
      // 3 filtro-category products: americano, filtro-etiopia, filtro-colombia
      expect(list.total).toBe(3);
      const etiopia = list.items.find((i) => i.id === "filtro-etiopia");
      expect(etiopia).toBeDefined();
      expect(etiopia?.image_url).toContain("/filtro-etiopia.webp");
      expect(etiopia?.has_customization).toBe(false);
      expect(etiopia?.next_actions.map((a) => a.tool)).toEqual([
        "get_product",
        "add_to_cart",
      ]);
    });

    it("marks has_customization true for cappuccino", () => {
      const list = buildProductList(
        PRODUCTS.filter((p) => p.id === "cappuccino"),
        "id=cappuccino",
      );
      expect(list.items[0].has_customization).toBe(true);
      expect(list.items[0].next_actions.map((a) => a.tool)).toEqual(["get_product"]);
    });
  });

  describe("buildCart", () => {
    it("returns empty cart with empty:true and no next_actions for checkout", () => {
      const cart = buildCart();
      expect(cart.kind).toBe("cart");
      expect(cart.empty).toBe(true);
      expect(cart.lines).toEqual([]);
      expect(cart.subtotal).toBe(0);
      expect(cart.total).toBe(0);
      expect(cart.coupon).toBeNull();
      expect(cart.next_actions.find((a) => a.tool === "checkout")).toBeUndefined();
    });

    it("returns cart with lines, options_label, and coupon", () => {
      useCartStore.getState().addItem("cappuccino", 1, { size: "M", milk: "milk-oat" });
      useCartStore.getState().applyCoupon("BENVENUTO");
      const cart = buildCart();
      expect(cart.empty).toBe(false);
      expect(cart.lines).toHaveLength(1);
      expect(cart.lines[0].product_id).toBe("cappuccino");
      expect(cart.lines[0].options_label).toContain("avena");
      expect(cart.lines[0].unit_price).toBeGreaterThan(2.5);
      expect(cart.coupon).toEqual({
        code: "BENVENUTO",
        label: "10% di sconto sul totale",
        discount: expect.any(Number),
      });
      expect(cart.next_actions.find((a) => a.tool === "checkout")).toBeDefined();
    });
  });

  describe("buildMutationResult", () => {
    it("returns ok=true with message and cart", () => {
      useCartStore.getState().addItem("espresso", 1);
      const result = buildMutationResult({
        ok: true,
        tool: "add_to_cart",
        message: "Espresso aggiunto.",
      });
      expect(result.kind).toBe("mutation_result");
      expect(result.ok).toBe(true);
      expect(result.message).toBe("Espresso aggiunto.");
      expect(result.error).toBeUndefined();
      expect(result.cart.lines).toHaveLength(1);
    });

    it("returns ok=false with error and unchanged cart", () => {
      const result = buildMutationResult({
        ok: false,
        tool: "add_to_cart",
        error: {
          code: "out_of_stock",
          message: "Latte di soia esaurito",
          alternatives: [{ id: "milk-oat", label: "Avena", price_delta: 0.5 }],
        },
      });
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("out_of_stock");
      expect(result.error?.alternatives).toHaveLength(1);
      expect(result.message).toBeUndefined();
      expect(result.cart.empty).toBe(true);
    });
  });
});

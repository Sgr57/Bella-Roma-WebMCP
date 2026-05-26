import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildTools } from "../webmcp";
import { useCartStore } from "../../store/cart";

const fakeAgent = {
  requestUserInteraction: vi.fn(async (fn: () => unknown) => fn()),
};

function findTool(name: string) {
  const t = buildTools().find((x) => x.name === name);
  if (!t) throw new Error(`tool ${name} not found`);
  return t;
}

describe("WebMCP tools", () => {
  beforeEach(() => {
    useCartStore.getState().reset();
    fakeAgent.requestUserInteraction.mockClear();
  });

  it("exposes exactly 9 tools", () => {
    expect(buildTools()).toHaveLength(9);
  });

  it("search_products returns all products when no filter", async () => {
    const res = await findTool("search_products").execute({}, fakeAgent);
    expect(res.isError).toBeFalsy();
    const list = res.structuredContent as { items: Array<{ name: string }> };
    expect(list.items.map((i) => i.name)).toContain("Espresso Classico");
  });

  it("search_products filters by category", async () => {
    const res = await findTool("search_products").execute(
      { category: "filtro" },
      fakeAgent,
    );
    const list = res.structuredContent as { items: Array<{ name: string }> };
    const names = list.items.map((i) => i.name);
    expect(names).toContain("Filtro Etiopia");
    expect(names).not.toContain("Cappuccino");
  });

  it("search_products filters by max_price", async () => {
    const res = await findTool("search_products").execute(
      { max_price: 2 },
      fakeAgent,
    );
    const list = res.structuredContent as { items: Array<{ name: string }> };
    const names = list.items.map((i) => i.name);
    expect(names).toContain("Espresso Classico");
    expect(names).not.toContain("Filtro Etiopia");
  });

  it("search_products returns structuredContent product_list", async () => {
    const res = await findTool("search_products").execute(
      { category: "filtro" },
      fakeAgent,
    );
    expect(res.structuredContent).toMatchObject({
      kind: "product_list",
      query_summary: expect.stringContaining("category=filtro"),
      items: expect.arrayContaining([
        expect.objectContaining({
          id: "filtro-etiopia",
          image_url: expect.stringContaining("/filtro-etiopia.webp"),
          has_customization: false,
        }),
      ]),
    });
  });

  it("search_products has_customization is true for items with options", async () => {
    const res = await findTool("search_products").execute(
      { query: "cappuccino" },
      fakeAgent,
    );
    const list = res.structuredContent as {
      items: Array<{ id: string; has_customization: boolean }>;
    };
    const cap = list.items.find((i) => i.id === "cappuccino");
    expect(cap?.has_customization).toBe(true);
  });

  it("add_to_cart adds product and logs activity", async () => {
    const res = await findTool("add_to_cart").execute(
      { product_id: "espresso", quantity: 2 },
      fakeAgent
    );
    expect(res.isError).toBeFalsy();
    expect(useCartStore.getState().items).toEqual([
      {
        productId: "espresso",
        quantity: 2,
        options: { sweetness: "normal" },
      },
    ]);
    expect(useCartStore.getState().activity).toHaveLength(1);
  });

  it("add_to_cart errors on unknown product", async () => {
    const res = await findTool("add_to_cart").execute(
      { product_id: "ghost", quantity: 1 },
      fakeAgent,
    );
    expect(res.isError).toBe(true);
    expect(res.structuredContent).toMatchObject({
      kind: "mutation_result",
      ok: false,
      error: expect.objectContaining({ code: "product_not_found" }),
    });
  });

  it("add_to_cart returns mutation_result ok=true with embedded cart", async () => {
    const res = await findTool("add_to_cart").execute(
      { product_id: "espresso", quantity: 1 },
      fakeAgent,
    );
    expect(res.structuredContent).toMatchObject({
      kind: "mutation_result",
      ok: true,
      tool: "add_to_cart",
      message: expect.stringContaining("Espresso"),
      cart: expect.objectContaining({ kind: "cart", empty: false }),
    });
    expect(res.isError).toBeFalsy();
  });

  it("add_to_cart returns mutation_result ok=false with error.code=out_of_stock for soy milk", async () => {
    const res = await findTool("add_to_cart").execute(
      { product_id: "cappuccino", quantity: 1, options: { milk: "milk-soy" } },
      fakeAgent,
    );
    expect(res.structuredContent).toMatchObject({
      kind: "mutation_result",
      ok: false,
      tool: "add_to_cart",
      error: expect.objectContaining({
        code: "out_of_stock",
        alternatives: expect.arrayContaining([
          expect.objectContaining({ id: "milk-oat" }),
        ]),
      }),
    });
    expect(res.isError).toBe(true);
  });

  it("add_to_cart returns error.code=quantity_out_of_range for qty=0", async () => {
    const res = await findTool("add_to_cart").execute(
      { product_id: "espresso", quantity: 0 },
      fakeAgent,
    );
    expect(res.structuredContent).toMatchObject({
      kind: "mutation_result",
      ok: false,
      error: expect.objectContaining({ code: "quantity_out_of_range" }),
    });
  });

  it("add_to_cart returns error.code=invalid_option when adding a milk_option directly", async () => {
    const res = await findTool("add_to_cart").execute(
      { product_id: "milk-oat", quantity: 1 },
      fakeAgent,
    );
    expect(res.structuredContent).toMatchObject({
      ok: false,
      error: expect.objectContaining({ code: "invalid_option" }),
    });
  });

  it("remove_from_cart removes item", async () => {
    useCartStore.getState().addItem("espresso", 2);
    const res = await findTool("remove_from_cart").execute(
      { product_id: "espresso" },
      fakeAgent
    );
    expect(res.isError).toBeFalsy();
    expect(useCartStore.getState().items).toEqual([]);
  });

  it("remove_from_cart returns mutation_result ok=true with cart updated", async () => {
    await findTool("add_to_cart").execute({ product_id: "espresso", quantity: 1 }, fakeAgent);
    const res = await findTool("remove_from_cart").execute({ product_id: "espresso" }, fakeAgent);
    expect(res.structuredContent).toMatchObject({
      kind: "mutation_result",
      ok: true,
      tool: "remove_from_cart",
      cart: expect.objectContaining({ empty: true }),
    });
  });

  it("remove_from_cart returns error.code=not_in_cart when missing", async () => {
    const res = await findTool("remove_from_cart").execute({ product_id: "espresso" }, fakeAgent);
    expect(res.structuredContent).toMatchObject({
      ok: false,
      error: expect.objectContaining({ code: "not_in_cart" }),
    });
  });

  it("apply_coupon applies BENVENUTO", async () => {
    useCartStore.getState().addItem("espresso", 10);
    const res = await findTool("apply_coupon").execute(
      { code: "BENVENUTO" },
      fakeAgent
    );
    expect(res.isError).toBeFalsy();
    expect(useCartStore.getState().coupon).toBe("BENVENUTO");
  });

  it("apply_coupon errors on invalid code", async () => {
    const res = await findTool("apply_coupon").execute(
      { code: "NOPE" },
      fakeAgent
    );
    expect(res.isError).toBe(true);
  });

  it("apply_coupon returns mutation_result with coupon in embedded cart", async () => {
    useCartStore.getState().addItem("espresso", 1);
    const res = await findTool("apply_coupon").execute({ code: "BENVENUTO" }, fakeAgent);
    expect(res.structuredContent).toMatchObject({
      kind: "mutation_result",
      ok: true,
      tool: "apply_coupon",
      cart: expect.objectContaining({
        coupon: expect.objectContaining({ code: "BENVENUTO" }),
      }),
    });
  });

  it("apply_coupon returns error.code=invalid_coupon for unknown code", async () => {
    const res = await findTool("apply_coupon").execute({ code: "INVALID" }, fakeAgent);
    expect(res.structuredContent).toMatchObject({
      ok: false,
      error: expect.objectContaining({ code: "invalid_coupon" }),
    });
  });

  it("remove_coupon returns mutation_result with coupon=null", async () => {
    useCartStore.getState().addItem("espresso", 1);
    await findTool("apply_coupon").execute({ code: "BENVENUTO" }, fakeAgent);
    const res = await findTool("remove_coupon").execute({}, fakeAgent);
    expect(res.structuredContent).toMatchObject({
      ok: true,
      tool: "remove_coupon",
      cart: expect.objectContaining({ coupon: null }),
    });
  });

  it("clear_cart returns mutation_result with empty cart", async () => {
    await findTool("add_to_cart").execute({ product_id: "espresso", quantity: 1 }, fakeAgent);
    const res = await findTool("clear_cart").execute({}, fakeAgent);
    expect(res.structuredContent).toMatchObject({
      ok: true,
      tool: "clear_cart",
      cart: expect.objectContaining({ empty: true }),
    });
  });

  it("get_cart returns current state", async () => {
    useCartStore.getState().addItem("espresso", 2);
    const res = await findTool("get_cart").execute({}, fakeAgent);
    expect(res.isError).toBeFalsy();
    const cart = res.structuredContent as {
      lines: Array<{ product_id: string; quantity: number; line_total: number }>;
      total: number;
    };
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].product_id).toBe("espresso");
    expect(cart.lines[0].quantity).toBe(2);
    expect(cart.total).toBeCloseTo(3.0, 2);
  });

  it("get_cart returns structuredContent cart (empty)", async () => {
    const res = await findTool("get_cart").execute({}, fakeAgent);
    expect(res.structuredContent).toMatchObject({
      kind: "cart",
      empty: true,
      lines: [],
      subtotal: 0,
      total: 0,
      coupon: null,
    });
  });

  it("get_cart returns structuredContent cart with lines after add", async () => {
    await findTool("add_to_cart").execute(
      { product_id: "espresso", quantity: 1 },
      fakeAgent,
    );
    const res = await findTool("get_cart").execute({}, fakeAgent);
    const cart = res.structuredContent as { lines: unknown[]; empty: boolean };
    expect(cart.empty).toBe(false);
    expect(cart.lines).toHaveLength(1);
  });

  it("checkout requests user interaction and succeeds when confirmed", async () => {
    useCartStore.getState().addItem("espresso", 2);
    fakeAgent.requestUserInteraction.mockImplementationOnce(async () => true);
    const res = await findTool("checkout").execute({}, fakeAgent);
    expect(fakeAgent.requestUserInteraction).toHaveBeenCalledOnce();
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text.toLowerCase()).toContain("confermato");
    expect(useCartStore.getState().items).toEqual([]);
  });

  it("checkout returns user_cancelled mutation_result when user rejects", async () => {
    useCartStore.getState().addItem("espresso", 2);
    fakeAgent.requestUserInteraction.mockImplementationOnce(async () => false);
    const res = await findTool("checkout").execute({}, fakeAgent);
    expect(res.isError).toBe(true);
    expect(res.structuredContent).toMatchObject({
      ok: false,
      error: expect.objectContaining({ code: "user_cancelled" }),
    });
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it("checkout errors on empty cart", async () => {
    const res = await findTool("checkout").execute({}, fakeAgent);
    expect(res.isError).toBe(true);
    expect(res.structuredContent).toMatchObject({
      ok: false,
      error: expect.objectContaining({ code: "empty_cart" }),
    });
  });

  it("checkout returns mutation_result ok=true on confirmed payment", async () => {
    await findTool("add_to_cart").execute({ product_id: "espresso", quantity: 1 }, fakeAgent);
    fakeAgent.requestUserInteraction.mockImplementationOnce(async () => true);
    const res = await findTool("checkout").execute({}, fakeAgent);
    expect(res.structuredContent).toMatchObject({
      kind: "mutation_result",
      ok: true,
      tool: "checkout",
      message: expect.stringContaining("Ordine confermato"),
      cart: expect.objectContaining({ empty: true }),
    });
  });

  it("checkout returns mutation_result ok=false error.code=empty_cart on empty", async () => {
    const res = await findTool("checkout").execute({}, fakeAgent);
    expect(res.structuredContent).toMatchObject({
      kind: "mutation_result",
      ok: false,
      tool: "checkout",
      error: expect.objectContaining({ code: "empty_cart" }),
    });
  });

  it("checkout returns mutation_result ok=false error.code=user_cancelled when user rejects", async () => {
    await findTool("add_to_cart").execute({ product_id: "espresso", quantity: 1 }, fakeAgent);
    const reject = {
      requestUserInteraction: vi.fn(async () => false),
    };
    const res = await findTool("checkout").execute({}, reject);
    expect(res.structuredContent).toMatchObject({
      ok: false,
      error: expect.objectContaining({ code: "user_cancelled" }),
    });
  });

  it("search_products excludes milk_option by default", async () => {
    const res = await findTool("search_products").execute({}, fakeAgent);
    const list = res.structuredContent as { items: Array<{ id: string; name: string }> };
    const ids = list.items.map((i) => i.id);
    const names = list.items.map((i) => i.name);
    expect(ids).not.toContain("milk-whole");
    expect(names).not.toContain("Latte intero");
  });

  it("search_products filters by type=beans", async () => {
    const res = await findTool("search_products").execute(
      { type: "beans" },
      fakeAgent,
    );
    const list = res.structuredContent as { items: Array<{ name: string }> };
    const names = list.items.map((i) => i.name);
    expect(names.some((n) => n.includes("Chicchi Etiopia"))).toBe(true);
    expect(names).not.toContain("Cappuccino");
  });

  it("search_products filters by dietary contains all", async () => {
    const res = await findTool("search_products").execute(
      { dietary: ["no-caffeine"] },
      fakeAgent,
    );
    const list = res.structuredContent as { items: Array<{ name: string }> };
    const names = list.items.map((i) => i.name);
    expect(names).toContain("Decaffeinato");
    expect(names).not.toContain("Espresso Classico");
  });

  it("search_products filters by flavor_notes contains all", async () => {
    const res = await findTool("search_products").execute(
      { flavor_notes: ["fruity"] },
      fakeAgent,
    );
    const list = res.structuredContent as { items: Array<{ name: string }> };
    const names = list.items.map((i) => i.name);
    expect(names).toContain("Filtro Etiopia");
    expect(names).not.toContain("Espresso Classico");
  });

  it("search_products filters by intensity_max", async () => {
    const res = await findTool("search_products").execute(
      { intensity_max: 4 },
      fakeAgent,
    );
    const list = res.structuredContent as { items: Array<{ name: string }> };
    const names = list.items.map((i) => i.name);
    expect(names).toContain("Decaffeinato");
    expect(names).not.toContain("Doppio Espresso");
  });

  it("search_products filters by origin", async () => {
    const res = await findTool("search_products").execute(
      { origin: "Etiopia" },
      fakeAgent,
    );
    const list = res.structuredContent as { items: Array<{ name: string }> };
    const names = list.items.map((i) => i.name);
    expect(names).toContain("Filtro Etiopia");
    expect(names.some((n) => n.includes("Chicchi Etiopia"))).toBe(true);
    expect(names).not.toContain("Cappuccino");
  });

  it("search_products in_stock_only=true hides unavailable", async () => {
    const res = await findTool("search_products").execute(
      { type: "milk_option", in_stock_only: true },
      fakeAgent,
    );
    const list = res.structuredContent as { items: Array<{ name: string }> };
    const names = list.items.map((i) => i.name);
    expect(names).not.toContain("Latte di soia");
    expect(names).toContain("Latte d'avena");
  });

  it("get_product returns rich details for existing product", async () => {
    const res = await findTool("get_product").execute(
      { product_id: "cappuccino" },
      fakeAgent,
    );
    expect(res.isError).toBeFalsy();
    const card = res.structuredContent as {
      product: {
        name: string;
        attributes: { intensity?: { value: number } };
        pairings: Array<{ id: string }>;
        customization?: Record<string, unknown>;
      };
    };
    expect(card.product.name).toContain("Cappuccino");
    expect(card.product.attributes.intensity?.value).toBeGreaterThan(0);
    expect(card.product.pairings.map((p) => p.id)).toContain("cornetto-vuoto");
    expect(card.product.customization?.milk).toBeDefined();
  });

  it("get_product flags out of stock with alternatives", async () => {
    const res = await findTool("get_product").execute(
      { product_id: "milk-soy" },
      fakeAgent,
    );
    expect(res.isError).toBeFalsy();
    const card = res.structuredContent as {
      product: { available: boolean; alternatives: Array<{ id: string }> };
    };
    expect(card.product.available).toBe(false);
    const altIds = card.product.alternatives.map((a) => a.id);
    expect(altIds).toContain("milk-oat");
    expect(altIds).toContain("milk-almond");
  });

  it("get_product surfaces related_products for cross-modal", async () => {
    const res = await findTool("get_product").execute(
      { product_id: "filtro-etiopia" },
      fakeAgent,
    );
    const card = res.structuredContent as {
      product: { related_products: Array<{ id: string }> };
    };
    expect(card.product.related_products.map((r) => r.id)).toContain("beans-etiopia-250g");
  });

  it("get_product returns error for unknown id", async () => {
    const res = await findTool("get_product").execute(
      { product_id: "ghost" },
      fakeAgent,
    );
    expect(res.isError).toBe(true);
  });

  it("get_product returns structuredContent product_card with customization", async () => {
    const res = await findTool("get_product").execute(
      { product_id: "cappuccino" },
      fakeAgent,
    );
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toBeDefined();
    expect(res.structuredContent).toMatchObject({
      kind: "product_card",
      product: expect.objectContaining({
        id: "cappuccino",
        image_url: expect.stringContaining("/cappuccino.webp"),
        customization: expect.objectContaining({
          milk: expect.objectContaining({ default: "milk-whole" }),
        }),
      }),
    });
    expect(res.content[0].type).toBe("text");
    expect((res.content[0] as { text: string }).text).toContain("Cappuccino");
  });

  it("get_product missing product has no structuredContent and isError", async () => {
    const res = await findTool("get_product").execute(
      { product_id: "nonexistent" },
      fakeAgent,
    );
    expect(res.isError).toBe(true);
    expect(res.structuredContent).toBeUndefined();
  });

  it("add_to_cart accepts options and stores them on the line", async () => {
    const res = await findTool("add_to_cart").execute(
      {
        product_id: "cappuccino",
        quantity: 1,
        options: { size: "L", milk: "milk-oat", sweetness: "none" },
      },
      fakeAgent,
    );
    expect(res.isError).toBeFalsy();
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].options).toEqual({
      size: "L",
      milk: "milk-oat",
      sweetness: "none",
    });
  });

  it("add_to_cart errors with alternatives when milk option is OOS", async () => {
    const res = await findTool("add_to_cart").execute(
      {
        product_id: "cappuccino",
        quantity: 1,
        options: { milk: "milk-soy" },
      },
      fakeAgent,
    );
    expect(res.isError).toBe(true);
    const t = res.content[0].text;
    expect(t.toLowerCase()).toMatch(/esaurit[ao]/);
    const altIds = (
      (res.structuredContent as { error?: { alternatives?: Array<{ id: string }> } })
        ?.error?.alternatives ?? []
    ).map((a) => a.id);
    expect(altIds).toContain("milk-oat");
    expect(altIds).toContain("milk-almond");
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("add_to_cart errors when option is not offered by the product", async () => {
    const res = await findTool("add_to_cart").execute(
      {
        product_id: "espresso",
        quantity: 1,
        options: { milk: "milk-oat" },
      },
      fakeAgent,
    );
    expect(res.isError).toBe(true);
    expect(res.content[0].text.toLowerCase()).toContain("non offre");
  });

  it("add_to_cart rejects milk_option products as modifiers", async () => {
    const res = await findTool("add_to_cart").execute(
      { product_id: "milk-oat", quantity: 1 },
      fakeAgent,
    );
    expect(res.isError).toBe(true);
    expect(res.content[0].text.toLowerCase()).toContain("modificatore");
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("add_to_cart rejects non-integer quantity", async () => {
    const res = await findTool("add_to_cart").execute(
      { product_id: "espresso", quantity: 2.5 },
      fakeAgent,
    );
    expect(res.isError).toBe(true);
    expect(res.content[0].text.toLowerCase()).toContain("intero");
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("add_to_cart rejects string quantity", async () => {
    const res = await findTool("add_to_cart").execute(
      { product_id: "espresso", quantity: "due" },
      fakeAgent,
    );
    expect(res.isError).toBe(true);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("add_to_cart rejects quantity > 10", async () => {
    const res = await findTool("add_to_cart").execute(
      { product_id: "espresso", quantity: 11 },
      fakeAgent,
    );
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("1-10");
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("add_to_cart rejects missing quantity", async () => {
    const res = await findTool("add_to_cart").execute(
      { product_id: "espresso" },
      fakeAgent,
    );
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("quantity");
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("add_to_cart enforces cumulative max across calls", async () => {
    const first = await findTool("add_to_cart").execute(
      { product_id: "espresso", quantity: 6 },
      fakeAgent,
    );
    expect(first.isError).toBeFalsy();
    const second = await findTool("add_to_cart").execute(
      { product_id: "espresso", quantity: 6 },
      fakeAgent,
    );
    expect(second.isError).toBe(true);
    expect(second.content[0].text).toContain("Limite");
    expect(second.structuredContent).toMatchObject({
      kind: "mutation_result",
      ok: false,
      error: expect.objectContaining({ code: "line_quantity_limit" }),
    });
    expect(useCartStore.getState().items[0].quantity).toBe(6);
  });

  it("get_product is case-insensitive on product_id", async () => {
    const res = await findTool("get_product").execute(
      { product_id: "ESPRESSO" },
      fakeAgent,
    );
    expect(res.isError).toBeFalsy();
    const card = res.structuredContent as { product: { id: string } };
    expect(card.product.id).toBe("espresso");
  });

  it("remove_from_cart with options removes the specific line", async () => {
    useCartStore.getState().addItem("cappuccino", 1, { milk: "milk-oat" });
    useCartStore.getState().addItem("cappuccino", 1, { milk: "milk-almond" });
    const res = await findTool("remove_from_cart").execute(
      { product_id: "cappuccino", options: { milk: "milk-oat" } },
      fakeAgent,
    );
    expect(res.isError).toBeFalsy();
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].options?.milk).toBe("milk-almond");
  });

  it("apply_coupon reports the overwritten coupon", async () => {
    useCartStore.getState().addItem("espresso", 2);
    await findTool("apply_coupon").execute({ code: "BENVENUTO" }, fakeAgent);
    const res = await findTool("apply_coupon").execute(
      { code: "STUDENTI" },
      fakeAgent,
    );
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("sostituisce BENVENUTO");
  });

  it("clear_cart empties items and coupon", async () => {
    useCartStore.getState().addItem("espresso", 2);
    useCartStore.getState().applyCoupon("BENVENUTO");
    const res = await findTool("clear_cart").execute({}, fakeAgent);
    expect(res.isError).toBeFalsy();
    expect(useCartStore.getState().items).toEqual([]);
    expect(useCartStore.getState().coupon).toBeNull();
  });

  it("remove_coupon clears active coupon", async () => {
    useCartStore.getState().addItem("espresso", 1);
    useCartStore.getState().applyCoupon("BENVENUTO");
    const res = await findTool("remove_coupon").execute({}, fakeAgent);
    expect(res.isError).toBeFalsy();
    expect(useCartStore.getState().coupon).toBeNull();
  });
});

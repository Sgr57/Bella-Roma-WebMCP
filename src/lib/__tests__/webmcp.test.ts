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

  it("exposes exactly 10 tools", () => {
    expect(buildTools()).toHaveLength(10);
  });

  it("show_product_image returns text + resource_link to public jpeg", async () => {
    const res = await findTool("show_product_image").execute(
      { product_id: "espresso" },
      fakeAgent,
    );
    expect(res.isError).toBeFalsy();
    expect(res.content).toHaveLength(2);
    expect(res.content[0]).toMatchObject({ type: "text" });
    expect(res.content[1]).toMatchObject({
      type: "resource_link",
      uri: "https://bella-roma-web-mcp.vercel.app/products/editorial/espresso.jpeg",
      mimeType: "image/jpeg",
    });
  });

  it("show_product_image rejects unknown product", async () => {
    const res = await findTool("show_product_image").execute(
      { product_id: "nonexistent" },
      fakeAgent,
    );
    expect(res.isError).toBe(true);
  });

  it("search_products returns all products when no filter", async () => {
    const res = await findTool("search_products").execute({}, fakeAgent);
    expect(res.isError).toBeFalsy();
    const text = res.content[0].text;
    expect(text).toContain("Espresso Classico");
  });

  it("search_products filters by category", async () => {
    const res = await findTool("search_products").execute(
      { category: "filtro" },
      fakeAgent
    );
    expect(res.content[0].text).toContain("Filtro Etiopia");
    expect(res.content[0].text).not.toContain("Cappuccino");
  });

  it("search_products filters by max_price", async () => {
    const res = await findTool("search_products").execute(
      { max_price: 2 },
      fakeAgent
    );
    expect(res.content[0].text).toContain("Espresso Classico");
    expect(res.content[0].text).not.toContain("Filtro Etiopia");
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
      fakeAgent
    );
    expect(res.isError).toBe(true);
    expect(res.content[0].text.toLowerCase()).toContain("non trovato");
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

  it("get_cart returns current state", async () => {
    useCartStore.getState().addItem("espresso", 2);
    const res = await findTool("get_cart").execute({}, fakeAgent);
    expect(res.content[0].text).toContain("Espresso Classico");
    expect(res.content[0].text).toContain("3.00");
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

  it("checkout returns non-error message when user cancels", async () => {
    useCartStore.getState().addItem("espresso", 2);
    fakeAgent.requestUserInteraction.mockImplementationOnce(async () => false);
    const res = await findTool("checkout").execute({}, fakeAgent);
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text.toLowerCase()).toContain("annullato");
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it("checkout errors on empty cart", async () => {
    const res = await findTool("checkout").execute({}, fakeAgent);
    expect(res.isError).toBe(true);
  });

  it("search_products excludes milk_option by default", async () => {
    const res = await findTool("search_products").execute({}, fakeAgent);
    expect(res.content[0].text).not.toContain("milk-whole");
    expect(res.content[0].text).not.toContain("Latte intero");
  });

  it("search_products filters by type=beans", async () => {
    const res = await findTool("search_products").execute(
      { type: "beans" },
      fakeAgent,
    );
    expect(res.content[0].text).toContain("Chicchi Etiopia");
    expect(res.content[0].text).not.toContain("Cappuccino");
  });

  it("search_products filters by dietary contains all", async () => {
    const res = await findTool("search_products").execute(
      { dietary: ["no-caffeine"] },
      fakeAgent,
    );
    expect(res.content[0].text).toContain("Decaffeinato");
    expect(res.content[0].text).not.toContain("Espresso Classico");
  });

  it("search_products filters by flavor_notes contains all", async () => {
    const res = await findTool("search_products").execute(
      { flavor_notes: ["fruity"] },
      fakeAgent,
    );
    expect(res.content[0].text).toContain("Filtro Etiopia");
    expect(res.content[0].text).not.toContain("Espresso Classico");
  });

  it("search_products filters by intensity_max", async () => {
    const res = await findTool("search_products").execute(
      { intensity_max: 4 },
      fakeAgent,
    );
    expect(res.content[0].text).toContain("Decaffeinato");
    expect(res.content[0].text).not.toContain("Doppio Espresso");
  });

  it("search_products filters by origin", async () => {
    const res = await findTool("search_products").execute(
      { origin: "Etiopia" },
      fakeAgent,
    );
    expect(res.content[0].text).toContain("Filtro Etiopia");
    expect(res.content[0].text).toContain("Chicchi Etiopia");
    expect(res.content[0].text).not.toContain("Cappuccino");
  });

  it("search_products in_stock_only=true hides unavailable", async () => {
    const res = await findTool("search_products").execute(
      { type: "milk_option", in_stock_only: true },
      fakeAgent,
    );
    expect(res.content[0].text).not.toContain("Latte di soia");
    expect(res.content[0].text).toContain("Latte d'avena");
  });

  it("get_product returns rich details for existing product", async () => {
    const res = await findTool("get_product").execute(
      { product_id: "cappuccino" },
      fakeAgent,
    );
    expect(res.isError).toBeFalsy();
    const t = res.content[0].text;
    expect(t).toContain("Cappuccino");
    expect(t).toContain("Intensità");
    expect(t).toContain("cornetto-vuoto");
    expect(t).toContain("Latte");
  });

  it("get_product flags out of stock with alternatives", async () => {
    const res = await findTool("get_product").execute(
      { product_id: "milk-soy" },
      fakeAgent,
    );
    expect(res.isError).toBeFalsy();
    const t = res.content[0].text;
    expect(t.toLowerCase()).toMatch(/esaurit[ao]/);
    expect(t).toContain("milk-oat");
    expect(t).toContain("milk-almond");
  });

  it("get_product surfaces related_products for cross-modal", async () => {
    const res = await findTool("get_product").execute(
      { product_id: "filtro-etiopia" },
      fakeAgent,
    );
    expect(res.content[0].text).toContain("beans-etiopia-250g");
  });

  it("get_product returns error for unknown id", async () => {
    const res = await findTool("get_product").execute(
      { product_id: "ghost" },
      fakeAgent,
    );
    expect(res.isError).toBe(true);
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
    expect(t).toContain("milk-oat");
    expect(t).toContain("milk-almond");
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
    expect(useCartStore.getState().items[0].quantity).toBe(6);
  });

  it("get_product is case-insensitive on product_id", async () => {
    const res = await findTool("get_product").execute(
      { product_id: "ESPRESSO" },
      fakeAgent,
    );
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("Espresso Classico");
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

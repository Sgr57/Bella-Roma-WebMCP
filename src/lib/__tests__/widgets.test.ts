import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildTools, __resetWidgetStateForTests } from "../webmcp";
import {
  buildCartPanelHtml,
  buildProductCardHtml,
  buildProductGridHtml,
  cartPanelUri,
  productCardUri,
  productGridUri,
  WIDGET_MIME_TYPE,
} from "../widgets";
import { PRODUCTS, getProductById } from "../products";
import { useCartStore } from "../../store/cart";

const fakeAgent = {
  requestUserInteraction: vi.fn(async (fn: () => unknown) => fn()),
};

function findTool(name: string) {
  const t = buildTools().find((x) => x.name === name);
  if (!t) throw new Error(`tool ${name} not found`);
  return t;
}

describe("MCP Apps widgets — `_meta.ui.resourceUri` on tools", () => {
  beforeEach(() => {
    useCartStore.getState().reset();
    __resetWidgetStateForTests();
  });

  it("search_products carries the product-grid resourceUri", () => {
    const t = findTool("search_products");
    expect(t._meta?.ui?.resourceUri).toBe("ui://bellaroma/product-grid");
    expect(t._meta?.ui?.resourceUri).toBe(productGridUri());
  });

  it("get_product carries the product-card resourceUri", () => {
    const t = findTool("get_product");
    expect(t._meta?.ui?.resourceUri).toBe("ui://bellaroma/product-card");
    expect(t._meta?.ui?.resourceUri).toBe(productCardUri());
  });

  it("get_cart carries the cart-panel resourceUri", () => {
    const t = findTool("get_cart");
    expect(t._meta?.ui?.resourceUri).toBe("ui://bellaroma/cart-panel");
    expect(t._meta?.ui?.resourceUri).toBe(cartPanelUri());
  });

  it("no other tool carries a resourceUri (only 3 widgets per spec)", () => {
    const withMeta = buildTools().filter((t) => t._meta?.ui?.resourceUri);
    expect(withMeta.map((t) => t.name).sort()).toEqual([
      "get_cart",
      "get_product",
      "search_products",
    ]);
  });
});

describe("MCP Apps widgets — fallback graceful (HARD MERGE REQUIREMENT)", () => {
  beforeEach(() => {
    useCartStore.getState().reset();
    __resetWidgetStateForTests();
  });

  it("search_products still returns text content (no _meta side-effects on result)", async () => {
    const res = await findTool("search_products").execute({ category: "filtro" }, fakeAgent);
    expect(res.isError).toBeFalsy();
    expect(res.content[0]).toMatchObject({ type: "text" });
    expect(typeof res.content[0].text).toBe("string");
    expect(res.content[0].text!.length).toBeGreaterThan(0);
  });

  it("get_product still returns text content with product details", async () => {
    const res = await findTool("get_product").execute(
      { product_id: "cappuccino" },
      fakeAgent,
    );
    expect(res.isError).toBeFalsy();
    expect(res.content[0]).toMatchObject({ type: "text" });
    expect(res.content[0].text).toContain("Cappuccino");
  });

  it("get_cart still returns text content with totals", async () => {
    useCartStore.getState().addItem("espresso", 1);
    const res = await findTool("get_cart").execute({}, fakeAgent);
    expect(res.isError).toBeFalsy();
    expect(res.content[0]).toMatchObject({ type: "text" });
    expect(res.content[0].text).toContain("Espresso Classico");
    expect(res.content[0].text).toContain("Subtotale");
  });

  it("show_product_image (deprecated but kept) still returns resource_link", async () => {
    const res = await findTool("show_product_image").execute(
      { product_id: "cappuccino" },
      fakeAgent,
    );
    expect(res.isError).toBeFalsy();
    expect(res.content).toHaveLength(2);
    expect(res.content[1]).toMatchObject({
      type: "resource_link",
      mimeType: "image/webp",
    });
  });
});

describe("MCP Apps widgets — HTML providers", () => {
  it("product-grid HTML mentions every product passed in", () => {
    const cappuccino = getProductById("cappuccino")!;
    const espresso = getProductById("espresso")!;
    const html = buildProductGridHtml([cappuccino, espresso], "test");
    expect(html).toContain("Cappuccino");
    expect(html).toContain("Espresso");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("data-product-id=\"cappuccino\"");
    expect(html).toContain("data-product-id=\"espresso\"");
    // Bridge JS is embedded.
    expect(html).toContain("function callTool");
  });

  it("product-grid HTML escapes the query label", () => {
    const html = buildProductGridHtml([], '"><script>alert(1)</script>');
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("product-card HTML renders configurator buttons for customizable drinks", () => {
    const cappuccino = getProductById("cappuccino")!;
    const html = buildProductCardHtml(cappuccino);
    expect(html).toContain("Cappuccino");
    // Size buttons.
    expect(html).toContain('data-group="size"');
    expect(html).toContain('data-value="S"');
    expect(html).toContain('data-value="L"');
    // The "Aggiungi" CTA is present.
    expect(html).toContain('id="card-add"');
  });

  it("cart-panel HTML renders rows for current cart items", () => {
    useCartStore.getState().reset();
    useCartStore.getState().addItem("espresso", 2);
    const snap = {
      items: useCartStore.getState().items,
      coupon: useCartStore.getState().coupon,
      subtotal: useCartStore.getState().subtotal(),
      discount: useCartStore.getState().discount(),
      total: useCartStore.getState().total(),
    };
    const html = buildCartPanelHtml(snap);
    expect(html).toContain("Espresso Classico");
    expect(html).toContain("cart-step");
    expect(html).toContain("cart-checkout");
  });

  it("cart-panel HTML shows empty state when cart is empty", () => {
    const snap = {
      items: [],
      coupon: null,
      subtotal: 0,
      discount: 0,
      total: 0,
    };
    const html = buildCartPanelHtml(snap);
    expect(html).toContain("Il carrello è vuoto.");
    // Checkout disabled in empty state.
    expect(html).toMatch(/cart-checkout[^>]*disabled/);
  });
});

describe("MCP Apps widgets — provider integration via navigator.modelContext.resources", () => {
  beforeEach(() => {
    useCartStore.getState().reset();
    __resetWidgetStateForTests();
  });

  it("registerTools registers 3 widget resources when polyfill exposes resources namespace", async () => {
    const registered = new Map<string, { provider: () => unknown; options: unknown }>();
    const fakeMc = {
      registerTool: vi.fn().mockResolvedValue(undefined),
      getTools: vi.fn().mockReturnValue([]),
      resources: {
        register: vi.fn(
          (uri: string, provider: () => unknown, options: unknown) => {
            registered.set(uri, { provider, options });
          },
        ),
        unregister: vi.fn(),
      },
    };
    // Inject a synthetic navigator.modelContext for this test.
    const prev = (globalThis as { navigator?: { modelContext?: unknown } })
      .navigator?.modelContext;
    Object.defineProperty(navigator, "modelContext", {
      configurable: true,
      value: fakeMc,
    });

    const { registerTools, __resetForTests } = await import("../webmcp");
    __resetForTests?.();
    await registerTools();

    expect(registered.has("ui://bellaroma/product-grid")).toBe(true);
    expect(registered.has("ui://bellaroma/product-card")).toBe(true);
    expect(registered.has("ui://bellaroma/cart-panel")).toBe(true);

    // Each provider, when invoked, returns a valid MCP App HTML result.
    for (const [uri, { provider }] of registered) {
      const out = (await provider()) as {
        text?: string;
        mimeType?: string;
        meta?: Record<string, unknown>;
      };
      expect(out.mimeType).toBe(WIDGET_MIME_TYPE);
      expect(typeof out.text).toBe("string");
      expect(out.text!.length).toBeGreaterThan(100);
      expect(out.text!).toContain("<!doctype html>");
      // CSP `_meta` declares jsdelivr for img resources.
      const csp = (out.meta?.ui as { csp?: { resourceDomains?: string[] } })?.csp;
      expect(csp?.resourceDomains).toContain("https://cdn.jsdelivr.net");
      // Suppress unused-var lint hint.
      expect(uri).toMatch(/^ui:\/\/bellaroma\//);
    }

    // Restore.
    if (prev === undefined) {
      delete (navigator as unknown as { modelContext?: unknown }).modelContext;
    } else {
      Object.defineProperty(navigator, "modelContext", {
        configurable: true,
        value: prev,
      });
    }
  });

  it("registerTools no-ops the widget registration when resources namespace is missing (graceful fallback)", async () => {
    const fakeMc = {
      registerTool: vi.fn().mockResolvedValue(undefined),
      getTools: vi.fn().mockReturnValue([]),
      // NO `resources` namespace — simulates unpatched polyfill or native browser.
    };
    const prev = (globalThis as { navigator?: { modelContext?: unknown } })
      .navigator?.modelContext;
    Object.defineProperty(navigator, "modelContext", {
      configurable: true,
      value: fakeMc,
    });

    const { registerTools, __resetForTests } = await import("../webmcp");
    __resetForTests?.();
    // Must NOT throw even though resources is missing.
    await expect(registerTools()).resolves.toBeUndefined();

    if (prev === undefined) {
      delete (navigator as unknown as { modelContext?: unknown }).modelContext;
    } else {
      Object.defineProperty(navigator, "modelContext", {
        configurable: true,
        value: prev,
      });
    }
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildTools, __resetWidgetStateForTests } from "../webmcp";
import {
  buildCartPanelHtml,
  buildProductCardHtml,
  buildProductGridHtml,
  cartPanelUri,
  embedAsJson,
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

// ---------------------------------------------------------------------------
// XSS-hardening: state inlined into <script> blocks must survive
// `</script>` injection. `embedAsJson` double-encodes so the outer
// `JSON.stringify` escapes `/`, breaking `</script>` apart at injection
// time. The JSON.parse-at-runtime step yields the original string.
// ---------------------------------------------------------------------------
describe("MCP Apps widgets — embedAsJson XSS hardening", () => {
  it("escapes </script> in string values (no premature script close)", () => {
    const payload = { note: "evil </script><img src=x onerror=alert(1)>" };
    const out = embedAsJson(payload);
    expect(out).not.toContain("</script>");
    // Round-trip via Function (safe: same as runtime widget eval).
    const parsed = new Function(`return ${out};`)();
    expect(parsed).toEqual(payload);
  });

  it("escapes <!-- (HTML comment) in string values", () => {
    const payload = { x: "a <!-- b --> c" };
    const out = embedAsJson(payload);
    // The double-encode escapes `<` via JSON's `<` only when slashes are
    // present; for `<!--` we still get safe parse semantics.
    const parsed = new Function(`return ${out};`)();
    expect(parsed).toEqual(payload);
  });

  it("cart-panel HTML never inlines a raw `</script>` substring through rowsMeta", () => {
    // Force a synthetic cart item whose options carry a string that, if
    // inlined verbatim, would close the script tag. The widget should
    // emit the value via embedAsJson so this never happens.
    useCartStore.getState().reset();
    const snap = {
      items: [
        {
          productId: "espresso",
          quantity: 1,
          // Cast: cart-panel only reads the value as JSON, type irrelevant.
          options: { sweetness: "</script><img src=x>" } as unknown as {
            sweetness: "none" | "low" | "normal";
          },
        },
      ],
      coupon: null,
      subtotal: 0,
      discount: 0,
      total: 0,
    };
    const html = buildCartPanelHtml(snap);
    // The script block embedding rowsMeta must not break out — the only
    // `</script>` substring permitted is the closing tag of the embedded
    // <script>...</script> itself. Count occurrences: exactly 1.
    const occurrences = (html.match(/<\/script>/g) ?? []).length;
    expect(occurrences).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Bridge-JS execution test: extract the widget's <script> body, run it in a
// jsdom document with a stubbed `window.parent.postMessage`, then click the
// first product's "Aggiungi" button and assert the JSON-RPC envelope sent.
// Catches regressions in the inlined bridge or event wiring.
// ---------------------------------------------------------------------------
describe("MCP Apps widgets — bridge JS execution (product-grid)", () => {
  it("clicking 'Aggiungi' posts a tools/call envelope for add_to_cart", async () => {
    const espresso = getProductById("espresso")!;
    const html = buildProductGridHtml([espresso], "test");

    // Mount the HTML in a fresh jsdom document.
    document.documentElement.innerHTML = html.replace(/<!doctype html>/i, "")
      .replace(/<\/?html[^>]*>/gi, "")
      .replace(/<\/?head[^>]*>/gi, "")
      .replace(/<\/?body[^>]*>/gi, "");

    // Stub window.parent.postMessage to capture calls.
    const postSpy = vi.fn();
    // jsdom: window.parent === window by default; override postMessage on it.
    Object.defineProperty(window.parent, "postMessage", {
      configurable: true,
      writable: true,
      value: postSpy,
    });

    // Extract the inlined bridge + per-widget JS from the doc. We
    // concatenate every <script> body so handlers register against the
    // jsdom DOM we just installed.
    const scripts = Array.from(document.querySelectorAll("script"))
      .map((s) => s.textContent ?? "")
      .join("\n");
    expect(scripts.length).toBeGreaterThan(100);

    // Execute the bridge in the current window scope.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function(scripts).call(window);

    // Locate the "Aggiungi" button and click it.
    const btn = document.querySelector<HTMLButtonElement>(
      '.grid-card .br-cta[data-product-id="espresso"]',
    );
    expect(btn).toBeTruthy();
    btn!.click();

    // The bridge synchronously posts before awaiting the response.
    await Promise.resolve();
    expect(postSpy).toHaveBeenCalledTimes(1);
    const envelope = postSpy.mock.calls[0][0] as {
      jsonrpc: string;
      id: string;
      method: string;
      params: { name: string; arguments: Record<string, unknown> };
    };
    expect(envelope.jsonrpc).toBe("2.0");
    expect(envelope.method).toBe("tools/call");
    expect(envelope.params.name).toBe("add_to_cart");
    expect(envelope.params.arguments).toEqual({
      product_id: "espresso",
      quantity: 1,
    });
    expect(typeof envelope.id).toBe("string");
    expect(envelope.id.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Bridge-JS execution test: cart-panel `−` button must NOT collapse to a
// bare `remove_from_cart` when the row has quantity > 1. The bridge should
// emit `remove_from_cart` first, then `add_to_cart{quantity: q-1}`.
// ---------------------------------------------------------------------------
describe("MCP Apps widgets — bridge JS execution (cart-panel decrement)", () => {
  it("clicking '−' on a row with quantity 2 sends remove_from_cart then add_to_cart{quantity:1}", async () => {
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

    document.documentElement.innerHTML = html.replace(/<!doctype html>/i, "")
      .replace(/<\/?html[^>]*>/gi, "")
      .replace(/<\/?head[^>]*>/gi, "")
      .replace(/<\/?body[^>]*>/gi, "");

    // postMessage spy that ALSO immediately replies success for every
    // request — otherwise the second callTool never fires because the
    // first awaits its response.
    const sent: Array<Record<string, unknown>> = [];
    const fakePost = vi.fn((msg: Record<string, unknown>) => {
      sent.push(msg);
      // Schedule a fake JSON-RPC reply on the next tick.
      const id = msg.id as string;
      setTimeout(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: { id, result: { content: [{ type: "text", text: "ok" }] } },
          }),
        );
      }, 0);
    });
    Object.defineProperty(window.parent, "postMessage", {
      configurable: true,
      writable: true,
      value: fakePost,
    });

    const scripts = Array.from(document.querySelectorAll("script"))
      .map((s) => s.textContent ?? "")
      .join("\n");
    new Function(scripts).call(window);

    const decBtn = document.querySelector<HTMLButtonElement>(
      '.cart-step[data-action="dec"]',
    );
    expect(decBtn).toBeTruthy();
    decBtn!.click();

    // Wait two macrotasks so the chained awaits resolve.
    await new Promise((r) => setTimeout(r, 5));
    await new Promise((r) => setTimeout(r, 5));

    expect(sent.length).toBe(2);
    const first = sent[0] as {
      method: string;
      params: { name: string; arguments: Record<string, unknown> };
    };
    const second = sent[1] as {
      method: string;
      params: { name: string; arguments: Record<string, unknown> };
    };
    expect(first.params.name).toBe("remove_from_cart");
    expect(first.params.arguments.product_id).toBe("espresso");
    expect(second.params.name).toBe("add_to_cart");
    expect(second.params.arguments.product_id).toBe("espresso");
    expect(second.params.arguments.quantity).toBe(1);
    // Both calls forward the row's options verbatim (which the cart store
    // populates with defaults). Crucially, the second call's options must
    // exactly match the first's so we don't end up creating a different row.
    expect(second.params.arguments.options).toEqual(
      first.params.arguments.options,
    );
  });

  it("clicking '−' on a row with quantity 1 sends only remove_from_cart (no re-add)", async () => {
    useCartStore.getState().reset();
    useCartStore.getState().addItem("espresso", 1);
    const snap = {
      items: useCartStore.getState().items,
      coupon: useCartStore.getState().coupon,
      subtotal: useCartStore.getState().subtotal(),
      discount: useCartStore.getState().discount(),
      total: useCartStore.getState().total(),
    };
    const html = buildCartPanelHtml(snap);

    document.documentElement.innerHTML = html.replace(/<!doctype html>/i, "")
      .replace(/<\/?html[^>]*>/gi, "")
      .replace(/<\/?head[^>]*>/gi, "")
      .replace(/<\/?body[^>]*>/gi, "");

    const sent: Array<Record<string, unknown>> = [];
    const fakePost = vi.fn((msg: Record<string, unknown>) => {
      sent.push(msg);
      const id = msg.id as string;
      setTimeout(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: { id, result: { content: [{ type: "text", text: "ok" }] } },
          }),
        );
      }, 0);
    });
    Object.defineProperty(window.parent, "postMessage", {
      configurable: true,
      writable: true,
      value: fakePost,
    });

    const scripts = Array.from(document.querySelectorAll("script"))
      .map((s) => s.textContent ?? "")
      .join("\n");
    new Function(scripts).call(window);

    const decBtn = document.querySelector<HTMLButtonElement>(
      '.cart-step[data-action="dec"]',
    );
    decBtn!.click();
    await new Promise((r) => setTimeout(r, 5));
    await new Promise((r) => setTimeout(r, 5));

    expect(sent.length).toBe(1);
    const only = sent[0] as {
      params: { name: string; arguments: Record<string, unknown> };
    };
    expect(only.params.name).toBe("remove_from_cart");
    expect(only.params.arguments.product_id).toBe("espresso");
  });
});

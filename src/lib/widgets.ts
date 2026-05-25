/**
 * MCP Apps widget HTML builders (Phase 3).
 *
 * Each `build*WidgetHtml(...)` returns a self-contained `text/html;profile=mcp-app`
 * payload that the host mounts in a sandboxed iframe. Widgets communicate
 * back to the host via `window.parent.postMessage(...)` using the MCP Apps
 * JSON-RPC dialect (`tools/call`). The host routes the call to the relay,
 * which dispatches it through `navigator.modelContext` → our WebMCP tool
 * `execute()` implementations. Widget code therefore never imports any of
 * the React app's state directly — all interactivity is `tools/call`.
 *
 * Branding follows the BellaRoma "Lavazza" palette declared in
 * `tailwind.config.js`. Images are loaded from the jsdelivr CDN base used
 * by `show_product_image` (already CSP-allowed by the host's default
 * `img-src 'self' data:` + our explicit `_meta.ui.csp.resourceDomains`).
 */

import type { Product } from "./products";
import { getProductById, type SizeOption, type SweetnessOption } from "./products";
import type { CartItem } from "../store/cart";

// Keep this URL in sync with IMAGE_BASE_URL in src/lib/webmcp.ts.
const IMAGE_BASE_URL =
  "https://cdn.jsdelivr.net/gh/Sgr57/Bella-Roma-WebMCP@main/public/products/editorial";

// CSP allow-list for widget iframes. Hosts default `img-src` to `'self' data:`;
// we declare jsdelivr explicitly via `_meta.ui.csp.resourceDomains`.
export const WIDGET_RESOURCE_DOMAINS = ["https://cdn.jsdelivr.net"] as const;

// MCP Apps spec MIME type.
export const WIDGET_MIME_TYPE = "text/html;profile=mcp-app";

// ---- ui:// URIs -----------------------------------------------------------

export function productGridUri(): string {
  return "ui://bellaroma/product-grid";
}

/**
 * Single URI for the product-card widget. The resource provider reads
 * the most-recently-requested product from `widgetState` (see webmcp.ts)
 * so this is a stable URI — hosts can pre-fetch it once and reuse it.
 *
 * Per MCP Apps spec 2026-01-26 the URI is identifier-only; per-instance
 * data flows via the captured state, not via URI parameterisation.
 */
export function productCardUri(): string {
  return "ui://bellaroma/product-card";
}

export function cartPanelUri(): string {
  return "ui://bellaroma/cart-panel";
}

// ---- helpers --------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function imageUrl(productId: string): string {
  return `${IMAGE_BASE_URL}/${productId}.webp`;
}

function formatPrice(n: number): string {
  return `€ ${n.toFixed(2).replace(".", ",")}`;
}

/**
 * Shared CSS for all widgets — BellaRoma palette.
 *
 * Defined as a string constant rather than per-builder so we keep visual
 * consistency and the iframe payload small.
 */
const SHARED_CSS = `
  :root { color-scheme: light; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
    background: #FFFBF8;       /* lavazza-off */
    color: #343E52;            /* coffee-mid */
    padding: 16px;
    box-sizing: border-box;
    -webkit-font-smoothing: antialiased;
  }
  * { box-sizing: border-box; }
  h1, h2, h3 { color: #051432; margin: 0; }   /* lavazza-deep */
  .br-eyebrow {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: #343E52;
    font-weight: 500;
  }
  .br-cta {
    appearance: none;
    border: 1.5px solid #163052;
    background: #163052;
    color: #ffffff;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    padding: 8px 14px;
    border-radius: 30px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    transition: background 120ms ease, border-color 120ms ease;
  }
  .br-cta:hover {
    background: #051432;
    border-color: #051432;
  }
  .br-cta:active { transform: translateY(1px); }
  .br-cta:disabled {
    background: #c5cad4;
    border-color: #c5cad4;
    cursor: not-allowed;
  }
  .br-cta--ghost {
    background: transparent;
    color: #163052;
  }
  .br-cta--ghost:hover {
    background: rgba(22, 48, 82, 0.08);
    color: #051432;
  }
  .br-cta--accent {
    background: #FF8700;
    border-color: #FF8700;
  }
  .br-cta--accent:hover {
    background: #e07a00;
    border-color: #e07a00;
  }
  .br-card {
    background: #ffffff;
    border: 1px solid #E6E9EF;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 0 6px rgba(2,20,35,0.08);
  }
  .br-toast {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: #051432;
    color: #ffffff;
    padding: 10px 18px;
    border-radius: 30px;
    font-size: 13px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 180ms ease;
    z-index: 1000;
    max-width: 90vw;
    box-shadow: 0 4px 16px rgba(0,0,0,0.18);
  }
  .br-toast.is-visible { opacity: 1; }
  .br-error { color: #b22222; }
`;

/**
 * Shared JS bootstrap for postMessage ↔ host bridge.
 *
 * Per MCP Apps spec 2026-01-26, widgets send JSON-RPC requests to
 * `window.parent` using the same method names as the MCP wire protocol
 * (`tools/call` etc.). The host listens for the response and forwards it
 * back via `ui/notifications/tool-result` and direct response messages.
 *
 * We use a small request-id correlation map so multiple in-flight calls
 * can resolve independently. Hosts respond either as a JSON-RPC reply
 * (`id` set, `result`/`error`) or as a `ui/notifications/tool-result`
 * (notification, no id) — we handle both.
 */
const BRIDGE_JS = `
  const __pendingCalls = new Map();
  let __reqIdSeq = 0;
  function __nextReqId() {
    __reqIdSeq += 1;
    return "br-" + Date.now() + "-" + __reqIdSeq;
  }
  function __post(msg) {
    try {
      window.parent.postMessage(msg, "*");
    } catch (e) {
      console.warn("[bellaroma-widget] postMessage failed:", e);
    }
  }
  function __toast(text, error) {
    const t = document.getElementById("br-toast");
    if (!t) return;
    t.textContent = text;
    t.classList.toggle("br-error", Boolean(error));
    t.classList.add("is-visible");
    clearTimeout(t.__hideTimer);
    t.__hideTimer = setTimeout(function () {
      t.classList.remove("is-visible");
    }, 2400);
  }
  function callTool(name, args) {
    const id = __nextReqId();
    const request = {
      jsonrpc: "2.0",
      id: id,
      method: "tools/call",
      params: { name: name, arguments: args || {} }
    };
    __post(request);
    return new Promise(function (resolve) {
      __pendingCalls.set(id, resolve);
      setTimeout(function () {
        if (__pendingCalls.has(id)) {
          __pendingCalls.delete(id);
          resolve({ ok: false, error: "timeout" });
        }
      }, 15000);
    });
  }
  window.addEventListener("message", function (ev) {
    const data = ev.data;
    if (!data || typeof data !== "object") return;
    // JSON-RPC reply path (host returns id matching our request).
    if (data.id && __pendingCalls.has(data.id)) {
      const resolver = __pendingCalls.get(data.id);
      __pendingCalls.delete(data.id);
      if (data.error) {
        resolver({ ok: false, error: data.error.message || String(data.error) });
      } else {
        resolver({ ok: true, result: data.result });
      }
    }
    // ui/notifications/tool-result path — host may not echo our id.
    if (data.method === "ui/notifications/tool-result" && data.params) {
      // Best-effort: surface a success/error toast based on the result.
      const r = data.params.result;
      if (r && Array.isArray(r.content) && r.content[0] && typeof r.content[0].text === "string") {
        __toast(r.content[0].text, Boolean(r.isError));
      }
    }
  });
  function extractText(result) {
    if (result && result.content && Array.isArray(result.content) && result.content[0]) {
      const block = result.content[0];
      if (typeof block.text === "string") return block.text;
    }
    return "";
  }
  // Boilerplate "Aggiungi" handler — used by product-grid and product-card.
  async function __handleAdd(productId, quantity, options) {
    const args = { product_id: productId, quantity: quantity || 1 };
    if (options) args.options = options;
    const res = await callTool("add_to_cart", args);
    if (!res.ok) {
      __toast("Errore: " + res.error, true);
      return;
    }
    const text = extractText(res.result);
    if (res.result && res.result.isError) {
      __toast(text || "Errore aggiunta", true);
    } else {
      __toast(text || "Aggiunto al carrello");
    }
  }
  window.__bellaroma = {
    callTool: callTool,
    handleAdd: __handleAdd,
    toast: __toast,
    extractText: extractText
  };
`;

function shellHtml(title: string, body: string, extraJs?: string): string {
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${SHARED_CSS}</style>
</head>
<body>
${body}
<div id="br-toast" class="br-toast" role="status" aria-live="polite"></div>
<script>${BRIDGE_JS}${extraJs ?? ""}</script>
</body>
</html>`;
}

// ---- product-grid widget --------------------------------------------------

/**
 * Card grid rendered for `search_products` results.
 *
 * Caller filters PRODUCTS to the same set the tool returned. The widget
 * is purely presentational — every "Aggiungi" button posts a `tools/call`
 * with `add_to_cart` (default options).
 */
export function buildProductGridHtml(products: Product[], queryLabel: string): string {
  const cards = products
    .map((p) => {
      const customizable = Boolean(
        p.options?.size || p.options?.milk || p.options?.sweetness,
      );
      const ctaLabel = !p.available
        ? "Esaurito"
        : customizable
          ? "Scegli"
          : "Aggiungi";
      const ctaDisabled = !p.available;
      const intensity =
        typeof p.intensity === "number"
          ? `<div class="grid-meta">Intensità ${p.intensity}/10</div>`
          : "";
      const origin = p.origin
        ? `<div class="grid-meta">${escapeHtml(p.origin)}</div>`
        : "";
      return `
  <article class="grid-card br-card">
    <div class="grid-img">
      <img src="${escapeHtml(imageUrl(p.id))}" alt="${escapeHtml(p.name)}" loading="lazy" />
    </div>
    <div class="grid-body">
      <p class="br-eyebrow">${escapeHtml(p.category)}</p>
      <h3 class="grid-name">${escapeHtml(p.name)}</h3>
      ${intensity}
      ${origin}
      <p class="grid-desc">${escapeHtml(p.description)}</p>
      <div class="grid-foot">
        <span class="grid-price">${formatPrice(p.price)}</span>
        <button
          class="br-cta br-cta--accent"
          type="button"
          ${ctaDisabled ? "disabled" : ""}
          data-product-id="${escapeHtml(p.id)}"
          data-customizable="${customizable ? "true" : "false"}"
        >${ctaLabel}</button>
      </div>
    </div>
  </article>`;
    })
    .join("\n");

  const empty =
    products.length === 0
      ? `<p class="grid-empty">Nessun prodotto corrisponde a "${escapeHtml(queryLabel)}".</p>`
      : "";

  const body = `
<header class="grid-header">
  <p class="br-eyebrow">Bella Roma — Catalogo</p>
  <h1>${escapeHtml(queryLabel || "Risultati")}</h1>
  <p class="grid-count">${products.length} ${products.length === 1 ? "prodotto" : "prodotti"}</p>
</header>
<section class="grid">
  ${cards}
  ${empty}
</section>
<style>
  body { background: #FEF1DF; padding: 20px; }
  .grid-header { margin-bottom: 16px; max-width: 920px; }
  .grid-header h1 { font-size: 24px; margin-top: 4px; }
  .grid-count { font-size: 12px; color: #343E52; margin: 6px 0 0; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 14px;
    max-width: 920px;
  }
  .grid-empty {
    grid-column: 1 / -1;
    text-align: center;
    padding: 32px 16px;
    color: #343E52;
    font-style: italic;
  }
  .grid-card { display: flex; flex-direction: column; }
  .grid-img {
    height: 140px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ffffff;
  }
  .grid-img img {
    max-width: 80%;
    max-height: 80%;
    object-fit: contain;
  }
  .grid-body {
    padding: 12px 14px 14px;
    display: flex;
    flex-direction: column;
    flex: 1;
  }
  .grid-name {
    font-size: 16px;
    font-weight: 700;
    margin: 6px 0 4px;
    line-height: 1.2;
  }
  .grid-meta {
    font-size: 11px;
    color: #343E52;
    margin: 2px 0;
  }
  .grid-desc {
    font-size: 12px;
    color: #343E52;
    line-height: 1.4;
    margin: 6px 0 10px;
    flex: 1;
  }
  .grid-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: auto;
  }
  .grid-price {
    font-size: 16px;
    font-weight: 700;
    color: #051432;
  }
</style>`;

  const js = `
  document.querySelectorAll(".grid-card .br-cta").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const pid = btn.getAttribute("data-product-id");
      if (!pid) return;
      btn.disabled = true;
      __handleAdd(pid, 1, null).finally(function () {
        btn.disabled = false;
      });
    });
  });
`;

  return shellHtml(`Catalogo Bella Roma`, body, js);
}

// ---- product-card widget --------------------------------------------------

/**
 * Detailed card with size/milk/sweetness configurator. Live price updates
 * client-side from `data-*` attributes on each option button.
 */
export function buildProductCardHtml(p: Product): string {
  const sizeBlock = p.options?.size
    ? renderSizeBlock(p)
    : "";
  const milkBlock = p.options?.milk
    ? renderMilkBlock(p)
    : "";
  const sweetnessBlock = p.options?.sweetness
    ? renderSweetnessBlock(p)
    : "";

  const defaultSize = p.options?.size?.default ?? null;
  const defaultMilk = p.options?.milk?.default ?? null;
  const defaultSweetness = p.options?.sweetness?.default ?? null;

  const initialState = {
    productId: p.id,
    basePrice: p.price,
    size: defaultSize,
    milk: defaultMilk,
    sweetness: defaultSweetness,
    sizeMods: p.options?.size?.price_modifier ?? {},
    milkPrices: milkPricesMap(p),
  };

  const dietary =
    p.dietary && p.dietary.length > 0
      ? `<div class="card-tags">${p.dietary
          .map((d) => `<span class="card-tag">${escapeHtml(d)}</span>`)
          .join("")}</div>`
      : "";

  const intensityBlock =
    typeof p.intensity === "number"
      ? `<div class="card-intensity">
          <span class="br-eyebrow">Intensità</span>
          <div class="card-intensity-bars">
            ${Array.from({ length: 10 })
              .map(
                (_, i) =>
                  `<span class="card-intensity-bar ${
                    i < (p.intensity ?? 0) ? "is-on" : ""
                  }"></span>`,
              )
              .join("")}
          </div>
          <span class="card-intensity-num">${p.intensity}/10</span>
        </div>`
      : "";

  const ctaDisabled = !p.available;

  const body = `
<article class="card br-card">
  <div class="card-img">
    <img src="${escapeHtml(imageUrl(p.id))}" alt="${escapeHtml(p.name)}" />
  </div>
  <div class="card-body">
    <p class="br-eyebrow">${escapeHtml(p.category)}</p>
    <h1>${escapeHtml(p.name)}</h1>
    ${intensityBlock}
    <p class="card-desc">${escapeHtml(p.description)}</p>
    ${dietary}
    ${sizeBlock}
    ${milkBlock}
    ${sweetnessBlock}
    <div class="card-foot">
      <span class="card-price" id="card-price">${formatPrice(p.price)}</span>
      <button
        class="br-cta br-cta--accent"
        id="card-add"
        type="button"
        ${ctaDisabled ? "disabled" : ""}
      >${ctaDisabled ? "Esaurito" : "Aggiungi"}</button>
    </div>
  </div>
</article>
<style>
  body { background: #FEF1DF; padding: 24px; }
  .card { max-width: 480px; margin: 0 auto; }
  .card-img {
    height: 240px;
    background: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card-img img {
    max-width: 70%;
    max-height: 90%;
    object-fit: contain;
  }
  .card-body { padding: 20px 22px 22px; }
  .card-body h1 {
    font-size: 24px;
    margin: 6px 0 8px;
  }
  .card-intensity {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 8px 0 12px;
  }
  .card-intensity-bars { display: flex; gap: 2px; }
  .card-intensity-bar {
    width: 6px;
    height: 10px;
    background: #E6E9EF;
    border-radius: 2px;
  }
  .card-intensity-bar.is-on { background: #163052; }
  .card-intensity-num {
    font-size: 12px;
    font-weight: 700;
    color: #051432;
  }
  .card-desc {
    color: #343E52;
    font-size: 14px;
    line-height: 1.5;
    margin: 8px 0 12px;
  }
  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0 0 14px;
  }
  .card-tag {
    background: #F4FBFF;
    color: #163052;
    border: 1px solid #E6E9EF;
    border-radius: 30px;
    padding: 2px 10px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .opt-block { margin: 14px 0; }
  .opt-block-label {
    display: block;
    margin-bottom: 6px;
  }
  .opt-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .opt-btn {
    appearance: none;
    border: 1px solid #E6E9EF;
    background: #ffffff;
    color: #343E52;
    font: inherit;
    font-size: 12px;
    padding: 8px 12px;
    border-radius: 30px;
    cursor: pointer;
    transition: all 120ms ease;
  }
  .opt-btn:hover { border-color: #163052; }
  .opt-btn.is-selected {
    background: #163052;
    color: #ffffff;
    border-color: #163052;
  }
  .opt-btn:disabled {
    color: #c5cad4;
    cursor: not-allowed;
    text-decoration: line-through;
  }
  .opt-price-mod {
    font-size: 10px;
    color: #FF8700;
    margin-left: 4px;
  }
  .card-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid #E6E9EF;
  }
  .card-price {
    font-size: 22px;
    font-weight: 700;
    color: #051432;
    font-variant-numeric: tabular-nums;
  }
</style>`;

  // Encode the configurator state as a JSON string we parse inside the
  // widget. Avoids HTML-escape ambiguity inside a <script> block.
  const js = `
  const _state = JSON.parse(${JSON.stringify(JSON.stringify(initialState))});
  function totalPrice() {
    let p = _state.basePrice;
    if (_state.size && _state.sizeMods && typeof _state.sizeMods[_state.size] === "number") {
      p += _state.sizeMods[_state.size];
    }
    if (_state.milk && _state.milkPrices && typeof _state.milkPrices[_state.milk] === "number") {
      p += _state.milkPrices[_state.milk];
    }
    return p;
  }
  function renderPrice() {
    const el = document.getElementById("card-price");
    if (!el) return;
    const p = totalPrice();
    el.textContent = "€ " + p.toFixed(2).replace(".", ",");
  }
  function bindGroup(group) {
    document.querySelectorAll('.opt-btn[data-group="' + group + '"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.disabled) return;
        const value = btn.getAttribute("data-value");
        _state[group] = value;
        document.querySelectorAll('.opt-btn[data-group="' + group + '"]').forEach(function (b) {
          b.classList.toggle("is-selected", b.getAttribute("data-value") === value);
        });
        renderPrice();
      });
    });
  }
  bindGroup("size");
  bindGroup("milk");
  bindGroup("sweetness");
  renderPrice();
  const addBtn = document.getElementById("card-add");
  if (addBtn) {
    addBtn.addEventListener("click", function () {
      const opts = {};
      if (_state.size) opts.size = _state.size;
      if (_state.milk) opts.milk = _state.milk;
      if (_state.sweetness) opts.sweetness = _state.sweetness;
      addBtn.disabled = true;
      __handleAdd(_state.productId, 1, Object.keys(opts).length ? opts : null).finally(function () {
        addBtn.disabled = false;
      });
    });
  }
`;

  return shellHtml(`${p.name} — Bella Roma`, body, js);
}

function milkPricesMap(p: Product): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of p.options?.milk?.values ?? []) {
    const milk = getProductById(id);
    if (milk) out[id] = milk.price;
  }
  return out;
}

function renderSizeBlock(p: Product): string {
  const sz = p.options?.size;
  if (!sz) return "";
  const buttons = sz.values
    .map((v) => {
      const mod = sz.price_modifier[v] ?? 0;
      const modLabel =
        mod > 0
          ? ` <span class="opt-price-mod">+${formatPrice(mod)}</span>`
          : "";
      const selected = v === sz.default ? "is-selected" : "";
      return `<button class="opt-btn ${selected}" type="button" data-group="size" data-value="${escapeHtml(v)}">${escapeHtml(v)}${modLabel}</button>`;
    })
    .join("");
  return `<div class="opt-block">
    <span class="br-eyebrow opt-block-label">Dimensione</span>
    <div class="opt-row">${buttons}</div>
  </div>`;
}

function renderMilkBlock(p: Product): string {
  const ml = p.options?.milk;
  if (!ml) return "";
  const buttons = ml.values
    .map((id) => {
      const milk = getProductById(id);
      const name = milk?.name ?? id;
      const price = milk?.price ?? 0;
      const modLabel =
        price > 0
          ? ` <span class="opt-price-mod">+${formatPrice(price)}</span>`
          : "";
      const disabled = milk && !milk.available ? "disabled" : "";
      const selected = id === ml.default ? "is-selected" : "";
      return `<button class="opt-btn ${selected}" type="button" data-group="milk" data-value="${escapeHtml(id)}" ${disabled}>${escapeHtml(name)}${modLabel}</button>`;
    })
    .join("");
  return `<div class="opt-block">
    <span class="br-eyebrow opt-block-label">Latte</span>
    <div class="opt-row">${buttons}</div>
  </div>`;
}

function renderSweetnessBlock(p: Product): string {
  const sw = p.options?.sweetness;
  if (!sw) return "";
  const labels: Record<SweetnessOption, string> = {
    none: "Senza",
    low: "Poco",
    normal: "Normale",
  };
  const buttons = sw.values
    .map((v) => {
      const selected = v === sw.default ? "is-selected" : "";
      return `<button class="opt-btn ${selected}" type="button" data-group="sweetness" data-value="${escapeHtml(v)}">${escapeHtml(labels[v] ?? v)}</button>`;
    })
    .join("");
  return `<div class="opt-block">
    <span class="br-eyebrow opt-block-label">Zucchero</span>
    <div class="opt-row">${buttons}</div>
  </div>`;
}

// ---- cart-panel widget ----------------------------------------------------

interface CartSnapshot {
  items: CartItem[];
  coupon: string | null;
  subtotal: number;
  discount: number;
  total: number;
}

export function buildCartPanelHtml(snapshot: CartSnapshot): string {
  const itemsHtml = snapshot.items.length === 0
    ? `<p class="cart-empty">Il carrello è vuoto.</p>`
    : snapshot.items
        .map((item) => renderCartRow(item))
        .filter(Boolean)
        .join("\n");

  const coupon = snapshot.coupon
    ? `<div class="cart-coupon-active">
        Coupon <strong>${escapeHtml(snapshot.coupon)}</strong> attivo · -${formatPrice(snapshot.discount)}
        <button class="br-cta br-cta--ghost cart-coupon-remove" type="button">Rimuovi</button>
      </div>`
    : `<div class="cart-coupon-form">
        <input id="cart-coupon-input" type="text" placeholder="Codice sconto" maxlength="40" />
        <button class="br-cta br-cta--ghost cart-coupon-apply" type="button">Applica</button>
      </div>`;

  const isEmpty = snapshot.items.length === 0;

  const body = `
<section class="cart">
  <header class="cart-header">
    <p class="br-eyebrow">Bella Roma — Il tuo carrello</p>
    <h1>Carrello</h1>
  </header>
  <div class="cart-items">${itemsHtml}</div>
  ${coupon}
  <div class="cart-totals">
    <div class="cart-total-row">
      <span>Subtotale</span>
      <span class="cart-total-val">${formatPrice(snapshot.subtotal)}</span>
    </div>
    ${snapshot.coupon
      ? `<div class="cart-total-row">
          <span>Sconto (${escapeHtml(snapshot.coupon)})</span>
          <span class="cart-total-val cart-discount">−${formatPrice(snapshot.discount)}</span>
        </div>`
      : ""}
    <div class="cart-total-row cart-total-row--grand">
      <span>Totale</span>
      <span class="cart-total-val">${formatPrice(snapshot.total)}</span>
    </div>
  </div>
  <div class="cart-actions">
    <button class="br-cta br-cta--ghost cart-clear" type="button" ${isEmpty ? "disabled" : ""}>Svuota</button>
    <button class="br-cta br-cta--accent cart-checkout" type="button" ${isEmpty ? "disabled" : ""}>Checkout</button>
  </div>
</section>
<style>
  body { background: #FEF1DF; padding: 20px; }
  .cart { max-width: 480px; margin: 0 auto; background: #ffffff; border: 1px solid #E6E9EF; border-radius: 12px; padding: 22px; box-shadow: 0 0 6px rgba(2,20,35,0.08); }
  .cart-header { margin-bottom: 16px; }
  .cart-header h1 { font-size: 22px; margin: 4px 0 0; }
  .cart-items { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
  .cart-empty {
    text-align: center;
    color: #343E52;
    font-style: italic;
    padding: 24px 8px;
    margin: 0;
  }
  .cart-row {
    display: grid;
    grid-template-columns: 56px 1fr auto;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid #F4FBFF;
    align-items: center;
  }
  .cart-row:last-child { border-bottom: none; }
  .cart-row-img {
    width: 56px;
    height: 56px;
    background: #FEF1DF;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .cart-row-img img {
    max-width: 75%;
    max-height: 75%;
    object-fit: contain;
  }
  .cart-row-body { min-width: 0; }
  .cart-row-name {
    font-size: 14px;
    font-weight: 600;
    color: #051432;
    margin: 0 0 2px;
    line-height: 1.2;
  }
  .cart-row-opts {
    font-size: 11px;
    color: #343E52;
  }
  .cart-row-price {
    font-size: 13px;
    color: #343E52;
    margin-top: 2px;
    font-variant-numeric: tabular-nums;
  }
  .cart-row-controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .cart-step {
    appearance: none;
    border: 1px solid #E6E9EF;
    background: #ffffff;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    font-size: 14px;
    font-weight: 600;
    color: #163052;
    cursor: pointer;
    line-height: 1;
  }
  .cart-step:hover { border-color: #163052; }
  .cart-qty {
    font-size: 13px;
    font-weight: 600;
    color: #051432;
    min-width: 18px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .cart-coupon-form, .cart-coupon-active {
    display: flex;
    gap: 8px;
    align-items: center;
    margin: 14px 0;
    padding: 10px 12px;
    background: #F4FBFF;
    border-radius: 8px;
    font-size: 12px;
  }
  .cart-coupon-active { color: #163052; }
  .cart-coupon-active strong { font-weight: 700; }
  .cart-coupon-form input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #E6E9EF;
    border-radius: 30px;
    background: #ffffff;
    color: #051432;
    font: inherit;
    font-size: 13px;
  }
  .cart-coupon-form input:focus {
    outline: none;
    border-color: #163052;
  }
  .cart-totals {
    margin: 16px 0 4px;
    padding: 14px 0;
    border-top: 1px solid #E6E9EF;
    border-bottom: 1px solid #E6E9EF;
  }
  .cart-total-row {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: #343E52;
    margin: 4px 0;
  }
  .cart-total-row--grand {
    font-size: 16px;
    font-weight: 700;
    color: #051432;
    margin-top: 8px;
  }
  .cart-total-val { font-variant-numeric: tabular-nums; }
  .cart-discount { color: #FF8700; }
  .cart-actions {
    display: flex;
    gap: 8px;
    margin-top: 18px;
  }
  .cart-actions .br-cta { flex: 1; }
</style>`;

  // Encode the items as a JSON map row-key → row metadata to support
  // stepper actions.
  const rowsMeta = snapshot.items.map((it) => ({
    productId: it.productId,
    quantity: it.quantity,
    options: it.options ?? null,
  }));

  const js = `
  const __rows = ${JSON.stringify(rowsMeta)};
  function findRowMeta(key) {
    return __rows.find(function (r) { return rowKey(r) === key; });
  }
  function rowKey(r) {
    const oj = r.options ? JSON.stringify(Object.keys(r.options).sort().reduce(function (acc, k) { acc[k] = r.options[k]; return acc; }, {})) : "";
    return r.productId + "|" + oj;
  }
  document.querySelectorAll(".cart-step").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      const key = btn.getAttribute("data-row-key");
      const action = btn.getAttribute("data-action");
      const meta = findRowMeta(key);
      if (!meta) return;
      btn.disabled = true;
      if (action === "inc") {
        const args = { product_id: meta.productId, quantity: 1 };
        if (meta.options) args.options = meta.options;
        const res = await callTool("add_to_cart", args);
        __toast(res.ok ? (extractText(res.result) || "+1") : ("Errore: " + res.error), !res.ok || (res.result && res.result.isError));
      } else if (action === "dec") {
        const args = { product_id: meta.productId };
        if (meta.options) args.options = meta.options;
        const res = await callTool("remove_from_cart", args);
        __toast(res.ok ? (extractText(res.result) || "−1") : ("Errore: " + res.error), !res.ok || (res.result && res.result.isError));
      }
    });
  });
  const applyBtn = document.querySelector(".cart-coupon-apply");
  if (applyBtn) {
    applyBtn.addEventListener("click", async function () {
      const inp = document.getElementById("cart-coupon-input");
      const code = inp ? inp.value.trim() : "";
      if (!code) { __toast("Inserisci un codice", true); return; }
      applyBtn.disabled = true;
      const res = await callTool("apply_coupon", { code: code });
      __toast(res.ok ? (extractText(res.result) || "Coupon applicato") : ("Errore: " + res.error), !res.ok || (res.result && res.result.isError));
      applyBtn.disabled = false;
    });
  }
  const removeBtn = document.querySelector(".cart-coupon-remove");
  if (removeBtn) {
    removeBtn.addEventListener("click", async function () {
      removeBtn.disabled = true;
      const res = await callTool("remove_coupon", {});
      __toast(res.ok ? (extractText(res.result) || "Coupon rimosso") : ("Errore: " + res.error), !res.ok || (res.result && res.result.isError));
    });
  }
  const clearBtn = document.querySelector(".cart-clear");
  if (clearBtn) {
    clearBtn.addEventListener("click", async function () {
      clearBtn.disabled = true;
      const res = await callTool("clear_cart", {});
      __toast(res.ok ? (extractText(res.result) || "Carrello svuotato") : ("Errore: " + res.error), !res.ok || (res.result && res.result.isError));
    });
  }
  const checkoutBtn = document.querySelector(".cart-checkout");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", async function () {
      checkoutBtn.disabled = true;
      const res = await callTool("checkout", {});
      __toast(res.ok ? (extractText(res.result) || "Checkout") : ("Errore: " + res.error), !res.ok || (res.result && res.result.isError));
      setTimeout(function () { checkoutBtn.disabled = false; }, 1500);
    });
  }
`;

  return shellHtml(`Carrello — Bella Roma`, body, js);
}

function renderCartRow(item: CartItem): string {
  const p = getProductById(item.productId);
  if (!p) return "";
  const opts = item.options;
  const optsLabel: string[] = [];
  if (opts?.size) optsLabel.push(opts.size);
  if (opts?.milk) {
    const milk = getProductById(opts.milk);
    optsLabel.push(milk?.name ?? opts.milk);
  }
  if (opts?.sweetness) optsLabel.push(`zucchero ${opts.sweetness}`);
  let unit = p.price;
  if (opts?.size && p.options?.size?.price_modifier) {
    unit += p.options.size.price_modifier[opts.size as SizeOption] ?? 0;
  }
  if (opts?.milk) {
    const milk = getProductById(opts.milk);
    if (milk) unit += milk.price;
  }
  const lineTotal = unit * item.quantity;
  const optsHtml = optsLabel.length
    ? `<div class="cart-row-opts">${escapeHtml(optsLabel.join(" · "))}</div>`
    : "";
  // Stable row key for stepper actions.
  const optsKey = opts
    ? JSON.stringify(
        Object.keys(opts)
          .sort()
          .reduce<Record<string, unknown>>((acc, k) => {
            acc[k] = (opts as unknown as Record<string, unknown>)[k];
            return acc;
          }, {}),
      )
    : "";
  const rowKey = `${p.id}|${optsKey}`;
  return `<div class="cart-row">
    <div class="cart-row-img"><img src="${escapeHtml(imageUrl(p.id))}" alt="${escapeHtml(p.name)}" loading="lazy" /></div>
    <div class="cart-row-body">
      <p class="cart-row-name">${escapeHtml(p.name)}</p>
      ${optsHtml}
      <div class="cart-row-price">${formatPrice(lineTotal)}</div>
    </div>
    <div class="cart-row-controls">
      <button class="cart-step" type="button" data-row-key="${escapeHtml(rowKey)}" data-action="dec" aria-label="Diminuisci">−</button>
      <span class="cart-qty">${item.quantity}</span>
      <button class="cart-step" type="button" data-row-key="${escapeHtml(rowKey)}" data-action="inc" aria-label="Aumenta">+</button>
    </div>
  </div>`;
}

export type { CartSnapshot };

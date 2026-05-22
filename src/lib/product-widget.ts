// Build HTML for the show_product_widget probe.
//
// Goal: return an MCP App embedded resource (text/html;profile=mcp-app)
// inline in the tool result, bypassing resources/list and resources/read.
//
// Probe B'': previously cappuccino was inlined as a base64 data: URI (~22KB
// HTML payload). We now reference the jsdelivr CDN URL instead (~3KB payload)
// to isolate whether the embedded-resource block was rejected for size, vs.
// the mechanism itself. Note: the default MCP App iframe CSP is
// `img-src 'self' data:`, so jsdelivr may be blocked by CSP — that produces
// a separate, useful signal (magenta bg + badge + broken image icon).
import type { Product } from "./products";

// CDN base for editorial product images. Same host the rest of the app uses
// (see IMAGE_BASE_URL in src/lib/webmcp.ts).
const PRODUCT_IMAGE_CDN_BASE =
  "https://cdn.jsdelivr.net/gh/Sgr57/Bella-Roma-WebMCP@main/public/products/editorial";

// Map of product id -> CDN filename. Only cappuccino is wired in for this
// probe; other products fall back to a CSS-only placeholder so the widget
// still renders end-to-end.
const PRODUCT_IMAGE_FILE: Record<string, string> = {
  cappuccino: "cappuccino.webp",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderImageSection(p: Product): string {
  const file = PRODUCT_IMAGE_FILE[p.id];
  if (file) {
    const src = `${PRODUCT_IMAGE_CDN_BASE}/${file}`;
    return `<img class="bw-img" src="${src}" alt="${escapeHtml(p.name)}" />`;
  }
  // CSS-only fallback for products without a CDN image: monogram on warm bg.
  const monogram = escapeHtml(p.emoji || p.name.slice(0, 1));
  return `<div class="bw-img bw-img--placeholder">${monogram}</div>`;
}

function metaStrip(p: Product): string {
  const parts: string[] = [];
  if (typeof p.intensity === "number") {
    parts.push(`Intensità ${p.intensity}/10`);
  }
  if (p.origin) parts.push(escapeHtml(p.origin));
  return parts.join(" &middot; ");
}

export function buildProductWidgetHtml(p: Product): string {
  const name = escapeHtml(p.name);
  const description = escapeHtml(p.description);
  const meta = metaStrip(p);
  const price = `€${p.price.toFixed(2)}`;
  const image = renderImageSection(p);

  // Inline CSS only; no external fetches beyond the data: URI for the image.
  // Bella Roma vibe: warm beige bg, serif heading, modern sans body.
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<title>${name} — Bella Roma</title>
<style>
  :root { color-scheme: light; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #ff00aa;
    color: #2b1f17;
    padding: 16px;
    position: relative;
    min-height: 100vh;
    box-sizing: border-box;
  }
  .bw-debug-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    background: #fff;
    color: #ff00aa;
    border: 1px dashed #2b1f17;
    border-radius: 999px;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 700;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    letter-spacing: 0.02em;
    z-index: 10;
  }
  .bw-card {
    background: #fffaf0;
    border: 1px solid #e6d5b0;
    border-radius: 12px;
    overflow: hidden;
    max-width: 360px;
    margin: 0 auto;
    box-shadow: 0 2px 6px rgba(60, 40, 20, 0.08);
  }
  .bw-img {
    display: block;
    width: 100%;
    height: 200px;
    object-fit: cover;
    background: #d9c4a0;
  }
  .bw-img--placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 64px;
    color: #6b4d2b;
  }
  .bw-body { padding: 14px 16px 16px; }
  .bw-title {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 22px;
    font-weight: 600;
    margin: 0 0 6px;
    color: #3a2614;
  }
  .bw-desc {
    font-size: 14px;
    line-height: 1.45;
    margin: 0 0 10px;
    color: #4a3a2a;
  }
  .bw-meta {
    font-size: 12px;
    color: #7a5d3e;
    letter-spacing: 0.02em;
    margin: 0 0 12px;
    text-transform: uppercase;
  }
  .bw-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 8px;
  }
  .bw-price {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 20px;
    font-weight: 600;
    color: #3a2614;
  }
  .bw-cta {
    appearance: none;
    border: 0;
    background: #5b3a1d;
    color: #fff7e6;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    padding: 10px 14px;
    border-radius: 8px;
    cursor: pointer;
  }
  .bw-cta:hover { background: #7a4f29; }
  .bw-cta:active { background: #4a2f17; }
</style>
</head>
<body>
  <div class="bw-debug-badge">&#129514; show_product_widget</div>
  <article class="bw-card">
    ${image}
    <div class="bw-body">
      <h1 class="bw-title">${name}</h1>
      <p class="bw-desc">${description}</p>
      <p class="bw-meta">${meta}</p>
      <div class="bw-row">
        <span class="bw-price">${price}</span>
        <button class="bw-cta" type="button" onclick="try{window.parent.postMessage({source:'mcp-app',action:'add_to_cart',productId:'${p.id}'},'*')}catch(e){}">Aggiungi al carrello</button>
      </div>
    </div>
  </article>
</body>
</html>`;
}

export function widgetUri(productId: string): string {
  return `ui://bellaroma/product-card/${productId}`;
}

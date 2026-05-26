import {
  PRODUCTS,
  getProductById,
  COUPONS,
  type SizeOption,
  type SweetnessOption,
} from "./products";
import { defaultOptionsFor, useCartStore } from "../store/cart";
import {
  buildCartPanelHtml,
  buildProductCardHtml,
  buildProductGridHtml,
  cartPanelUri,
  productCardUri,
  productGridUri,
  WIDGET_MIME_TYPE,
  WIDGET_RESOURCE_DOMAINS,
  type CartSnapshot,
} from "./widgets";
import { RELAY_HTTP_URL, RELAY_WS_URL } from "./relay-config";

const MAX_LINE_QUANTITY = 10;

function findProductCaseInsensitive(id: string) {
  const direct = getProductById(id);
  if (direct) return direct;
  const needle = id.trim().toLowerCase();
  if (!needle) return undefined;
  return PRODUCTS.find((p) => p.id.toLowerCase() === needle);
}

function validateQuantity(
  raw: unknown,
): { ok: true; value: number } | { ok: false; message: string } {
  if (raw === undefined || raw === null) {
    return { ok: false, message: "Parametro 'quantity' obbligatorio (intero 1-10)." };
  }
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return {
      ok: false,
      message: `Parametro 'quantity' deve essere un intero numerico (ricevuto: ${JSON.stringify(raw)}).`,
    };
  }
  if (!Number.isInteger(raw)) {
    return { ok: false, message: `Parametro 'quantity' deve essere intero (ricevuto ${raw}).` };
  }
  if (raw < 1 || raw > MAX_LINE_QUANTITY) {
    return {
      ok: false,
      message: `Parametro 'quantity' fuori range: deve essere 1-${MAX_LINE_QUANTITY} (ricevuto ${raw}).`,
    };
  }
  return { ok: true, value: raw };
}

type TextBlock = { type: "text"; text: string };
type ResourceLinkBlock = {
  type: "resource_link";
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
};

export type ContentBlock = TextBlock | ResourceLinkBlock;

export type ToolResult = {
  content: ContentBlock[];
  isError?: boolean;
};

// cdn.jsdelivr.net è nella CSP img-src degli iframe MCP App di Claude Desktop;
// il dominio Vercel non lo è. Asset serviti da questo repo via jsdelivr.
const IMAGE_BASE_URL =
  "https://cdn.jsdelivr.net/gh/Sgr57/Bella-Roma-WebMCP@main/public/products/editorial";

export type Agent = {
  requestUserInteraction?: <T>(fn: () => Promise<T> | T) => Promise<T>;
};

export type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>, agent?: Agent) => Promise<ToolResult>;
  /**
   * MCP Apps `_meta` (spec 2026-01-26). When `_meta.ui.resourceUri` is set,
   * hosts that support MCP Apps mount the named `ui://` resource as an
   * inline widget alongside the tool result. Clients without MCP Apps
   * support ignore `_meta` and render only `content`.
   */
  _meta?: {
    ui?: {
      resourceUri?: string;
      // Other MCP Apps tool-level hints (visibility, etc.) live here when
      // we adopt them — out of scope for v1.
    };
    [k: string]: unknown;
  };
};

function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}
function err(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

// ---- MCP Apps widget state (Phase 3) --------------------------------------
//
// Three widgets need data that is computed by the tool call that triggered
// them. We capture the last invocation's data so the `ui://` resource
// provider — invoked LATER by the host via `resources/read` — can render
// the right product set / product card / cart snapshot.
//
// This mirrors how reference MCP Apps servers work (e.g. the cohort-heatmap
// example caches the last `query_cohorts` result keyed by a session id).
// Because BellaRoma's host today only mounts one widget at a time, a
// single mutable slot per widget is sufficient.

type LastSearchResults = {
  queryLabel: string;
  products: ReturnType<typeof PRODUCTS.filter>;
};

const widgetState = {
  lastSearch: null as LastSearchResults | null,
  lastProductId: null as string | null,
};

function describeSearchQuery(args: Record<string, unknown>): string {
  const bits: string[] = [];
  const a = args as Record<string, unknown>;
  if (typeof a.query === "string" && a.query.length > 0) bits.push(`"${a.query}"`);
  if (typeof a.category === "string") bits.push(a.category);
  if (typeof a.type === "string") bits.push(a.type);
  if (typeof a.origin === "string") bits.push(a.origin);
  if (Array.isArray(a.tags) && a.tags.length > 0)
    bits.push(`tag: ${(a.tags as string[]).join("+")}`);
  if (Array.isArray(a.dietary) && a.dietary.length > 0)
    bits.push((a.dietary as string[]).join("+"));
  if (Array.isArray(a.flavor_notes) && a.flavor_notes.length > 0)
    bits.push((a.flavor_notes as string[]).join("+"));
  if (typeof a.max_price === "number") bits.push(`< €${a.max_price}`);
  return bits.length > 0 ? bits.join(" · ") : "Tutti i prodotti";
}

function snapshotCart(): CartSnapshot {
  const s = useCartStore.getState();
  return {
    items: s.items.map((it) => ({
      productId: it.productId,
      quantity: it.quantity,
      ...(it.options ? { options: { ...it.options } } : {}),
    })),
    coupon: s.coupon,
    subtotal: s.subtotal(),
    discount: s.discount(),
    total: s.total(),
  };
}

// Reset helper used by tests so a previous test's invocation cannot leak
// into the next one's widget state.
export function __resetWidgetStateForTests(): void {
  widgetState.lastSearch = null;
  widgetState.lastProductId = null;
}

function formatAlternatives(ids?: string[]): string {
  if (!ids || ids.length === 0) return "";
  const labels = ids
    .map((id) => {
      const p = getProductById(id);
      if (!p) return id;
      const mod = p.price > 0 ? ` (+€${p.price.toFixed(2)})` : "";
      return `${p.name} (${p.id})${mod}`;
    })
    .join(", ");
  return ` Alternative simili: ${labels}.`;
}

function formatOptionsLabel(o?: {
  size?: SizeOption;
  milk?: string;
  sweetness?: SweetnessOption;
}): string {
  if (!o) return "";
  const bits: string[] = [];
  if (o.size) bits.push(`size ${o.size}`);
  if (o.milk) {
    const m = getProductById(o.milk);
    bits.push(`latte: ${m?.name ?? o.milk}`);
  }
  if (o.sweetness) bits.push(`zucchero: ${o.sweetness}`);
  return bits.length ? ` (${bits.join(", ")})` : "";
}

function formatLine(item: {
  productId: string;
  quantity: number;
  options?: { size?: SizeOption; milk?: string; sweetness?: SweetnessOption };
}): string {
  const p = getProductById(item.productId);
  if (!p) return `${item.productId} x${item.quantity}`;
  const opts = formatOptionsLabel(item.options);
  let unit = p.price;
  if (item.options?.size && p.options?.size?.price_modifier) {
    unit += p.options.size.price_modifier[item.options.size] ?? 0;
  }
  if (item.options?.milk) {
    const m = getProductById(item.options.milk);
    if (m) unit += m.price;
  }
  return `${p.name} x${item.quantity}${opts} (€${(unit * item.quantity).toFixed(2)})`;
}

export function buildTools(): Tool[] {
  return [
    {
      name: "search_products",
      description:
        "Cerca prodotti nel catalogo (drink, food, beans, capsule). Quando l'utente nomina un prodotto specifico (es. 'voglio un cappuccino', 'mostrami l'espresso') preferisci `get_product` per la scheda dettagliata; usa `search_products` per query di browse/filtro (es. 'cosa avete di filtro', 'prodotti senza lattosio'). I prodotti di tipo milk_option sono esclusi di default — passa type:'milk_option' per includerli. Tutti i filtri sono in AND; tags/dietary/flavor_notes sono AND interno (il prodotto deve avere tutti i valori richiesti).",
      _meta: { ui: { resourceUri: productGridUri() } },
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Testo libero da cercare nel nome o nella descrizione",
          },
          category: {
            type: "string",
            enum: [
              "espresso",
              "filtro",
              "decaf",
              "latte",
              "cold",
              "food",
              "beans",
              "capsule",
            ],
          },
          type: {
            type: "string",
            enum: ["drink", "food", "beans", "capsule", "milk_option"],
          },
          max_price: { type: "number", description: "Prezzo massimo in euro" },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Tag richiesti (AND). Es: ['signature', 'best-seller']",
          },
          dietary: {
            type: "array",
            items: {
              type: "string",
              enum: ["vegan", "lactose-free", "gluten-free", "no-caffeine"],
            },
            description: "Requisiti dietetici richiesti (AND)",
          },
          flavor_notes: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "floral",
                "fruity",
                "chocolate",
                "caramel",
                "nutty",
                "citrus",
                "spicy",
                "honey",
                "berry",
              ],
            },
            description: "Note aromatiche richieste (AND)",
          },
          origin: {
            type: "string",
            description: "Es: 'Etiopia', 'Colombia', 'Italia'",
          },
          intensity_min: { type: "number", minimum: 1, maximum: 10 },
          intensity_max: { type: "number", minimum: 1, maximum: 10 },
          time_of_day: {
            type: "string",
            enum: ["morning", "afternoon", "evening", "anytime"],
          },
          in_stock_only: {
            type: "boolean",
            description: "Se true, esclude i prodotti non disponibili",
          },
        },
      },
      async execute(args) {
        const a = args as {
          query?: string;
          category?: string;
          type?: string;
          max_price?: number;
          tags?: string[];
          dietary?: string[];
          flavor_notes?: string[];
          origin?: string;
          intensity_min?: number;
          intensity_max?: number;
          time_of_day?: string;
          in_stock_only?: boolean;
        };
        const q = (a.query ?? "").toLowerCase().trim();
        const results = PRODUCTS.filter((p) => {
          if (p.type === "milk_option" && a.type !== "milk_option") return false;
          if (a.type && p.type !== a.type) return false;
          if (a.category && p.category !== a.category) return false;
          if (typeof a.max_price === "number" && p.price > a.max_price)
            return false;
          if (a.origin && p.origin !== a.origin) return false;
          if (
            typeof a.intensity_min === "number" &&
            (p.intensity ?? 0) < a.intensity_min
          )
            return false;
          if (
            typeof a.intensity_max === "number" &&
            (p.intensity ?? 10) > a.intensity_max
          )
            return false;
          if (a.in_stock_only && !p.available) return false;
          if (a.tags && a.tags.length > 0) {
            const has = new Set(p.tags ?? []);
            if (!a.tags.every((t) => has.has(t))) return false;
          }
          if (a.dietary && a.dietary.length > 0) {
            const has = new Set<string>(p.dietary ?? []);
            if (!a.dietary.every((d) => has.has(d))) return false;
          }
          if (a.flavor_notes && a.flavor_notes.length > 0) {
            const has = new Set<string>(p.flavor_notes ?? []);
            if (!a.flavor_notes.every((f) => has.has(f))) return false;
          }
          if (a.time_of_day) {
            const has = new Set<string>(p.time_of_day ?? []);
            if (!has.has(a.time_of_day) && !has.has("anytime")) return false;
          }
          if (q && !`${p.name} ${p.description}`.toLowerCase().includes(q))
            return false;
          return true;
        });
        const text = results.length
          ? results
              .map((p) => {
                const bits = [
                  `${p.name} (id: ${p.id}, ${p.category})`,
                  typeof p.intensity === "number"
                    ? `intensità ${p.intensity}/10`
                    : null,
                  p.origin ? p.origin : null,
                  `€${p.price.toFixed(2)}`,
                  p.available ? null : "ESAURITO",
                ].filter(Boolean);
                return `- ${bits.join(" — ")} — ${p.description}`;
              })
              .join("\n")
          : "Nessun prodotto trovato.";
        // Capture the result set so the product-grid widget provider
        // (registered via navigator.modelContext.resources) can render the
        // same list when the host later issues `resources/read`.
        widgetState.lastSearch = {
          queryLabel: describeSearchQuery(args),
          products: results,
        };
        useCartStore
          .getState()
          .logToolCall("search_products", args, `${results.length} risultati`);
        return ok(text);
      },
    },
    {
      name: "get_product",
      _meta: { ui: { resourceUri: productCardUri() } },
      description:
        "USA QUESTO TOOL quando l'utente esprime interesse in un prodotto specifico (es. 'voglio un cappuccino', 'mostrami l'espresso', 'parlami del flat white'). La scheda contiene il configuratore (size/milk/sweetness) che l'utente DEVE poter usare prima dell'aggiunta al carrello. Restituisce la scheda completa di un prodotto: attributi (intensità, origine, note aromatiche, dietary, tag, time_of_day), disponibilità, alternative se esaurito, pairing consigliati, prodotti correlati (es. chicchi da asporto della stessa bevanda) e opzioni di personalizzazione (size, milk, sweetness). Usalo per ragionare su un singolo prodotto in dettaglio.",
      inputSchema: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "L'id del prodotto" },
        },
        required: ["product_id"],
      },
      async execute(args) {
        const a = args as { product_id?: unknown };
        if (typeof a.product_id !== "string" || a.product_id.length === 0) {
          useCartStore.getState().logToolCall("get_product", args, "errore: product_id mancante");
          return err("Parametro 'product_id' obbligatorio (stringa non vuota).");
        }
        const product_id = a.product_id;
        const p = findProductCaseInsensitive(product_id);
        if (!p) {
          useCartStore
            .getState()
            .logToolCall("get_product", args, "non trovato");
          return err(`Prodotto "${product_id}" non trovato.`);
        }
        const lines: string[] = [];
        lines.push(`# ${p.name} (${p.id})`);
        lines.push(`Tipo: ${p.type} · Categoria: ${p.category}`);
        lines.push(`Prezzo base: €${p.price.toFixed(2)}`);
        if (typeof p.intensity === "number")
          lines.push(`Intensità: ${p.intensity}/10`);
        if (p.origin) lines.push(`Origine: ${p.origin}`);
        if (p.flavor_notes?.length)
          lines.push(`Note aromatiche: ${p.flavor_notes.join(", ")}`);
        if (p.dietary?.length) lines.push(`Dietary: ${p.dietary.join(", ")}`);
        if (p.temperature) lines.push(`Servizio: ${p.temperature}`);
        if (p.time_of_day?.length)
          lines.push(`Momento: ${p.time_of_day.join(", ")}`);
        if (p.tags?.length) lines.push(`Tag: ${p.tags.join(", ")}`);
        lines.push(`Disponibilità: ${p.available ? "disponibile" : "ESAURITO"}`);
        if (!p.available && p.alternatives?.length) {
          const altLabels = p.alternatives
            .map((id) => {
              const a = getProductById(id);
              return a ? `${a.name} (${a.id})` : id;
            })
            .join(", ");
          lines.push(`Alternative consigliate: ${altLabels}`);
        }
        if (p.pairings?.length) {
          const ps = p.pairings
            .map((id) => {
              const x = getProductById(id);
              return x ? `${x.name} (${x.id})` : id;
            })
            .join(", ");
          lines.push(`Pairing consigliati: ${ps}`);
        }
        if (p.related_products?.length) {
          const rs = p.related_products
            .map((id) => {
              const x = getProductById(id);
              return x ? `${x.name} (${x.id})` : id;
            })
            .join(", ");
          lines.push(`Prodotti correlati: ${rs}`);
        }
        if (p.options) {
          lines.push("Opzioni:");
          if (p.options.size) {
            const sz = p.options.size;
            const mods = sz.values
              .map(
                (v) =>
                  `${v}${sz.price_modifier[v] ? ` (+€${sz.price_modifier[v]?.toFixed(2)})` : ""}`,
              )
              .join(", ");
            lines.push(`  - size: ${mods} · default ${sz.default}`);
          }
          if (p.options.milk) {
            const milkLabels = p.options.milk.values
              .map((id) => {
                const m = getProductById(id);
                if (!m) return id;
                const avail = m.available ? "" : " [ESAURITO]";
                const mod = m.price > 0 ? ` (+€${m.price.toFixed(2)})` : "";
                return `${m.name} (${m.id})${mod}${avail}`;
              })
              .join(", ");
            lines.push(
              `  - milk: ${milkLabels} · default ${p.options.milk.default}`,
            );
          }
          if (p.options.sweetness) {
            lines.push(
              `  - sweetness: ${p.options.sweetness.values.join(", ")} · default ${p.options.sweetness.default}`,
            );
          }
        }
        const text = lines.join("\n");
        // Remember which product this was so the product-card widget
        // provider can render it on the next `resources/read` request.
        widgetState.lastProductId = p.id;
        useCartStore
          .getState()
          .logToolCall("get_product", args, `${p.id} (${p.type})`);
        return ok(text);
      },
    },
    {
      name: "add_to_cart",
      description:
        "Aggiunge un prodotto al carrello in una certa quantità. Per prodotti con opzioni di personalizzazione (caffè, cappuccino, espresso, latte macchiato, etc.), USA PRIMA `get_product` per mostrare la scheda con configuratore. Chiama `add_to_cart` direttamente solo (a) dopo che l'utente ha confermato esplicitamente la configurazione tramite la scheda, oppure (b) per prodotti senza opzioni (food, beans, capsule). Supporta options (size, milk, sweetness) se il prodotto le offre. Se il prodotto o l'opzione richiesta è ESAURITA, ritorna un errore strutturato con alternative coerenti che puoi proporre all'utente.",
      inputSchema: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "L'id del prodotto" },
          quantity: { type: "integer", minimum: 1, maximum: 10 },
          options: {
            type: "object",
            properties: {
              size: { type: "string", enum: ["S", "M", "L"] },
              milk: {
                type: "string",
                description: "id di un milk_option (es. milk-oat, milk-almond)",
              },
              sweetness: { type: "string", enum: ["none", "low", "normal"] },
            },
          },
        },
        required: ["product_id", "quantity"],
      },
      async execute(args) {
        const a = args as {
          product_id?: unknown;
          quantity?: unknown;
          options?: { size?: SizeOption; milk?: string; sweetness?: SweetnessOption };
        };
        if (typeof a.product_id !== "string" || a.product_id.length === 0) {
          useCartStore
            .getState()
            .logToolCall("add_to_cart", args, "errore: product_id mancante");
          return err("Parametro 'product_id' obbligatorio (stringa non vuota).");
        }
        const product_id = a.product_id;
        const qCheck = validateQuantity(a.quantity);
        if (!qCheck.ok) {
          useCartStore.getState().logToolCall("add_to_cart", args, `errore: ${qCheck.message}`);
          return err(qCheck.message);
        }
        const quantity = qCheck.value;
        const options = a.options;
        const product = findProductCaseInsensitive(product_id);
        if (!product) {
          useCartStore
            .getState()
            .logToolCall("add_to_cart", args, "errore: prodotto non trovato");
          return err(`Prodotto "${product_id}" non trovato.`);
        }
        if (product.type === "milk_option") {
          useCartStore
            .getState()
            .logToolCall("add_to_cart", args, "errore: milk_option non vendibile");
          return err(
            `"${product.name}" è un modificatore latte, non vendibile da solo. Usalo come options.milk su una bevanda.`,
          );
        }
        if (!product.available) {
          const altText = formatAlternatives(product.alternatives);
          const msg = `Prodotto "${product.name}" ESAURITO.${altText}`;
          useCartStore.getState().logToolCall("add_to_cart", args, "errore: esaurito");
          return err(msg);
        }
        const existingQty = useCartStore
          .getState()
          .quantityFor(product.id, options);
        if (existingQty + quantity > MAX_LINE_QUANTITY) {
          const msg = `Limite di ${MAX_LINE_QUANTITY} per riga: ne hai già ${existingQty}, puoi aggiungerne al massimo ${MAX_LINE_QUANTITY - existingQty}.`;
          useCartStore
            .getState()
            .logToolCall("add_to_cart", args, "errore: limite riga superato");
          return err(msg);
        }
        if (options?.size) {
          if (!product.options?.size?.values.includes(options.size)) {
            useCartStore
              .getState()
              .logToolCall("add_to_cart", args, "errore: size non offerta");
            return err(
              `Il prodotto "${product.name}" non offre la dimensione "${options.size}".`,
            );
          }
        }
        if (options?.sweetness) {
          if (!product.options?.sweetness?.values.includes(options.sweetness)) {
            useCartStore
              .getState()
              .logToolCall("add_to_cart", args, "errore: sweetness non offerta");
            return err(
              `Il prodotto "${product.name}" non offre il livello di zucchero "${options.sweetness}".`,
            );
          }
        }
        if (options?.milk) {
          if (!product.options?.milk?.values.includes(options.milk)) {
            useCartStore
              .getState()
              .logToolCall("add_to_cart", args, "errore: milk non offerto");
            return err(
              `Il prodotto "${product.name}" non offre l'opzione latte "${options.milk}".`,
            );
          }
          const milkProduct = getProductById(options.milk);
          if (!milkProduct) {
            return err(`Opzione latte "${options.milk}" sconosciuta.`);
          }
          if (!milkProduct.available) {
            const altText = formatAlternatives(milkProduct.alternatives);
            const msg = `Opzione latte "${milkProduct.name}" ESAURITA.${altText}`;
            useCartStore
              .getState()
              .logToolCall("add_to_cart", args, "errore: milk esaurito");
            return err(msg);
          }
        }
        const okAdd = useCartStore
          .getState()
          .addItem(product.id, quantity, options);
        if (!okAdd) {
          useCartStore
            .getState()
            .logToolCall("add_to_cart", args, "errore generico");
          return err(`Impossibile aggiungere "${product_id}".`);
        }
        const effective = { ...defaultOptionsFor(product.id), ...options };
        const optsLabel = formatOptionsLabel(effective);
        const totalQty = useCartStore.getState().quantityFor(product.id, options);
        const mergeNote =
          existingQty > 0
            ? ` (riga ora x${totalQty}, era x${existingQty})`
            : "";
        const msg = `Aggiunto: ${product.name} x${quantity}${optsLabel}${mergeNote}.`;
        useCartStore.getState().logToolCall("add_to_cart", args, msg);
        return ok(msg);
      },
    },
    {
      name: "remove_from_cart",
      description:
        "Rimuove una riga dal carrello. Passa anche 'options' (size/milk/sweetness) se il carrello contiene più righe dello stesso prodotto con opzioni diverse, altrimenti viene rimossa la prima riga che combacia con il product_id.",
      inputSchema: {
        type: "object",
        properties: {
          product_id: { type: "string" },
          options: {
            type: "object",
            description:
              "Opzioni per disambiguare quale riga rimuovere (size/milk/sweetness).",
            properties: {
              size: { type: "string", enum: ["S", "M", "L"] },
              milk: { type: "string" },
              sweetness: { type: "string", enum: ["none", "low", "normal"] },
            },
          },
        },
        required: ["product_id"],
      },
      async execute(args) {
        const a = args as {
          product_id?: unknown;
          options?: { size?: SizeOption; milk?: string; sweetness?: SweetnessOption };
        };
        if (typeof a.product_id !== "string" || a.product_id.length === 0) {
          useCartStore
            .getState()
            .logToolCall("remove_from_cart", args, "errore: product_id mancante");
          return err("Parametro 'product_id' obbligatorio (stringa non vuota).");
        }
        const product_id = a.product_id;
        const product = findProductCaseInsensitive(product_id);
        const canonicalId = product?.id ?? product_id;
        const removed = useCartStore
          .getState()
          .removeItem(canonicalId, a.options);
        if (!removed) {
          useCartStore
            .getState()
            .logToolCall("remove_from_cart", args, "non era nel carrello");
          return err(`"${product_id}" non era nel carrello.`);
        }
        const remaining = useCartStore.getState().quantityFor(canonicalId);
        const tail = remaining > 0 ? ` Restano ${remaining} unità con opzioni diverse.` : "";
        const msg = `Rimosso "${canonicalId}" dal carrello.${tail}`;
        useCartStore.getState().logToolCall("remove_from_cart", args, msg);
        return ok(msg);
      },
    },
    {
      name: "apply_coupon",
      description:
        "Applica un codice sconto al carrello. Codici disponibili: BENVENUTO (10%), STUDENTI (20% max €5). Se un coupon era già attivo viene sovrascritto e segnalato nel messaggio.",
      inputSchema: {
        type: "object",
        properties: {
          code: { type: "string" },
        },
        required: ["code"],
      },
      async execute(args) {
        const a = args as { code?: unknown };
        if (typeof a.code !== "string" || a.code.trim().length === 0) {
          useCartStore.getState().logToolCall("apply_coupon", args, "errore: code mancante");
          return err("Parametro 'code' obbligatorio (stringa non vuota).");
        }
        const code = a.code;
        const result = useCartStore.getState().applyCoupon(code);
        if (!result.ok) {
          useCartStore.getState().logToolCall("apply_coupon", args, "non valido");
          const available = Object.keys(COUPONS).join(", ");
          return err(`Coupon "${code}" non valido. Disponibili: ${available}.`);
        }
        const overwrite = result.previous
          ? ` (sostituisce ${result.previous})`
          : "";
        const cartHint =
          useCartStore.getState().items.length === 0
            ? " Il carrello è vuoto: lo sconto sarà attivo al primo prodotto aggiunto."
            : "";
        const msg = `Coupon ${code.toUpperCase()} applicato${overwrite}.${cartHint}`;
        useCartStore.getState().logToolCall("apply_coupon", args, msg);
        return ok(msg);
      },
    },
    {
      name: "remove_coupon",
      description:
        "Rimuove il coupon attualmente applicato al carrello. Non rimuove i prodotti.",
      inputSchema: { type: "object", properties: {} },
      async execute() {
        const had = useCartStore.getState().clearCoupon();
        const msg = had
          ? "Coupon rimosso."
          : "Nessun coupon era applicato.";
        useCartStore.getState().logToolCall("remove_coupon", {}, msg);
        return ok(msg);
      },
    },
    {
      name: "clear_cart",
      description:
        "Svuota completamente il carrello e rimuove il coupon. Usalo quando l'utente vuole ricominciare da zero.",
      inputSchema: { type: "object", properties: {} },
      async execute() {
        const s = useCartStore.getState();
        const hadItems = s.items.length;
        const hadCoupon = s.coupon !== null;
        s.clearCart();
        const msg = hadItems === 0 && !hadCoupon
          ? "Carrello già vuoto."
          : `Carrello svuotato (${hadItems} righe rimosse${hadCoupon ? " + coupon rimosso" : ""}).`;
        useCartStore.getState().logToolCall("clear_cart", {}, msg);
        return ok(msg);
      },
    },
    {
      name: "get_cart",
      description: "Ritorna il contenuto corrente del carrello con totali.",
      _meta: { ui: { resourceUri: cartPanelUri() } },
      inputSchema: { type: "object", properties: {} },
      async execute() {
        const s = useCartStore.getState();
        if (s.items.length === 0) {
          useCartStore.getState().logToolCall("get_cart", {}, "vuoto");
          return ok("Il carrello è vuoto.");
        }
        const lines = s.items.map((it) => `- ${formatLine(it)}`);
        const summary = [
          ...lines,
          `Subtotale: €${s.subtotal().toFixed(2)}`,
          s.coupon
            ? `Sconto (${s.coupon}): -€${s.discount().toFixed(2)}`
            : "Nessun coupon applicato",
          `Totale: €${s.total().toFixed(2)}`,
        ].join("\n");
        useCartStore
          .getState()
          .logToolCall("get_cart", {}, `${s.items.length} righe`);
        return ok(summary);
      },
    },
    {
      name: "show_product_image",
      description:
        "DEPRECATO — preferire `get_product` (mostra una scheda widget interattiva sui client MCP Apps). Restituisce l'immagine editoriale del prodotto come MCP resource_link. Mantenuto per i client privi di MCP Apps (Gemini, ecc.) che renderizzano solo i resource_link.",
      inputSchema: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "L'id del prodotto" },
        },
        required: ["product_id"],
      },
      async execute(args) {
        const a = args as { product_id?: unknown };
        if (typeof a.product_id !== "string" || a.product_id.length === 0) {
          useCartStore
            .getState()
            .logToolCall("show_product_image", args, "errore: product_id mancante");
          return err("Parametro 'product_id' obbligatorio (stringa non vuota).");
        }
        const p = findProductCaseInsensitive(a.product_id);
        if (!p) {
          useCartStore
            .getState()
            .logToolCall("show_product_image", args, "non trovato");
          return err(`Prodotto "${a.product_id}" non trovato.`);
        }
        const uri = `${IMAGE_BASE_URL}/${p.id}.webp`;
        useCartStore
          .getState()
          .logToolCall("show_product_image", args, `${p.id}.webp`);
        return {
          content: [
            { type: "text", text: `Immagine del prodotto ${p.name} (${p.id}).` },
            {
              type: "resource_link",
              uri,
              name: `${p.name} — immagine editoriale`,
              description: `Foto editoriale di ${p.name}`,
              mimeType: "image/webp",
            },
          ],
        };
      },
    },
    {
      name: "checkout",
      description:
        "Conferma l'ordine e completa il pagamento. Richiede conferma esplicita dell'utente.",
      inputSchema: { type: "object", properties: {} },
      async execute(_args, agent) {
        const s = useCartStore.getState();
        if (s.items.length === 0) {
          useCartStore.getState().logToolCall("checkout", {}, "carrello vuoto");
          return err("Il carrello è vuoto, niente da pagare.");
        }
        const total = s.total();
        const { requestCheckoutConfirmation } = await import("./checkout-bridge");
        const ask = () => requestCheckoutConfirmation(total);
        const confirmed = agent?.requestUserInteraction
          ? await agent.requestUserInteraction(ask)
          : await ask();
        if (!confirmed) {
          useCartStore
            .getState()
            .logToolCall("checkout", {}, "annullato dall'utente");
          return ok("Pagamento annullato dall'utente.");
        }
        const result = useCartStore.getState().checkout();
        const msg = `Ordine confermato! Totale pagato: €${result.total.toFixed(2)}.`;
        useCartStore.getState().logToolCall("checkout", {}, msg);
        return ok(msg);
      },
    },
  ];
}

let registered = false;

/**
 * Test-only helper. Resets the `registered` guard so `registerTools()` can
 * be re-invoked against a fresh `navigator.modelContext` stub.
 */
export function __resetForTests(): void {
  registered = false;
  __resetWidgetStateForTests();
}

async function listExistingToolNames(getTools?: () => unknown): Promise<Set<string>> {
  if (!getTools) return new Set();
  try {
    const raw = await Promise.resolve(getTools());
    const arr = Array.isArray(raw) ? raw : [];
    return new Set(arr.map((t) => (t as { name: string }).name));
  } catch {
    return new Set();
  }
}

// ---- MCP Apps widget providers --------------------------------------------
//
// Three widget resources registered via the polyfill's `resources` namespace
// (Phase 2 of the resources-forwarding fork). Each provider returns a
// `text/html;profile=mcp-app` payload and CSP `_meta` declaring jsdelivr
// for product images.
//
// Providers are CALLED LAZILY by the polyfill when the host issues
// `resources/read` — not at registration time. They read `widgetState`
// (set by the last `search_products` / `get_product` / `get_cart` call)
// to know what to render. If the state slot is empty (no preceding call)
// the provider returns a sensible default snapshot.

interface ResourceProviderResult {
  text?: string;
  blob?: string;
  mimeType: string;
  meta?: Record<string, unknown>;
}

type ResourcesNamespace = {
  register: (
    uri: string,
    provider: () => Promise<ResourceProviderResult> | ResourceProviderResult,
    options?: {
      name?: string;
      title?: string;
      description?: string;
      mimeType?: string;
      _meta?: Record<string, unknown>;
    },
  ) => void;
  unregister: (uri: string) => void;
};

function getResourcesNamespace(
  mc: object,
): ResourcesNamespace | null {
  const candidate = (mc as { resources?: unknown }).resources;
  if (!candidate || typeof candidate !== "object") return null;
  const c = candidate as Record<string, unknown>;
  if (typeof c.register !== "function" || typeof c.unregister !== "function") {
    return null;
  }
  return c as unknown as ResourcesNamespace;
}

// Shared CSP `_meta` for every widget. `resourceDomains` is for img/script
// hosts; `connectDomains` lists callback endpoints (relay-bound websocket
// origins). Endpoint values come from `relay-config.ts` so the relay client
// and the CSP allow-list never drift apart. Hosts treat absent connect
// domains as deny-list anyway.
const WIDGET_CSP_META = {
  ui: {
    csp: {
      resourceDomains: WIDGET_RESOURCE_DOMAINS,
      connectDomains: [RELAY_HTTP_URL, RELAY_WS_URL],
    },
  },
} as const;

async function provideProductGrid(): Promise<ResourceProviderResult> {
  const snap = widgetState.lastSearch;
  const products = snap?.products ?? PRODUCTS.filter((p) => p.type !== "milk_option");
  const queryLabel = snap?.queryLabel ?? "Tutti i prodotti";
  return {
    text: buildProductGridHtml(products, queryLabel),
    mimeType: WIDGET_MIME_TYPE,
    meta: WIDGET_CSP_META,
  };
}

async function provideProductCard(): Promise<ResourceProviderResult> {
  const id = widgetState.lastProductId;
  const product = id ? getProductById(id) : undefined;
  if (!product) {
    // Default to the first available drink so the widget is never blank.
    const fallback = PRODUCTS.find((p) => p.type === "drink" && p.available);
    if (!fallback) {
      throw new Error("Nessun prodotto disponibile");
    }
    return {
      text: buildProductCardHtml(fallback),
      mimeType: WIDGET_MIME_TYPE,
      meta: WIDGET_CSP_META,
    };
  }
  return {
    text: buildProductCardHtml(product),
    mimeType: WIDGET_MIME_TYPE,
    meta: WIDGET_CSP_META,
  };
}

async function provideCartPanel(): Promise<ResourceProviderResult> {
  return {
    text: buildCartPanelHtml(snapshotCart()),
    mimeType: WIDGET_MIME_TYPE,
    meta: WIDGET_CSP_META,
  };
}

function registerWidgets(resources: ResourcesNamespace): number {
  let count = 0;
  try {
    resources.register(productGridUri(), provideProductGrid, {
      name: "bellaroma-product-grid",
      title: "Catalogo Bella Roma",
      description: "Griglia prodotti interattiva per i risultati di search_products.",
      mimeType: WIDGET_MIME_TYPE,
    });
    count++;
  } catch (err) {
    console.warn("[webmcp] failed to register product-grid widget:", err);
  }
  try {
    resources.register(productCardUri(), provideProductCard, {
      name: "bellaroma-product-card",
      title: "Scheda prodotto Bella Roma",
      description:
        "Scheda dettaglio con configuratore size/milk/sweetness e prezzo dinamico.",
      mimeType: WIDGET_MIME_TYPE,
    });
    count++;
  } catch (err) {
    console.warn("[webmcp] failed to register product-card widget:", err);
  }
  try {
    resources.register(cartPanelUri(), provideCartPanel, {
      name: "bellaroma-cart-panel",
      title: "Carrello Bella Roma",
      description: "Carrello live con stepper, coupon e checkout.",
      mimeType: WIDGET_MIME_TYPE,
    });
    count++;
  } catch (err) {
    console.warn("[webmcp] failed to register cart-panel widget:", err);
  }
  return count;
}

export async function registerTools(): Promise<void> {
  if (registered) return;
  const mc = navigator.modelContext as
    | undefined
    | {
        registerTool?: (tool: unknown) => unknown;
        provideContext?: (cfg: { tools: unknown[] }) => void;
        getTools?: () => unknown;
      };
  if (!mc) {
    console.warn(
      "[webmcp] navigator.modelContext not available, skipping registration"
    );
    return;
  }
  const tools = buildTools();
  // Native Chrome Canary API: registerTool per tool (può essere async).
  // Polyfill @mcp-b/global API: provideContext({tools}).
  if (typeof mc.registerTool === "function") {
    const existing = await listExistingToolNames(mc.getTools);
    let count = 0;
    for (const t of tools) {
      if (existing.has(t.name)) continue;
      try {
        await Promise.resolve(mc.registerTool(t));
        count++;
      } catch (err) {
        console.warn(`[webmcp] registerTool('${t.name}') failed:`, err);
      }
    }
    registered = true;
    console.info(`[webmcp] registered ${count}/${tools.length} tools via native registerTool`);
  } else if (typeof mc.provideContext === "function") {
    mc.provideContext({ tools });
    registered = true;
    console.info(`[webmcp] registered ${tools.length} tools via provideContext`);
  } else {
    console.warn("[webmcp] modelContext present but no known registration API");
    return;
  }

  // MCP Apps Phase 3: register the 3 widget resources alongside the tools.
  // Gracefully no-op when the polyfill doesn't expose `resources` (e.g.
  // unpatched polyfill or future Chrome native that hasn't implemented it).
  const resources = getResourcesNamespace(mc);
  if (!resources) {
    console.info(
      "[webmcp] navigator.modelContext.resources unavailable — MCP Apps widgets disabled (text/resource_link fallback active)",
    );
    return;
  }
  const widgetCount = registerWidgets(resources);
  console.info(
    `[webmcp] registered ${widgetCount}/3 MCP Apps widget resources via navigator.modelContext.resources`,
  );
}

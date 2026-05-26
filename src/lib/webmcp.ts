import {
  PRODUCTS,
  getProductById,
  COUPONS,
  type SizeOption,
  type SweetnessOption,
} from "./products";
import { defaultOptionsFor, useCartStore } from "../store/cart";
import {
  buildCart,
  buildMutationResult,
  buildProductCard,
  buildProductList,
  CART_SCHEMA,
  MUTATION_RESULT_SCHEMA,
  PRODUCT_CARD_SCHEMA,
  PRODUCT_LIST_SCHEMA,
  type ErrorCode,
} from "./webmcp-schemas";

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

export type ContentBlock = TextBlock;

export type ToolResult = {
  content: ContentBlock[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

export type Agent = {
  requestUserInteraction?: <T>(fn: () => Promise<T> | T) => Promise<T>;
};

export type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  execute: (args: Record<string, unknown>, agent?: Agent) => Promise<ToolResult>;
};

function err(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
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


function summarizeQuery(args: Record<string, unknown>): string {
  const bits: string[] = [];
  for (const [k, v] of Object.entries(args)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    bits.push(`${k}=${Array.isArray(v) ? v.join("|") : v}`);
  }
  return bits.length ? bits.join(", ") : "tutti i prodotti";
}

function mutErr(
  tool: string,
  code: ErrorCode,
  message: string,
  alternatives?: Array<{ id: string; label: string; price_delta?: number }>,
): ToolResult {
  const error: { code: ErrorCode; message: string; alternatives?: typeof alternatives } = {
    code,
    message,
  };
  if (alternatives && alternatives.length > 0) error.alternatives = alternatives;
  return {
    content: [{ type: "text", text: message }],
    structuredContent: buildMutationResult({ ok: false, tool, error }) as unknown as Record<string, unknown>,
    isError: true,
  };
}

function mutOk(tool: string, message: string): ToolResult {
  return {
    content: [{ type: "text", text: message }],
    structuredContent: buildMutationResult({ ok: true, tool, message }) as unknown as Record<string, unknown>,
  };
}

function altsFromProductIds(
  ids: string[] | undefined,
): Array<{ id: string; label: string; price_delta?: number }> {
  if (!ids) return [];
  const out: Array<{ id: string; label: string; price_delta?: number }> = [];
  for (const id of ids) {
    const p = getProductById(id);
    if (!p) continue;
    const entry: { id: string; label: string; price_delta?: number } = {
      id: p.id,
      label: p.name,
    };
    if (p.price > 0) entry.price_delta = p.price;
    out.push(entry);
  }
  return out;
}

export function buildTools(): Tool[] {
  return [
    {
      name: "__probe_structured",
      description:
        "[PRE-FLIGHT] Tool temporaneo per verificare che structuredContent arrivi a Claude Desktop. Da rimuovere prima del merge.",
      inputSchema: { type: "object", properties: {} },
      outputSchema: {
        type: "object",
        properties: {
          hello: { type: "string" },
          probe_version: { type: "number" },
        },
        required: ["hello", "probe_version"],
      },
      async execute() {
        useCartStore.getState().logToolCall("__probe_structured", {}, "probe");
        return {
          content: [{ type: "text", text: "ok" }],
          structuredContent: { hello: "world", probe_version: 1 },
        };
      },
    },
    {
      name: "search_products",
      description:
        "Cerca prodotti nel catalogo con filtri AND (testo, categoria, prezzo, tag,\n" +
        "dietary, note aromatiche, origine, intensità, momento del giorno).\n" +
        "Usalo quando l'utente chiede un'esplorazione (\"qualcosa di leggero\",\n" +
        "\"cosa avete di vegano\") o lista per criteri.\n" +
        "Output: structuredContent.kind=\"product_list\" con query_summary e items[]\n" +
        "(ciascuno con image_url e has_customization). Renderizza come griglia\n" +
        "markdown di card compatte (3-6 risultati max visibili: ![img], nome+prezzo,\n" +
        "1 riga descrizione, chip principali). Se ci sono più di 6 risultati riassumi\n" +
        "in fondo \"+N altri\" e proponi di restringere.\n" +
        "Dopo: invita l'utente a scegliere uno per get_product, o aggiungere\n" +
        "direttamente se has_customization=false.",
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
      outputSchema: PRODUCT_LIST_SCHEMA,
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
        const querySummary = summarizeQuery(args);
        const list = buildProductList(results, querySummary);
        const summary = results.length
          ? `${results.length} prodotti trovati per "${querySummary}"`
          : `Nessun prodotto trovato per "${querySummary}"`;
        useCartStore
          .getState()
          .logToolCall("search_products", args, `${results.length} risultati`);
        return {
          content: [{ type: "text", text: summary }],
          structuredContent: list as unknown as Record<string, unknown>,
        };
      },
    },
    {
      name: "get_product",
      description:
        "Restituisce la scheda completa di un prodotto del catalogo Bella Roma.\n" +
        "Usalo dopo search_products, o quando l'utente nomina un prodotto specifico\n" +
        "(\"dimmi del cappuccino\", \"questo cos'è\").\n" +
        "Output: structuredContent.kind=\"product_card\" con image_url, attributes\n" +
        "(intensità/origine/note), customization (size/milk/sweetness con price_delta\n" +
        "e available), pairings, related_products, next_actions. Renderizza come card\n" +
        "markdown: ![immagine](image_url), titolo, prezzo, chip [intensità · origine ·\n" +
        "dietary], descrizione, sezione \"Personalizza\" con opzioni numerate (mostra\n" +
        "price_delta se > 0 e segnala ESAURITO con alternatives), CTA finale.\n" +
        "Dopo: se customization è presente chiedi le scelte all'utente PRIMA di\n" +
        "chiamare add_to_cart, usando args_template come baseline.",
      inputSchema: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "L'id del prodotto" },
        },
        required: ["product_id"],
      },
      outputSchema: PRODUCT_CARD_SCHEMA,
      async execute(args) {
        const a = args as { product_id?: unknown };
        if (typeof a.product_id !== "string" || a.product_id.length === 0) {
          useCartStore
            .getState()
            .logToolCall("get_product", args, "errore: product_id mancante");
          return err("Parametro 'product_id' obbligatorio (stringa non vuota).");
        }
        const p = findProductCaseInsensitive(a.product_id);
        if (!p) {
          useCartStore
            .getState()
            .logToolCall("get_product", args, "non trovato");
          return err(`Prodotto "${a.product_id}" non trovato.`);
        }
        const card = buildProductCard(p);
        const summary = [
          `${p.name} — €${p.price.toFixed(2)}`,
          p.origin,
          typeof p.intensity === "number" ? `intensità ${p.intensity}/10` : null,
          p.options
            ? `${
                Object.keys(card.product.customization ?? {}).length
              } opzioni di personalizzazione`
            : null,
        ]
          .filter(Boolean)
          .join(" — ");
        useCartStore
          .getState()
          .logToolCall("get_product", args, `${p.id} (${p.type})`);
        return {
          content: [{ type: "text", text: summary }],
          structuredContent: card as unknown as Record<string, unknown>,
        };
      },
    },
    {
      name: "add_to_cart",
      description:
        "Aggiunge una riga al carrello con quantità e opzioni scelte.\n" +
        "Usalo SOLO dopo che l'utente ha confermato le opzioni di customization\n" +
        "(quando esistono). Se l'utente dice solo \"aggiungi cappuccino\" e il prodotto\n" +
        "ha customization, chiedi prima latte/size/zucchero invece di assumere i default.\n" +
        "Output: structuredContent.kind=\"mutation_result\" con ok, message, e cart\n" +
        "ricalcolato. Renderizza il message in 1 riga + la card del carrello aggiornata\n" +
        "(no doppia get_cart). In caso di ok=false leggi error.code e error.alternatives\n" +
        "per proporre rimpiazzi.\n" +
        "Dopo: chiedi se vuole completare con checkout o continuare a curiosare.",
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
      outputSchema: MUTATION_RESULT_SCHEMA,
      async execute(args) {
        const a = args as {
          product_id?: unknown;
          quantity?: unknown;
          options?: { size?: SizeOption; milk?: string; sweetness?: SweetnessOption };
        };
        if (typeof a.product_id !== "string" || a.product_id.length === 0) {
          useCartStore.getState().logToolCall("add_to_cart", args, "errore: product_id mancante");
          return mutErr("add_to_cart", "product_not_found", "Parametro 'product_id' obbligatorio.");
        }
        const product_id = a.product_id;
        const qCheck = validateQuantity(a.quantity);
        if (!qCheck.ok) {
          useCartStore.getState().logToolCall("add_to_cart", args, `errore: ${qCheck.message}`);
          return mutErr("add_to_cart", "quantity_out_of_range", qCheck.message);
        }
        const quantity = qCheck.value;
        const options = a.options;
        const product = findProductCaseInsensitive(product_id);
        if (!product) {
          useCartStore.getState().logToolCall("add_to_cart", args, "errore: prodotto non trovato");
          return mutErr("add_to_cart", "product_not_found", `Prodotto "${product_id}" non trovato.`);
        }
        if (product.type === "milk_option") {
          useCartStore.getState().logToolCall("add_to_cart", args, "errore: milk_option non vendibile");
          return mutErr(
            "add_to_cart",
            "invalid_option",
            `"${product.name}" è un modificatore latte, non vendibile da solo. Usalo come options.milk.`,
          );
        }
        if (!product.available) {
          useCartStore.getState().logToolCall("add_to_cart", args, "errore: esaurito");
          return mutErr(
            "add_to_cart",
            "out_of_stock",
            `Prodotto "${product.name}" esaurito.`,
            altsFromProductIds(product.alternatives),
          );
        }
        const existingQty = useCartStore.getState().quantityFor(product.id, options);
        if (existingQty + quantity > MAX_LINE_QUANTITY) {
          const remaining = MAX_LINE_QUANTITY - existingQty;
          const msg = `Limite di ${MAX_LINE_QUANTITY} per riga: ne hai già ${existingQty}, puoi aggiungerne al massimo ${remaining}.`;
          useCartStore.getState().logToolCall("add_to_cart", args, "errore: limite riga superato");
          return mutErr("add_to_cart", "line_quantity_limit", msg);
        }
        if (options?.size && !product.options?.size?.values.includes(options.size)) {
          useCartStore.getState().logToolCall("add_to_cart", args, "errore: size non offerta");
          return mutErr(
            "add_to_cart",
            "invalid_option",
            `Il prodotto "${product.name}" non offre la dimensione "${options.size}".`,
          );
        }
        if (options?.sweetness && !product.options?.sweetness?.values.includes(options.sweetness)) {
          useCartStore.getState().logToolCall("add_to_cart", args, "errore: sweetness non offerta");
          return mutErr(
            "add_to_cart",
            "invalid_option",
            `Il prodotto "${product.name}" non offre il livello di zucchero "${options.sweetness}".`,
          );
        }
        if (options?.milk) {
          if (!product.options?.milk?.values.includes(options.milk)) {
            useCartStore.getState().logToolCall("add_to_cart", args, "errore: milk non offerto");
            return mutErr(
              "add_to_cart",
              "invalid_option",
              `Il prodotto "${product.name}" non offre l'opzione latte "${options.milk}".`,
            );
          }
          const milkProduct = getProductById(options.milk);
          if (!milkProduct) {
            return mutErr("add_to_cart", "invalid_option", `Opzione latte "${options.milk}" sconosciuta.`);
          }
          if (!milkProduct.available) {
            useCartStore.getState().logToolCall("add_to_cart", args, "errore: milk esaurito");
            return mutErr(
              "add_to_cart",
              "out_of_stock",
              `Opzione latte "${milkProduct.name}" esaurita.`,
              altsFromProductIds(milkProduct.alternatives),
            );
          }
        }
        const okAdd = useCartStore.getState().addItem(product.id, quantity, options);
        if (!okAdd) {
          useCartStore.getState().logToolCall("add_to_cart", args, "errore generico");
          return mutErr("add_to_cart", "invalid_option", `Impossibile aggiungere "${product_id}".`);
        }
        const effective = { ...defaultOptionsFor(product.id), ...options };
        const optsLabel = formatOptionsLabel(effective);
        const totalQty = useCartStore.getState().quantityFor(product.id, options);
        const mergeNote = existingQty > 0 ? ` (riga ora x${totalQty})` : "";
        const msg = `Aggiunto: ${product.name} x${quantity}${optsLabel}${mergeNote}.`;
        useCartStore.getState().logToolCall("add_to_cart", args, msg);
        return mutOk("add_to_cart", msg);
      },
    },
    {
      name: "remove_from_cart",
      description:
        "Rimuove una riga dal carrello.\n" +
        "Usalo quando l'utente dice \"togli\", \"rimuovi\", \"non lo voglio più\".\n" +
        "Passa anche 'options' se ci sono più righe dello stesso prodotto con opzioni\n" +
        "diverse, altrimenti viene rimossa la prima che combacia con product_id.\n" +
        "Output: structuredContent.kind=\"mutation_result\" con ok, message, cart.\n" +
        "Renderizza il message + la card carrello aggiornata.\n" +
        "Dopo: se il carrello è ora vuoto invita a esplorare con search_products.",
      inputSchema: {
        type: "object",
        properties: {
          product_id: { type: "string" },
          options: {
            type: "object",
            description: "Opzioni per disambiguare quale riga rimuovere (size/milk/sweetness).",
            properties: {
              size: { type: "string", enum: ["S", "M", "L"] },
              milk: { type: "string" },
              sweetness: { type: "string", enum: ["none", "low", "normal"] },
            },
          },
        },
        required: ["product_id"],
      },
      outputSchema: MUTATION_RESULT_SCHEMA,
      async execute(args) {
        const a = args as {
          product_id?: unknown;
          options?: { size?: SizeOption; milk?: string; sweetness?: SweetnessOption };
        };
        if (typeof a.product_id !== "string" || a.product_id.length === 0) {
          useCartStore.getState().logToolCall("remove_from_cart", args, "errore: product_id mancante");
          return mutErr("remove_from_cart", "product_not_found", "Parametro 'product_id' obbligatorio.");
        }
        const product = findProductCaseInsensitive(a.product_id);
        const canonicalId = product?.id ?? a.product_id;
        const removed = useCartStore.getState().removeItem(canonicalId, a.options);
        if (!removed) {
          useCartStore.getState().logToolCall("remove_from_cart", args, "non era nel carrello");
          return mutErr("remove_from_cart", "not_in_cart", `"${a.product_id}" non era nel carrello.`);
        }
        const remaining = useCartStore.getState().quantityFor(canonicalId);
        const tail = remaining > 0 ? ` Restano ${remaining} unità con opzioni diverse.` : "";
        const msg = `Rimosso "${canonicalId}" dal carrello.${tail}`;
        useCartStore.getState().logToolCall("remove_from_cart", args, msg);
        return mutOk("remove_from_cart", msg);
      },
    },
    {
      name: "apply_coupon",
      description:
        "Applica un codice sconto al carrello (BENVENUTO 10%, STUDENTI 20% max €5).\n" +
        "Usalo quando l'utente dice \"applica\", \"ho un coupon\", \"sconto\".\n" +
        "Sovrascrive un coupon precedente se presente (lo segnala nel message).\n" +
        "Output: structuredContent.kind=\"mutation_result\" con cart.coupon popolato.\n" +
        "Renderizza il message + la card carrello con la riga sconto visibile.\n" +
        "Dopo: se il carrello è vuoto avvisa che lo sconto scatterà al primo prodotto.",
      inputSchema: {
        type: "object",
        properties: { code: { type: "string" } },
        required: ["code"],
      },
      outputSchema: MUTATION_RESULT_SCHEMA,
      async execute(args) {
        const a = args as { code?: unknown };
        if (typeof a.code !== "string" || a.code.trim().length === 0) {
          useCartStore.getState().logToolCall("apply_coupon", args, "errore: code mancante");
          return mutErr("apply_coupon", "invalid_coupon", "Parametro 'code' obbligatorio.");
        }
        const code = a.code;
        const result = useCartStore.getState().applyCoupon(code);
        if (!result.ok) {
          useCartStore.getState().logToolCall("apply_coupon", args, "non valido");
          const available = Object.keys(COUPONS).join(", ");
          return mutErr(
            "apply_coupon",
            "invalid_coupon",
            `Coupon "${code}" non valido. Disponibili: ${available}.`,
          );
        }
        const overwrite = result.previous ? ` (sostituisce ${result.previous})` : "";
        const cartHint =
          useCartStore.getState().items.length === 0
            ? " Il carrello è vuoto: lo sconto sarà attivo al primo prodotto aggiunto."
            : "";
        const msg = `Coupon ${code.toUpperCase()} applicato${overwrite}.${cartHint}`;
        useCartStore.getState().logToolCall("apply_coupon", args, msg);
        return mutOk("apply_coupon", msg);
      },
    },
    {
      name: "remove_coupon",
      description:
        "Rimuove il coupon attualmente applicato al carrello (non rimuove prodotti).\n" +
        "Usalo quando l'utente dice \"togli lo sconto\", \"rimuovi il coupon\".\n" +
        "Output: structuredContent.kind=\"mutation_result\" con cart.coupon=null.\n" +
        "Renderizza il message in 1 riga + la card carrello senza riga sconto.\n" +
        "Dopo: se l'utente ha un altro codice proponi apply_coupon.",
      inputSchema: { type: "object", properties: {} },
      outputSchema: MUTATION_RESULT_SCHEMA,
      async execute() {
        const had = useCartStore.getState().clearCoupon();
        const msg = had ? "Coupon rimosso." : "Nessun coupon era applicato.";
        useCartStore.getState().logToolCall("remove_coupon", {}, msg);
        return mutOk("remove_coupon", msg);
      },
    },
    {
      name: "clear_cart",
      description:
        "Svuota completamente il carrello e rimuove il coupon.\n" +
        "Usalo quando l'utente vuole ricominciare da zero (\"cancella tutto\",\n" +
        "\"svuota\", \"resetta\").\n" +
        "Output: structuredContent.kind=\"mutation_result\" con cart.empty=true.\n" +
        "Renderizza il message in 1 riga + la card carrello vuota.\n" +
        "Dopo: invita a esplorare di nuovo con search_products.",
      inputSchema: { type: "object", properties: {} },
      outputSchema: MUTATION_RESULT_SCHEMA,
      async execute() {
        const s = useCartStore.getState();
        const hadItems = s.items.length;
        const hadCoupon = s.coupon !== null;
        s.clearCart();
        const msg =
          hadItems === 0 && !hadCoupon
            ? "Carrello già vuoto."
            : `Carrello svuotato (${hadItems} righe rimosse${hadCoupon ? " + coupon rimosso" : ""}).`;
        useCartStore.getState().logToolCall("clear_cart", {}, msg);
        return mutOk("clear_cart", msg);
      },
    },
    {
      name: "get_cart",
      description:
        "Restituisce il contenuto corrente del carrello con totali e coupon.\n" +
        "Usalo quando l'utente chiede \"cosa ho nel carrello\", \"quanto ho speso\",\n" +
        "o serve riassumere lo stato prima di un suggerimento (\"cosa va bene con\n" +
        "quello che ho?\").\n" +
        "Output: structuredContent.kind=\"cart\" con lines (con options_label e\n" +
        "line_total), subtotal/total, coupon (o null), empty, next_actions.\n" +
        "Renderizza come card carrello: lista compatta righe (immagine, nome, qty,\n" +
        "opzioni in 1 riga, prezzo), riga sconto se coupon != null, totale in grassetto.\n" +
        "Dopo: se !empty proponi checkout o apply_coupon; se empty invita a esplorare\n" +
        "con search_products.",
      inputSchema: { type: "object", properties: {} },
      outputSchema: CART_SCHEMA,
      async execute() {
        const cart = buildCart();
        const summary = cart.empty
          ? "Il carrello è vuoto."
          : `Carrello: ${cart.lines.length} righe, totale €${cart.total.toFixed(2)}${
              cart.coupon ? ` (sconto ${cart.coupon.code} -€${cart.coupon.discount.toFixed(2)})` : ""
            }`;
        useCartStore
          .getState()
          .logToolCall("get_cart", {}, `${cart.lines.length} righe`);
        return {
          content: [{ type: "text", text: summary }],
          structuredContent: cart as unknown as Record<string, unknown>,
        };
      },
    },
    {
      name: "checkout",
      description:
        "Conferma l'ordine e completa il pagamento. Richiede conferma esplicita\n" +
        "dell'utente tramite agent.requestUserInteraction.\n" +
        "Usalo quando l'utente dice \"paga\", \"completa\", \"conferma l'ordine\".\n" +
        "Output: structuredContent.kind=\"mutation_result\". ok=true con message di\n" +
        "ricevuta e cart vuoto; ok=false con error.code (\"empty_cart\" o\n" +
        "\"user_cancelled\") quando applicabile.\n" +
        "Renderizza il message + se ok=true mostra un breve riepilogo ricevuta\n" +
        "(totale pagato), se ok=false leggi error.code per spiegare cosa è successo.",
      inputSchema: { type: "object", properties: {} },
      outputSchema: MUTATION_RESULT_SCHEMA,
      async execute(_args, agent) {
        const s = useCartStore.getState();
        if (s.items.length === 0) {
          useCartStore.getState().logToolCall("checkout", {}, "carrello vuoto");
          return mutErr("checkout", "empty_cart", "Il carrello è vuoto, niente da pagare.");
        }
        const total = s.total();
        const { requestCheckoutConfirmation } = await import("./checkout-bridge");
        const ask = () => requestCheckoutConfirmation(total);
        const confirmed = agent?.requestUserInteraction
          ? await agent.requestUserInteraction(ask)
          : await ask();
        if (!confirmed) {
          useCartStore.getState().logToolCall("checkout", {}, "annullato dall'utente");
          return mutErr("checkout", "user_cancelled", "Pagamento annullato dall'utente.");
        }
        const result = useCartStore.getState().checkout();
        const msg = `Ordine confermato! Totale pagato: €${result.total.toFixed(2)}.`;
        useCartStore.getState().logToolCall("checkout", {}, msg);
        return mutOk("checkout", msg);
      },
    },
  ];
}

let registered = false;

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
    return;
  }
  if (typeof mc.provideContext === "function") {
    mc.provideContext({ tools });
    registered = true;
    console.info(`[webmcp] registered ${tools.length} tools via provideContext`);
    return;
  }
  console.warn("[webmcp] modelContext present but no known registration API");
}

# WebMCP Card-Ready Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ridisegnare l'output dei 9 tool WebMCP per restituire `structuredContent` tipizzato (4 `kind`: `product_card`, `product_list`, `cart`, `mutation_result`) così che Claude Desktop possa comporre card markdown ricche e coerenti in chat.

**Architecture:** Aggiungiamo un layer di "content builders" (`src/lib/webmcp-schemas.ts`) che produce structuredContent + summary text per ciascuna shape. Ogni tool dichiara `outputSchema` MCP. I tool di mutazione embed `cart` aggiornato. Gli `inputSchema` restano identici (zero rottura per i client esistenti). Si parte con un pre-flight kill criterion (`__probe_structured`) che valida la propagazione di `structuredContent` lungo la catena polyfill+relay+Claude Desktop prima di toccare i 9 tool veri.

**Tech Stack:** TypeScript, Vitest, React 18, Zustand. WebMCP via `@mcp-b/global ^2.3.2` (polyfill ufficiale, no fork) o `navigator.modelContext` nativo (Chrome Canary 146+). Relay: `@mcp-b/webmcp-local-relay` ufficiale.

**Spec:** [`docs/superpowers/specs/2026-05-26-webmcp-card-ready-tools-design.md`](../specs/2026-05-26-webmcp-card-ready-tools-design.md)

---

## File structure

| File | Azione | Responsabilità |
|---|---|---|
| `src/lib/webmcp-schemas.ts` | create | Tipi TS (`ProductCard`, `ProductList`, `Cart`, `MutationResult`, `ErrorCode`), costanti JSON Schema (`PRODUCT_CARD_SCHEMA`, ecc.), content builders (`buildProductCard`, `buildProductList`, `buildCart`, `buildMutationResult`). |
| `src/lib/__tests__/webmcp-schemas.test.ts` | create | Unit test sui 4 builder: shape esatta, gestione campi opzionali, error path. |
| `src/lib/webmcp.ts` | modify | Estendere `Tool` con `outputSchema?`; estendere `ToolResult` con `structuredContent?`; ricablare ogni tool (eccetto `show_product_image` da rimuovere) per usare i builder + dichiarare `outputSchema`; aggiungere temporaneo `__probe_structured`; rimuovere `show_product_image`; riscrivere tutte le descrizioni in stile 4-blocchi. |
| `src/lib/__tests__/webmcp.test.ts` | modify | Aggiornare conta tool (9 al termine); rimuovere test su `show_product_image`; aggiungere asserzioni su `structuredContent.kind` per ogni tool; aggiungere casi `mutation_result.ok=false` con `error.code` e `error.alternatives`. |
| `README.md` | modify | "10 tool" → "9 tool" in introduzione e nello Step 4 della guida. |

---

## Task 1: Pre-flight kill criterion — `__probe_structured`

**Files:**
- Modify: `src/lib/webmcp.ts` (aggiunta temporanea del probe in `buildTools()`)

Questo task ha una **gate manuale**: se il probe fallisce su entrambe le rotte, FERMA il piano e proponi ripiego ad Approccio A (JSON-in-text). Non forkare il polyfill.

- [ ] **Step 1: Verifica baseline tests passano**

```bash
npx vitest run
```
Expected: tutti i test attuali passano (incluso `webmcp.test.ts` con 10 tool).

- [ ] **Step 2: Aggiungi tipo `outputSchema` opzionale al `Tool`**

In `src/lib/webmcp.ts`, modifica la definizione di `Tool` (intorno alla riga 69):

```ts
export type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  execute: (args: Record<string, unknown>, agent?: Agent) => Promise<ToolResult>;
};
```

E la definizione di `ToolResult` (intorno alla riga 55):

```ts
export type ToolResult = {
  content: ContentBlock[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};
```

- [ ] **Step 3: Aggiungi il probe tool dentro `buildTools()`**

In `src/lib/webmcp.ts`, prepend il probe come **primo** elemento dell'array ritornato da `buildTools()` (subito dopo `return [`):

```ts
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
```

- [ ] **Step 4: Verifica che il probe compila e i test esistenti reggono**

```bash
npx tsc -b && npx vitest run
```
Expected: compila clean, tutti i test passano (il conteggio tool ora è 11; il test "exposes exactly 10 tools" fallirà — lo aggiorni TEMPORANEAMENTE a 11 per superare il gate, lo rimetterai a 9 in Task 11).

Aggiorna il count in `src/lib/__tests__/webmcp.test.ts`:

```ts
  it("exposes exactly 10 tools", () => {
    expect(buildTools()).toHaveLength(11); // 10 + probe temporaneo
  });
```

```bash
npx vitest run
```
Expected: tutti i test passano.

- [ ] **Step 5: Commit del probe**

```bash
git add src/lib/webmcp.ts src/lib/__tests__/webmcp.test.ts
git commit -m "feat(webmcp): add temporary __probe_structured tool (pre-flight)"
```

- [ ] **Step 6: MANUAL GATE — verifica rotta polyfill (Chrome stabile)**

1. Avvia il sito: `npm run dev`
2. Apri `http://localhost:5173` in **Chrome stabile** (polyfill `@mcp-b/global`).
3. Verifica che la pill "WebMCP" in header mostri `CDN` (polyfill caricato).
4. Verifica che la pill "Relay" mostri `Live` (assicurati che Claude Desktop sia avviato e il relay configurato per `webmcp-local-relay`).
5. In Claude Desktop, scrivi: *"Chiama __probe_structured e dimmi esattamente i campi che hai ricevuto."*

Expected: Claude risponde menzionando `hello: "world"` e `probe_version: 1`. **Se Claude vede solo `"ok"` → FAIL: polyfill+relay perdono `structuredContent`. Documenta il fallimento, fai stash del codice e proponi all'utente il ripiego ad Approccio A.**

- [ ] **Step 7: MANUAL GATE — verifica rotta nativa (Chrome Canary)**

1. Apri lo stesso URL in **Chrome Canary 146+** con flag WebMCP abilitato.
2. Verifica che la pill "WebMCP" mostri `Native` (`navigator.modelContext` registrato).
3. Ripeti l'istruzione: *"Chiama __probe_structured e dimmi esattamente i campi che hai ricevuto."*

Expected: Claude vede `hello: "world"` e `probe_version: 1`. **Se vede solo `"ok"` → FAIL: la rotta nativa perde `structuredContent`. STOP e ripiega ad Approccio A.**

- [ ] **Step 8: Decision gate**

- Se **entrambe** le rotte hanno propagato `structuredContent` → procedi a Task 2.
- Se **almeno una** fallisce → STOP qui. Apri issue con dettagli, proponi all'utente di rinegoziare lo scope (Approccio A). **Non rimuovere il probe finché non c'è una decisione.**

---

## Task 2: Add types, JSON Schemas, and `webmcp-schemas.ts` skeleton

**Files:**
- Create: `src/lib/webmcp-schemas.ts`
- Create: `src/lib/__tests__/webmcp-schemas.test.ts`

- [ ] **Step 1: Scaffold del file con tipi**

Create `src/lib/webmcp-schemas.ts`:

```ts
// Forme strutturate ritornate dai tool WebMCP via structuredContent.
// Una sola `kind` discriminator per ogni shape; Claude Desktop sceglie
// lo stile di rendering markdown in base al kind.

export type ErrorCode =
  | "product_not_found"
  | "out_of_stock"
  | "invalid_option"
  | "quantity_out_of_range"
  | "line_quantity_limit"
  | "invalid_coupon"
  | "empty_cart"
  | "user_cancelled"
  | "not_in_cart";

export interface OptionChoice {
  id: string;
  label: string;
  price_delta?: number;
  available?: boolean;
  alternatives?: string[];
}

export interface CustomizationGroup {
  label: string;
  default: string;
  options: OptionChoice[];
}

export interface ProductAttributes {
  intensity?: { value: number; scale: number };
  origin?: string;
  flavor_notes?: string[];
  dietary?: string[];
  temperature?: string;
  time_of_day?: string[];
}

export interface MiniProductCard {
  id: string;
  name: string;
  price: number;
  image_url: string;
  relation?: string;
}

export interface NextAction {
  tool: string;
  intent?: string;
  args_template?: Record<string, unknown>;
}

export interface ProductCardPayload {
  id: string;
  name: string;
  price: number;
  currency: "EUR";
  image_url: string;
  description: string;
  category: string;
  type: string;
  available: boolean;
  tags: string[];
  attributes: ProductAttributes;
  customization?: Record<string, CustomizationGroup>;
  pairings: MiniProductCard[];
  related_products: MiniProductCard[];
  alternatives: MiniProductCard[];
  next_actions: NextAction[];
}

export interface ProductCard {
  kind: "product_card";
  product: ProductCardPayload;
}

export interface ProductListItem {
  id: string;
  name: string;
  price: number;
  currency: "EUR";
  image_url: string;
  description: string;
  available: boolean;
  intensity?: number;
  origin?: string;
  flavor_notes?: string[];
  dietary?: string[];
  tags?: string[];
  has_customization: boolean;
  next_actions: NextAction[];
}

export interface ProductList {
  kind: "product_list";
  query_summary: string;
  total: number;
  items: ProductListItem[];
}

export interface CartLine {
  product_id: string;
  name: string;
  image_url: string;
  quantity: number;
  options?: { size?: string; milk?: string; sweetness?: string };
  options_label: string;
  unit_price: number;
  line_total: number;
}

export interface CouponSummary {
  code: string;
  label: string;
  discount: number;
}

export interface Cart {
  kind: "cart";
  lines: CartLine[];
  subtotal: number;
  coupon: CouponSummary | null;
  total: number;
  currency: "EUR";
  empty: boolean;
  next_actions: NextAction[];
}

export interface MutationError {
  code: ErrorCode;
  message: string;
  alternatives?: Array<{ id: string; label: string; price_delta?: number }>;
}

export interface MutationResult {
  kind: "mutation_result";
  ok: boolean;
  tool: string;
  message?: string;
  error?: MutationError;
  cart: Cart;
}
```

- [ ] **Step 2: Aggiungi le costanti JSON Schema**

Append a `src/lib/webmcp-schemas.ts`:

```ts
// JSON Schema constants — usati come outputSchema MCP dichiarato sui tool.
// Tenute volutamente snelle (additionalProperties:true) per non rompere
// l'estendibilità futura.

const MINI_CARD_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    price: { type: "number" },
    image_url: { type: "string" },
    relation: { type: "string" },
  },
  required: ["id", "name", "price", "image_url"],
} as const;

const NEXT_ACTION_SCHEMA = {
  type: "object",
  properties: {
    tool: { type: "string" },
    intent: { type: "string" },
    args_template: { type: "object" },
  },
  required: ["tool"],
} as const;

const OPTION_CHOICE_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    label: { type: "string" },
    price_delta: { type: "number" },
    available: { type: "boolean" },
    alternatives: { type: "array", items: { type: "string" } },
  },
  required: ["id", "label"],
} as const;

const CUSTOMIZATION_GROUP_SCHEMA = {
  type: "object",
  properties: {
    label: { type: "string" },
    default: { type: "string" },
    options: { type: "array", items: OPTION_CHOICE_SCHEMA },
  },
  required: ["label", "default", "options"],
} as const;

export const PRODUCT_CARD_SCHEMA = {
  type: "object",
  properties: {
    kind: { const: "product_card" },
    product: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        price: { type: "number" },
        currency: { const: "EUR" },
        image_url: { type: "string" },
        description: { type: "string" },
        category: { type: "string" },
        type: { type: "string" },
        available: { type: "boolean" },
        tags: { type: "array", items: { type: "string" } },
        attributes: { type: "object" },
        customization: { type: "object", additionalProperties: CUSTOMIZATION_GROUP_SCHEMA },
        pairings: { type: "array", items: MINI_CARD_SCHEMA },
        related_products: { type: "array", items: MINI_CARD_SCHEMA },
        alternatives: { type: "array", items: MINI_CARD_SCHEMA },
        next_actions: { type: "array", items: NEXT_ACTION_SCHEMA },
      },
      required: [
        "id", "name", "price", "currency", "image_url",
        "description", "category", "type", "available",
        "tags", "attributes", "pairings", "related_products",
        "alternatives", "next_actions",
      ],
    },
  },
  required: ["kind", "product"],
} as const;

export const PRODUCT_LIST_SCHEMA = {
  type: "object",
  properties: {
    kind: { const: "product_list" },
    query_summary: { type: "string" },
    total: { type: "number" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          price: { type: "number" },
          currency: { const: "EUR" },
          image_url: { type: "string" },
          description: { type: "string" },
          available: { type: "boolean" },
          intensity: { type: "number" },
          origin: { type: "string" },
          flavor_notes: { type: "array", items: { type: "string" } },
          dietary: { type: "array", items: { type: "string" } },
          tags: { type: "array", items: { type: "string" } },
          has_customization: { type: "boolean" },
          next_actions: { type: "array", items: NEXT_ACTION_SCHEMA },
        },
        required: [
          "id", "name", "price", "currency", "image_url",
          "description", "available", "has_customization", "next_actions",
        ],
      },
    },
  },
  required: ["kind", "query_summary", "total", "items"],
} as const;

export const CART_SCHEMA = {
  type: "object",
  properties: {
    kind: { const: "cart" },
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          product_id: { type: "string" },
          name: { type: "string" },
          image_url: { type: "string" },
          quantity: { type: "number" },
          options: { type: "object" },
          options_label: { type: "string" },
          unit_price: { type: "number" },
          line_total: { type: "number" },
        },
        required: ["product_id", "name", "image_url", "quantity", "options_label", "unit_price", "line_total"],
      },
    },
    subtotal: { type: "number" },
    coupon: {
      oneOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            code: { type: "string" },
            label: { type: "string" },
            discount: { type: "number" },
          },
          required: ["code", "label", "discount"],
        },
      ],
    },
    total: { type: "number" },
    currency: { const: "EUR" },
    empty: { type: "boolean" },
    next_actions: { type: "array", items: NEXT_ACTION_SCHEMA },
  },
  required: ["kind", "lines", "subtotal", "coupon", "total", "currency", "empty", "next_actions"],
} as const;

export const MUTATION_RESULT_SCHEMA = {
  type: "object",
  properties: {
    kind: { const: "mutation_result" },
    ok: { type: "boolean" },
    tool: { type: "string" },
    message: { type: "string" },
    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        alternatives: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              price_delta: { type: "number" },
            },
            required: ["id", "label"],
          },
        },
      },
      required: ["code", "message"],
    },
    cart: CART_SCHEMA,
  },
  required: ["kind", "ok", "tool", "cart"],
} as const;
```

- [ ] **Step 3: Test che il file compili**

```bash
npx tsc -b
```
Expected: nessun errore.

- [ ] **Step 4: Commit**

```bash
git add src/lib/webmcp-schemas.ts
git commit -m "feat(webmcp): scaffold structuredContent types and JSON schemas"
```

---

## Task 3: Content builders (TDD per builder)

**Files:**
- Modify: `src/lib/webmcp-schemas.ts`
- Create: `src/lib/__tests__/webmcp-schemas.test.ts`

I 4 builder consumano dati dal modulo `products.ts` e dallo store carrello e producono shape strutturate. Si testano in isolamento.

- [ ] **Step 1: Setup file di test con import**

Create `src/lib/__tests__/webmcp-schemas.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Test #1 di `buildProductCard` per prodotto con customization**

In `src/lib/__tests__/webmcp-schemas.test.ts`, dentro `describe`:

```ts
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
  });
```

- [ ] **Step 3: Esegui il test e verifica FAIL**

```bash
npx vitest run src/lib/__tests__/webmcp-schemas.test.ts
```
Expected: FAIL con "buildProductCard is not a function".

- [ ] **Step 4: Implementa `buildProductCard` in `src/lib/webmcp-schemas.ts`**

Append:

```ts
import {
  getProductById,
  type Product,
  type SizeOption,
  type SweetnessOption,
} from "./products";

const IMAGE_BASE_URL =
  "https://cdn.jsdelivr.net/gh/Sgr57/Bella-Roma-WebMCP@main/public/products/editorial";

function imageUrlFor(productId: string): string {
  return `${IMAGE_BASE_URL}/${productId}.webp`;
}

function toMiniCards(ids: string[] | undefined, relation?: string): MiniProductCard[] {
  if (!ids) return [];
  const out: MiniProductCard[] = [];
  for (const id of ids) {
    const p = getProductById(id);
    if (!p) continue;
    const mini: MiniProductCard = {
      id: p.id,
      name: p.name,
      price: p.price,
      image_url: imageUrlFor(p.id),
    };
    if (relation) mini.relation = relation;
    out.push(mini);
  }
  return out;
}

const SIZE_LABELS: Record<SizeOption, string> = { S: "Small", M: "Medium", L: "Large" };

const MILK_LABEL_OVERRIDES: Record<string, string> = {
  "milk-whole": "Intero",
  "milk-oat": "Avena",
  "milk-soy": "Soia",
  "milk-almond": "Mandorla",
  "milk-lactose-free": "Senza lattosio",
};

const SWEETNESS_LABELS: Record<SweetnessOption, string> = {
  none: "Senza",
  low: "Poco",
  normal: "Normale",
};

function defaultActionsFor(product: Product): NextAction[] {
  if (product.type === "milk_option") return [];
  if (!product.available) return [];
  const args: Record<string, unknown> = { product_id: product.id, quantity: 1 };
  if (product.options) {
    const options: Record<string, unknown> = {};
    if (product.options.size) options.size = product.options.size.default;
    if (product.options.milk) options.milk = product.options.milk.default;
    if (product.options.sweetness) options.sweetness = product.options.sweetness.default;
    if (Object.keys(options).length > 0) args.options = options;
  }
  return [
    {
      tool: "add_to_cart",
      intent: "aggiungi questo prodotto con le opzioni scelte",
      args_template: args,
    },
  ];
}

function buildCustomization(product: Product): Record<string, CustomizationGroup> | undefined {
  if (!product.options) return undefined;
  const out: Record<string, CustomizationGroup> = {};
  if (product.options.size) {
    const sz = product.options.size;
    out.size = {
      label: "Size",
      default: sz.default,
      options: sz.values.map((v) => ({
        id: v,
        label: SIZE_LABELS[v],
        price_delta: sz.price_modifier[v] ?? 0,
        available: true,
      })),
    };
  }
  if (product.options.milk) {
    const m = product.options.milk;
    out.milk = {
      label: "Latte",
      default: m.default,
      options: m.values.map((id) => {
        const milkProduct = getProductById(id);
        const choice: OptionChoice = {
          id,
          label: MILK_LABEL_OVERRIDES[id] ?? milkProduct?.name ?? id,
          price_delta: milkProduct?.price ?? 0,
          available: milkProduct?.available ?? true,
        };
        if (milkProduct && !milkProduct.available && milkProduct.alternatives?.length) {
          choice.alternatives = milkProduct.alternatives;
        }
        return choice;
      }),
    };
  }
  if (product.options.sweetness) {
    const s = product.options.sweetness;
    out.sweetness = {
      label: "Zucchero",
      default: s.default,
      options: s.values.map((v) => ({ id: v, label: SWEETNESS_LABELS[v] })),
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function buildProductCard(product: Product): ProductCard {
  const customization = buildCustomization(product);
  const card: ProductCardPayload = {
    id: product.id,
    name: product.name,
    price: product.price,
    currency: "EUR",
    image_url: imageUrlFor(product.id),
    description: product.description,
    category: product.category,
    type: product.type,
    available: product.available,
    tags: product.tags ?? [],
    attributes: {
      ...(typeof product.intensity === "number"
        ? { intensity: { value: product.intensity, scale: 10 } }
        : {}),
      ...(product.origin ? { origin: product.origin } : {}),
      ...(product.flavor_notes ? { flavor_notes: product.flavor_notes } : {}),
      ...(product.dietary ? { dietary: product.dietary } : {}),
      ...(product.temperature ? { temperature: product.temperature } : {}),
      ...(product.time_of_day ? { time_of_day: product.time_of_day } : {}),
    },
    pairings: toMiniCards(product.pairings),
    related_products: toMiniCards(product.related_products, "take_home"),
    alternatives: toMiniCards(product.alternatives),
    next_actions: defaultActionsFor(product),
  };
  if (customization) card.customization = customization;
  return { kind: "product_card", product: card };
}
```

- [ ] **Step 5: Esegui il test e verifica PASS**

```bash
npx vitest run src/lib/__tests__/webmcp-schemas.test.ts
```
Expected: 1 test passes.

- [ ] **Step 6: Test di `buildProductCard` per prodotto senza customization (filtro-etiopia)**

Aggiungi al file di test, dentro `describe("buildProductCard")`:

```ts
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
```

Run:
```bash
npx vitest run src/lib/__tests__/webmcp-schemas.test.ts
```
Expected: 3 tests pass.

- [ ] **Step 7: Test di `buildProductList`**

Aggiungi al file di test:

```ts
  describe("buildProductList", () => {
    it("returns product_list with items and query_summary", () => {
      const list = buildProductList(
        PRODUCTS.filter((p) => p.category === "filtro"),
        "categoria=filtro",
      );
      expect(list.kind).toBe("product_list");
      expect(list.query_summary).toBe("categoria=filtro");
      expect(list.total).toBe(2);
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
```

Run:
```bash
npx vitest run src/lib/__tests__/webmcp-schemas.test.ts
```
Expected: FAIL con "buildProductList is not a function".

- [ ] **Step 8: Implementa `buildProductList`**

Append a `src/lib/webmcp-schemas.ts`:

```ts
function listItemActionsFor(product: Product): NextAction[] {
  if (!product.available) return [];
  const get: NextAction = {
    tool: "get_product",
    args_template: { product_id: product.id },
  };
  if (product.options) return [get];
  return [
    get,
    {
      tool: "add_to_cart",
      args_template: { product_id: product.id, quantity: 1 },
    },
  ];
}

export function buildProductList(products: Product[], querySummary: string): ProductList {
  return {
    kind: "product_list",
    query_summary: querySummary,
    total: products.length,
    items: products.map((p) => {
      const item: ProductListItem = {
        id: p.id,
        name: p.name,
        price: p.price,
        currency: "EUR",
        image_url: imageUrlFor(p.id),
        description: p.description,
        available: p.available,
        has_customization: Boolean(
          p.options && (p.options.size || p.options.milk || p.options.sweetness),
        ),
        next_actions: listItemActionsFor(p),
      };
      if (typeof p.intensity === "number") item.intensity = p.intensity;
      if (p.origin) item.origin = p.origin;
      if (p.flavor_notes?.length) item.flavor_notes = p.flavor_notes;
      if (p.dietary?.length) item.dietary = p.dietary;
      if (p.tags?.length) item.tags = p.tags;
      return item;
    }),
  };
}
```

Run:
```bash
npx vitest run src/lib/__tests__/webmcp-schemas.test.ts
```
Expected: 5 tests pass.

- [ ] **Step 9: Test di `buildCart` (vuoto + con righe + coupon)**

Aggiungi al file di test:

```ts
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
```

Run:
```bash
npx vitest run src/lib/__tests__/webmcp-schemas.test.ts
```
Expected: FAIL con "buildCart is not a function".

- [ ] **Step 10: Implementa `buildCart`**

Append a `src/lib/webmcp-schemas.ts`:

```ts
import { useCartStore, lineUnitPrice, type CartItemOptions } from "../store/cart";
import { COUPONS } from "./products";

function formatOptionsLabel(o: CartItemOptions | undefined): string {
  if (!o) return "";
  const bits: string[] = [];
  if (o.size) bits.push(o.size);
  if (o.milk) {
    const m = getProductById(o.milk);
    const label = m ? `latte ${MILK_LABEL_OVERRIDES[o.milk]?.toLowerCase() ?? m.name.toLowerCase()}` : `latte ${o.milk}`;
    const delta = m && m.price > 0 ? ` (+€${m.price.toFixed(2)})` : "";
    bits.push(`${label}${delta}`);
  }
  if (o.sweetness) bits.push(`zucchero ${SWEETNESS_LABELS[o.sweetness].toLowerCase()}`);
  return bits.join(", ");
}

export function buildCart(): Cart {
  const s = useCartStore.getState();
  const lines = s.items.map((it) => {
    const p = getProductById(it.productId);
    const unit = lineUnitPrice(it);
    return {
      product_id: it.productId,
      name: p?.name ?? it.productId,
      image_url: imageUrlFor(it.productId),
      quantity: it.quantity,
      ...(it.options ? { options: it.options } : {}),
      options_label: formatOptionsLabel(it.options),
      unit_price: unit,
      line_total: Math.round(unit * it.quantity * 100) / 100,
    };
  });
  const subtotal = Math.round(s.subtotal() * 100) / 100;
  const discount = s.discount();
  const total = Math.round(s.total() * 100) / 100;
  const coupon: CouponSummary | null = s.coupon
    ? {
        code: s.coupon,
        label: COUPONS[s.coupon]?.description ?? s.coupon,
        discount: Math.round(discount * 100) / 100,
      }
    : null;
  const empty = lines.length === 0;
  const nextActions: NextAction[] = [];
  if (!empty) nextActions.push({ tool: "checkout", intent: "completa l'ordine" });
  if (!coupon) nextActions.push({ tool: "apply_coupon", intent: "applica un coupon" });
  if (!empty) nextActions.push({ tool: "clear_cart", intent: "ricomincia da zero" });
  return {
    kind: "cart",
    lines,
    subtotal,
    coupon,
    total,
    currency: "EUR",
    empty,
    next_actions: nextActions,
  };
}
```

Run:
```bash
npx vitest run src/lib/__tests__/webmcp-schemas.test.ts
```
Expected: 7 tests pass.

- [ ] **Step 11: Test di `buildMutationResult` (ok + ko)**

Aggiungi al file di test:

```ts
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
```

Run:
```bash
npx vitest run src/lib/__tests__/webmcp-schemas.test.ts
```
Expected: FAIL con "buildMutationResult is not a function".

- [ ] **Step 12: Implementa `buildMutationResult`**

Append a `src/lib/webmcp-schemas.ts`:

```ts
export function buildMutationResult(input: {
  ok: boolean;
  tool: string;
  message?: string;
  error?: MutationError;
}): MutationResult {
  const result: MutationResult = {
    kind: "mutation_result",
    ok: input.ok,
    tool: input.tool,
    cart: buildCart(),
  };
  if (input.message !== undefined) result.message = input.message;
  if (input.error !== undefined) result.error = input.error;
  return result;
}
```

Run:
```bash
npx vitest run src/lib/__tests__/webmcp-schemas.test.ts
```
Expected: 9 tests pass.

- [ ] **Step 13: Commit**

```bash
git add src/lib/webmcp-schemas.ts src/lib/__tests__/webmcp-schemas.test.ts
git commit -m "feat(webmcp): add content builders for product_card, product_list, cart, mutation_result"
```

---

## Task 4: Refactor `get_product` to use builders + outputSchema

**Files:**
- Modify: `src/lib/webmcp.ts` (tool `get_product`)
- Modify: `src/lib/__tests__/webmcp.test.ts`

- [ ] **Step 1: Aggiungi test che richiede `structuredContent.kind=product_card`**

In `src/lib/__tests__/webmcp.test.ts`, aggiungi sotto i test esistenti per get_product (o se non ce ne sono, aggiungi nuovi):

```ts
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

  it("get_product returns isError for unknown product", async () => {
    const res = await findTool("get_product").execute(
      { product_id: "nonexistent" },
      fakeAgent,
    );
    expect(res.isError).toBe(true);
    expect(res.structuredContent).toBeUndefined();
  });
```

- [ ] **Step 2: Esegui i nuovi test e verifica che FALLISCONO sui campi structuredContent**

```bash
npx vitest run src/lib/__tests__/webmcp.test.ts -t get_product
```
Expected: i nuovi test FAIL su `structuredContent`.

- [ ] **Step 3: Refactor `get_product` in `src/lib/webmcp.ts`**

In `src/lib/webmcp.ts`, sostituisci la definizione del tool `get_product` (l'oggetto con `name: "get_product"`):

```ts
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
        useCartStore.getState().logToolCall("get_product", args, `${p.id} (${p.type})`);
        return {
          content: [{ type: "text", text: summary }],
          structuredContent: card,
        };
      },
    },
```

E in cima a `src/lib/webmcp.ts` aggiungi gli import:

```ts
import {
  buildProductCard,
  PRODUCT_CARD_SCHEMA,
} from "./webmcp-schemas";
```

- [ ] **Step 4: Esegui tutti i test webmcp e verifica PASS**

```bash
npx vitest run src/lib/__tests__/webmcp.test.ts
```
Expected: tutti i test passano (i nuovi su `get_product` ora passano; quelli vecchi su `get_product` che controllano il testo possono fallire — leggi cosa si rompe).

Se test esistenti su get_product (es. quelli che cercano sostringhe nel `content[0].text`) falliscono, aggiornali per cercare sul summary breve invece che sul testo lungo originale, oppure accetta che il nuovo summary più conciso copra ancora i campi chiave (es. nome prodotto presente).

- [ ] **Step 5: Commit**

```bash
git add src/lib/webmcp.ts src/lib/__tests__/webmcp.test.ts
git commit -m "feat(webmcp): get_product returns structuredContent product_card"
```

---

## Task 5: Refactor `search_products` to use builders + outputSchema

**Files:**
- Modify: `src/lib/webmcp.ts` (tool `search_products`)
- Modify: `src/lib/__tests__/webmcp.test.ts`

- [ ] **Step 1: Aggiungi test che richiede `structuredContent.kind=product_list`**

In `src/lib/__tests__/webmcp.test.ts`:

```ts
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
    const list = res.structuredContent as { items: Array<{ id: string; has_customization: boolean }> };
    const cap = list.items.find((i) => i.id === "cappuccino");
    expect(cap?.has_customization).toBe(true);
  });
```

- [ ] **Step 2: Esegui e verifica FAIL**

```bash
npx vitest run src/lib/__tests__/webmcp.test.ts -t search_products
```
Expected: i nuovi test FAIL.

- [ ] **Step 3: Refactor `search_products` in `src/lib/webmcp.ts`**

Sostituisci la definizione di `search_products`:

```ts
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
          query: { type: "string", description: "Testo libero da cercare nel nome o nella descrizione" },
          category: {
            type: "string",
            enum: ["espresso", "filtro", "decaf", "latte", "cold", "food", "beans", "capsule"],
          },
          type: { type: "string", enum: ["drink", "food", "beans", "capsule", "milk_option"] },
          max_price: { type: "number", description: "Prezzo massimo in euro" },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Tag richiesti (AND). Es: ['signature', 'best-seller']",
          },
          dietary: {
            type: "array",
            items: { type: "string", enum: ["vegan", "lactose-free", "gluten-free", "no-caffeine"] },
            description: "Requisiti dietetici richiesti (AND)",
          },
          flavor_notes: {
            type: "array",
            items: {
              type: "string",
              enum: ["floral", "fruity", "chocolate", "caramel", "nutty", "citrus", "spicy", "honey", "berry"],
            },
            description: "Note aromatiche richieste (AND)",
          },
          origin: { type: "string", description: "Es: 'Etiopia', 'Colombia', 'Italia'" },
          intensity_min: { type: "number", minimum: 1, maximum: 10 },
          intensity_max: { type: "number", minimum: 1, maximum: 10 },
          time_of_day: { type: "string", enum: ["morning", "afternoon", "evening", "anytime"] },
          in_stock_only: { type: "boolean", description: "Se true, esclude i prodotti non disponibili" },
        },
      },
      outputSchema: PRODUCT_LIST_SCHEMA,
      async execute(args) {
        // ... (TUTTA la logica di filtering esistente, immutata)
        // Cambia SOLO il blocco finale che costruisce text+return:
        // Sostituisci la formattazione bullet-list con:
        const querySummary = summarizeQuery(args);
        const list = buildProductList(results, querySummary);
        const summary = results.length
          ? `${results.length} prodotti trovati per "${querySummary}"`
          : `Nessun prodotto trovato per "${querySummary}"`;
        useCartStore.getState().logToolCall("search_products", args, `${results.length} risultati`);
        return {
          content: [{ type: "text", text: summary }],
          structuredContent: list,
        };
      },
    },
```

**Nota importante**: `inputSchema` resta IDENTICO a quello attuale (intere righe 137-208 del file pre-refactor). Copia incolla, non riscrivere.

Aggiungi gli import in cima:

```ts
import {
  buildProductCard,
  buildProductList,
  PRODUCT_CARD_SCHEMA,
  PRODUCT_LIST_SCHEMA,
} from "./webmcp-schemas";
```

Aggiungi la helper `summarizeQuery` in `src/lib/webmcp.ts`, sopra `buildTools()`:

```ts
function summarizeQuery(args: Record<string, unknown>): string {
  const bits: string[] = [];
  for (const [k, v] of Object.entries(args)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    bits.push(`${k}=${Array.isArray(v) ? v.join("|") : v}`);
  }
  return bits.length ? bits.join(", ") : "tutti i prodotti";
}
```

- [ ] **Step 4: Esegui tutti i test e verifica PASS**

```bash
npx vitest run src/lib/__tests__/webmcp.test.ts
```
Expected: tutti i test passano. I vecchi test su `search_products` che cercavano stringhe specifiche (es. "Espresso Classico" nel testo) potrebbero rompersi — aggiornali per asserire su `structuredContent.items.find(...).name` invece che sul testo bullet-list.

Esempio di update per test esistente:
```ts
  // Prima:
  // expect(res.content[0].text).toContain("Espresso Classico");
  // Dopo:
  const list = res.structuredContent as { items: Array<{ name: string }> };
  expect(list.items.map((i) => i.name)).toContain("Espresso Classico");
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/webmcp.ts src/lib/__tests__/webmcp.test.ts
git commit -m "feat(webmcp): search_products returns structuredContent product_list"
```

---

## Task 6: Refactor `get_cart` to use builders + outputSchema

**Files:**
- Modify: `src/lib/webmcp.ts` (tool `get_cart`)
- Modify: `src/lib/__tests__/webmcp.test.ts`

- [ ] **Step 1: Test**

In `src/lib/__tests__/webmcp.test.ts`:

```ts
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
```

- [ ] **Step 2: Esegui e verifica FAIL**

```bash
npx vitest run src/lib/__tests__/webmcp.test.ts -t get_cart
```
Expected: FAIL.

- [ ] **Step 3: Refactor `get_cart` in `src/lib/webmcp.ts`**

Sostituisci la definizione:

```ts
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
          structuredContent: cart,
        };
      },
    },
```

Aggiorna gli import:

```ts
import {
  buildCart,
  buildProductCard,
  buildProductList,
  CART_SCHEMA,
  PRODUCT_CARD_SCHEMA,
  PRODUCT_LIST_SCHEMA,
} from "./webmcp-schemas";
```

- [ ] **Step 4: Esegui tutti i test e verifica PASS**

```bash
npx vitest run src/lib/__tests__/webmcp.test.ts
```
Expected: tutti passano.

- [ ] **Step 5: Commit**

```bash
git add src/lib/webmcp.ts src/lib/__tests__/webmcp.test.ts
git commit -m "feat(webmcp): get_cart returns structuredContent cart"
```

---

## Task 7: Refactor `add_to_cart` to use builders + outputSchema

**Files:**
- Modify: `src/lib/webmcp.ts` (tool `add_to_cart`)
- Modify: `src/lib/__tests__/webmcp.test.ts`

- [ ] **Step 1: Test happy path**

In `src/lib/__tests__/webmcp.test.ts`:

```ts
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
```

- [ ] **Step 2: Test error path (OOS milk)**

```ts
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

  it("add_to_cart returns error.code=product_not_found for unknown id", async () => {
    const res = await findTool("add_to_cart").execute(
      { product_id: "nope", quantity: 1 },
      fakeAgent,
    );
    expect(res.structuredContent).toMatchObject({
      kind: "mutation_result",
      ok: false,
      error: expect.objectContaining({ code: "product_not_found" }),
    });
  });

  it("add_to_cart returns error.code=quantity_out_of_range for qty=0", async () => {
    const res = await findTool("add_to_cart").execute(
      { product_id: "espresso", quantity: 0 },
      fakeAgent,
    );
    expect(res.structuredContent).toMatchObject({
      ok: false,
      error: expect.objectContaining({ code: "quantity_out_of_range" }),
    });
  });
```

- [ ] **Step 3: Esegui e verifica FAIL**

```bash
npx vitest run src/lib/__tests__/webmcp.test.ts -t add_to_cart
```
Expected: i nuovi test FAIL.

- [ ] **Step 4: Refactor `add_to_cart`**

Sostituisci la definizione del tool `add_to_cart`. La logica di validazione resta, cambiano solo i return statement: invece di `err("...")` o `ok("...")` ritornano `mutation_result` con structuredContent.

Aggiungi prima del `buildTools()` una helper:

```ts
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
    structuredContent: buildMutationResult({ ok: false, tool, error }),
    isError: true,
  };
}

function mutOk(tool: string, message: string): ToolResult {
  return {
    content: [{ type: "text", text: message }],
    structuredContent: buildMutationResult({ ok: true, tool, message }),
  };
}

function altsFromProductIds(ids: string[] | undefined): Array<{ id: string; label: string; price_delta?: number }> {
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
```

Aggiorna gli import:

```ts
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
```

Sostituisci `add_to_cart`:

```ts
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
```

- [ ] **Step 5: Esegui tutti i test e verifica PASS**

```bash
npx vitest run src/lib/__tests__/webmcp.test.ts
```
Expected: tutti passano. I test vecchi che asserivano sul testo "Aggiunto: Espresso..." vanno aggiornati per leggere da `structuredContent.message` o `content[0].text` (entrambi disponibili).

- [ ] **Step 6: Commit**

```bash
git add src/lib/webmcp.ts src/lib/__tests__/webmcp.test.ts
git commit -m "feat(webmcp): add_to_cart returns mutation_result with embedded cart and typed errors"
```

---

## Task 8: Refactor `remove_from_cart`

**Files:**
- Modify: `src/lib/webmcp.ts` (tool `remove_from_cart`)
- Modify: `src/lib/__tests__/webmcp.test.ts`

- [ ] **Step 1: Test**

```ts
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
```

- [ ] **Step 2: Esegui e verifica FAIL**

```bash
npx vitest run src/lib/__tests__/webmcp.test.ts -t remove_from_cart
```
Expected: FAIL.

- [ ] **Step 3: Refactor**

Sostituisci `remove_from_cart`:

```ts
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
```

- [ ] **Step 4: Esegui e verifica PASS**

```bash
npx vitest run src/lib/__tests__/webmcp.test.ts
```
Expected: tutti passano.

- [ ] **Step 5: Commit**

```bash
git add src/lib/webmcp.ts src/lib/__tests__/webmcp.test.ts
git commit -m "feat(webmcp): remove_from_cart returns mutation_result"
```

---

## Task 9: Refactor `apply_coupon` + `remove_coupon` + `clear_cart`

**Files:**
- Modify: `src/lib/webmcp.ts` (3 tool)
- Modify: `src/lib/__tests__/webmcp.test.ts`

- [ ] **Step 1: Test per i 3 tool**

```ts
  it("apply_coupon returns mutation_result with coupon in embedded cart", async () => {
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
```

- [ ] **Step 2: Esegui e verifica FAIL**

```bash
npx vitest run src/lib/__tests__/webmcp.test.ts -t "apply_coupon|remove_coupon|clear_cart"
```
Expected: FAIL.

- [ ] **Step 3: Refactor `apply_coupon`**

Sostituisci:

```ts
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
```

- [ ] **Step 4: Refactor `remove_coupon`**

Sostituisci:

```ts
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
```

- [ ] **Step 5: Refactor `clear_cart`**

Sostituisci:

```ts
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
```

- [ ] **Step 6: Esegui tutti i test e verifica PASS**

```bash
npx vitest run src/lib/__tests__/webmcp.test.ts
```
Expected: tutti passano.

- [ ] **Step 7: Commit**

```bash
git add src/lib/webmcp.ts src/lib/__tests__/webmcp.test.ts
git commit -m "feat(webmcp): apply_coupon, remove_coupon, clear_cart return mutation_result"
```

---

## Task 10: Refactor `checkout`

**Files:**
- Modify: `src/lib/webmcp.ts` (tool `checkout`)
- Modify: `src/lib/__tests__/webmcp.test.ts`

- [ ] **Step 1: Test**

```ts
  it("checkout returns mutation_result ok=false error.code=empty_cart on empty", async () => {
    const res = await findTool("checkout").execute({}, fakeAgent);
    expect(res.structuredContent).toMatchObject({
      kind: "mutation_result",
      ok: false,
      tool: "checkout",
      error: expect.objectContaining({ code: "empty_cart" }),
    });
  });

  it("checkout returns mutation_result ok=true on confirmed payment", async () => {
    await findTool("add_to_cart").execute({ product_id: "espresso", quantity: 1 }, fakeAgent);
    const res = await findTool("checkout").execute({}, fakeAgent);
    expect(res.structuredContent).toMatchObject({
      kind: "mutation_result",
      ok: true,
      tool: "checkout",
      message: expect.stringContaining("Ordine confermato"),
      cart: expect.objectContaining({ empty: true }),
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
```

- [ ] **Step 2: Esegui e verifica FAIL**

```bash
npx vitest run src/lib/__tests__/webmcp.test.ts -t checkout
```
Expected: FAIL.

- [ ] **Step 3: Refactor `checkout`**

Sostituisci:

```ts
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
```

- [ ] **Step 4: Esegui e verifica PASS**

```bash
npx vitest run src/lib/__tests__/webmcp.test.ts
```
Expected: tutti passano.

- [ ] **Step 5: Commit**

```bash
git add src/lib/webmcp.ts src/lib/__tests__/webmcp.test.ts
git commit -m "feat(webmcp): checkout returns mutation_result with empty_cart and user_cancelled error codes"
```

---

## Task 11: Remove `show_product_image` tool

**Files:**
- Modify: `src/lib/webmcp.ts` (rimuovi il tool)
- Modify: `src/lib/__tests__/webmcp.test.ts` (rimuovi test)

- [ ] **Step 1: Rimuovi il tool dall'array in `buildTools()`**

In `src/lib/webmcp.ts`, elimina l'intero oggetto `{ name: "show_product_image", … }` (le sue ~45 righe).

- [ ] **Step 2: Rimuovi i test dedicati**

In `src/lib/__tests__/webmcp.test.ts`, elimina i test che cominciano con:
- `it("show_product_image returns text + resource_link to jsdelivr CDN", ...)`
- `it("show_product_image rejects unknown product", ...)`

Aggiorna il counter:
```ts
  it("exposes exactly 10 tools", () => {
    expect(buildTools()).toHaveLength(10); // 9 reali + 1 probe temporaneo
  });
```

(Lasciamo 10 in questo task perché il probe è ancora presente; in Task 13 scenderà a 9 una volta rimosso.)

- [ ] **Step 3: Pulisci `IMAGE_BASE_URL` non più usato in webmcp.ts**

`IMAGE_BASE_URL` in `src/lib/webmcp.ts` ora è morto (era solo per il show_product_image). Verifica con:
```bash
grep -n IMAGE_BASE_URL src/lib/webmcp.ts
```

Se appare solo nella sua dichiarazione, rimuovi la costante e il commento associato. (Il builder `buildProductCard` ha la sua copia in `webmcp-schemas.ts`.)

- [ ] **Step 4: Pulisci `ResourceLinkBlock` se non più referenziato**

```bash
grep -n "resource_link" src/lib/webmcp.ts
```

Se non appare più nel codice di runtime (solo nei tipi), puoi rimuovere il `ResourceLinkBlock` dalla union `ContentBlock`. Verifica anche `src/lib/__tests__/webmcp.test.ts` — se nessun test usa `resource_link`, ok.

- [ ] **Step 5: Esegui tutti i test e verifica PASS**

```bash
npx vitest run
```
Expected: tutti passano.

- [ ] **Step 6: Commit**

```bash
git add src/lib/webmcp.ts src/lib/__tests__/webmcp.test.ts
git commit -m "refactor(webmcp): remove show_product_image (merged into get_product image_url)"
```

---

## Task 12: Verify all 9 descriptions follow the 4-block style guide

**Files:**
- Modify: `src/lib/webmcp.ts` (descrizioni dei 9 tool)

Tutti i tool sono già stati ri-descritti nei task precedenti col template 4-blocchi. Questo task è una **review consolidante**: skim ogni descrizione e verifica conformità.

- [ ] **Step 1: Per ogni tool, verifica la conformità al template**

Per ognuno dei 9 tool (`search_products`, `get_product`, `get_cart`, `add_to_cart`, `remove_from_cart`, `apply_coupon`, `remove_coupon`, `clear_cart`, `checkout`), controlla:

1. ☐ Blocco 1 (Purpose) presente in 1 riga.
2. ☐ Blocco 2 (Quando) presente con trigger naturali in italiano.
3. ☐ Blocco 3 (Output) menziona `structuredContent.kind="<kind>"` E contiene la parola **Renderizza**.
4. ☐ Blocco 4 (Dopo) menziona la prossima azione conversazionale.
5. ☐ Totale ≤6 righe (newline-separated, ignorando code/example).

Per ciascun tool che non rispetta tutti i punti, riapri il blocco e correggilo. Le descrizioni base sono già nei Task 4-10, qui rifiniamo solo eventuali divergenze.

- [ ] **Step 2: Esegui i test (smoke test descrizioni)**

```bash
npx vitest run
```
Expected: tutti passano (le descrizioni non hanno test diretti ma il typing controlla la struttura).

- [ ] **Step 3: Commit (anche se vuoto, segnala il passaggio di review)**

Se hai fatto modifiche:
```bash
git add src/lib/webmcp.ts
git commit -m "docs(webmcp): conform all tool descriptions to 4-block style guide"
```

Se NON hai fatto modifiche, salta il commit. Avanza.

---

## Task 13: Remove pre-flight `__probe_structured`

**Files:**
- Modify: `src/lib/webmcp.ts` (rimuovi il probe)
- Modify: `src/lib/__tests__/webmcp.test.ts` (aggiorna counter)

- [ ] **Step 1: Rimuovi il tool probe dall'array `buildTools()`**

In `src/lib/webmcp.ts`, elimina l'intero oggetto `{ name: "__probe_structured", … }`.

- [ ] **Step 2: Aggiorna il counter del test**

```ts
  it("exposes exactly 9 tools", () => {
    expect(buildTools()).toHaveLength(9);
  });
```

- [ ] **Step 3: Verifica nessun riferimento orfano**

```bash
grep -rn __probe_structured src/
```
Expected: nessun risultato.

- [ ] **Step 4: Esegui tutti i test e verifica PASS**

```bash
npx vitest run
```
Expected: tutti passano.

- [ ] **Step 5: Commit**

```bash
git add src/lib/webmcp.ts src/lib/__tests__/webmcp.test.ts
git commit -m "chore(webmcp): remove temporary __probe_structured tool after pre-flight"
```

---

## Task 14: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Aggiorna l'intro "10 tool WebMCP" → "9 tool WebMCP"**

Cerca nel README:
```bash
grep -n "10 tool" README.md
grep -n "show_product_image" README.md
```

Trova e modifica le occorrenze a 9 tool. Aggiorna l'elenco dei tool in Step 4 della guida, rimuovendo `show_product_image` dalla lista.

Esempio di edit:

```diff
- I suoi **10 tool** (`search_products`, `get_product`, `show_product_image`, `add_to_cart`, `remove_from_cart`, `apply_coupon`, `remove_coupon`, `clear_cart`, `get_cart`, `checkout`).
+ I suoi **9 tool** (`search_products`, `get_product`, `add_to_cart`, `remove_from_cart`, `apply_coupon`, `remove_coupon`, `clear_cart`, `get_cart`, `checkout`). L'immagine del prodotto è esposta come campo `image_url` dentro `get_product`/`search_products`, non come tool separato.
```

- [ ] **Step 2: Aggiungi una nota sulla forma `structuredContent`**

Sotto la sezione che parla dei tool (probabilmente attorno allo Step 4 della guida), aggiungi un capoverso:

```markdown
**Nota tecnica — risposta dei tool:** ogni tool ritorna sia un breve `content[0].text` sia un payload tipizzato in `structuredContent` (4 forme: `product_card`, `product_list`, `cart`, `mutation_result`). Il payload strutturato permette a Claude Desktop di comporre card markdown coerenti (immagine, opzioni di personalizzazione, prossime azioni suggerite) senza riparsare prosa. Schema dettagliato in `docs/superpowers/specs/2026-05-26-webmcp-card-ready-tools-design.md`.
```

- [ ] **Step 3: Build per verificare nessun riferimento rotto**

```bash
npm run build
```
Expected: build OK.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(readme): update tool count to 9 after show_product_image removal"
```

---

## Task 15: Manual demo scenarios verification

**Files:**
- Nessuna modifica al codice — verifica manuale guidata sui 7 prompt demo.

- [ ] **Step 1: Setup**

```bash
npm run dev
```
Apri `http://localhost:5173` in Chrome Canary E in Chrome stabile (due tab/finestre).
Avvia Claude Desktop col relay configurato (vedi README Step 2).

- [ ] **Step 2: S1 — "Qualcosa di leggero e fruttato, senza latte, sotto i 4 euro"**

In Claude Desktop, copia-incolla il prompt. Aspettative:
- Claude chiama `search_products` con filtri appropriati.
- La risposta di Claude in chat include **almeno un'immagine** (URL `cdn.jsdelivr.net` o pillola "Show Image"), nome prodotto, prezzo, descrizione.
- Claude propone di aggiungerne uno → `add_to_cart`.
- Il carrello nella pagina mostra il prodotto.

Se Claude fa eco al JSON invece di renderizzare card → annotare e iterare wording in `get_product`/`search_products` descriptions.

- [ ] **Step 3: S2 — "Vorrei un cappuccino e qualcosa di dolce da abbinarci, ma non pesante"**

Aspettative:
- Claude chiama `get_product` per cappuccino → vede `customization`.
- Claude **chiede** le opzioni (latte, size, zucchero) PRIMA di chiamare `add_to_cart`.
- Risposta utente → `add_to_cart` con options.
- Per il dolce: `search_products({type:"food", max_price:3})` → card → `add_to_cart`.

- [ ] **Step 4: S3 — "Vorrei un cappuccino con latte di soia"** (soia ESAURITA)

Aspettative:
- Claude prova `add_to_cart({milk:"milk-soy"})`.
- Riceve `mutation_result.ok=false`, `error.code="out_of_stock"`, `error.alternatives=[milk-oat, milk-almond]`.
- Claude **propone l'avena o la mandorla** come alternativa (in card o testo).
- Su conferma utente: re-call `add_to_cart` con alternativa.

- [ ] **Step 5: S4 — "Ordine colazione 3 persone max €15, uno decaf"**

Aspettative:
- Multiple `search_products` + `add_to_cart`.
- Claude **non** chiama `get_cart` dopo ogni add (usa `cart` embedded nel `mutation_result`).
- Budget tracciato implicitamente, ordine totale entro €15.

- [ ] **Step 6: S5 — "Mi è piaciuto il Filtro Etiopia, voglio portarmene a casa 250g"**

Aspettative:
- Claude chiama `get_product({product_id:"filtro-etiopia"})`.
- Legge `related_products[0]` (`beans-etiopia-250g`, `relation: "take_home"`).
- Propone i chicchi e chiama `add_to_cart({product_id:"beans-etiopia-250g"})`.

- [ ] **Step 7: S6 — "Cappuccino grande con latte d'avena, senza zucchero"**

Aspettative:
- Claude chiama direttamente `add_to_cart` con tutte le options specificate (`size:"L", milk:"milk-oat", sweetness:"none"`), **senza** chiedere conferma (utente ha specificato tutto).
- Card carrello aggiornata.

- [ ] **Step 8: S8 — "Cosa va bene con quello che ho già nel carrello?"** (richiede prodotti nel cart)

Aspettative:
- Claude chiama `get_cart()` → vede le righe.
- Per ogni riga, può chiamare `get_product()` per leggere `pairings`.
- Propone uno/due abbinamenti in card markdown.
- Su conferma: `add_to_cart`.

- [ ] **Step 9: Smoke test sulle due rotte**

Ripeti almeno S1 e S3 **sia** in Chrome stabile (polyfill) **sia** in Chrome Canary (nativo). Verifica che il comportamento sia identico (Claude vede lo stesso `structuredContent`).

- [ ] **Step 10: Documentazione esiti**

Crea un breve report (≤30 righe) di cosa ha funzionato, cosa serve iterare. Salva in `docs/superpowers/plans/2026-05-26-webmcp-card-ready-tools-verification.md`. Se ci sono regressioni o behavior strani, apri issue o torna ai task precedenti per refinare le descrizioni dei tool.

```bash
git add docs/superpowers/plans/2026-05-26-webmcp-card-ready-tools-verification.md
git commit -m "docs(plan): manual verification report for card-ready tools"
```

---

## Self-review

**Spec coverage check:**

- ✅ Pre-flight kill criterion → Task 1
- ✅ 9 tool list (con `show_product_image` rimosso) → Task 11
- ✅ `product_card` schema → Task 3, applicato in Task 4 (`get_product`)
- ✅ `product_list` schema → Task 3, applicato in Task 5 (`search_products`)
- ✅ `cart` schema → Task 3, applicato in Task 6 (`get_cart`)
- ✅ `mutation_result` schema con `ok`/`error`/`cart` embed → Task 3, applicato in Task 7-10
- ✅ Tutti i 9 codici errore (`product_not_found`, `out_of_stock`, `invalid_option`, `quantity_out_of_range`, `line_quantity_limit`, `invalid_coupon`, `empty_cart`, `user_cancelled`, `not_in_cart`) → coperti nei Task 7-10
- ✅ Description style guide 4 blocchi → applicato in Task 4-10, review consolidante in Task 12
- ✅ Fallback `content[0].text` di una riga → ogni tool refactor (Task 4-10)
- ✅ `image_url` dentro `product_card` e `product_list` → Task 3 (`buildProductCard`, `buildProductList`)
- ✅ `related_products` con `relation` → Task 3 (`toMiniCards` con relation="take_home")
- ✅ Embed `cart` in `mutation_result` → Task 3 (`buildMutationResult`)
- ✅ README aggiornato → Task 14
- ✅ Verifica manuale 7 scenari → Task 15
- ✅ Probe rimosso prima del merge → Task 13

**Placeholder scan:** plan letto, nessun "TBD"/"TODO"/"implement later" lasciato indietro. Tutti i task includono codice eseguibile.

**Type consistency check:**
- `ProductCard`/`ProductCardPayload`/`ProductListItem`/`Cart`/`MutationResult`/`MutationError` definiti in Task 2 e usati coerentemente nei builder Task 3 e nei tool Task 4-10.
- `OptionChoice`/`CustomizationGroup` definiti e usati in `buildCustomization`.
- `NextAction` definito e usato in `defaultActionsFor`, `listItemActionsFor`, `buildCart`.
- `ErrorCode` definito in Task 2, usato come parametro di `mutErr` in Task 7.
- Helper `mutErr`/`mutOk`/`altsFromProductIds` introdotti in Task 7 e riutilizzati in Task 8-10.
- Costante `IMAGE_BASE_URL` ridefinita in `webmcp-schemas.ts` (Task 3) e rimossa da `webmcp.ts` (Task 11) per evitare drift.

**Note operative:**
- I commit sono atomici (1 task = 1+ commit) per facilitare bisect se si rompe qualcosa.
- Il probe (Task 1) **non** va mai mergiato su main; sopravvive solo durante l'implementazione e viene rimosso in Task 13.
- Se la gate manuale di Task 1 fallisce, il piano va abortito e bisogna tornare al brainstorming con Approccio A. Non procedere con Task 2.

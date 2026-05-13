# Catalog Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Espandere catalogo, schema dati e tool WebMCP per supportare 7 scenari "wow" diversi, mantenendo un set minimale di 7 tool composti dall'agente.

**Architecture:** Tre piani indipendenti che lavorano sui livelli classici: (1) **dati** — schema `Product` esteso, catalogo a 27 entry; (2) **stato** — cart store con righe distinte per options; (3) **tool** — `search_products` esteso, `get_product` nuovo, `add_to_cart` esteso. Layer UI mostra ricchezza dei dati (intensità per-prodotto, tag, OOS) e aggiunge sezione "Prova con l'agente".

**Tech Stack:** TypeScript, React, Vite, Vitest, Zustand, Tailwind CSS, Framer Motion. WebMCP tramite `@mcp-b/global` polyfill o `navigator.modelContext` nativo.

**Spec:** [`docs/superpowers/specs/2026-05-13-catalog-expansion-design.md`](../specs/2026-05-13-catalog-expansion-design.md)

---

## File structure

| File | Azione | Responsabilità |
|---|---|---|
| `src/lib/products.ts` | modify | Estendere `Product`, aggiungere tipi (`ProductType`, `FlavorNote`, ecc.), riscrivere `PRODUCTS` con 27 entry, aggiungere helper `getProductsByType`, `getMilkOptions`. |
| `src/lib/__tests__/products.test.ts` | modify | Aggiornare check sui campi minimi; aggiungere validazione integrità riferimenti (`pairings`, `related_products`, `options.milk.values`). |
| `src/store/cart.ts` | modify | `CartItem.options?`; `addItem(productId, quantity, options?)`; subtotal include modifier prezzo. |
| `src/store/__tests__/cart.test.ts` | modify | Test addItem con options: merge se options identiche, righe distinte se diverse, prezzo con modifier. |
| `src/lib/webmcp.ts` | modify | Estendere `search_products` (tags, dietary, flavor_notes, intensity_min/max, type, origin, time_of_day, in_stock_only, esclude milk_option di default); aggiungere `get_product`; estendere `add_to_cart` con `options` e errore strutturato per OOS. |
| `src/lib/__tests__/webmcp.test.ts` | modify | Aggiornare conta tool (7); coprire nuovi filtri di search; coprire `get_product`; coprire `add_to_cart` con options, OOS, milk OOS. |
| `src/components/ProductCard.tsx` | modify | Intensità da `product.intensity`; badge "Esaurito"; tag pill; CTA disabled se !available. |
| `src/components/ProductGrid.tsx` | modify | Chip filtro per `type` (Tutti/Bar/Take-home/Da mangiare); sezione "Take-home" e "Da mangiare" sotto i drink. |
| `src/components/CartItem.tsx` | modify | Mostrare opzioni (size, milk, sweetness) sotto il nome. |
| `src/components/TryWithAgent.tsx` | create | Sezione con i 7 prompt killer cliccabili (copy-to-clipboard + toast inline). |
| `src/App.tsx` | modify | Integrare `<TryWithAgent />` sopra `ProductGrid`. |

---

## Task 1: Extend Product types (schema only, no data change)

**Files:**
- Modify: `src/lib/products.ts:1-10` (types only, keep PRODUCTS unchanged)

- [ ] **Step 1: Run baseline tests**

```bash
npx vitest run
```
Expected: 35 tests pass.

- [ ] **Step 2: Add new types and extend Product interface**

Replace the top of `src/lib/products.ts` (the type section, before `export const PRODUCTS`):

```ts
export type ProductCategory =
  | "espresso"
  | "filtro"
  | "decaf"
  | "latte"
  | "cold"
  | "food"
  | "beans"
  | "capsule"
  | "milk";

export type ProductType =
  | "drink"
  | "food"
  | "beans"
  | "capsule"
  | "milk_option";

export type FlavorNote =
  | "floral"
  | "fruity"
  | "chocolate"
  | "caramel"
  | "nutty"
  | "citrus"
  | "spicy"
  | "honey"
  | "berry";

export type Dietary = "vegan" | "lactose-free" | "gluten-free" | "no-caffeine";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "anytime";

export type Temperature = "hot" | "iced" | "ambient";

export type SizeOption = "S" | "M" | "L";

export type SweetnessOption = "none" | "low" | "normal";

export interface ProductOptions {
  size?: {
    values: SizeOption[];
    default: SizeOption;
    price_modifier: Partial<Record<SizeOption, number>>;
  };
  milk?: {
    values: string[]; // ids dei milk_option
    default: string;
  };
  sweetness?: {
    values: SweetnessOption[];
    default: SweetnessOption;
  };
}

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  category: ProductCategory;
  price: number;
  description: string;
  emoji: string;
  intensity?: number; // 1-10
  origin?: string;
  flavor_notes?: FlavorNote[];
  dietary?: Dietary[];
  temperature?: Temperature;
  tags?: string[];
  time_of_day?: TimeOfDay[];
  pairings?: string[];
  related_products?: string[];
  available: boolean;
  alternatives?: string[];
  options?: ProductOptions;
}
```

Then update each entry of the existing `PRODUCTS` array to add `type: "drink"` and `available: true` (so the file compiles). Example for the first entry:

```ts
  {
    id: "espresso",
    name: "Espresso Classico",
    type: "drink",
    category: "espresso",
    price: 1.5,
    description: "Tostatura scura, crema densa, rotondo al palato.",
    emoji: "☕",
    available: true,
  },
```

Apply the same minimal patch to all 8 existing entries: add `type: "drink"` and `available: true`. Do **not** add other new fields yet (those come in Task 2 with the full catalog).

- [ ] **Step 3: Run tests to verify still green**

```bash
npx vitest run
```
Expected: 35 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/products.ts
git commit -m "refactor(products): extend Product schema with new optional fields

Adds ProductType, FlavorNote, Dietary, TimeOfDay, Temperature,
SizeOption, SweetnessOption types and ProductOptions interface.
Existing 8 products are minimally updated with type:'drink' and
available:true so the file compiles; the full extended catalog comes
in the next task.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Replace PRODUCTS with the 27-entry catalog

**Files:**
- Modify: `src/lib/products.ts` (PRODUCTS array)
- Modify: `src/lib/__tests__/products.test.ts` (schema check + integrity)

- [ ] **Step 1: Write failing tests for catalog integrity**

Replace `src/lib/__tests__/products.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import {
  PRODUCTS,
  getProductById,
  getProductsByType,
  COUPONS,
  getCouponDiscount,
} from "../products";

const VALID_TYPES = new Set(["drink", "food", "beans", "capsule", "milk_option"]);

describe("PRODUCTS catalog", () => {
  it("contains exactly 27 entries (13 drink + 4 food + 3 beans + 2 capsule + 5 milk)", () => {
    expect(PRODUCTS.length).toBe(27);
    expect(getProductsByType("drink").length).toBe(13);
    expect(getProductsByType("food").length).toBe(4);
    expect(getProductsByType("beans").length).toBe(3);
    expect(getProductsByType("capsule").length).toBe(2);
    expect(getProductsByType("milk_option").length).toBe(5);
  });

  it("each product has required fields", () => {
    for (const p of PRODUCTS) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(VALID_TYPES.has(p.type)).toBe(true);
      expect(typeof p.available).toBe("boolean");
      expect(p.description).toBeTruthy();
      expect(p.emoji).toBeTruthy();
    }
  });

  it("product ids are unique", () => {
    const ids = PRODUCTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("milk-soy is out of stock with alternatives", () => {
    const soy = getProductById("milk-soy");
    expect(soy?.available).toBe(false);
    expect(soy?.alternatives).toEqual(
      expect.arrayContaining(["milk-oat", "milk-almond"]),
    );
  });

  it("pairings references exist in catalog", () => {
    for (const p of PRODUCTS) {
      for (const id of p.pairings ?? []) {
        expect(getProductById(id), `pairing ${id} of ${p.id}`).toBeDefined();
      }
    }
  });

  it("related_products references exist", () => {
    for (const p of PRODUCTS) {
      for (const id of p.related_products ?? []) {
        expect(getProductById(id), `related ${id} of ${p.id}`).toBeDefined();
      }
    }
  });

  it("options.milk.values reference real milk_option products", () => {
    for (const p of PRODUCTS) {
      const milkVals = p.options?.milk?.values ?? [];
      for (const id of milkVals) {
        const m = getProductById(id);
        expect(m?.type, `milk option ${id} on ${p.id}`).toBe("milk_option");
      }
    }
  });

  it("alternatives references exist", () => {
    for (const p of PRODUCTS) {
      for (const id of p.alternatives ?? []) {
        expect(getProductById(id), `alternative ${id} of ${p.id}`).toBeDefined();
      }
    }
  });
});

describe("getProductById", () => {
  it("returns the product when found", () => {
    expect(getProductById("espresso")?.name).toBe("Espresso Classico");
  });
  it("returns undefined when not found", () => {
    expect(getProductById("ghost")).toBeUndefined();
  });
});

describe("getProductsByType", () => {
  it("filters by type", () => {
    expect(getProductsByType("drink").every((p) => p.type === "drink")).toBe(true);
  });
});

describe("getCouponDiscount", () => {
  it("returns 10% for BENVENUTO", () => {
    expect(getCouponDiscount("BENVENUTO", 10)).toBe(1);
  });
  it("returns 20% for STUDENTI capped at 5 EUR", () => {
    expect(getCouponDiscount("STUDENTI", 10)).toBe(2);
    expect(getCouponDiscount("STUDENTI", 100)).toBe(5);
  });
  it("is case-insensitive", () => {
    expect(getCouponDiscount("benvenuto", 10)).toBe(1);
  });
  it("returns null for invalid code", () => {
    expect(getCouponDiscount("NOPE", 10)).toBeNull();
  });
});

void COUPONS; // keep import non-elided
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/__tests__/products.test.ts
```
Expected: FAIL on the count test (PRODUCTS has 8, expected 27), on `getProductsByType` not exported, on `milk-soy` not found.

- [ ] **Step 3: Replace PRODUCTS and add helpers**

Replace the entire `PRODUCTS` constant and add `getProductsByType` in `src/lib/products.ts`. Keep the type section from Task 1.

```ts
export const PRODUCTS: Product[] = [
  // ── DRINK (13) ──
  {
    id: "espresso",
    name: "Espresso Classico",
    type: "drink",
    category: "espresso",
    price: 1.5,
    description: "Tostatura scura, crema densa, rotondo al palato.",
    emoji: "☕",
    intensity: 9,
    origin: "Italia",
    flavor_notes: ["chocolate", "caramel"],
    dietary: ["vegan", "lactose-free"],
    temperature: "hot",
    tags: ["best-seller", "signature"],
    time_of_day: ["anytime"],
    pairings: ["biscotti-cantucci", "tiramisu"],
    related_products: ["beans-italian-blend-250g", "capsule-espresso-10pz"],
    available: true,
    options: {
      sweetness: { values: ["none", "low", "normal"], default: "normal" },
    },
  },
  {
    id: "doppio",
    name: "Doppio Espresso",
    type: "drink",
    category: "espresso",
    price: 2.5,
    description: "Doppia dose, per chi non ha tempo da perdere.",
    emoji: "☕",
    intensity: 10,
    origin: "Italia",
    flavor_notes: ["chocolate", "nutty"],
    dietary: ["vegan", "lactose-free"],
    temperature: "hot",
    tags: ["best-seller"],
    time_of_day: ["morning", "afternoon"],
    pairings: ["biscotti-cantucci"],
    available: true,
    options: {
      sweetness: { values: ["none", "low", "normal"], default: "normal" },
    },
  },
  {
    id: "ristretto",
    name: "Ristretto",
    type: "drink",
    category: "espresso",
    price: 1.6,
    description: "Estratto più breve, concentrato, intenso al naso.",
    emoji: "☕",
    intensity: 10,
    origin: "Italia",
    flavor_notes: ["chocolate", "spicy"],
    dietary: ["vegan", "lactose-free"],
    temperature: "hot",
    tags: [],
    time_of_day: ["anytime"],
    available: true,
    options: {
      sweetness: { values: ["none", "low", "normal"], default: "normal" },
    },
  },
  {
    id: "macchiato",
    name: "Macchiato",
    type: "drink",
    category: "latte",
    price: 2.0,
    description: "Espresso macchiato con un tocco di schiuma di latte.",
    emoji: "☕",
    intensity: 8,
    origin: "Italia",
    flavor_notes: ["chocolate"],
    dietary: [],
    temperature: "hot",
    tags: [],
    time_of_day: ["anytime"],
    available: true,
    options: {
      milk: {
        values: ["milk-whole", "milk-oat", "milk-soy", "milk-almond", "milk-lactose-free"],
        default: "milk-whole",
      },
      sweetness: { values: ["none", "low", "normal"], default: "normal" },
    },
  },
  {
    id: "americano",
    name: "Caffè Americano",
    type: "drink",
    category: "filtro",
    price: 2.2,
    description: "Espresso lungo allungato con acqua calda.",
    emoji: "☕",
    intensity: 6,
    origin: "Italia",
    flavor_notes: ["chocolate"],
    dietary: ["vegan", "lactose-free"],
    temperature: "hot",
    tags: [],
    time_of_day: ["morning", "afternoon"],
    pairings: ["cornetto-vuoto", "biscotti-cantucci"],
    available: true,
    options: {
      size: {
        values: ["S", "M", "L"],
        default: "M",
        price_modifier: { S: 0, M: 0, L: 0.5 },
      },
      sweetness: { values: ["none", "low", "normal"], default: "normal" },
    },
  },
  {
    id: "cappuccino",
    name: "Cappuccino",
    type: "drink",
    category: "latte",
    price: 2.5,
    description: "Latte montato a velluto, equilibrio italiano classico.",
    emoji: "☕",
    intensity: 6,
    origin: "Italia",
    flavor_notes: ["chocolate", "nutty"],
    dietary: [],
    temperature: "hot",
    tags: ["signature", "best-seller"],
    time_of_day: ["morning"],
    pairings: ["cornetto-vuoto", "cornetto-cioccolato"],
    available: true,
    options: {
      size: {
        values: ["S", "M", "L"],
        default: "M",
        price_modifier: { S: 0, M: 0, L: 0.5 },
      },
      milk: {
        values: ["milk-whole", "milk-oat", "milk-soy", "milk-almond", "milk-lactose-free"],
        default: "milk-whole",
      },
      sweetness: { values: ["none", "low", "normal"], default: "normal" },
    },
  },
  {
    id: "flat-white",
    name: "Flat White",
    type: "drink",
    category: "latte",
    price: 3.0,
    description: "Doppio ristretto su microfoam vellutato.",
    emoji: "☕",
    intensity: 7,
    origin: "Italia",
    flavor_notes: ["chocolate", "caramel"],
    dietary: [],
    temperature: "hot",
    tags: [],
    time_of_day: ["morning", "afternoon"],
    available: true,
    options: {
      milk: {
        values: ["milk-whole", "milk-oat", "milk-soy", "milk-almond", "milk-lactose-free"],
        default: "milk-whole",
      },
      sweetness: { values: ["none", "low", "normal"], default: "normal" },
    },
  },
  {
    id: "latte-macchiato",
    name: "Latte Macchiato",
    type: "drink",
    category: "latte",
    price: 3.0,
    description: "Latte caldo macchiato con un espresso, servito a strati.",
    emoji: "🥛",
    intensity: 4,
    origin: "Italia",
    flavor_notes: ["nutty", "honey"],
    dietary: [],
    temperature: "hot",
    tags: [],
    time_of_day: ["morning"],
    available: true,
    options: {
      size: {
        values: ["S", "M", "L"],
        default: "M",
        price_modifier: { S: 0, M: 0, L: 0.5 },
      },
      milk: {
        values: ["milk-whole", "milk-oat", "milk-soy", "milk-almond", "milk-lactose-free"],
        default: "milk-whole",
      },
      sweetness: { values: ["none", "low", "normal"], default: "normal" },
    },
  },
  {
    id: "mocha",
    name: "Mocha",
    type: "drink",
    category: "latte",
    price: 3.5,
    description: "Espresso, latte montato e una vena di cioccolato.",
    emoji: "🍫",
    intensity: 6,
    origin: "Italia",
    flavor_notes: ["chocolate"],
    dietary: [],
    temperature: "hot",
    tags: [],
    time_of_day: ["afternoon"],
    pairings: ["biscotti-cantucci"],
    available: true,
    options: {
      size: {
        values: ["S", "M", "L"],
        default: "M",
        price_modifier: { S: 0, M: 0, L: 0.5 },
      },
      milk: {
        values: ["milk-whole", "milk-oat", "milk-soy", "milk-almond", "milk-lactose-free"],
        default: "milk-whole",
      },
      sweetness: { values: ["none", "low", "normal"], default: "normal" },
    },
  },
  {
    id: "shakerato",
    name: "Caffè Shakerato",
    type: "drink",
    category: "cold",
    price: 3.5,
    description: "Espresso shakerato con ghiaccio, denso e cremoso.",
    emoji: "🧊",
    intensity: 7,
    origin: "Italia",
    flavor_notes: ["chocolate", "caramel"],
    dietary: ["vegan", "lactose-free"],
    temperature: "iced",
    tags: ["limited", "estate"],
    time_of_day: ["afternoon"],
    available: true,
    options: {
      sweetness: { values: ["none", "low", "normal"], default: "normal" },
    },
  },
  {
    id: "decaffeinato",
    name: "Decaffeinato",
    type: "drink",
    category: "decaf",
    price: 1.8,
    description: "Decaffeinato ad acqua, corpo pieno senza caffeina.",
    emoji: "☕",
    intensity: 3,
    origin: "Italia",
    flavor_notes: ["chocolate", "nutty"],
    dietary: ["no-caffeine"],
    temperature: "hot",
    tags: ["promo"],
    time_of_day: ["afternoon", "evening"],
    related_products: ["capsule-decaf-10pz"],
    available: true,
    options: {
      size: {
        values: ["S", "M", "L"],
        default: "M",
        price_modifier: { S: 0, M: 0, L: 0.5 },
      },
      milk: {
        values: ["milk-whole", "milk-oat", "milk-soy", "milk-almond", "milk-lactose-free"],
        default: "milk-whole",
      },
      sweetness: { values: ["none", "low", "normal"], default: "normal" },
    },
  },
  {
    id: "filtro-etiopia",
    name: "Filtro Etiopia",
    type: "drink",
    category: "filtro",
    price: 4.0,
    description: "Note floreali e di bergamotto, lavorato a umido.",
    emoji: "🫖",
    intensity: 5,
    origin: "Etiopia",
    flavor_notes: ["floral", "fruity", "berry", "citrus"],
    dietary: ["vegan", "lactose-free"],
    temperature: "hot",
    tags: ["novità", "signature"],
    time_of_day: ["morning", "afternoon"],
    related_products: ["beans-etiopia-250g"],
    available: true,
  },
  {
    id: "filtro-colombia",
    name: "Filtro Colombia",
    type: "drink",
    category: "filtro",
    price: 3.8,
    description: "Caramello, cioccolato al latte, dolce nel finale.",
    emoji: "🫖",
    intensity: 5,
    origin: "Colombia",
    flavor_notes: ["caramel", "chocolate", "nutty"],
    dietary: ["vegan", "lactose-free"],
    temperature: "hot",
    tags: ["novità"],
    time_of_day: ["morning"],
    related_products: ["beans-colombia-250g"],
    available: true,
  },

  // ── FOOD (4) ──
  {
    id: "cornetto-vuoto",
    name: "Cornetto Vuoto",
    type: "food",
    category: "food",
    price: 1.5,
    description: "Sfoglia dorata, leggermente vanigliata, perfetta a colazione.",
    emoji: "🥐",
    dietary: [],
    tags: [],
    time_of_day: ["morning"],
    available: true,
  },
  {
    id: "cornetto-cioccolato",
    name: "Cornetto al Cioccolato",
    type: "food",
    category: "food",
    price: 1.8,
    description: "Cornetto ripieno di crema al cioccolato fondente.",
    emoji: "🥐",
    dietary: [],
    tags: [],
    time_of_day: ["morning"],
    available: true,
  },
  {
    id: "biscotti-cantucci",
    name: "Cantucci alle Mandorle",
    type: "food",
    category: "food",
    price: 2.5,
    description: "Biscotti toscani con mandorle intere, croccanti.",
    emoji: "🍪",
    dietary: [],
    tags: [],
    time_of_day: ["anytime"],
    available: true,
  },
  {
    id: "tiramisu",
    name: "Tiramisù della Casa",
    type: "food",
    category: "food",
    price: 4.5,
    description: "Mascarpone, savoiardi inzuppati nel caffè, cacao amaro.",
    emoji: "🍰",
    dietary: [],
    tags: ["signature"],
    time_of_day: ["afternoon", "evening"],
    available: true,
  },

  // ── BEANS (3) ──
  {
    id: "beans-etiopia-250g",
    name: "Chicchi Etiopia 250g",
    type: "beans",
    category: "beans",
    price: 12.0,
    description: "Single origin Etiopia Yirgacheffe, tostatura chiara.",
    emoji: "🌱",
    intensity: 4,
    origin: "Etiopia",
    flavor_notes: ["floral", "fruity", "citrus"],
    dietary: ["vegan", "lactose-free"],
    tags: ["single-origin"],
    available: true,
  },
  {
    id: "beans-colombia-250g",
    name: "Chicchi Colombia 250g",
    type: "beans",
    category: "beans",
    price: 11.0,
    description: "Single origin Colombia Huila, tostatura media.",
    emoji: "🌱",
    intensity: 5,
    origin: "Colombia",
    flavor_notes: ["caramel", "chocolate", "nutty"],
    dietary: ["vegan", "lactose-free"],
    tags: ["single-origin"],
    available: true,
  },
  {
    id: "beans-italian-blend-250g",
    name: "Italian Blend 250g",
    type: "beans",
    category: "beans",
    price: 9.0,
    description: "Miscela classica italiana, tostatura scura, ottima per moka.",
    emoji: "🌱",
    intensity: 9,
    origin: "Italia",
    flavor_notes: ["chocolate", "nutty"],
    dietary: ["vegan", "lactose-free"],
    tags: ["best-seller"],
    available: true,
  },

  // ── CAPSULE (2) ──
  {
    id: "capsule-espresso-10pz",
    name: "Capsule Espresso (10pz)",
    type: "capsule",
    category: "capsule",
    price: 4.5,
    description: "10 capsule compatibili con macchine espresso domestiche.",
    emoji: "🟤",
    intensity: 9,
    origin: "Italia",
    flavor_notes: ["chocolate"],
    dietary: ["vegan", "lactose-free"],
    available: true,
  },
  {
    id: "capsule-decaf-10pz",
    name: "Capsule Decaf (10pz)",
    type: "capsule",
    category: "capsule",
    price: 5.0,
    description: "10 capsule decaffeinate, profilo dolce e tondo.",
    emoji: "⚫",
    intensity: 3,
    origin: "Italia",
    flavor_notes: ["chocolate", "nutty"],
    dietary: ["vegan", "lactose-free", "no-caffeine"],
    available: true,
  },

  // ── MILK OPTIONS (5) ──
  {
    id: "milk-whole",
    name: "Latte intero",
    type: "milk_option",
    category: "milk",
    price: 0,
    description: "Latte vaccino intero, microfoam denso.",
    emoji: "🥛",
    dietary: [],
    available: true,
  },
  {
    id: "milk-oat",
    name: "Latte d'avena",
    type: "milk_option",
    category: "milk",
    price: 0.5,
    description: "Avena barista edition, texture vellutata.",
    emoji: "🌾",
    dietary: ["vegan", "lactose-free"],
    tags: ["plant-based"],
    flavor_notes: ["nutty"],
    available: true,
  },
  {
    id: "milk-soy",
    name: "Latte di soia",
    type: "milk_option",
    category: "milk",
    price: 0.5,
    description: "Soia barista, profilo neutro.",
    emoji: "🫘",
    dietary: ["vegan", "lactose-free"],
    tags: ["plant-based"],
    flavor_notes: ["nutty"],
    available: false,
    alternatives: ["milk-oat", "milk-almond"],
  },
  {
    id: "milk-almond",
    name: "Latte di mandorla",
    type: "milk_option",
    category: "milk",
    price: 0.5,
    description: "Mandorla barista, tono dolce.",
    emoji: "🌰",
    dietary: ["vegan", "lactose-free"],
    tags: ["plant-based"],
    flavor_notes: ["nutty"],
    available: true,
  },
  {
    id: "milk-lactose-free",
    name: "Latte senza lattosio",
    type: "milk_option",
    category: "milk",
    price: 0.3,
    description: "Latte vaccino delattosato.",
    emoji: "🥛",
    dietary: ["lactose-free"],
    available: true,
  },
];

export function getProductById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function getProductsByType(type: ProductType): Product[] {
  return PRODUCTS.filter((p) => p.type === type);
}
```

Keep the `Coupon`/`COUPONS`/`getCouponDiscount` section unchanged at the bottom of the file.

- [ ] **Step 4: Run tests**

```bash
npx vitest run
```
Expected: products.test.ts passes. The existing `webmcp.test.ts` test on line 22 (`toHaveLength(6)`) and others may still pass since search by category/max_price still works. Some webmcp tests may break later — fix in Task 4.

If the cart subtotal test fails (line 59 of cart.test.ts): the test expects `addItem("espresso", 2) + addItem("cappuccino", 1)` → 5.5. With new prices: espresso 1.5 × 2 + cappuccino 2.5 = 5.5. ✓ Unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/lib/products.ts src/lib/__tests__/products.test.ts
git commit -m "feat(products): extended catalog with 27 entries

Adds 5 new drinks (doppio, ristretto, flat white, mocha, shakerato),
4 food items, 3 take-home beans, 2 capsule formats, and 5 milk
options (one OOS for the substitution scenario). Each product is
annotated with intensity, origin, flavor notes, dietary, tags,
time_of_day, pairings, related_products, and customization options
where appropriate.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Cart store supports options (S6, prerequisite for S3)

**Files:**
- Modify: `src/store/cart.ts`
- Modify: `src/store/__tests__/cart.test.ts`

- [ ] **Step 1: Write failing tests for options support**

Append to `src/store/__tests__/cart.test.ts` before the closing `});` of the outer describe:

```ts
  it("addItem with different options creates a distinct line", () => {
    useCartStore.getState().addItem("cappuccino", 1);
    useCartStore.getState().addItem("cappuccino", 1, { size: "L" });
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ productId: "cappuccino", quantity: 1 });
    expect(items[1]).toEqual({
      productId: "cappuccino",
      quantity: 1,
      options: { size: "L" },
    });
  });

  it("addItem with identical options merges quantity", () => {
    useCartStore.getState().addItem("cappuccino", 1, { size: "L", milk: "milk-oat" });
    useCartStore.getState().addItem("cappuccino", 2, { milk: "milk-oat", size: "L" });
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(3);
  });

  it("subtotal includes size and milk modifiers", () => {
    // cappuccino base 2.50, size L = +0.50, milk-oat = +0.50 -> 3.50
    useCartStore.getState().addItem("cappuccino", 2, { size: "L", milk: "milk-oat" });
    expect(useCartStore.getState().subtotal()).toBeCloseTo(7.0, 2);
  });

  it("subtotal handles size S and default milk gracefully", () => {
    // americano base 2.20, size S = +0 -> 2.20
    useCartStore.getState().addItem("americano", 1, { size: "S" });
    expect(useCartStore.getState().subtotal()).toBeCloseTo(2.2, 2);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/store/__tests__/cart.test.ts
```
Expected: FAIL on the new tests because `addItem` doesn't accept a third argument and rows have no `options`.

- [ ] **Step 3: Update cart store**

Replace `src/store/cart.ts` with:

```ts
import { create } from "zustand";
import {
  getProductById,
  getCouponDiscount,
  type SizeOption,
  type SweetnessOption,
} from "../lib/products";

export interface CartItemOptions {
  size?: SizeOption;
  milk?: string;
  sweetness?: SweetnessOption;
}

export interface CartItem {
  productId: string;
  quantity: number;
  options?: CartItemOptions;
}

export interface ToolActivity {
  id: string;
  tool: string;
  args: unknown;
  result: string;
  timestamp: number;
}

interface CartState {
  items: CartItem[];
  coupon: string | null;
  activity: ToolActivity[];
  addItem: (
    productId: string,
    quantity: number,
    options?: CartItemOptions,
  ) => boolean;
  removeItem: (productId: string) => boolean;
  applyCoupon: (code: string) => boolean;
  clearCoupon: () => void;
  checkout: () => { ok: boolean; total: number; reason?: string };
  reset: () => void;
  logToolCall: (tool: string, args: unknown, result: string) => void;
  subtotal: () => number;
  discount: () => number;
  total: () => number;
}

function normalizeOptions(o?: CartItemOptions): CartItemOptions | undefined {
  if (!o) return undefined;
  const out: CartItemOptions = {};
  if (o.size !== undefined) out.size = o.size;
  if (o.milk !== undefined) out.milk = o.milk;
  if (o.sweetness !== undefined) out.sweetness = o.sweetness;
  return Object.keys(out).length > 0 ? out : undefined;
}

function optionsKey(o?: CartItemOptions): string {
  const n = normalizeOptions(o);
  if (!n) return "";
  // stable JSON: sort keys
  const keys = Object.keys(n).sort();
  const obj: Record<string, unknown> = {};
  for (const k of keys) obj[k] = (n as Record<string, unknown>)[k];
  return JSON.stringify(obj);
}

export function lineUnitPrice(item: CartItem): number {
  const p = getProductById(item.productId);
  if (!p) return 0;
  let price = p.price;
  const sz = item.options?.size;
  if (sz && p.options?.size?.price_modifier) {
    price += p.options.size.price_modifier[sz] ?? 0;
  }
  const milkId = item.options?.milk;
  if (milkId) {
    const milk = getProductById(milkId);
    if (milk) price += milk.price;
  }
  return price;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  coupon: null,
  activity: [],

  addItem: (productId, quantity, options) => {
    if (!getProductById(productId)) return false;
    if (quantity < 1) return false;
    const norm = normalizeOptions(options);
    const key = optionsKey(norm);
    set((state) => {
      const idx = state.items.findIndex(
        (i) => i.productId === productId && optionsKey(i.options) === key,
      );
      if (idx >= 0) {
        return {
          items: state.items.map((i, j) =>
            j === idx ? { ...i, quantity: i.quantity + quantity } : i,
          ),
        };
      }
      const newItem: CartItem = { productId, quantity };
      if (norm) newItem.options = norm;
      return { items: [...state.items, newItem] };
    });
    return true;
  },

  removeItem: (productId) => {
    const idx = get().items.findIndex((i) => i.productId === productId);
    if (idx < 0) return false;
    set((state) => ({
      items: state.items.filter((_, j) => j !== idx),
    }));
    return true;
  },

  applyCoupon: (code) => {
    const normalized = code.toUpperCase();
    const discount = getCouponDiscount(normalized, get().subtotal());
    if (discount === null) return false;
    set({ coupon: normalized });
    return true;
  },

  clearCoupon: () => set({ coupon: null }),

  checkout: () => {
    const items = get().items;
    if (items.length === 0) {
      return { ok: false, total: 0, reason: "cart_empty" };
    }
    const total = get().total();
    set({ items: [], coupon: null });
    return { ok: true, total };
  },

  reset: () =>
    set({
      items: [],
      coupon: null,
      activity: [],
    }),

  logToolCall: (tool, args, result) =>
    set((state) => ({
      activity: [
        ...state.activity,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          tool,
          args,
          result,
          timestamp: Date.now(),
        },
      ],
    })),

  subtotal: () => {
    return get().items.reduce(
      (acc, item) => acc + lineUnitPrice(item) * item.quantity,
      0,
    );
  },

  discount: () => {
    const code = get().coupon;
    if (!code) return 0;
    return getCouponDiscount(code, get().subtotal()) ?? 0;
  },

  total: () => {
    return Math.max(0, get().subtotal() - get().discount());
  },
}));
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/store/__tests__/cart.test.ts
```
Expected: all cart tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/store/cart.ts src/store/__tests__/cart.test.ts
git commit -m "feat(cart): support per-line options with price modifiers

CartItem can now carry options (size, milk, sweetness). Lines with
identical options merge; lines with different options stay distinct.
subtotal() includes size price_modifier and milk option price as
modifier on top of base price. Exports lineUnitPrice helper.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Extend search_products tool

**Files:**
- Modify: `src/lib/webmcp.ts` (search_products implementation + schema)
- Modify: `src/lib/__tests__/webmcp.test.ts` (new filter tests + update tool count)

- [ ] **Step 1: Update expected tool count and add new filter tests**

In `src/lib/__tests__/webmcp.test.ts`:

Find line 22 `expect(buildTools()).toHaveLength(6);` and change to:

```ts
  it("exposes exactly 7 tools", () => {
    expect(buildTools()).toHaveLength(7);
  });
```

Then append the following tests inside the same describe block (before the closing `});`):

```ts
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
    // milk_option are excluded by default; force inclusion
    const res = await findTool("search_products").execute(
      { type: "milk_option", in_stock_only: true },
      fakeAgent,
    );
    expect(res.content[0].text).not.toContain("Latte di soia");
    expect(res.content[0].text).toContain("Latte d'avena");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/__tests__/webmcp.test.ts
```
Expected: FAIL — tool count 6 ≠ 7, and the new filter args are ignored so milk options leak / type filter not applied.

- [ ] **Step 3: Replace search_products in webmcp.ts**

In `src/lib/webmcp.ts`, replace the entire `search_products` tool entry (lines roughly 35-83) with:

```ts
    {
      name: "search_products",
      description:
        "Cerca prodotti nel catalogo (drink, food, beans, capsule). I prodotti di tipo milk_option sono esclusi di default — passa type:'milk_option' per includerli. Tutti i filtri sono in AND; tags/dietary/flavor_notes sono AND interno (il prodotto deve avere tutti i valori richiesti).",
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
          origin: { type: "string", description: "Es: 'Etiopia', 'Colombia', 'Italia'" },
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
          // exclude milk_option unless explicitly requested
          if (p.type === "milk_option" && a.type !== "milk_option") return false;
          if (a.type && p.type !== a.type) return false;
          if (a.category && p.category !== a.category) return false;
          if (typeof a.max_price === "number" && p.price > a.max_price) return false;
          if (a.origin && p.origin !== a.origin) return false;
          if (typeof a.intensity_min === "number" && (p.intensity ?? 0) < a.intensity_min)
            return false;
          if (typeof a.intensity_max === "number" && (p.intensity ?? 10) > a.intensity_max)
            return false;
          if (a.in_stock_only && !p.available) return false;
          if (a.tags && a.tags.length > 0) {
            const has = new Set(p.tags ?? []);
            if (!a.tags.every((t) => has.has(t))) return false;
          }
          if (a.dietary && a.dietary.length > 0) {
            const has = new Set(p.dietary ?? []);
            if (!a.dietary.every((d) => has.has(d))) return false;
          }
          if (a.flavor_notes && a.flavor_notes.length > 0) {
            const has = new Set(p.flavor_notes ?? []);
            if (!a.flavor_notes.every((f) => has.has(f))) return false;
          }
          if (a.time_of_day) {
            const has = new Set(p.time_of_day ?? []);
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
        useCartStore
          .getState()
          .logToolCall("search_products", args, `${results.length} risultati`);
        return ok(text);
      },
    },
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/webmcp.test.ts
```
Expected: the new search filter tests pass. The tool-count test will still fail (6 ≠ 7) until Task 5 adds `get_product`. Leave it for now.

- [ ] **Step 5: Commit**

```bash
git add src/lib/webmcp.ts src/lib/__tests__/webmcp.test.ts
git commit -m "feat(webmcp): extend search_products with rich filters

Adds filters: type, tags[], dietary[], flavor_notes[], origin,
intensity_min/max, time_of_day, in_stock_only. milk_option products
are excluded unless explicitly requested via type. Output is richer
(intensity, origin, ESAURITO flag).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: New tool `get_product`

**Files:**
- Modify: `src/lib/webmcp.ts` (add tool)
- Modify: `src/lib/__tests__/webmcp.test.ts` (add tests)

- [ ] **Step 1: Write failing tests for get_product**

Append to the describe block in `src/lib/__tests__/webmcp.test.ts`:

```ts
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
    expect(t.toLowerCase()).toContain("esaurito");
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/__tests__/webmcp.test.ts
```
Expected: FAIL — `get_product` tool not found.

- [ ] **Step 3: Add get_product to buildTools()**

In `src/lib/webmcp.ts`, add this entry **after** `search_products` and **before** `add_to_cart`:

```ts
    {
      name: "get_product",
      description:
        "Restituisce la scheda completa di un prodotto: attributi (intensità, origine, note aromatiche, dietary, tag, time_of_day), disponibilità, alternative se esaurito, pairing consigliati, prodotti correlati (es. chicchi da asporto della stessa bevanda) e opzioni di personalizzazione (size, milk, sweetness). Usalo per ragionare su un singolo prodotto in dettaglio.",
      inputSchema: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "L'id del prodotto" },
        },
        required: ["product_id"],
      },
      async execute(args) {
        const { product_id } = args as { product_id: string };
        const p = getProductById(product_id);
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
        useCartStore
          .getState()
          .logToolCall("get_product", args, `${p.id} (${p.type})`);
        return ok(text);
      },
    },
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/lib/__tests__/webmcp.test.ts
```
Expected: all tests pass (including the tool count of 7).

- [ ] **Step 5: Commit**

```bash
git add src/lib/webmcp.ts src/lib/__tests__/webmcp.test.ts
git commit -m "feat(webmcp): add get_product tool

New primitive that returns full product details: attributes,
availability with alternatives (for OOS substitution), pairings,
related_products (for cross-modal scenarios), and customization
options. This is the only new tool needed for all 7 wow scenarios —
the rest are composed by the agent.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Extend add_to_cart with options and OOS handling

**Files:**
- Modify: `src/lib/webmcp.ts` (add_to_cart implementation + schema)
- Modify: `src/lib/__tests__/webmcp.test.ts` (new tests)

- [ ] **Step 1: Write failing tests**

Append to the describe block in `src/lib/__tests__/webmcp.test.ts`:

```ts
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
    expect(t.toLowerCase()).toContain("esaurito");
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

  it("add_to_cart errors when product itself is unavailable", async () => {
    // milk_option is a product type, milk-soy is OOS — but add_to_cart on
    // it directly should also reject. Mark by using a direct add_to_cart on milk-soy.
    const res = await findTool("add_to_cart").execute(
      { product_id: "milk-soy", quantity: 1 },
      fakeAgent,
    );
    expect(res.isError).toBe(true);
    const t = res.content[0].text;
    expect(t.toLowerCase()).toContain("esaurito");
    expect(t).toContain("milk-oat");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/__tests__/webmcp.test.ts
```
Expected: FAIL — options not supported, OOS not detected.

- [ ] **Step 3: Update add_to_cart**

In `src/lib/webmcp.ts`, replace the entire `add_to_cart` tool entry with:

```ts
    {
      name: "add_to_cart",
      description:
        "Aggiunge un prodotto al carrello in una certa quantità. Supporta options (size, milk, sweetness) se il prodotto le offre. Se il prodotto o l'opzione richiesta è ESAURITA, ritorna un errore strutturato con alternative coerenti che puoi proporre all'utente.",
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
        const { product_id, quantity, options } = args as {
          product_id: string;
          quantity: number;
          options?: { size?: SizeOption; milk?: string; sweetness?: SweetnessOption };
        };
        const product = getProductById(product_id);
        if (!product) {
          useCartStore
            .getState()
            .logToolCall("add_to_cart", args, "errore: prodotto non trovato");
          return err(`Prodotto "${product_id}" non trovato.`);
        }
        if (!product.available) {
          const altText = formatAlternatives(product.alternatives);
          const msg = `Prodotto "${product.name}" ESAURITO.${altText}`;
          useCartStore.getState().logToolCall("add_to_cart", args, "errore: esaurito");
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
          .addItem(product_id, quantity, options);
        if (!okAdd) {
          useCartStore
            .getState()
            .logToolCall("add_to_cart", args, "errore generico");
          return err(`Impossibile aggiungere "${product_id}".`);
        }
        const optsLabel = formatOptionsLabel(options);
        const msg = `Aggiunto: ${product.name} x${quantity}${optsLabel}.`;
        useCartStore.getState().logToolCall("add_to_cart", args, msg);
        return ok(msg);
      },
    },
```

Then add these helper functions to `src/lib/webmcp.ts` near the top (after the `err`/`ok` helpers, before `buildTools`):

```ts
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
```

Update the top-level import in `webmcp.ts` to include `SizeOption` and `SweetnessOption`:

```ts
import {
  PRODUCTS,
  getProductById,
  COUPONS,
  type SizeOption,
  type SweetnessOption,
} from "./products";
```

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/webmcp.ts src/lib/__tests__/webmcp.test.ts
git commit -m "feat(webmcp): add_to_cart accepts options and handles OOS

add_to_cart now accepts options (size, milk, sweetness) and validates
them against the product's options schema. If the product itself or
the requested milk option is unavailable, returns a structured error
listing alternative ids — the agent can propose these to the user
and retry.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: get_cart displays options per line

**Files:**
- Modify: `src/lib/webmcp.ts` (get_cart formatting)
- Modify: `src/lib/__tests__/webmcp.test.ts` (one test)

- [ ] **Step 1: Add test**

Append to `src/lib/__tests__/webmcp.test.ts`:

```ts
  it("get_cart shows options per line", async () => {
    useCartStore.getState().addItem("cappuccino", 1, {
      size: "L",
      milk: "milk-oat",
      sweetness: "none",
    });
    const res = await findTool("get_cart").execute({}, fakeAgent);
    const t = res.content[0].text;
    expect(t).toContain("Cappuccino");
    expect(t).toContain("size L");
    expect(t.toLowerCase()).toContain("avena");
  });
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run src/lib/__tests__/webmcp.test.ts -t "get_cart shows options"
```
Expected: FAIL — get_cart doesn't print options today.

- [ ] **Step 3: Update get_cart and replace formatProduct with formatLine**

In `src/lib/webmcp.ts`, **delete** the existing top-level `formatProduct(id, qty)` helper (it's unused after Task 6 reworked the `add_to_cart` success message). Add a new helper `formatLine` in its place:

```ts
function formatLine(item: { productId: string; quantity: number; options?: { size?: SizeOption; milk?: string; sweetness?: SweetnessOption } }): string {
  const p = getProductById(item.productId);
  if (!p) return `${item.productId} x${item.quantity}`;
  const opts = formatOptionsLabel(item.options);
  // line unit price including modifiers (mirror cart store)
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
```

Replace the `get_cart` execute body to use `formatLine`:

```ts
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
```

Confirm `formatProduct` is no longer referenced anywhere (it was removed in Step 3 above).

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```
Expected: all tests pass. Look closely at the existing test on line 103 of webmcp.test.ts: `expect(res.content[0].text).toContain("3.00")` for `addItem("espresso", 2)`. Espresso 1.50 × 2 = 3.00 ✓.

- [ ] **Step 5: Commit**

```bash
git add src/lib/webmcp.ts src/lib/__tests__/webmcp.test.ts
git commit -m "feat(webmcp): get_cart prints options and unit price per line

Each cart line now shows size/milk/sweetness selections and the
computed line total including size and milk modifiers.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: ProductCard — per-product intensity, OOS badge, tag pills

**Files:**
- Modify: `src/components/ProductCard.tsx`

- [ ] **Step 1: Update ProductCard**

Replace `src/components/ProductCard.tsx` with:

```tsx
import { motion } from "framer-motion";
import { useState } from "react";
import type { Product, ProductCategory } from "../lib/products";
import { useCartStore } from "../store/cart";

interface Props {
  product: Product;
}

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  espresso: "Espresso",
  filtro: "Filtro",
  decaf: "Decaffeinato",
  latte: "Latte",
  cold: "Freddo",
  food: "Pasticceria",
  beans: "Chicchi",
  capsule: "Capsule",
  milk: "Latte",
};

const TAG_VARIANT: Record<string, "new" | "promo" | "info"> = {
  novità: "new",
  signature: "info",
  "best-seller": "info",
  limited: "new",
  promo: "promo",
  estate: "info",
  "plant-based": "info",
  "single-origin": "info",
};

export function ProductCard({ product }: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const [pulse, setPulse] = useState(0);

  const handleAdd = () => {
    if (!product.available) return;
    addItem(product.id, 1);
    setPulse((p) => p + 1);
  };

  const eyebrow = CATEGORY_LABEL[product.category];
  const intensity = product.intensity;
  // Choose up to 2 most informative tags
  const displayTags = (product.tags ?? []).slice(0, 2);

  return (
    <motion.div
      data-product-id={product.id}
      animate={
        pulse > 0
          ? {
              scale: [1, 1.03, 1],
              boxShadow: [
                "0 0 0 rgba(255,135,0,0)",
                "0 0 28px rgba(255,135,0,0.55)",
                "0 0 0 rgba(255,135,0,0)",
              ],
            }
          : {}
      }
      transition={{ duration: 0.55 }}
      className={`bg-lavazza-off rounded-md p-4 flex flex-col hover:shadow-lavazza transition-shadow relative ${
        product.available ? "" : "opacity-60"
      }`}
    >
      {displayTags.length > 0 && (
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
          {displayTags.map((tag) => {
            const v = TAG_VARIANT[tag] ?? "info";
            const cls =
              v === "new"
                ? "bg-coffee-dark text-white"
                : v === "promo"
                  ? "bg-white text-coffee-accent border border-coffee-accent/30"
                  : "bg-lavazza-deep text-white";
            return (
              <span
                key={tag}
                className={`${cls} text-[10px] font-medium px-2 py-0.5 rounded-md uppercase tracking-wider`}
              >
                {tag}
              </span>
            );
          })}
        </div>
      )}

      {!product.available && (
        <div className="absolute top-3 right-3 z-10">
          <span className="bg-coffee-mid text-white text-[10px] font-medium px-2 py-0.5 rounded-md uppercase tracking-wider">
            Esaurito
          </span>
        </div>
      )}

      <div className="h-40 flex items-center justify-center mb-3 mt-2">
        <span className="text-7xl">{product.emoji}</span>
      </div>

      <p className="text-[11px] uppercase tracking-[0.15em] font-light text-coffee-mid mb-1 text-center">
        {eyebrow}
      </p>

      <h3 className="font-display text-lg font-bold text-lavazza-deep text-center mb-1 leading-tight">
        {product.name}
      </h3>

      {typeof intensity === "number" && (
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-xs text-coffee-mid">Intensità</span>
          <div className="flex gap-0.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <span
                key={i}
                className={`h-2 w-1.5 rounded-sm ${
                  i < intensity ? "bg-coffee-dark" : "bg-lavazza-line"
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-semibold text-lavazza-deep">
            {intensity}/10
          </span>
        </div>
      )}

      <p className="text-xs text-coffee-mid mb-4 flex-grow text-center leading-relaxed px-1">
        {product.description}
      </p>

      <p className="text-xl font-bold text-coffee-mid text-center mb-3">
        € {product.price.toFixed(2).replace(".", ",")}
      </p>

      <button
        onClick={handleAdd}
        disabled={!product.available}
        className="w-full bg-coffee-dark text-white py-3 rounded-pill text-xs uppercase tracking-[0.1em] font-semibold border-[1.5px] border-coffee-dark hover:bg-lavazza-deep hover:border-lavazza-deep transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        {product.available ? "Aggiungi al carrello" : "Esaurito"}
      </button>
    </motion.div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc -p tsconfig.app.json --noEmit
```
Expected: no errors.

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/ProductCard.tsx
git commit -m "feat(ui): ProductCard uses per-product intensity, tags, OOS

Intensity bar now reads product.intensity (per-product, optional).
Up to 2 tag pills shown top-left with variant colors. Esaurito
badge top-right when !available; CTA disabled in that case.
CATEGORY_LABEL extended for new categories.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: ProductGrid — type filter chips and sections

**Files:**
- Modify: `src/components/ProductGrid.tsx`

- [ ] **Step 1: Replace ProductGrid**

Replace `src/components/ProductGrid.tsx` with:

```tsx
import { useState } from "react";
import { getProductsByType, type Product, type ProductType } from "../lib/products";
import { ProductCard } from "./ProductCard";

type FilterKey = "all" | "bar" | "take-home" | "food";

const FILTERS: { key: FilterKey; label: string; matches: (p: Product) => boolean }[] = [
  { key: "all", label: "Tutto", matches: () => true },
  { key: "bar", label: "Al bar", matches: (p) => p.type === "drink" },
  { key: "food", label: "Pasticceria", matches: (p) => p.type === "food" },
  {
    key: "take-home",
    label: "Da asporto",
    matches: (p) => p.type === "beans" || p.type === "capsule",
  },
];

function section(title: string, eyebrow: string, products: Product[]) {
  if (products.length === 0) return null;
  return (
    <div key={title} className="mb-12">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-coffee-mid mb-2">
            {eyebrow}
          </p>
          <h2 className="font-display text-3xl font-bold text-lavazza-deep">
            {title}
          </h2>
        </div>
        <p className="text-xs uppercase tracking-wider text-coffee-mid">
          {products.length} prodotti
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}

export function ProductGrid() {
  const [filter, setFilter] = useState<FilterKey>("all");

  const showType = (t: ProductType) =>
    FILTERS.find((f) => f.key === filter)?.matches({ type: t } as Product) ?? true;

  return (
    <section className="px-6 pt-8 pb-12">
      <div className="mb-6 flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs uppercase tracking-wider px-4 py-2 rounded-pill border transition ${
              filter === f.key
                ? "bg-coffee-dark text-white border-coffee-dark"
                : "bg-white text-coffee-mid border-lavazza-line hover:border-coffee-dark"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {showType("drink") &&
        section("Il nostro caffè", "Catalogo", getProductsByType("drink"))}
      {showType("food") &&
        section(
          "Da accompagnare",
          "Pasticceria",
          getProductsByType("food"),
        )}
      {showType("beans") &&
        section(
          "Per portare a casa",
          "Take-home",
          [
            ...getProductsByType("beans"),
            ...getProductsByType("capsule"),
          ],
        )}
    </section>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc -p tsconfig.app.json --noEmit
```
Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```
Expected: 50+ tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/ProductGrid.tsx
git commit -m "feat(ui): ProductGrid groups by type with filter chips

Splits the catalog into three sections (drinks, pastries,
take-home) and adds filter chips at the top: Tutto / Al bar /
Pasticceria / Da asporto. Each section is hidden by the filter
rather than re-querying.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: CartItem displays options

**Files:**
- Modify: `src/components/CartItem.tsx`

- [ ] **Step 1: Replace CartItem**

Replace `src/components/CartItem.tsx` with:

```tsx
import { getProductById } from "../lib/products";
import {
  lineUnitPrice,
  useCartStore,
  type CartItem as CartItemType,
} from "../store/cart";

interface Props {
  item: CartItemType;
}

function optionsLine(item: CartItemType): string | null {
  if (!item.options) return null;
  const bits: string[] = [];
  if (item.options.size) {
    const size = item.options.size;
    bits.push(size === "L" ? "Grande" : size === "S" ? "Piccolo" : "Medio");
  }
  if (item.options.milk) {
    const m = getProductById(item.options.milk);
    if (m) bits.push(m.name);
  }
  if (item.options.sweetness) {
    bits.push(
      item.options.sweetness === "none"
        ? "Senza zucchero"
        : item.options.sweetness === "low"
          ? "Poco zucchero"
          : "Normale",
    );
  }
  return bits.length ? bits.join(" · ") : null;
}

export function CartItem({ item }: Props) {
  const product = getProductById(item.productId);
  const remove = useCartStore((s) => s.removeItem);
  if (!product) return null;
  const unit = lineUnitPrice(item);
  const optsLine = optionsLine(item);
  return (
    <li className="flex justify-between items-start py-2.5 border-b border-lavazza-line last:border-b-0">
      <div className="min-w-0 flex-1 pr-2">
        <p className="font-medium text-sm text-lavazza-deep truncate">
          {product.name}
        </p>
        {optsLine && (
          <p className="text-[11px] text-coffee-mid">{optsLine}</p>
        )}
        <p className="text-xs text-coffee-mid">
          €{unit.toFixed(2)} × {item.quantity}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-bold text-lavazza-deep">
          €{(unit * item.quantity).toFixed(2)}
        </span>
        <button
          onClick={() => remove(item.productId)}
          className="text-coffee-mid hover:text-coffee-accent text-sm transition"
          aria-label={`Rimuovi ${product.name}`}
        >
          ✕
        </button>
      </div>
    </li>
  );
}
```

- [ ] **Step 2: Run typecheck and tests**

```bash
npx tsc -p tsconfig.app.json --noEmit && npx vitest run
```
Expected: no errors, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/CartItem.tsx
git commit -m "feat(ui): CartItem shows options sub-line and modified price

Lines with options display 'Grande · Avena · Senza zucchero' under
the product name. Unit price uses lineUnitPrice() so size and milk
modifiers are reflected in the cart UI, not just in the tool
responses.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: TryWithAgent component + App integration

**Files:**
- Create: `src/components/TryWithAgent.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create TryWithAgent**

Create `src/components/TryWithAgent.tsx`:

```tsx
import { useState } from "react";

interface Prompt {
  id: string;
  capability: string;
  prompt: string;
}

const PROMPTS: Prompt[] = [
  {
    id: "S1",
    capability: "Filtri compositi da linguaggio naturale",
    prompt:
      "Qualcosa di leggero e fruttato, senza latte, sotto i 4 euro.",
  },
  {
    id: "S2",
    capability: "Pairing cross-categoria",
    prompt:
      "Sto prendendo un cappuccino, abbinaci qualcosa di dolce ma non pesante.",
  },
  {
    id: "S3",
    capability: "Sostituzione live su disponibilità",
    prompt: "Vorrei un cappuccino con latte di soia.",
  },
  {
    id: "S4",
    capability: "Ordine multi-item con vincoli",
    prompt:
      "Componi un ordine colazione per 3 persone, max 15 euro, uno deve essere decaffeinato.",
  },
  {
    id: "S5",
    capability: "Dal bar al take-home",
    prompt:
      "Mi è piaciuto il Filtro Etiopia, voglio portarmene a casa 250g.",
  },
  {
    id: "S6",
    capability: "Customizzazione drink",
    prompt: "Cappuccino grande con latte d'avena, senza zucchero.",
  },
  {
    id: "S8",
    capability: "Awareness del carrello",
    prompt: "Cosa va bene con quello che ho già nel carrello?",
  },
];

export function TryWithAgent() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (p: Prompt) => {
    try {
      await navigator.clipboard.writeText(p.prompt);
      setCopied(p.id);
      window.setTimeout(() => setCopied((c) => (c === p.id ? null : c)), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <section className="px-6 pt-10 pb-6">
      <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-coffee-mid mb-2">
        Prova con l'agente
      </p>
      <h2 className="font-display text-3xl font-bold text-lavazza-deep mb-4">
        7 scenari per i WebMCP
      </h2>
      <p className="text-sm text-coffee-mid mb-6 max-w-2xl">
        Ogni card mostra un prompt che dimostra una capacità diversa dei
        WebMCP. Clicca per copiarlo e incollalo nel tuo agente.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {PROMPTS.map((p) => (
          <button
            key={p.id}
            onClick={() => copy(p)}
            className="text-left bg-white border border-lavazza-line rounded-md p-4 hover:border-coffee-dark hover:shadow-lavazza transition relative"
          >
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-[10px] font-mono font-bold text-coffee-accent">
                {p.id}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-coffee-mid">
                {p.capability}
              </span>
            </div>
            <p className="text-sm text-lavazza-deep leading-snug">
              "{p.prompt}"
            </p>
            <span
              className={`absolute top-2 right-3 text-[10px] uppercase tracking-wider transition-opacity ${
                copied === p.id ? "opacity-100 text-coffee-accent" : "opacity-0"
              }`}
            >
              copiato
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Integrate in App.tsx**

In `src/App.tsx`:

Add the import alongside the others:

```tsx
import { TryWithAgent } from "./components/TryWithAgent";
```

In the JSX, insert `<TryWithAgent />` directly before `<main>`:

```tsx
      <Hero />
      <DemoBanner />
      <TryWithAgent />
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 p-4">
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc -p tsconfig.app.json --noEmit
```
Expected: no errors.

- [ ] **Step 4: Run tests**

```bash
npx vitest run
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/TryWithAgent.tsx src/App.tsx
git commit -m "feat(ui): add TryWithAgent panel with 7 wow prompts

New section above the catalog presenting the 7 killer prompts
(S1-S6, S8) with the capability each demonstrates. Clicking copies
the prompt to clipboard with a short confirmation flash.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 12: Final verification

- [ ] **Step 1: Typecheck and build**

```bash
npx tsc -p tsconfig.app.json --noEmit
```
Expected: zero TS errors.

```bash
npm run build
```
Expected: build succeeds.

- [ ] **Step 2: Full test suite**

```bash
npx vitest run
```
Expected: all tests pass, count ≥ 50.

- [ ] **Step 3: Manual smoke test in browser**

Start the dev server:

```bash
npm run dev
```

Open the URL printed (typically http://localhost:5173). Check:

1. `TryWithAgent` panel appears above the catalog with 7 cards.
2. Clicking a card flashes "copiato" and the prompt is in clipboard.
3. Catalog shows three sections (drinks / pastries / take-home).
4. `Latte di soia` does **not** appear in the catalog (it's a milk_option, excluded from grid). It can appear only via the agent.
5. Filter chips ("Tutto / Al bar / Pasticceria / Da asporto") filter sections correctly.
6. Add a cappuccino from the UI → cart shows "Cappuccino" with no sub-line (no options).
7. Each drink card shows its real intensity (different across espresso 9, decaf 3, filtro 5, etc.).
8. `Decaffeinato` shows a "promo" tag pill. `Espresso Classico` shows "best-seller". `Caffè Shakerato` shows "limited".

Stop the dev server.

- [ ] **Step 4: Final commit (if any UI tweaks were needed during smoke test)**

If smoke test required no further changes, skip. Otherwise commit fixes with descriptive message.

- [ ] **Step 5: Summary message to user**

Report:
- Catalog now has 27 entries (22 in-grid + 5 milk options accessible only via agent).
- Tool surface: 7 tools total (6 existing + 1 new `get_product`); 2 existing extended (`search_products`, `add_to_cart`).
- 7 wow scenarios supported via composition.
- All tests pass.
- Branch: `worktree-demo-catalog-expansion` ready to merge or open PR.

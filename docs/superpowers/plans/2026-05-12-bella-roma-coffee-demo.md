# Bella Roma Coffee Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page React app ("Bella Roma Coffee") that exposes 6 cart/checkout tools via `navigator.modelContext` for a 60-second WebMCP manager demo.

**Architecture:** Vite + React + TS + Tailwind + Zustand single-page app. Zustand is the single source of truth for cart, coupon, and tool activity log. A thin `lib/webmcp.ts` adapter registers 6 tools that mutate the store; React components read from the store. The MCP-B polyfill is loaded conditionally if `navigator.modelContext` is not present, so the demo works on Chrome stable (via the MCP-B browser extension) and on Chrome Canary 146 (native).

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS, Zustand, Framer Motion, `@mcp-b/global` (polyfill), Vitest for unit tests on the store and tool adapter.

**Spec:** [`docs/superpowers/specs/2026-05-12-bella-roma-coffee-demo-design.md`](../specs/2026-05-12-bella-roma-coffee-demo-design.md)

---

## Task 1: Scaffold Vite + React + TS

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`

- [ ] **Step 1: Run Vite scaffold**

Run from `/Users/emanuele/Projects/webMCP`:

```bash
npm create vite@latest . -- --template react-ts
```

When prompted "Current directory is not empty. Please choose how to proceed:" select **"Ignore files and continue"** (this keeps `RESEARCH.md`, `docs/`, and `.git/`).

- [ ] **Step 2: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` populated, no errors.

- [ ] **Step 3: Verify dev server starts**

```bash
npm run dev
```

Expected: server starts at `http://localhost:5173`, default Vite + React page loads. Kill with Ctrl-C.

- [ ] **Step 4: Update `.gitignore`**

Append to `.gitignore` (after the Vite-generated entries) if not already present:

```
.DS_Store
.vscode/
.idea/
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS"
```

---

## Task 2: Install Tailwind, Zustand, Framer Motion, polyfill, Vitest

**Files:**
- Create: `tailwind.config.js`, `postcss.config.js`, `src/styles.css`, `vitest.config.ts`
- Modify: `src/main.tsx`, `package.json`

- [ ] **Step 1: Install runtime deps**

```bash
npm install zustand framer-motion @mcp-b/global
```

- [ ] **Step 2: Install dev deps (Tailwind + Vitest)**

```bash
npm install -D tailwindcss@3 postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom
```

(Pin Tailwind to v3 — v4 has a different config approach and we want the well-known PostCSS pipeline.)

- [ ] **Step 3: Initialize Tailwind config**

```bash
npx tailwindcss init -p
```

Expected: creates `tailwind.config.js` and `postcss.config.js`.

- [ ] **Step 4: Configure Tailwind content paths**

Replace `tailwind.config.js` with:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "coffee-dark": "#3b2417",
        "coffee-mid": "#6f4e37",
        "coffee-cream": "#f5e6d3",
        "coffee-accent": "#c89860",
      },
      fontFamily: {
        display: ["Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 5: Replace default styles**

Replace `src/index.css` (rename to `styles.css` if you want; for simplicity keep `index.css` and overwrite). Open `src/index.css` and replace its entire contents with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  background-color: #faf6f1;
  color: #3b2417;
}
```

Delete `src/App.css` if it exists.

- [ ] **Step 6: Update `src/main.tsx`**

Replace `src/main.tsx` contents with:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 7: Replace `src/App.tsx` with a smoke placeholder**

Replace `src/App.tsx` with:

```tsx
export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <h1 className="text-4xl font-display text-coffee-dark">
        Bella Roma Coffee
      </h1>
    </div>
  );
}
```

- [ ] **Step 8: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
```

- [ ] **Step 9: Create `src/test-setup.ts`**

```typescript
import "@testing-library/jest-dom";
```

- [ ] **Step 10: Add test script**

Edit `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 11: Verify dev server still works**

```bash
npm run dev
```

Expected: page shows "Bella Roma Coffee" centered, brown serif, on cream background. Kill with Ctrl-C.

- [ ] **Step 12: Verify Vitest runs (no tests yet)**

```bash
npm test
```

Expected: "No test files found" or similar — that's OK at this stage.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "chore: install Tailwind, Zustand, Framer Motion, MCP-B polyfill, Vitest"
```

---

## Task 3: Product catalog and coupon definitions

**Files:**
- Create: `src/lib/products.ts`, `src/lib/__tests__/products.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/products.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { PRODUCTS, getProductById, COUPONS, getCouponDiscount } from "../products";

describe("PRODUCTS", () => {
  it("contains at least 6 products", () => {
    expect(PRODUCTS.length).toBeGreaterThanOrEqual(6);
  });

  it("each product has required fields", () => {
    for (const p of PRODUCTS) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(["espresso", "filtro", "decaf", "latte"]).toContain(p.category);
      expect(p.price).toBeGreaterThan(0);
      expect(p.description).toBeTruthy();
      expect(p.emoji).toBeTruthy();
    }
  });

  it("product ids are unique", () => {
    const ids = PRODUCTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/products.ts`**

```typescript
export type ProductCategory = "espresso" | "filtro" | "decaf" | "latte";

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  description: string;
  emoji: string;
}

export const PRODUCTS: Product[] = [
  {
    id: "espresso",
    name: "Espresso Classico",
    category: "espresso",
    price: 1.5,
    description: "Tostatura scura, crema densa, rotondo al palato.",
    emoji: "☕",
  },
  {
    id: "cappuccino",
    name: "Cappuccino",
    category: "latte",
    price: 2.5,
    description: "Latte montato a velluto, equilibrio italiano classico.",
    emoji: "☕",
  },
  {
    id: "macchiato",
    name: "Macchiato",
    category: "latte",
    price: 2.0,
    description: "Espresso macchiato con un tocco di schiuma di latte.",
    emoji: "☕",
  },
  {
    id: "filtro-etiopia",
    name: "Caffè Filtro Etiopia",
    category: "filtro",
    price: 4.0,
    description: "Note floreali e di bergamotto, lavorato a umido.",
    emoji: "🫖",
  },
  {
    id: "filtro-colombia",
    name: "Caffè Filtro Colombia",
    category: "filtro",
    price: 3.8,
    description: "Caramello, cioccolato al latte, dolce nel finale.",
    emoji: "🫖",
  },
  {
    id: "decaffeinato",
    name: "Decaffeinato",
    category: "decaf",
    price: 1.8,
    description: "Decaffeinato ad acqua, corpo pieno senza caffeina.",
    emoji: "☕",
  },
  {
    id: "americano",
    name: "Caffè Americano",
    category: "filtro",
    price: 2.2,
    description: "Espresso lungo allungato con acqua calda.",
    emoji: "☕",
  },
  {
    id: "latte-macchiato",
    name: "Latte Macchiato",
    category: "latte",
    price: 3.0,
    description: "Latte caldo macchiato con un espresso, servito a strati.",
    emoji: "🥛",
  },
];

export function getProductById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export interface Coupon {
  code: string;
  description: string;
  apply: (subtotal: number) => number;
}

export const COUPONS: Record<string, Coupon> = {
  BENVENUTO: {
    code: "BENVENUTO",
    description: "10% di sconto sul totale",
    apply: (subtotal) => Math.round(subtotal * 0.1 * 100) / 100,
  },
  STUDENTI: {
    code: "STUDENTI",
    description: "20% di sconto (max €5)",
    apply: (subtotal) =>
      Math.min(5, Math.round(subtotal * 0.2 * 100) / 100),
  },
};

export function getCouponDiscount(
  code: string,
  subtotal: number
): number | null {
  const coupon = COUPONS[code.toUpperCase()];
  if (!coupon) return null;
  return coupon.apply(subtotal);
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add product catalog and coupon definitions"
```

---

## Task 4: Zustand store for cart, coupon, tool activity

**Files:**
- Create: `src/store/cart.ts`, `src/store/__tests__/cart.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/store/__tests__/cart.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore } from "../cart";

describe("cart store", () => {
  beforeEach(() => {
    useCartStore.getState().reset();
  });

  it("starts empty", () => {
    const s = useCartStore.getState();
    expect(s.items).toEqual([]);
    expect(s.coupon).toBeNull();
    expect(s.subtotal()).toBe(0);
    expect(s.total()).toBe(0);
  });

  it("addItem adds a new line", () => {
    useCartStore.getState().addItem("espresso", 2);
    const s = useCartStore.getState();
    expect(s.items).toHaveLength(1);
    expect(s.items[0]).toEqual({ productId: "espresso", quantity: 2 });
  });

  it("addItem merges quantity if product already in cart", () => {
    useCartStore.getState().addItem("espresso", 2);
    useCartStore.getState().addItem("espresso", 1);
    expect(useCartStore.getState().items).toEqual([
      { productId: "espresso", quantity: 3 },
    ]);
  });

  it("addItem returns false for unknown product", () => {
    const ok = useCartStore.getState().addItem("ghost", 1);
    expect(ok).toBe(false);
  });

  it("removeItem deletes the line", () => {
    useCartStore.getState().addItem("espresso", 2);
    useCartStore.getState().removeItem("espresso");
    expect(useCartStore.getState().items).toEqual([]);
  });

  it("applyCoupon stores coupon code in uppercase", () => {
    useCartStore.getState().addItem("espresso", 2);
    const ok = useCartStore.getState().applyCoupon("benvenuto");
    expect(ok).toBe(true);
    expect(useCartStore.getState().coupon).toBe("BENVENUTO");
  });

  it("applyCoupon returns false for invalid", () => {
    const ok = useCartStore.getState().applyCoupon("NOPE");
    expect(ok).toBe(false);
    expect(useCartStore.getState().coupon).toBeNull();
  });

  it("subtotal sums items", () => {
    useCartStore.getState().addItem("espresso", 2); // 3.00
    useCartStore.getState().addItem("cappuccino", 1); // 2.50
    expect(useCartStore.getState().subtotal()).toBe(5.5);
  });

  it("total subtracts coupon discount", () => {
    useCartStore.getState().addItem("espresso", 2); // 3.00
    useCartStore.getState().applyCoupon("BENVENUTO"); // -0.30
    expect(useCartStore.getState().total()).toBeCloseTo(2.7, 2);
  });

  it("checkout returns success and clears cart", () => {
    useCartStore.getState().addItem("espresso", 2);
    const res = useCartStore.getState().checkout();
    expect(res.ok).toBe(true);
    expect(res.total).toBe(3.0);
    expect(useCartStore.getState().items).toEqual([]);
  });

  it("checkout fails on empty cart", () => {
    const res = useCartStore.getState().checkout();
    expect(res.ok).toBe(false);
  });

  it("logToolCall appends to activity log", () => {
    useCartStore.getState().logToolCall("add_to_cart", { product_id: "espresso", quantity: 2 }, "ok");
    expect(useCartStore.getState().activity).toHaveLength(1);
    expect(useCartStore.getState().activity[0].tool).toBe("add_to_cart");
  });

  it("reset clears everything", () => {
    useCartStore.getState().addItem("espresso", 1);
    useCartStore.getState().applyCoupon("BENVENUTO");
    useCartStore.getState().logToolCall("x", {}, "y");
    useCartStore.getState().reset();
    const s = useCartStore.getState();
    expect(s.items).toEqual([]);
    expect(s.coupon).toBeNull();
    expect(s.activity).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/store/cart.ts`**

```typescript
import { create } from "zustand";
import { getProductById, getCouponDiscount } from "../lib/products";

export interface CartItem {
  productId: string;
  quantity: number;
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
  // actions
  addItem: (productId: string, quantity: number) => boolean;
  removeItem: (productId: string) => boolean;
  applyCoupon: (code: string) => boolean;
  clearCoupon: () => void;
  checkout: () => { ok: boolean; total: number; reason?: string };
  reset: () => void;
  logToolCall: (tool: string, args: unknown, result: string) => void;
  // selectors
  subtotal: () => number;
  discount: () => number;
  total: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  coupon: null,
  activity: [],

  addItem: (productId, quantity) => {
    if (!getProductById(productId)) return false;
    if (quantity < 1) return false;
    set((state) => {
      const existing = state.items.find((i) => i.productId === productId);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === productId
              ? { ...i, quantity: i.quantity + quantity }
              : i
          ),
        };
      }
      return { items: [...state.items, { productId, quantity }] };
    });
    return true;
  },

  removeItem: (productId) => {
    const existed = get().items.some((i) => i.productId === productId);
    set((state) => ({
      items: state.items.filter((i) => i.productId !== productId),
    }));
    return existed;
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
    return get().items.reduce((acc, item) => {
      const product = getProductById(item.productId);
      return acc + (product ? product.price * item.quantity : 0);
    }, 0);
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

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all cart store tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add cart Zustand store with TDD tests"
```

---

## Task 5: WebMCP polyfill loader

**Files:**
- Create: `src/lib/polyfill.ts`

- [ ] **Step 1: Implement `src/lib/polyfill.ts`**

```typescript
export type WebMCPMode = "native" | "polyfill" | "unavailable";

export async function ensureWebMCP(): Promise<WebMCPMode> {
  if (typeof window === "undefined") return "unavailable";
  if ("modelContext" in window.navigator) {
    return "native";
  }
  try {
    await import("@mcp-b/global");
    if ("modelContext" in window.navigator) {
      return "polyfill";
    }
    return "unavailable";
  } catch (err) {
    console.warn("[webmcp] polyfill load failed:", err);
    return "unavailable";
  }
}
```

- [ ] **Step 2: Add ambient type declaration**

Append to `src/vite-env.d.ts`:

```typescript
declare global {
  interface ModelContextTool {
    name: string;
    description: string;
    inputSchema: object;
    execute: (
      args: Record<string, unknown>,
      agent: {
        requestUserInteraction: <T>(fn: () => Promise<T> | T) => Promise<T>;
      }
    ) => Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }>;
  }

  interface ModelContext {
    provideContext: (config: { tools: ModelContextTool[] }) => void;
    registerTool?: (tool: ModelContextTool) => void;
    unregisterTool?: (name: string) => void;
  }

  interface Navigator {
    modelContext?: ModelContext;
  }
}

export {};
```

- [ ] **Step 3: Verify type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add WebMCP polyfill loader and ambient types"
```

---

## Task 6: WebMCP tool adapter (6 tools)

**Files:**
- Create: `src/lib/webmcp.ts`, `src/lib/__tests__/webmcp.test.ts`

- [ ] **Step 1: Write failing tests for the adapter**

Create `src/lib/__tests__/webmcp.test.ts`:

```typescript
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

  it("exposes exactly 6 tools", () => {
    expect(buildTools()).toHaveLength(6);
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
      { productId: "espresso", quantity: 2 },
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `buildTools` not found.

- [ ] **Step 3: Implement `src/lib/webmcp.ts`**

```typescript
import { PRODUCTS, getProductById, COUPONS } from "./products";
import { useCartStore } from "../store/cart";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

type Agent = {
  requestUserInteraction: <T>(fn: () => Promise<T> | T) => Promise<T>;
};

type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  execute: (args: Record<string, unknown>, agent: Agent) => Promise<ToolResult>;
};

function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}
function err(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

function formatProduct(id: string, qty: number): string {
  const p = getProductById(id);
  if (!p) return `${id} x${qty}`;
  return `${p.name} x${qty} (€${(p.price * qty).toFixed(2)})`;
}

export function buildTools(): Tool[] {
  return [
    {
      name: "search_products",
      description:
        "Cerca prodotti nel catalogo del coffee shop. Permette di filtrare per categoria, prezzo massimo o testo libero.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Testo libero da cercare nel nome o descrizione" },
          category: {
            type: "string",
            enum: ["espresso", "filtro", "decaf", "latte"],
            description: "Categoria del prodotto",
          },
          max_price: { type: "number", description: "Prezzo massimo in euro" },
        },
      },
      async execute(args) {
        const { query, category, max_price } = args as {
          query?: string;
          category?: string;
          max_price?: number;
        };
        const q = (query ?? "").toLowerCase().trim();
        const results = PRODUCTS.filter((p) => {
          if (category && p.category !== category) return false;
          if (typeof max_price === "number" && p.price > max_price) return false;
          if (q && !`${p.name} ${p.description}`.toLowerCase().includes(q)) return false;
          return true;
        });
        const result = results.length
          ? results
              .map(
                (p) =>
                  `- ${p.name} (id: ${p.id}, ${p.category}) — €${p.price.toFixed(2)} — ${p.description}`
              )
              .join("\n")
          : "Nessun prodotto trovato.";
        useCartStore.getState().logToolCall("search_products", args, `${results.length} risultati`);
        return ok(result);
      },
    },
    {
      name: "add_to_cart",
      description: "Aggiunge un prodotto al carrello in una certa quantità.",
      inputSchema: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "L'id del prodotto" },
          quantity: { type: "integer", minimum: 1, maximum: 10 },
        },
        required: ["product_id", "quantity"],
      },
      async execute(args) {
        const { product_id, quantity } = args as {
          product_id: string;
          quantity: number;
        };
        const okAdd = useCartStore.getState().addItem(product_id, quantity);
        if (!okAdd) {
          useCartStore
            .getState()
            .logToolCall("add_to_cart", args, "errore: prodotto non trovato");
          return err(`Prodotto "${product_id}" non trovato.`);
        }
        const msg = `Aggiunto: ${formatProduct(product_id, quantity)}.`;
        useCartStore.getState().logToolCall("add_to_cart", args, msg);
        return ok(msg);
      },
    },
    {
      name: "remove_from_cart",
      description: "Rimuove un prodotto dal carrello.",
      inputSchema: {
        type: "object",
        properties: {
          product_id: { type: "string" },
        },
        required: ["product_id"],
      },
      async execute(args) {
        const { product_id } = args as { product_id: string };
        const removed = useCartStore.getState().removeItem(product_id);
        if (!removed) {
          useCartStore
            .getState()
            .logToolCall("remove_from_cart", args, "non era nel carrello");
          return err(`"${product_id}" non era nel carrello.`);
        }
        const msg = `Rimosso "${product_id}" dal carrello.`;
        useCartStore.getState().logToolCall("remove_from_cart", args, msg);
        return ok(msg);
      },
    },
    {
      name: "apply_coupon",
      description:
        "Applica un codice sconto al carrello. Codici disponibili: BENVENUTO (10%), STUDENTI (20% max €5).",
      inputSchema: {
        type: "object",
        properties: {
          code: { type: "string" },
        },
        required: ["code"],
      },
      async execute(args) {
        const { code } = args as { code: string };
        const okC = useCartStore.getState().applyCoupon(code);
        if (!okC) {
          useCartStore.getState().logToolCall("apply_coupon", args, "non valido");
          const available = Object.keys(COUPONS).join(", ");
          return err(`Coupon "${code}" non valido. Disponibili: ${available}.`);
        }
        const msg = `Coupon ${code.toUpperCase()} applicato.`;
        useCartStore.getState().logToolCall("apply_coupon", args, msg);
        return ok(msg);
      },
    },
    {
      name: "get_cart",
      description: "Ritorna il contenuto corrente del carrello con totali.",
      inputSchema: { type: "object", properties: {} },
      async execute() {
        const s = useCartStore.getState();
        if (s.items.length === 0) {
          useCartStore.getState().logToolCall("get_cart", {}, "vuoto");
          return ok("Il carrello è vuoto.");
        }
        const lines = s.items.map(
          (it) => `- ${formatProduct(it.productId, it.quantity)}`
        );
        const summary = [
          ...lines,
          `Subtotale: €${s.subtotal().toFixed(2)}`,
          s.coupon
            ? `Sconto (${s.coupon}): -€${s.discount().toFixed(2)}`
            : "Nessun coupon applicato",
          `Totale: €${s.total().toFixed(2)}`,
        ].join("\n");
        useCartStore.getState().logToolCall("get_cart", {}, `${s.items.length} righe`);
        return ok(summary);
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
        const confirmed = await agent.requestUserInteraction(async () => {
          return window.confirm(
            `Vuoi confermare il pagamento di €${total.toFixed(2)}?`
          );
        });
        if (!confirmed) {
          useCartStore.getState().logToolCall("checkout", {}, "annullato dall'utente");
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

export function registerTools(): void {
  if (!navigator.modelContext) {
    console.warn("[webmcp] navigator.modelContext not available, skipping registration");
    return;
  }
  navigator.modelContext.provideContext({ tools: buildTools() });
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all WebMCP adapter tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add WebMCP tool adapter with 6 tools (TDD)"
```

---

## Task 7: Build the UI shell — Header, DemoBanner, ProductGrid, Cart

**Files:**
- Create: `src/components/Header.tsx`, `src/components/DemoBanner.tsx`, `src/components/ProductCard.tsx`, `src/components/ProductGrid.tsx`, `src/components/Cart.tsx`, `src/components/CartItem.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/components/Header.tsx`**

```tsx
import { useCartStore } from "../store/cart";

type ConnectionState = "native" | "polyfill" | "unavailable";

interface Props {
  connection: ConnectionState;
}

const CONNECTION_LABEL: Record<ConnectionState, { dot: string; text: string }> = {
  native: { dot: "🟢", text: "WebMCP nativo attivo" },
  polyfill: { dot: "🟡", text: "Polyfill MCP-B attivo" },
  unavailable: { dot: "⚪", text: "Nessun agente collegato" },
};

export function Header({ connection }: Props) {
  const reset = useCartStore((s) => s.reset);
  const label = CONNECTION_LABEL[connection];
  return (
    <header className="bg-coffee-dark text-coffee-cream px-6 py-4 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-3">
        <span className="text-3xl">☕</span>
        <div>
          <h1 className="font-display text-2xl leading-none">Bella Roma Coffee</h1>
          <p className="text-xs opacity-70">Torrefazione artigianale dal 1962</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm flex items-center gap-2" title={label.text}>
          <span>{label.dot}</span>
          <span className="hidden sm:inline">{label.text}</span>
        </span>
        <button
          onClick={reset}
          className="bg-coffee-accent text-coffee-dark px-3 py-1 rounded font-medium hover:opacity-90 text-sm"
        >
          Reset demo
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Create `src/components/DemoBanner.tsx`**

```tsx
const PROMPTS = [
  "Ordina 2 espresso e 1 cappuccino, applica BENVENUTO e fai checkout",
  "Mostrami solo i caffè sotto i 2 euro",
  "Svuota il carrello e ricomincia",
];

export function DemoBanner() {
  return (
    <div className="bg-coffee-cream border-b border-coffee-accent px-6 py-3">
      <p className="text-sm text-coffee-dark font-medium mb-1">
        ✨ Prova questi prompt con il tuo assistente AI collegato:
      </p>
      <ul className="space-y-1">
        {PROMPTS.map((p) => (
          <li
            key={p}
            className="text-sm text-coffee-mid font-mono bg-white/60 px-2 py-1 rounded inline-block mr-2"
          >
            "{p}"
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/ProductCard.tsx`**

```tsx
import type { Product } from "../lib/products";
import { useCartStore } from "../store/cart";

interface Props {
  product: Product;
}

export function ProductCard({ product }: Props) {
  const addItem = useCartStore((s) => s.addItem);
  return (
    <div
      data-product-id={product.id}
      className="bg-white rounded-lg shadow-sm border border-coffee-cream p-4 flex flex-col"
    >
      <div className="text-5xl text-center mb-2">{product.emoji}</div>
      <h3 className="font-display text-lg text-coffee-dark">{product.name}</h3>
      <p className="text-xs text-coffee-mid mb-2 flex-grow">{product.description}</p>
      <div className="flex items-center justify-between mt-auto">
        <span className="font-bold text-coffee-dark">€{product.price.toFixed(2)}</span>
        <button
          onClick={() => addItem(product.id, 1)}
          className="bg-coffee-dark text-coffee-cream px-3 py-1 rounded text-sm hover:bg-coffee-mid"
        >
          Aggiungi
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/ProductGrid.tsx`**

```tsx
import { PRODUCTS } from "../lib/products";
import { ProductCard } from "./ProductCard";

export function ProductGrid() {
  return (
    <section className="p-6">
      <h2 className="font-display text-2xl text-coffee-dark mb-4">Il nostro catalogo</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {PRODUCTS.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Create `src/components/CartItem.tsx`**

```tsx
import { getProductById } from "../lib/products";
import { useCartStore, type CartItem as CartItemType } from "../store/cart";

interface Props {
  item: CartItemType;
}

export function CartItem({ item }: Props) {
  const product = getProductById(item.productId);
  const remove = useCartStore((s) => s.removeItem);
  if (!product) return null;
  return (
    <li className="flex justify-between items-center py-2 border-b border-coffee-cream last:border-b-0">
      <div>
        <p className="font-medium text-sm">{product.name}</p>
        <p className="text-xs text-coffee-mid">
          €{product.price.toFixed(2)} × {item.quantity}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold">
          €{(product.price * item.quantity).toFixed(2)}
        </span>
        <button
          onClick={() => remove(item.productId)}
          className="text-coffee-mid hover:text-red-700 text-xs"
          aria-label={`Rimuovi ${product.name}`}
        >
          ✕
        </button>
      </div>
    </li>
  );
}
```

- [ ] **Step 6: Create `src/components/Cart.tsx`**

```tsx
import { useCartStore } from "../store/cart";
import { CartItem } from "./CartItem";

export function Cart() {
  const items = useCartStore((s) => s.items);
  const coupon = useCartStore((s) => s.coupon);
  const subtotal = useCartStore((s) => s.subtotal());
  const discount = useCartStore((s) => s.discount());
  const total = useCartStore((s) => s.total());
  const clearCoupon = useCartStore((s) => s.clearCoupon);

  return (
    <aside className="bg-white rounded-lg shadow-sm border border-coffee-cream p-4 sticky top-4">
      <h2 className="font-display text-xl text-coffee-dark mb-2">Carrello</h2>
      {items.length === 0 ? (
        <p className="text-sm text-coffee-mid italic">Il carrello è vuoto.</p>
      ) : (
        <>
          <ul className="mb-3">
            {items.map((i) => (
              <CartItem key={i.productId} item={i} />
            ))}
          </ul>
          <div className="text-sm space-y-1 border-t border-coffee-cream pt-2">
            <div className="flex justify-between">
              <span>Subtotale</span>
              <span>€{subtotal.toFixed(2)}</span>
            </div>
            {coupon && (
              <div className="flex justify-between text-green-700">
                <span>
                  Coupon {coupon}{" "}
                  <button
                    onClick={clearCoupon}
                    className="text-xs underline opacity-70 hover:opacity-100"
                  >
                    rimuovi
                  </button>
                </span>
                <span>-€{discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1 border-t border-coffee-cream">
              <span>Totale</span>
              <span>€{total.toFixed(2)}</span>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
```

- [ ] **Step 7: Wire it together in `src/App.tsx`**

Replace `src/App.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { DemoBanner } from "./components/DemoBanner";
import { ProductGrid } from "./components/ProductGrid";
import { Cart } from "./components/Cart";
import { ensureWebMCP, type WebMCPMode } from "./lib/polyfill";
import { registerTools } from "./lib/webmcp";

export default function App() {
  const [connection, setConnection] = useState<WebMCPMode>("unavailable");

  useEffect(() => {
    ensureWebMCP().then((mode) => {
      setConnection(mode);
      if (mode !== "unavailable") registerTools();
    });
  }, []);

  return (
    <div className="min-h-screen">
      <Header connection={connection} />
      <DemoBanner />
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 p-4">
        <ProductGrid />
        <Cart />
      </main>
    </div>
  );
}
```

- [ ] **Step 8: Verify the UI in the browser**

```bash
npm run dev
```

Open `http://localhost:5173`. Manually verify:
- Header shows "Bella Roma Coffee" + connection dot (likely ⚪ unavailable on Chrome stable without extension).
- Banner shows 3 prompt suggestions.
- Catalog grid shows 8 products.
- Click "Aggiungi" on a few products — cart fills up, totals update.
- Click ✕ on a cart item — removed.
- Click "Reset demo" — cart empties.

Kill dev server.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: build UI shell (header, banner, product grid, cart)"
```

---

## Task 8: Add cart-fly animation with Framer Motion

**Files:**
- Modify: `src/components/ProductCard.tsx`, `src/components/CartItem.tsx`, `src/components/Cart.tsx`

- [ ] **Step 1: Animate cart items entering/leaving**

Replace `src/components/Cart.tsx` `<ul>` block with motion-animated list. Update full file:

```tsx
import { AnimatePresence, motion } from "framer-motion";
import { useCartStore } from "../store/cart";
import { CartItem } from "./CartItem";

export function Cart() {
  const items = useCartStore((s) => s.items);
  const coupon = useCartStore((s) => s.coupon);
  const subtotal = useCartStore((s) => s.subtotal());
  const discount = useCartStore((s) => s.discount());
  const total = useCartStore((s) => s.total());
  const clearCoupon = useCartStore((s) => s.clearCoupon);

  return (
    <aside className="bg-white rounded-lg shadow-sm border border-coffee-cream p-4 sticky top-4">
      <h2 className="font-display text-xl text-coffee-dark mb-2">Carrello</h2>
      {items.length === 0 ? (
        <p className="text-sm text-coffee-mid italic">Il carrello è vuoto.</p>
      ) : (
        <>
          <ul className="mb-3">
            <AnimatePresence initial={false}>
              {items.map((i) => (
                <motion.div
                  key={i.productId}
                  layout
                  initial={{ opacity: 0, x: 40, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 40, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 320, damping: 28 }}
                >
                  <CartItem item={i} />
                </motion.div>
              ))}
            </AnimatePresence>
          </ul>
          <motion.div
            layout
            className="text-sm space-y-1 border-t border-coffee-cream pt-2"
          >
            <div className="flex justify-between">
              <span>Subtotale</span>
              <span>€{subtotal.toFixed(2)}</span>
            </div>
            <AnimatePresence>
              {coupon && (
                <motion.div
                  key="coupon"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex justify-between text-green-700"
                >
                  <span>
                    Coupon {coupon}{" "}
                    <button
                      onClick={clearCoupon}
                      className="text-xs underline opacity-70 hover:opacity-100"
                    >
                      rimuovi
                    </button>
                  </span>
                  <span>-€{discount.toFixed(2)}</span>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex justify-between font-bold text-base pt-1 border-t border-coffee-cream">
              <span>Totale</span>
              <motion.span
                key={total.toFixed(2)}
                initial={{ scale: 1.2, color: "#c89860" }}
                animate={{ scale: 1, color: "#3b2417" }}
                transition={{ duration: 0.3 }}
              >
                €{total.toFixed(2)}
              </motion.span>
            </div>
          </motion.div>
        </>
      )}
    </aside>
  );
}
```

- [ ] **Step 2: Pulse the product card when added**

Replace `src/components/ProductCard.tsx`:

```tsx
import { motion } from "framer-motion";
import { useState } from "react";
import type { Product } from "../lib/products";
import { useCartStore } from "../store/cart";

interface Props {
  product: Product;
}

export function ProductCard({ product }: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const [pulse, setPulse] = useState(0);

  const handleAdd = () => {
    addItem(product.id, 1);
    setPulse((p) => p + 1);
  };

  return (
    <motion.div
      data-product-id={product.id}
      animate={pulse > 0 ? { scale: [1, 1.06, 1], boxShadow: ["0 0 0 rgba(200,152,96,0)", "0 0 24px rgba(200,152,96,0.6)", "0 0 0 rgba(200,152,96,0)"] } : {}}
      transition={{ duration: 0.55 }}
      className="bg-white rounded-lg shadow-sm border border-coffee-cream p-4 flex flex-col"
    >
      <div className="text-5xl text-center mb-2">{product.emoji}</div>
      <h3 className="font-display text-lg text-coffee-dark">{product.name}</h3>
      <p className="text-xs text-coffee-mid mb-2 flex-grow">{product.description}</p>
      <div className="flex items-center justify-between mt-auto">
        <span className="font-bold text-coffee-dark">€{product.price.toFixed(2)}</span>
        <button
          onClick={handleAdd}
          className="bg-coffee-dark text-coffee-cream px-3 py-1 rounded text-sm hover:bg-coffee-mid"
        >
          Aggiungi
        </button>
      </div>
    </motion.div>
  );
}
```

Note: the pulse fires on manual click. When the tool `add_to_cart` runs, the store changes and the cart-list animation fires — that's the visible feedback for agent actions.

- [ ] **Step 3: Pulse the cart container when items arrive from agent**

To make agent-driven adds visually distinct (since the product card pulse only fires on manual click), add a pulse on the cart container when item count changes. Modify `src/components/Cart.tsx` — at the top after imports add:

```tsx
import { useEffect, useRef, useState } from "react";
```

And inside the component, before the `return`:

```tsx
  const [flash, setFlash] = useState(0);
  const lastCount = useRef(items.length);
  useEffect(() => {
    if (items.length > lastCount.current) setFlash((f) => f + 1);
    lastCount.current = items.length;
  }, [items.length]);
```

Then wrap the existing `<aside>` content as a `<motion.aside>`:

```tsx
    <motion.aside
      animate={
        flash > 0
          ? { boxShadow: ["0 0 0 rgba(200,152,96,0)", "0 0 30px rgba(200,152,96,0.6)", "0 0 0 rgba(200,152,96,0)"] }
          : {}
      }
      transition={{ duration: 0.8 }}
      className="bg-white rounded-lg shadow-sm border border-coffee-cream p-4 sticky top-4"
    >
```

(Don't forget the closing `</motion.aside>`.)

- [ ] **Step 4: Verify in browser**

```bash
npm run dev
```

Manually:
- Click "Aggiungi": card pulses, cart row slides in.
- Add a second item: cart row slides in, totals animate.
- Remove an item: row slides out.

Kill dev server.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: animate cart additions and totals with Framer Motion"
```

---

## Task 9: Tool Activity Log panel

**Files:**
- Create: `src/components/ToolActivityLog.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/components/ToolActivityLog.tsx`**

```tsx
import { AnimatePresence, motion } from "framer-motion";
import { useCartStore } from "../store/cart";

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("it-IT", { hour12: false });
}

export function ToolActivityLog() {
  const activity = useCartStore((s) => s.activity);
  const recent = activity.slice(-10).reverse();

  return (
    <div className="fixed bottom-4 right-4 w-80 max-h-96 bg-coffee-dark text-coffee-cream rounded-lg shadow-2xl overflow-hidden flex flex-col border border-coffee-accent z-40">
      <div className="px-3 py-2 bg-black/30 flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-wide">
          Tool Activity ({activity.length})
        </span>
        <span className="text-xs opacity-60">live</span>
      </div>
      <ul className="overflow-y-auto flex-1 px-2 py-1 text-xs font-mono space-y-1">
        {recent.length === 0 && (
          <li className="opacity-60 italic px-1 py-2">
            In attesa di chiamate dall'agente…
          </li>
        )}
        <AnimatePresence initial={false}>
          {recent.map((a) => (
            <motion.li
              key={a.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="bg-black/20 rounded px-2 py-1"
            >
              <div className="flex justify-between">
                <span className="text-coffee-accent">{a.tool}</span>
                <span className="opacity-50">{formatTime(a.timestamp)}</span>
              </div>
              {Object.keys(a.args ?? {}).length > 0 && (
                <div className="opacity-80 truncate">
                  args: {JSON.stringify(a.args)}
                </div>
              )}
              <div className="opacity-70 truncate">→ {a.result}</div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Mount it in `src/App.tsx`**

Add the import and render before the closing `</div>`:

```tsx
import { ToolActivityLog } from "./components/ToolActivityLog";
```

And inside the root `<div>`, after `<main>`:

```tsx
      <ToolActivityLog />
```

- [ ] **Step 3: Verify in browser**

```bash
npm run dev
```

The log panel appears bottom-right. Empty for now (manual clicks don't log). It will fill once the WebMCP tools are invoked. Kill dev server.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Tool Activity Log live panel"
```

---

## Task 10: Custom CheckoutModal replacing window.confirm

**Files:**
- Create: `src/components/CheckoutModal.tsx`, `src/lib/checkout-bridge.ts`
- Modify: `src/lib/webmcp.ts`, `src/App.tsx`

We need a styled modal triggered by the `checkout` tool. Approach: a tiny event-bridge module exposes `requestCheckoutConfirmation(total): Promise<boolean>`. The `checkout` tool calls it inside `agent.requestUserInteraction(...)`. A React component subscribes and resolves the promise on user click.

- [ ] **Step 1: Create `src/lib/checkout-bridge.ts`**

```typescript
type Listener = (total: number, resolve: (ok: boolean) => void) => void;

let listener: Listener | null = null;

export function setCheckoutListener(fn: Listener | null) {
  listener = fn;
}

export function requestCheckoutConfirmation(total: number): Promise<boolean> {
  if (!listener) {
    return Promise.resolve(window.confirm(`Vuoi confermare il pagamento di €${total.toFixed(2)}?`));
  }
  return new Promise<boolean>((resolve) => {
    listener!(total, resolve);
  });
}
```

- [ ] **Step 2: Update `checkout` in `src/lib/webmcp.ts`**

Replace the `window.confirm(...)` call in the `checkout` tool's `execute` with:

```typescript
        const { requestCheckoutConfirmation } = await import("./checkout-bridge");
        const confirmed = await agent.requestUserInteraction(async () => {
          return requestCheckoutConfirmation(total);
        });
```

(The dynamic import keeps the adapter testable in Node without a window stub.)

- [ ] **Step 3: Create `src/components/CheckoutModal.tsx`**

```tsx
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { setCheckoutListener } from "../lib/checkout-bridge";

interface Pending {
  total: number;
  resolve: (ok: boolean) => void;
}

export function CheckoutModal() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    setCheckoutListener((total, resolve) => setPending({ total, resolve }));
    return () => setCheckoutListener(null);
  }, []);

  const handle = (ok: boolean) => {
    if (!pending) return;
    pending.resolve(ok);
    setPending(null);
  };

  return (
    <AnimatePresence>
      {pending && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => handle(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
          >
            <div className="text-center mb-4">
              <div className="text-5xl mb-2">💳</div>
              <h2 className="font-display text-2xl text-coffee-dark">
                Conferma pagamento
              </h2>
              <p className="text-sm text-coffee-mid mt-2">
                L'agente AI vuole completare l'ordine. Vuoi procedere?
              </p>
            </div>
            <div className="bg-coffee-cream rounded-lg p-4 text-center mb-4">
              <p className="text-xs text-coffee-mid">Totale da pagare</p>
              <p className="font-display text-3xl text-coffee-dark">
                €{pending.total.toFixed(2)}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handle(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-coffee-mid text-coffee-mid hover:bg-coffee-cream"
              >
                Annulla
              </button>
              <button
                onClick={() => handle(true)}
                className="flex-1 px-4 py-2 rounded-lg bg-coffee-dark text-coffee-cream font-medium hover:bg-coffee-mid"
                autoFocus
              >
                Conferma €{pending.total.toFixed(2)}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 4: Mount the modal in `src/App.tsx`**

Add import:

```tsx
import { CheckoutModal } from "./components/CheckoutModal";
```

Render it inside the root `<div>` (after `<ToolActivityLog />`):

```tsx
      <CheckoutModal />
```

- [ ] **Step 5: Add a manual "Checkout" button for fallback testing**

We need a way to trigger the checkout flow without an agent for smoke testing. Modify `src/components/Cart.tsx` — add this button inside the totals block, after the "Totale" row:

```tsx
            {items.length > 0 && (
              <button
                onClick={async () => {
                  const { requestCheckoutConfirmation } = await import("../lib/checkout-bridge");
                  const total = useCartStore.getState().total();
                  const ok = await requestCheckoutConfirmation(total);
                  if (ok) {
                    useCartStore.getState().checkout();
                  }
                }}
                className="w-full mt-3 bg-coffee-dark text-coffee-cream py-2 rounded font-medium hover:bg-coffee-mid"
              >
                Checkout
              </button>
            )}
```

Place it right after the closing `</motion.div>` of the totals block (still inside the `<> ... </>` fragment, before the closing `</motion.aside>`).

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: WebMCP adapter tests still PASS (the dynamic import resolves in jsdom; if you get a "window.confirm" error, jsdom provides it).

- [ ] **Step 7: Verify modal in the browser**

```bash
npm run dev
```

Add items manually → click Checkout → modal appears → click Conferma → cart clears. Click Annulla on a second attempt → cart stays. Kill dev server.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: replace window.confirm with styled CheckoutModal driven by event bridge"
```

---

## Task 11: README with setup and demo instructions

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Bella Roma Coffee — Demo WebMCP

Single-page React app that exposes a coffee shop's cart & checkout as 6 WebMCP tools (`navigator.modelContext`). Built for a manager demo of WebMCP capabilities.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Demo: collegare un agente AI

Hai due opzioni per far parlare un agente con la pagina.

### Opzione A — Chrome Canary 146+ (WebMCP nativo)

1. Installa Chrome Canary 146 o superiore.
2. Vai a `chrome://flags/#enable-experimental-web-platform-features` e abilita.
3. Iscriviti all'**EPP (Early Preview Program)** WebMCP se richiesto.
4. Apri la demo, controlla che l'header mostri 🟢 *WebMCP nativo attivo*.
5. Usa l'assistente AI integrato di Chrome (o un'estensione compatibile).

### Opzione B — Chrome stabile + estensione MCP-B + Claude Desktop (consigliato per demo)

Più affidabile, perché Canary può cambiare comportamento.

1. Installa l'estensione MCP-B da [docs.mcp-b.ai](https://docs.mcp-b.ai/).
2. Installa Claude Desktop e configura il connettore MCP-B (l'estensione espone i tool della tab attiva).
3. Apri la demo: l'header mostrerà 🟡 *Polyfill MCP-B attivo*.
4. In Claude Desktop scrivi i prompt suggeriti nel banner:
   - *"Ordina 2 espresso e 1 cappuccino, applica BENVENUTO e fai checkout"*
   - *"Mostrami solo i caffè sotto i 2 euro"*
   - *"Svuota il carrello e ricomincia"*

## Tool esposti

| Tool | Cosa fa | Conferma utente |
|---|---|---|
| `search_products` | Filtra catalogo per categoria/prezzo/testo | no |
| `add_to_cart` | Aggiunge prodotto al carrello | no |
| `remove_from_cart` | Rimuove riga | no |
| `apply_coupon` | Applica `BENVENUTO` (-10%) o `STUDENTI` (-20% max €5) | no |
| `get_cart` | Ritorna stato carrello | no |
| `checkout` | Conferma ordine | **sì** (modale) |

## Test

```bash
npm test
```

Vitest sui moduli `store/cart`, `lib/products`, `lib/webmcp`.

## Architettura

- **Zustand** è la single source of truth (carrello, coupon, log).
- **`src/lib/webmcp.ts`** è l'adapter tra l'API WebMCP e lo store.
- **`src/lib/polyfill.ts`** carica `@mcp-b/global` se `navigator.modelContext` non è disponibile.
- I componenti React leggono dallo store: la UI manuale e quella agentica passano dagli stessi update.

Vedi il design completo in `docs/superpowers/specs/2026-05-12-bella-roma-coffee-demo-design.md`.
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "docs: add README with setup and demo instructions"
```

---

## Task 12: End-to-end dry-run and final polish

**Files:**
- Verify only; small fixes if needed.

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Production build**

```bash
npm run build
```

Expected: succeeds, output in `dist/`.

- [ ] **Step 4: Preview build**

```bash
npm run preview
```

Open the printed URL. Smoke-test the full manual flow (add → coupon → checkout). Kill the server.

- [ ] **Step 5: End-to-end dry-run with a real agent**

Pick **option A** (Chrome Canary) or **option B** (Chrome stable + MCP-B extension + Claude Desktop) from the README. Run the three demo prompts in order. Confirm:

- Connection indicator turns 🟢 or 🟡.
- Tool Activity Log fills with each invocation, timestamps update.
- Product cards / cart container pulse and animate.
- Checkout modal appears with formatted total; "Annulla" leaves cart intact; "Conferma" clears it.

Fix any rough edges encountered (e.g., schema mismatches if the agent picks unexpected arg shapes — adjust `inputSchema` descriptions to disambiguate).

- [ ] **Step 6: Final commit**

If anything changed in step 5:

```bash
git add -A
git commit -m "polish: end-to-end dry-run adjustments"
```

If nothing changed, skip.

---

## Self-Review

**Spec coverage check (against `docs/superpowers/specs/2026-05-12-bella-roma-coffee-demo-design.md`):**

- §1 Obiettivo: 60-second flow → Task 7+8+9+10+12 ✓
- §2 Flusso demo: banner, 3 prompts, modal, reset → Task 7 (banner+reset), Task 10 (modal) ✓
- §3 Tool surface (6 tools, coupon BENVENUTO/STUDENTI): Task 3 (coupons) + Task 6 (tools) ✓
- §4 Stack: Vite/React/TS/Tailwind/Zustand/Framer Motion/MCP-B → Task 1, 2, 4, 5, 8 ✓
- §4 File structure: matches Tasks 3-10 ✓
- §4 Connection indicator (🟢/🟡/⚪) → Task 7 Header ✓
- §5 Error handling (invalid coupon, ghost product, empty cart, user cancels) → Task 6 tests + adapter ✓
- §6 Testing (smoke manual + Vitest on tool surface + dry-run) → Task 12 ✓
- §7 Roadmap: implementation tasks follow the spec order ✓
- §8 Out of scope: respected (no auth, no persistence, no Playwright E2E) ✓

**Placeholder scan:** No "TBD", no "TODO", no "implement later". Every step has the actual code/command.

**Type/name consistency:**
- `useCartStore` actions: `addItem`, `removeItem`, `applyCoupon`, `clearCoupon`, `checkout`, `reset`, `logToolCall` — used consistently across Tasks 4, 6, 7, 8, 9, 10. ✓
- `buildTools()` exported from `webmcp.ts` in Task 6, tested in Task 6, called via `registerTools()` (also Task 6) from `App.tsx` in Task 7. ✓
- `WebMCPMode` type from `polyfill.ts` (Task 5) used in `App.tsx` (Task 7) and `Header.tsx` (Task 7). ✓
- `requestCheckoutConfirmation` exported from `checkout-bridge.ts` (Task 10) used in `webmcp.ts` (Task 10 step 2) and `Cart.tsx` (Task 10 step 5). ✓
- Tailwind color names (`coffee-dark`, `coffee-cream`, etc.) defined in Task 2 config, used in all later component tasks. ✓

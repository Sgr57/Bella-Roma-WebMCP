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
  customizerProductId: string | null;
  customizerDraft: CartItemOptions;
  addItem: (
    productId: string,
    quantity: number,
    options?: CartItemOptions,
  ) => boolean;
  removeItem: (productId: string, options?: CartItemOptions) => boolean;
  clearCart: () => void;
  quantityFor: (productId: string, options?: CartItemOptions) => number;
  applyCoupon: (code: string) => { ok: boolean; previous: string | null };
  clearCoupon: () => boolean;
  checkout: () => { ok: boolean; total: number; reason?: string };
  reset: () => void;
  logToolCall: (tool: string, args: unknown, result: string) => void;
  subtotal: () => number;
  discount: () => number;
  total: () => number;
  openCustomizer: (productId: string) => void;
  closeCustomizer: () => void;
  setCustomizerOption: <K extends keyof CartItemOptions>(
    key: K,
    value: CartItemOptions[K],
  ) => void;
  confirmCustomizerAdd: () => boolean;
}

export function defaultOptionsFor(productId: string): CartItemOptions {
  const p = getProductById(productId);
  const out: CartItemOptions = {};
  if (!p?.options) return out;
  if (p.options.size) out.size = p.options.size.default;
  if (p.options.milk) out.milk = p.options.milk.default;
  if (p.options.sweetness) out.sweetness = p.options.sweetness.default;
  return out;
}

export function isCustomizable(productId: string): boolean {
  const p = getProductById(productId);
  if (!p?.options) return false;
  return Boolean(p.options.size || p.options.milk || p.options.sweetness);
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
  customizerProductId: null,
  customizerDraft: {},

  addItem: (productId, quantity, options) => {
    if (!getProductById(productId)) return false;
    if (quantity < 1) return false;
    const withDefaults = { ...defaultOptionsFor(productId), ...options };
    const norm = normalizeOptions(withDefaults);
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

  removeItem: (productId, options) => {
    const items = get().items;
    let idx: number;
    if (options !== undefined) {
      const norm = normalizeOptions({
        ...defaultOptionsFor(productId),
        ...options,
      });
      const key = optionsKey(norm);
      idx = items.findIndex(
        (i) => i.productId === productId && optionsKey(i.options) === key,
      );
    } else {
      idx = items.findIndex((i) => i.productId === productId);
    }
    if (idx < 0) return false;
    set((state) => ({
      items: state.items.filter((_, j) => j !== idx),
    }));
    return true;
  },

  clearCart: () => set({ items: [], coupon: null }),

  quantityFor: (productId, options) => {
    const items = get().items;
    if (options !== undefined) {
      const norm = normalizeOptions({
        ...defaultOptionsFor(productId),
        ...options,
      });
      const key = optionsKey(norm);
      const found = items.find(
        (i) => i.productId === productId && optionsKey(i.options) === key,
      );
      return found?.quantity ?? 0;
    }
    return items
      .filter((i) => i.productId === productId)
      .reduce((acc, i) => acc + i.quantity, 0);
  },

  applyCoupon: (code) => {
    const normalized = code.toUpperCase();
    const discount = getCouponDiscount(normalized, get().subtotal());
    if (discount === null) return { ok: false, previous: get().coupon };
    const previous = get().coupon;
    set({ coupon: normalized });
    return { ok: true, previous: previous === normalized ? null : previous };
  },

  clearCoupon: () => {
    const had = get().coupon !== null;
    set({ coupon: null });
    return had;
  },

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

  openCustomizer: (productId) => {
    if (!getProductById(productId)) return;
    set({
      customizerProductId: productId,
      customizerDraft: defaultOptionsFor(productId),
    });
  },

  closeCustomizer: () =>
    set({ customizerProductId: null, customizerDraft: {} }),

  setCustomizerOption: (key, value) =>
    set((state) => ({
      customizerDraft: { ...state.customizerDraft, [key]: value },
    })),

  confirmCustomizerAdd: () => {
    const { customizerProductId, customizerDraft, addItem } = get();
    if (!customizerProductId) return false;
    const okAdd = addItem(customizerProductId, 1, customizerDraft);
    set({ customizerProductId: null, customizerDraft: {} });
    return okAdd;
  },
}));

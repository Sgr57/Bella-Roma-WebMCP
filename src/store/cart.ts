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

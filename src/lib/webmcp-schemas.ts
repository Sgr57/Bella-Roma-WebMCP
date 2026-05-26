// Forme strutturate ritornate dai tool WebMCP via structuredContent.
// Una sola `kind` discriminator per ogni shape; Claude Desktop sceglie
// lo stile di rendering markdown in base al kind.

import {
  getProductById,
  COUPONS,
  type Product,
  type SizeOption,
  type SweetnessOption,
} from "./products";
import { useCartStore, lineUnitPrice, type CartItemOptions } from "../store/cart";

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

function formatOptionsLabel(o: CartItemOptions | undefined): string {
  if (!o) return "";
  const bits: string[] = [];
  if (o.size) bits.push(o.size);
  if (o.milk) {
    const m = getProductById(o.milk);
    const label = m
      ? `latte ${MILK_LABEL_OVERRIDES[o.milk]?.toLowerCase() ?? m.name.toLowerCase()}`
      : `latte ${o.milk}`;
    const delta = m && m.price > 0 ? ` (+€${m.price.toFixed(2)})` : "";
    bits.push(`${label}${delta}`);
  }
  if (o.sweetness) bits.push(`zucchero ${SWEETNESS_LABELS[o.sweetness].toLowerCase()}`);
  return bits.join(", ");
}

export function buildCart(): Cart {
  const s = useCartStore.getState();
  const lines: CartLine[] = s.items.map((it) => {
    const p = getProductById(it.productId);
    const unit = lineUnitPrice(it);
    const line: CartLine = {
      product_id: it.productId,
      name: p?.name ?? it.productId,
      image_url: imageUrlFor(it.productId),
      quantity: it.quantity,
      options_label: formatOptionsLabel(it.options),
      unit_price: unit,
      line_total: Math.round(unit * it.quantity * 100) / 100,
    };
    if (it.options) line.options = it.options;
    return line;
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

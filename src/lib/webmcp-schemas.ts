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

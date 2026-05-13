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
    values: string[];
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
  intensity?: number;
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

export const PRODUCTS: Product[] = [
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
  {
    id: "cappuccino",
    name: "Cappuccino",
    type: "drink",
    category: "latte",
    price: 2.5,
    description: "Latte montato a velluto, equilibrio italiano classico.",
    emoji: "☕",
    available: true,
  },
  {
    id: "macchiato",
    name: "Macchiato",
    type: "drink",
    category: "latte",
    price: 2.0,
    description: "Espresso macchiato con un tocco di schiuma di latte.",
    emoji: "☕",
    available: true,
  },
  {
    id: "filtro-etiopia",
    name: "Caffè Filtro Etiopia",
    type: "drink",
    category: "filtro",
    price: 4.0,
    description: "Note floreali e di bergamotto, lavorato a umido.",
    emoji: "🫖",
    available: true,
  },
  {
    id: "filtro-colombia",
    name: "Caffè Filtro Colombia",
    type: "drink",
    category: "filtro",
    price: 3.8,
    description: "Caramello, cioccolato al latte, dolce nel finale.",
    emoji: "🫖",
    available: true,
  },
  {
    id: "decaffeinato",
    name: "Decaffeinato",
    type: "drink",
    category: "decaf",
    price: 1.8,
    description: "Decaffeinato ad acqua, corpo pieno senza caffeina.",
    emoji: "☕",
    available: true,
  },
  {
    id: "americano",
    name: "Caffè Americano",
    type: "drink",
    category: "filtro",
    price: 2.2,
    description: "Espresso lungo allungato con acqua calda.",
    emoji: "☕",
    available: true,
  },
  {
    id: "latte-macchiato",
    name: "Latte Macchiato",
    type: "drink",
    category: "latte",
    price: 3.0,
    description: "Latte caldo macchiato con un espresso, servito a strati.",
    emoji: "🥛",
    available: true,
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

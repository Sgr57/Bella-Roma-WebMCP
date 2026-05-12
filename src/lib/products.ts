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

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

const ALL_MILK = [
  "milk-whole",
  "milk-oat",
  "milk-soy",
  "milk-almond",
  "milk-lactose-free",
];

const SIZE_S_M_L: ProductOptions["size"] = {
  values: ["S", "M", "L"],
  default: "M",
  price_modifier: { S: 0, M: 0, L: 0.5 },
};

const SWEETNESS_OPTS: ProductOptions["sweetness"] = {
  values: ["none", "low", "normal"],
  default: "normal",
};

const MILK_OPTS: ProductOptions["milk"] = {
  values: ALL_MILK,
  default: "milk-whole",
};

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
    options: { sweetness: SWEETNESS_OPTS },
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
    options: { sweetness: SWEETNESS_OPTS },
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
    options: { sweetness: SWEETNESS_OPTS },
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
    options: { milk: MILK_OPTS, sweetness: SWEETNESS_OPTS },
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
    options: { size: SIZE_S_M_L, sweetness: SWEETNESS_OPTS },
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
    options: { size: SIZE_S_M_L, milk: MILK_OPTS, sweetness: SWEETNESS_OPTS },
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
    options: { milk: MILK_OPTS, sweetness: SWEETNESS_OPTS },
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
    options: { size: SIZE_S_M_L, milk: MILK_OPTS, sweetness: SWEETNESS_OPTS },
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
    options: { size: SIZE_S_M_L, milk: MILK_OPTS, sweetness: SWEETNESS_OPTS },
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
    options: { sweetness: SWEETNESS_OPTS },
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
    options: { size: SIZE_S_M_L, milk: MILK_OPTS, sweetness: SWEETNESS_OPTS },
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

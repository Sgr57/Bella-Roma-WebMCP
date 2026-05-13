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
};

const CATEGORY_INTENSITY: Record<ProductCategory, number> = {
  espresso: 9,
  filtro: 5,
  decaf: 3,
  latte: 6,
};

const BADGES: Record<string, { text: string; variant: "new" | "promo" }> = {
  "filtro-etiopia": { text: "Novità", variant: "new" },
  "filtro-colombia": { text: "Novità", variant: "new" },
  decaffeinato: { text: "Promo", variant: "promo" },
};

export function ProductCard({ product }: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const [pulse, setPulse] = useState(0);

  const handleAdd = () => {
    addItem(product.id, 1);
    setPulse((p) => p + 1);
  };

  const eyebrow = CATEGORY_LABEL[product.category];
  const intensity = CATEGORY_INTENSITY[product.category];
  const badge = BADGES[product.id];

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
      className="bg-lavazza-off rounded-md p-4 flex flex-col hover:shadow-lavazza transition-shadow relative"
    >
      {/* Badges top-left */}
      {badge && (
        <div className="absolute top-3 left-3 z-10">
          {badge.variant === "new" ? (
            <span className="bg-coffee-dark text-white text-[11px] font-medium px-3 py-0.5 rounded-md uppercase tracking-wider">
              {badge.text}
            </span>
          ) : (
            <span className="bg-white text-coffee-accent text-[13px] font-medium px-3 py-0.5 rounded-md border border-coffee-accent/30">
              {badge.text}
            </span>
          )}
        </div>
      )}

      {/* Image area */}
      <div className="h-40 flex items-center justify-center mb-3 mt-2">
        <span className="text-7xl">{product.emoji}</span>
      </div>

      {/* Eyebrow */}
      <p className="text-[11px] uppercase tracking-[0.15em] font-light text-coffee-mid mb-1 text-center">
        {eyebrow}
      </p>

      {/* Title */}
      <h3 className="font-display text-lg font-bold text-lavazza-deep text-center mb-1 leading-tight">
        {product.name}
      </h3>

      {/* Intensity bar */}
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

      {/* Description */}
      <p className="text-xs text-coffee-mid mb-4 flex-grow text-center leading-relaxed px-1">
        {product.description}
      </p>

      {/* Price */}
      <p className="text-xl font-bold text-coffee-mid text-center mb-3">
        € {product.price.toFixed(2).replace(".", ",")}
      </p>

      {/* CTA */}
      <button
        onClick={handleAdd}
        className="w-full bg-coffee-dark text-white py-3 rounded-pill text-xs uppercase tracking-[0.1em] font-semibold border-[1.5px] border-coffee-dark hover:bg-lavazza-deep hover:border-lavazza-deep transition"
      >
        Aggiungi al carrello
      </button>
    </motion.div>
  );
}

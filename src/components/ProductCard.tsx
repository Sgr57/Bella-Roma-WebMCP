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

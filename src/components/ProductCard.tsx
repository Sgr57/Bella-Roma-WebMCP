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
      animate={
        pulse > 0
          ? {
              scale: [1, 1.06, 1],
              boxShadow: [
                "0 0 0 rgba(200,152,96,0)",
                "0 0 24px rgba(200,152,96,0.6)",
                "0 0 0 rgba(200,152,96,0)",
              ],
            }
          : {}
      }
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

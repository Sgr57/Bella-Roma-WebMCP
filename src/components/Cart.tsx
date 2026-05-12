import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useCartStore } from "../store/cart";
import { CartItem } from "./CartItem";

export function Cart() {
  const items = useCartStore((s) => s.items);
  const coupon = useCartStore((s) => s.coupon);
  const subtotal = useCartStore((s) => s.subtotal());
  const discount = useCartStore((s) => s.discount());
  const total = useCartStore((s) => s.total());
  const clearCoupon = useCartStore((s) => s.clearCoupon);

  const [flash, setFlash] = useState(0);
  const lastCount = useRef(items.length);
  useEffect(() => {
    if (items.length > lastCount.current) setFlash((f) => f + 1);
    lastCount.current = items.length;
  }, [items.length]);

  return (
    <motion.aside
      animate={
        flash > 0
          ? {
              boxShadow: [
                "0 0 0 rgba(200,152,96,0)",
                "0 0 30px rgba(200,152,96,0.6)",
                "0 0 0 rgba(200,152,96,0)",
              ],
            }
          : {}
      }
      transition={{ duration: 0.8 }}
      className="bg-white rounded-lg shadow-sm border border-coffee-cream p-4 sticky top-4"
    >
      <h2 className="font-display text-xl text-coffee-dark mb-2">Carrello</h2>
      {items.length === 0 ? (
        <p className="text-sm text-coffee-mid italic">Il carrello è vuoto.</p>
      ) : (
        <>
          <ul className="mb-3">
            <AnimatePresence initial={false}>
              {items.map((i) => (
                <motion.div
                  key={i.productId}
                  layout
                  initial={{ opacity: 0, x: 40, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 40, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 320, damping: 28 }}
                >
                  <CartItem item={i} />
                </motion.div>
              ))}
            </AnimatePresence>
          </ul>
          <motion.div
            layout
            className="text-sm space-y-1 border-t border-coffee-cream pt-2"
          >
            <div className="flex justify-between">
              <span>Subtotale</span>
              <span>€{subtotal.toFixed(2)}</span>
            </div>
            <AnimatePresence>
              {coupon && (
                <motion.div
                  key="coupon"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex justify-between text-green-700"
                >
                  <span>
                    Coupon {coupon}{" "}
                    <button
                      onClick={clearCoupon}
                      className="text-xs underline opacity-70 hover:opacity-100"
                    >
                      rimuovi
                    </button>
                  </span>
                  <span>-€{discount.toFixed(2)}</span>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex justify-between font-bold text-base pt-1 border-t border-coffee-cream">
              <span>Totale</span>
              <motion.span
                key={total.toFixed(2)}
                initial={{ scale: 1.2, color: "#c89860" }}
                animate={{ scale: 1, color: "#3b2417" }}
                transition={{ duration: 0.3 }}
              >
                €{total.toFixed(2)}
              </motion.span>
            </div>
          </motion.div>
        </>
      )}
    </motion.aside>
  );
}

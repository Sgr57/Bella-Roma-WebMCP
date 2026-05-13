import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useCartStore } from "../store/cart";
import { CartItem } from "./CartItem";
import { CART_EMPTY_PROMPT_IDS, getPromptsByIds } from "../lib/prompts";

const EMPTY_STATE_PROMPTS = getPromptsByIds(CART_EMPTY_PROMPT_IDS);

export function Cart() {
  const items = useCartStore((s) => s.items);
  const coupon = useCartStore((s) => s.coupon);
  const subtotal = useCartStore((s) => s.subtotal());
  const discount = useCartStore((s) => s.discount());
  const total = useCartStore((s) => s.total());
  const clearCoupon = useCartStore((s) => s.clearCoupon);

  const [flash, setFlash] = useState(0);
  const lastCount = useRef(items.length);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  const copyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPrompt(text);
      window.setTimeout(
        () => setCopiedPrompt((c) => (c === text ? null : c)),
        1200,
      );
    } catch {
      // ignore
    }
  };
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
                "0 0 0 rgba(255,135,0,0)",
                "0 0 30px rgba(255,135,0,0.55)",
                "0 0 0 rgba(255,135,0,0)",
              ],
            }
          : {}
      }
      transition={{ duration: 0.8 }}
      className="bg-white rounded-2xl shadow-lavazza border border-lavazza-line p-5 sticky top-4"
    >
      <h2 className="font-display text-xl font-bold text-lavazza-deep mb-3">
        Carrello
      </h2>
      {items.length === 0 ? (
        <div className="flex flex-col items-center text-center py-4">
          <span className="text-5xl mb-3 opacity-30">🛒</span>
          <p className="text-sm font-medium text-lavazza-deep mb-1">
            Ancora niente?
          </p>
          <p className="text-xs text-coffee-mid leading-relaxed max-w-[240px] mb-4">
            Scegli dal catalogo qui accanto. Oppure — molto più comodo — chiedi
            al tuo assistente:{" "}
            <span className="italic text-lavazza-deep">
              ci pensa lui a ordinare.
            </span>
          </p>
          <p className="text-[10px] uppercase tracking-[0.18em] font-medium text-coffee-mid mb-2">
            Prova con…
          </p>
          <ul className="w-full flex flex-col items-center gap-1.5">
            {EMPTY_STATE_PROMPTS.map((p) => {
              const flash = copiedPrompt === p.text;
              return (
                <li key={p.id} className="w-full">
                  <button
                    onClick={() => copyPrompt(p.text)}
                    aria-label={`Copia prompt: ${p.text}`}
                    className={`group w-full text-[11px] leading-snug pl-2.5 pr-2 py-1 rounded-pill border transition-colors duration-200 inline-flex items-center gap-1.5 text-left ${
                      flash
                        ? "text-coffee-accent border-coffee-accent bg-white"
                        : "text-coffee-mid border-lavazza-line/70 bg-white/70 hover:text-lavazza-deep hover:border-coffee-dark/60"
                    }`}
                  >
                    <span className="flex-1">"{p.text}"</span>
                    <span
                      className={`shrink-0 transition-opacity ${
                        flash
                          ? "opacity-100"
                          : "opacity-40 group-hover:opacity-80"
                      }`}
                    >
                      {flash ? (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-3 h-3"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-3 h-3"
                          aria-hidden="true"
                        >
                          <rect x="9" y="2" width="6" height="4" rx="1" />
                          <path d="M9 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
                        </svg>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
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
            className="text-sm space-y-1 border-t border-lavazza-line pt-3"
          >
            <div className="flex justify-between text-coffee-mid">
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
                  className="flex justify-between text-coffee-accent font-medium"
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
            <div className="flex justify-between font-bold text-base pt-2 border-t border-lavazza-line text-lavazza-deep">
              <span>Totale</span>
              <motion.span
                key={total.toFixed(2)}
                initial={{ scale: 1.2, color: "#FF8700" }}
                animate={{ scale: 1, color: "#051432" }}
                transition={{ duration: 0.3 }}
              >
                €{total.toFixed(2)}
              </motion.span>
            </div>
          </motion.div>
          <button
            onClick={async () => {
              const { requestCheckoutConfirmation } = await import("../lib/checkout-bridge");
              const total = useCartStore.getState().total();
              const ok = await requestCheckoutConfirmation(total);
              if (ok) {
                useCartStore.getState().checkout();
              }
            }}
            className="w-full mt-4 bg-coffee-dark text-white py-3 rounded-pill text-xs uppercase tracking-[0.1em] font-semibold border-[1.5px] border-coffee-dark hover:bg-lavazza-deep hover:border-lavazza-deep transition"
          >
            Procedi al checkout
          </button>
        </>
      )}
    </motion.aside>
  );
}

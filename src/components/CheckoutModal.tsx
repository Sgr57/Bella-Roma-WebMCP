import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { setCheckoutListener } from "../lib/checkout-bridge";

interface Pending {
  total: number;
  resolve: (ok: boolean) => void;
}

export function CheckoutModal() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    setCheckoutListener((total, resolve) => setPending({ total, resolve }));
    return () => setCheckoutListener(null);
  }, []);

  const handle = (ok: boolean) => {
    if (!pending) return;
    pending.resolve(ok);
    setPending(null);
  };

  return (
    <AnimatePresence>
      {pending && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => handle(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-lavazza-md max-w-md w-full p-7"
          >
            <div className="text-center mb-5">
              <div className="text-5xl mb-3">💳</div>
              <p className="text-[11px] uppercase tracking-[0.15em] font-light text-coffee-mid mb-1">
                Checkout
              </p>
              <h2 className="font-display text-2xl font-bold text-lavazza-deep">
                Conferma pagamento
              </h2>
              <p className="text-sm text-coffee-mid mt-2 leading-relaxed">
                L'agente AI vuole completare l'ordine. Vuoi procedere?
              </p>
            </div>
            <div className="bg-coffee-cream rounded-2xl p-5 text-center mb-5">
              <p className="text-[11px] uppercase tracking-[0.15em] text-coffee-mid mb-1">
                Totale da pagare
              </p>
              <p className="font-display text-4xl font-bold text-lavazza-deep">
                €{pending.total.toFixed(2)}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handle(false)}
                className="flex-1 px-4 py-3 rounded-pill border border-lavazza-line text-coffee-mid font-medium text-sm uppercase tracking-wider hover:bg-lavazza-soft transition"
              >
                Annulla
              </button>
              <button
                onClick={() => handle(true)}
                className="flex-1 px-4 py-3 rounded-pill bg-coffee-dark text-white font-semibold text-xs uppercase tracking-[0.1em] border-[1.5px] border-coffee-dark hover:bg-lavazza-deep hover:border-lavazza-deep transition"
                autoFocus
              >
                Conferma €{pending.total.toFixed(2)}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

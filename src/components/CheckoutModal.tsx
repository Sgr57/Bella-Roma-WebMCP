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
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
          >
            <div className="text-center mb-4">
              <div className="text-5xl mb-2">💳</div>
              <h2 className="font-display text-2xl text-coffee-dark">
                Conferma pagamento
              </h2>
              <p className="text-sm text-coffee-mid mt-2">
                L'agente AI vuole completare l'ordine. Vuoi procedere?
              </p>
            </div>
            <div className="bg-coffee-cream rounded-lg p-4 text-center mb-4">
              <p className="text-xs text-coffee-mid">Totale da pagare</p>
              <p className="font-display text-3xl text-coffee-dark">
                €{pending.total.toFixed(2)}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handle(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-coffee-mid text-coffee-mid hover:bg-coffee-cream"
              >
                Annulla
              </button>
              <button
                onClick={() => handle(true)}
                className="flex-1 px-4 py-2 rounded-lg bg-coffee-dark text-coffee-cream font-medium hover:bg-coffee-mid"
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

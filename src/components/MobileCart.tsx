import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useCartStore } from "../store/cart";
import { CartItem } from "./CartItem";
import { CART_EMPTY_PROMPT_IDS, getPromptsByIds } from "../lib/prompts";

const EMPTY_STATE_PROMPTS = getPromptsByIds(CART_EMPTY_PROMPT_IDS);
const STORAGE_KEY = "mobile-cart-collapsed";

export function MobileCart() {
  const items = useCartStore((s) => s.items);
  const coupon = useCartStore((s) => s.coupon);
  const subtotal = useCartStore((s) => s.subtotal());
  const discount = useCartStore((s) => s.discount());
  const total = useCartStore((s) => s.total());
  const clearCoupon = useCartStore((s) => s.clearCoupon);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "1";
  });
  const [pulse, setPulse] = useState(0);
  const lastCountRef = useRef(items.length);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [hasOverflowTop, setHasOverflowTop] = useState(false);
  const [hasOverflowBottom, setHasOverflowBottom] = useState(false);
  const dragControls = useDragControls();

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    if (items.length > lastCountRef.current && collapsed) {
      setPulse((p) => p + 1);
    }
    lastCountRef.current = items.length;
  }, [items.length, collapsed]);

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
    const el = listRef.current;
    if (!el) return;
    const update = () => {
      setHasOverflowTop(el.scrollTop > 1);
      setHasOverflowBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [items.length, collapsed]);

  const isEmpty = items.length === 0;

  return (
    <motion.div
      drag={collapsed ? false : "y"}
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.4 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 80 || info.velocity.y > 400) setCollapsed(true);
      }}
      animate={
        pulse > 0
          ? {
              boxShadow: [
                "0 2px 12px rgba(2,20,35,0.10)",
                "0 -4px 28px rgba(255,135,0,0.55)",
                "0 2px 12px rgba(2,20,35,0.10)",
              ],
            }
          : {}
      }
      transition={{ duration: 0.7 }}
      className="fixed inset-x-0 bottom-0 z-50 lg:hidden bg-white rounded-t-2xl shadow-lavazza-md border-t border-x border-lavazza-line"
    >
      {!collapsed && (
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="pt-2.5 pb-1 touch-none cursor-grab active:cursor-grabbing"
          aria-hidden="true"
        >
          <div className="w-10 h-1 rounded-full bg-lavazza-line mx-auto" />
        </div>
      )}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
        aria-expanded={!collapsed}
        aria-controls="mobile-cart-panel"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-xl" aria-hidden="true">🛒</span>
          {isEmpty ? (
            <span className="text-xs text-coffee-mid truncate">
              Carrello vuoto — chiedi al tuo assistente
            </span>
          ) : (
            <>
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-coffee-accent text-white text-[11px] font-bold tabular-nums">
                {items.length}
              </span>
              <span className="text-sm font-medium text-lavazza-deep">
                Carrello
              </span>
            </>
          )}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {!isEmpty && (
            <span className="text-sm font-bold text-lavazza-deep tabular-nums">
              €{total.toFixed(2)}
            </span>
          )}
          <motion.svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4 text-coffee-mid"
            animate={{ rotate: collapsed ? 0 : 180 }}
            transition={{ duration: 0.2 }}
            aria-hidden="true"
          >
            <polyline points="18 15 12 9 6 15" />
          </motion.svg>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            id="mobile-cart-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className="overflow-hidden border-t border-lavazza-line"
          >
            <div className="px-4 pt-3 pb-1">
              <h2 className="font-display text-xl font-bold text-lavazza-deep mb-2">
                Carrello
              </h2>
            </div>
            <div className="px-4 pb-4 flex flex-col max-h-[calc(85vh-7rem)]">
              {isEmpty ? (
                <div className="flex flex-col items-center text-center py-4">
                  <span className="text-5xl mb-3 opacity-30">🛒</span>
                  <p className="text-sm font-medium text-lavazza-deep mb-1">
                    Ancora niente?
                  </p>
                  <p className="text-xs text-coffee-mid leading-relaxed max-w-[240px] mb-4">
                    Scegli dal catalogo qui sopra. Oppure — molto più comodo —
                    chiedi al tuo assistente:{" "}
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
                  <div className="relative flex-1 min-h-0 mb-3">
                    <div
                      ref={listRef}
                      className="h-full max-h-[40vh] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_bottom,transparent_0,black_16px,black_calc(100%-16px),transparent_100%)]"
                    >
                      <ul>
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
                    </div>
                    <AnimatePresence>
                      {hasOverflowTop && (
                        <motion.div
                          key="overflow-top"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: [0, -3, 0] }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{
                            opacity: { duration: 0.2 },
                            y: {
                              duration: 1.2,
                              repeat: Infinity,
                              ease: "easeInOut",
                              repeatDelay: 1.4,
                            },
                          }}
                          className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 text-coffee-accent"
                          aria-hidden="true"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-3.5 h-3.5"
                          >
                            <polyline points="18 15 12 9 6 15" />
                          </svg>
                        </motion.div>
                      )}
                      {hasOverflowBottom && (
                        <motion.div
                          key="overflow-bottom"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: [0, 3, 0] }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{
                            opacity: { duration: 0.2 },
                            y: {
                              duration: 1.2,
                              repeat: Infinity,
                              ease: "easeInOut",
                              repeatDelay: 1.4,
                            },
                          }}
                          className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 text-coffee-accent"
                          aria-hidden="true"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-3.5 h-3.5"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <motion.div
                    layout
                    className="text-sm space-y-1 border-t border-lavazza-line pt-3 shrink-0"
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
                    className="w-full mt-4 bg-coffee-dark text-white py-3 rounded-pill text-xs uppercase tracking-[0.1em] font-semibold border-[1.5px] border-coffee-dark hover:bg-lavazza-deep hover:border-lavazza-deep transition shrink-0"
                  >
                    Procedi al checkout
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

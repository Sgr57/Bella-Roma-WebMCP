import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { createPortal } from "react-dom";
import { lineUnitPrice, useCartStore } from "../store/cart";
import {
  getProductById,
  type SizeOption,
  type SweetnessOption,
} from "../lib/products";

const SWEET_LABEL: Record<SweetnessOption, string> = {
  none: "Senza",
  low: "Poco",
  normal: "Normale",
};

const MILK_SHORT_LABEL: Record<string, string> = {
  "milk-whole": "Intero",
  "milk-oat": "Avena",
  "milk-soy": "Soia",
  "milk-almond": "Mandorla",
  "milk-lactose-free": "Senza lattosio",
};

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 1024px)").matches
      : true,
  );
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

interface Position {
  top: number;
  left: number;
}

function useAnchorPosition(
  productId: string | null,
  popoverRef: React.RefObject<HTMLDivElement>,
  enabled: boolean,
): Position | null {
  const [pos, setPos] = useState<Position | null>(null);
  useLayoutEffect(() => {
    if (!enabled || !productId) {
      setPos(null);
      return;
    }
    const POP_W = 340;
    const GAP = 16;
    const update = () => {
      const card = document.querySelector(
        `[data-product-id="${productId}"]`,
      ) as HTMLElement | null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      const popH = popoverRef.current?.offsetHeight ?? 420;
      const spaceRight = window.innerWidth - r.right;
      let left: number;
      if (spaceRight > POP_W + GAP + 12) {
        left = r.right + GAP;
      } else {
        left = r.left - POP_W - GAP;
        if (left < 12) left = 12;
      }
      let top = r.top;
      const overflowBottom = top + popH - window.innerHeight + 12;
      if (overflowBottom > 0) top -= overflowBottom;
      if (top < 12) top = 12;
      setPos({ top, left });
    };
    update();
    const ro = new ResizeObserver(update);
    if (popoverRef.current) ro.observe(popoverRef.current);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [productId, enabled, popoverRef]);
  return pos;
}

function CustomizerBody({ productId }: { productId: string }) {
  const draft = useCartStore((s) => s.customizerDraft);
  const setOption = useCartStore((s) => s.setCustomizerOption);
  const close = useCartStore((s) => s.closeCustomizer);
  const confirm = useCartStore((s) => s.confirmCustomizerAdd);

  const product = getProductById(productId);
  if (!product) return null;
  const price = lineUnitPrice({ productId, quantity: 1, options: draft });

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-coffee-mid">
            Personalizza
          </p>
          <h3 className="font-display text-lg font-bold text-lavazza-deep leading-tight">
            {product.name}
          </h3>
        </div>
        <button
          onClick={close}
          aria-label="Chiudi"
          className="text-coffee-mid hover:text-lavazza-deep text-lg leading-none px-1 -mt-1"
        >
          ✕
        </button>
      </div>

      {product.options?.size && (
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-[0.15em] text-coffee-mid mb-2 font-medium">
            Taglia
          </p>
          <div className="flex gap-2">
            {product.options.size.values.map((s) => {
              const active = draft.size === s;
              return (
                <button
                  key={s}
                  onClick={() => setOption("size", s as SizeOption)}
                  className={`px-4 py-1.5 rounded-pill text-[11px] uppercase tracking-wider border transition ${
                    active
                      ? "bg-coffee-dark text-white border-coffee-dark"
                      : "bg-white text-coffee-mid border-lavazza-line hover:border-coffee-dark"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {product.options?.milk && (
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-[0.15em] text-coffee-mid mb-2 font-medium">
            Latte
          </p>
          <div className="grid grid-cols-2 gap-2">
            {product.options.milk.values.map((m) => {
              const milkProd = getProductById(m);
              if (!milkProd) return null;
              const active = draft.milk === m;
              const disabled = !milkProd.available;
              const label = MILK_SHORT_LABEL[m] ?? milkProd.name;
              return (
                <button
                  key={m}
                  disabled={disabled}
                  onClick={() => setOption("milk", m)}
                  className={`p-2 rounded-md text-center border transition ${
                    active
                      ? "border-coffee-dark bg-lavazza-soft shadow-lavazza"
                      : "border-lavazza-line bg-white hover:border-coffee-dark"
                  } ${disabled ? "opacity-40 cursor-not-allowed hover:border-lavazza-line" : ""}`}
                >
                  <span className="text-2xl block leading-none">
                    {milkProd.emoji}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-coffee-mid mt-1 block leading-tight">
                    {label}
                  </span>
                  {milkProd.price > 0 ? (
                    <span className="text-[9px] text-coffee-accent font-semibold mt-0.5 block">
                      +€{milkProd.price.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-[9px] text-coffee-mid/60 mt-0.5 block">
                      incluso
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {product.options?.sweetness && (
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-[0.15em] text-coffee-mid mb-2 font-medium">
            Zucchero
          </p>
          <div className="flex gap-2 flex-wrap">
            {product.options.sweetness.values.map((s) => {
              const active = draft.sweetness === s;
              return (
                <button
                  key={s}
                  onClick={() => setOption("sweetness", s as SweetnessOption)}
                  className={`px-4 py-1.5 rounded-pill text-[11px] uppercase tracking-wider border transition ${
                    active
                      ? "bg-coffee-dark text-white border-coffee-dark"
                      : "bg-white text-coffee-mid border-lavazza-line hover:border-coffee-dark"
                  }`}
                >
                  {SWEET_LABEL[s]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={confirm}
        className="w-full mt-2 bg-coffee-dark text-white py-3 rounded-pill text-xs uppercase tracking-[0.1em] font-semibold border-[1.5px] border-coffee-dark hover:bg-lavazza-deep hover:border-lavazza-deep transition flex items-center justify-center gap-2"
      >
        <span>Aggiungi al carrello</span>
        <span className="opacity-60">·</span>
        <span>€{price.toFixed(2).replace(".", ",")}</span>
      </button>
    </div>
  );
}

export function Customizer() {
  const activeId = useCartStore((s) => s.customizerProductId);
  const close = useCartStore((s) => s.closeCustomizer);
  const isDesktop = useIsDesktop();
  const popoverRef = useRef<HTMLDivElement>(null);
  const pos = useAnchorPosition(activeId, popoverRef, isDesktop);
  const dragControls = useDragControls();

  useEffect(() => {
    if (!activeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, close]);

  const overlay = (
    <AnimatePresence>
      {activeId && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            className="fixed inset-0 z-40"
            style={{
              background: "rgba(5,20,50,0.28)",
              backdropFilter: "blur(3px)",
              WebkitBackdropFilter: "blur(3px)",
            }}
          />
          {isDesktop ? (
            <motion.div
              key="popover"
              ref={popoverRef}
              initial={{ opacity: 0, x: -8, scale: 0.97 }}
              animate={{ opacity: pos ? 1 : 0, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -8, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className="fixed z-50 w-[340px] bg-white rounded-2xl shadow-lavazza-md p-5"
              style={{
                top: pos?.top ?? -9999,
                left: pos?.left ?? -9999,
                boxShadow: "0 24px 60px rgba(2,20,35,0.25)",
              }}
            >
              <CustomizerBody productId={activeId} />
            </motion.div>
          ) : (
            <motion.div
              key="sheet"
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80 || info.velocity.y > 400) close();
              }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 280, damping: 32 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl px-6 pt-3 pb-8 max-w-2xl mx-auto"
              style={{ boxShadow: "0 -16px 50px rgba(2,20,35,0.18)" }}
            >
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="-mx-6 px-6 pt-1 pb-3 touch-none cursor-grab active:cursor-grabbing"
                aria-hidden="true"
              >
                <div className="w-11 h-1 bg-lavazza-line rounded-full mx-auto" />
              </div>
              <CustomizerBody productId={activeId} />
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(overlay, document.body);
}

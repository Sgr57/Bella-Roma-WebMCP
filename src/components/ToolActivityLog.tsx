import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useCartStore } from "../store/cart";

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("it-IT", { hour12: false });
}

const STORAGE_KEY = "tool-activity-collapsed";

export function ToolActivityLog() {
  const activity = useCartStore((s) => s.activity);
  const recent = activity.slice(-10).reverse();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "1";
  });
  const [pulse, setPulse] = useState(0);
  const lastCountRef = useRef(activity.length);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    if (activity.length > lastCountRef.current && collapsed) {
      setPulse((p) => p + 1);
    }
    lastCountRef.current = activity.length;
  }, [activity.length, collapsed]);

  return (
    <motion.div
      animate={
        pulse > 0
          ? {
              boxShadow: [
                "0 2px 12px rgba(2,20,35,0.10)",
                "0 0 24px rgba(255,135,0,0.55)",
                "0 2px 12px rgba(2,20,35,0.10)",
              ],
            }
          : {}
      }
      transition={{ duration: 0.7 }}
      className="fixed bottom-4 left-4 w-72 bg-coffee-dark/95 backdrop-blur-sm text-white rounded-2xl shadow-lavazza-md overflow-hidden flex flex-col border border-white/10 z-40"
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="px-3 py-2 flex items-center justify-between gap-3 hover:bg-white/5 transition text-left w-full"
        aria-expanded={!collapsed}
        aria-controls="tool-activity-panel"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span
            className="relative inline-flex h-2 w-2 shrink-0"
            aria-hidden="true"
          >
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[10.5px] uppercase tracking-[0.15em] font-medium truncate">
            Tool Activity
          </span>
          <span className="text-[10px] tabular-nums text-white/60 shrink-0">
            {activity.length}
          </span>
        </span>
        <motion.svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-3.5 h-3.5 text-white/60 shrink-0"
          animate={{ rotate: collapsed ? 0 : 180 }}
          transition={{ duration: 0.2 }}
          aria-hidden="true"
        >
          <polyline points="18 15 12 9 6 15" />
        </motion.svg>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            id="tool-activity-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
            className="overflow-hidden border-t border-white/10"
          >
            <ul className="max-h-80 overflow-y-auto px-2 py-2 text-xs font-mono space-y-1">
              {recent.length === 0 && (
                <li className="opacity-60 italic px-1 py-2">
                  In attesa di chiamate dall'agente…
                </li>
              )}
              <AnimatePresence initial={false}>
                {recent.map((a) => (
                  <motion.li
                    key={a.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="bg-black/20 rounded px-2 py-1"
                  >
                    <div className="flex justify-between">
                      <span className="text-coffee-accent">{a.tool}</span>
                      <span className="opacity-50">
                        {formatTime(a.timestamp)}
                      </span>
                    </div>
                    {Object.keys(a.args ?? {}).length > 0 && (
                      <div className="opacity-80 truncate">
                        args: {JSON.stringify(a.args)}
                      </div>
                    )}
                    <div className="opacity-70 truncate">→ {a.result}</div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

import { AnimatePresence, motion } from "framer-motion";
import { useCartStore } from "../store/cart";

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("it-IT", { hour12: false });
}

export function ToolActivityLog() {
  const activity = useCartStore((s) => s.activity);
  const recent = activity.slice(-10).reverse();

  return (
    <div className="fixed bottom-4 left-4 w-80 max-h-96 bg-coffee-dark text-white rounded-2xl shadow-lavazza-md overflow-hidden flex flex-col border border-coffee-accent z-40">
      <div className="px-4 py-2.5 bg-black/30 flex items-center justify-between border-b border-white/10">
        <span className="text-[11px] uppercase tracking-[0.15em] font-medium">
          Tool Activity ({activity.length})
        </span>
        <span className="text-[10px] uppercase tracking-wider opacity-70">live</span>
      </div>
      <ul className="overflow-y-auto flex-1 px-2 py-1 text-xs font-mono space-y-1">
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
                <span className="opacity-50">{formatTime(a.timestamp)}</span>
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
    </div>
  );
}

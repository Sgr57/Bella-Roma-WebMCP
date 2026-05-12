import { useCartStore } from "../store/cart";

type ConnectionState = "native" | "polyfill" | "unavailable";

interface Props {
  connection: ConnectionState;
}

const CONNECTION_LABEL: Record<ConnectionState, { dot: string; text: string }> = {
  native: { dot: "🟢", text: "WebMCP nativo attivo" },
  polyfill: { dot: "🟡", text: "Polyfill MCP-B attivo" },
  unavailable: { dot: "⚪", text: "Nessun agente collegato" },
};

export function Header({ connection }: Props) {
  const reset = useCartStore((s) => s.reset);
  const label = CONNECTION_LABEL[connection];
  return (
    <header className="bg-coffee-dark text-coffee-cream px-6 py-4 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-3">
        <span className="text-3xl">☕</span>
        <div>
          <h1 className="font-display text-2xl leading-none">Bella Roma Coffee</h1>
          <p className="text-xs opacity-70">Torrefazione artigianale dal 1962</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm flex items-center gap-2" title={label.text}>
          <span>{label.dot}</span>
          <span className="hidden sm:inline">{label.text}</span>
        </span>
        <button
          onClick={reset}
          className="bg-coffee-accent text-coffee-dark px-3 py-1 rounded font-medium hover:opacity-90 text-sm"
        >
          Reset demo
        </button>
      </div>
    </header>
  );
}

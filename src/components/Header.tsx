import { useCartStore } from "../store/cart";
import { setRelayEnabled, type RelayVariant } from "../lib/relay";
import type { RelayState } from "../lib/relay-client";

type ConnectionState = "native" | "polyfill" | "unavailable";

interface Props {
  connection: ConnectionState;
  relay: boolean;
  relayVariant: RelayVariant;
  relayState: RelayState;
}

const CONNECTION_LABEL: Record<ConnectionState, { dot: string; text: string }> = {
  native: { dot: "🟢", text: "WebMCP nativo (Canary)" },
  polyfill: { dot: "🟡", text: "Polyfill MCP-B (compat)" },
  unavailable: { dot: "⚪", text: "Nessun agente collegato" },
};

function relayLabel(
  relay: boolean,
  variant: RelayVariant,
  state: RelayState,
): { dot: string; text: string; title: string } {
  if (!relay) {
    return {
      dot: "▫",
      text: "off",
      title:
        "Bridge a Claude Desktop disattivato. Click per abilitarlo (reload).",
    };
  }
  if (variant === "native-ws") {
    const dot =
      state === "open"
        ? "🔵"
        : state === "connecting"
          ? "🟠"
          : state === "error" || state === "closed"
            ? "🔴"
            : "⚪";
    return {
      dot,
      text: `native WS (${state})`,
      title:
        "Bridge nativo: la pagina parla direttamente con webmcp-local-relay via WebSocket. Nessuna estensione, nessun polyfill.",
    };
  }
  if (variant === "polyfill-embed") {
    return {
      dot: "🟣",
      text: "embed CDN",
      title:
        "Bridge compat: l'embed @mcp-b/webmcp-local-relay è caricato da CDN sopra il polyfill.",
    };
  }
  return {
    dot: "⚠️",
    text: "no API",
    title:
      "Relay richiesto ma nessuna API WebMCP è disponibile (né nativa né polyfill).",
  };
}

export function Header({ connection, relay, relayVariant, relayState }: Props) {
  const reset = useCartStore((s) => s.reset);
  const label = CONNECTION_LABEL[connection];
  const rl = relayLabel(relay, relayVariant, relayState);
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
          onClick={() => setRelayEnabled(!relay)}
          title={rl.title}
          className={`text-sm px-3 py-1 rounded font-medium border transition flex items-center gap-1.5 ${
            relay
              ? "bg-coffee-accent text-coffee-dark border-coffee-accent"
              : "bg-transparent text-coffee-cream border-coffee-cream/40 hover:border-coffee-cream"
          }`}
        >
          <span>{rl.dot}</span>
          <span>Relay: {rl.text}</span>
        </button>
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

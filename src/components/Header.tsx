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

interface StatusInfo {
  tone: "live" | "warn" | "idle";
  short: string;
  full: string;
}

const CONNECTION_INFO: Record<ConnectionState, StatusInfo> = {
  native: { tone: "live", short: "Native", full: "WebMCP nativo (Canary)" },
  polyfill: { tone: "warn", short: "Polyfill", full: "Polyfill MCP-B (compat)" },
  unavailable: { tone: "idle", short: "Offline", full: "Nessun agente collegato" },
};

function relayInfo(
  relay: boolean,
  variant: RelayVariant,
  state: RelayState,
): StatusInfo & { title: string } {
  if (!relay) {
    return {
      tone: "idle",
      short: "Off",
      full: "Relay disattivato",
      title: "Bridge a Claude Desktop disattivato. Click per abilitarlo (reload).",
    };
  }
  if (variant === "native-ws") {
    const tone: StatusInfo["tone"] =
      state === "open" ? "live"
      : state === "connecting" ? "warn"
      : "warn";
    return {
      tone,
      short: state === "open" ? "Live" : state,
      full: `Native WS · ${state}`,
      title:
        "Bridge nativo: la pagina parla direttamente con webmcp-local-relay via WebSocket.",
    };
  }
  if (variant === "polyfill-embed") {
    return {
      tone: "live",
      short: "CDN",
      full: "Embed CDN",
      title:
        "Bridge compat: l'embed @mcp-b/webmcp-local-relay è caricato da CDN sopra il polyfill.",
    };
  }
  return {
    tone: "warn",
    short: "No API",
    full: "Nessuna API WebMCP",
    title: "Relay richiesto ma nessuna API WebMCP è disponibile.",
  };
}

const TONE_DOT: Record<StatusInfo["tone"], string> = {
  live: "bg-emerald-400",
  warn: "bg-amber-400",
  idle: "bg-white/40",
};

export function Header({ connection, relay, relayVariant, relayState }: Props) {
  const reset = useCartStore((s) => s.reset);
  const conn = CONNECTION_INFO[connection];
  const rl = relayInfo(relay, relayVariant, relayState);
  const connPulse = conn.tone === "live";

  return (
    <header className="border-b border-lavazza-line">
      {/* Layer 2 — utility strip (navy, 40px) */}
      <div className="bg-coffee-dark text-white h-10 hidden md:flex items-center px-6">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-end gap-3">
          {/* WebMCP status pill */}
          <span
            title={conn.full}
            className="flex items-center gap-2 px-3 py-1 rounded-pill bg-white/[0.07] border border-white/10"
          >
            <span className="relative inline-flex h-2 w-2">
              {connPulse && (
                <span
                  className={`absolute inline-flex h-full w-full rounded-full opacity-60 ${TONE_DOT[conn.tone]} animate-ping`}
                />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${TONE_DOT[conn.tone]}`} />
            </span>
            <span className="text-[11px] tracking-[0.12em] uppercase">
              WebMCP <span className="opacity-60">·</span>{" "}
              <span className="font-semibold">{conn.short}</span>
            </span>
          </span>

          {/* Relay toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={relay}
            onClick={() => setRelayEnabled(!relay)}
            title={rl.title}
            className="group flex items-center gap-2.5 px-3 py-1 rounded-pill bg-white/[0.07] border border-white/10 hover:border-white/30 hover:bg-white/[0.12] transition"
          >
            <span className="text-[11px] tracking-[0.12em] uppercase">
              Relay <span className="opacity-60">·</span>{" "}
              <span className="font-semibold">{rl.short}</span>
            </span>
            <span
              className={`relative inline-block w-7 h-3.5 rounded-full transition ${
                relay ? "bg-coffee-accent" : "bg-white/20"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full shadow-sm transition-transform ${
                  relay ? "translate-x-3.5" : "translate-x-0"
                }`}
              />
            </span>
          </button>

          {/* Reset action */}
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-1 rounded-pill border border-white/20 hover:border-coffee-accent hover:text-coffee-accent transition text-[11px] tracking-[0.12em] uppercase font-semibold"
          >
            <span aria-hidden>↺</span>
            <span>Reset demo</span>
          </button>
        </div>
      </div>

      {/* Layer 3 — main brand bar (white, ~80px) */}
      <div className="bg-white px-4 md:px-6 h-16 md:h-20 flex items-center">
        <div className="max-w-7xl mx-auto w-full flex md:grid md:grid-cols-3 items-center">
          <div className="flex items-center gap-2.5 md:gap-3 md:justify-self-start">
            <img
              src="/brand/mark.webp"
              alt="Bella Roma"
              className="h-10 w-10 md:h-12 md:w-12 object-contain"
              decoding="async"
            />
            <div>
              <h1 className="font-display text-xl md:text-2xl font-bold text-lavazza-deep tracking-tight leading-none">
                Bella Roma
              </h1>
              <p className="hidden sm:block text-[10px] uppercase tracking-[0.2em] text-coffee-mid mt-1.5">
                Roma · Italia · 1962
              </p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-10 justify-self-center">
            <a
              href="#catalogo"
              className="text-sm font-bold uppercase tracking-wider text-lavazza-deep pb-1 border-b-2 border-coffee-accent"
            >
              Caffè
            </a>
            <a
              href="#"
              className="text-sm font-medium uppercase tracking-wider text-lavazza-deep hover:text-coffee-accent transition"
            >
              Abbonamenti
            </a>
            <a
              href="#"
              className="text-sm font-medium uppercase tracking-wider text-lavazza-deep hover:text-coffee-accent transition"
            >
              Promozioni
            </a>
            <a
              href="#"
              className="text-sm font-medium uppercase tracking-wider text-lavazza-deep hover:text-coffee-accent transition"
            >
              Stories
            </a>
          </nav>
          <div className="justify-self-end" />
        </div>
      </div>
    </header>
  );
}

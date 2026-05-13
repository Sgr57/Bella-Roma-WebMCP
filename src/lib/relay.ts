import { buildTools } from "./webmcp";
import type { WebMCPMode } from "./polyfill";

const EMBED_SRC =
  "https://cdn.jsdelivr.net/npm/@mcp-b/webmcp-local-relay@latest/dist/browser/embed.js";

export type RelayVariant = "native-ws" | "polyfill-embed" | "off";

export function isRelayEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("relay") === "true";
}

export function setRelayEnabled(enabled: boolean): void {
  const url = new URL(window.location.href);
  if (enabled) url.searchParams.set("relay", "true");
  else url.searchParams.delete("relay");
  window.location.href = url.toString();
}

export function pickRelayVariant(mode: WebMCPMode): RelayVariant {
  if (mode === "native") return "native-ws";
  if (mode === "polyfill") return "polyfill-embed";
  return "off";
}

function loadRelayEmbed(): void {
  // Non usare `data-webmcp-relay` sullo <script>: l'embed lo legge come
  // selettore per il proprio iframe e farebbe early-return (bug subdolo).
  if (document.querySelector(`script[data-webmcp-embed-loader]`)) return;
  const s = document.createElement("script");
  s.src = EMBED_SRC;
  s.async = false;
  s.dataset.webmcpEmbedLoader = "true";
  document.body.appendChild(s);
}

export async function connectRelay(
  mode: WebMCPMode,
): Promise<{ variant: RelayVariant; stop: () => void }> {
  const variant = pickRelayVariant(mode);
  if (variant === "native-ws") {
    const { startRelayClient } = await import("./relay-client");
    const stop = startRelayClient(buildTools());
    return { variant, stop };
  }
  if (variant === "polyfill-embed") {
    loadRelayEmbed();
    return { variant, stop: () => {} };
  }
  return { variant: "off", stop: () => {} };
}

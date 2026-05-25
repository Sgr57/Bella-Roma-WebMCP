import { buildTools } from "./webmcp";
import type { WebMCPMode } from "./polyfill";

// Self-hosted MCP Apps-patched embed (Phase 3). The npm/jsdelivr version of
// @mcp-b/webmcp-local-relay/dist/browser/embed.js does not yet forward
// resources/* between the browser polyfill and the relay; we vendor the
// patched build from Sgr57/webmcp-fork:feature/resources-forwarding into
// public/webmcp/embed.js. Source: packages/webmcp-local-relay/dist/browser/
// embed.js in the fork. Re-sync by running:
//   cp ~/Projects/webmcp-fork/packages/webmcp-local-relay/dist/browser/embed.js public/webmcp/embed.js
const EMBED_SRC = "/webmcp/embed.js";

export type RelayVariant = "native-ws" | "polyfill-embed" | "off";

// Default: relay attivo. Si disattiva esplicitamente con `?relay=false`.
// Vecchi URL con `?relay=true` continuano a funzionare (sono != "false").
export function isRelayEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("relay") !== "false";
}

export function setRelayEnabled(enabled: boolean): void {
  const url = new URL(window.location.href);
  if (enabled) url.searchParams.delete("relay");
  else url.searchParams.set("relay", "false");
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

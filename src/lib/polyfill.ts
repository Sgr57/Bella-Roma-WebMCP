export type WebMCPMode = "native" | "polyfill" | "unavailable";

function detectKind(mc: object): "native" | "polyfill" {
  // Polyfill @mcp-b/global espone l'API estesa (provideContext, clearContext,
  // listTools, callTool, …). Lo spec W3C ha solo registerTool sul prototype.
  // Inoltre il constructor del polyfill è "BrowserMcpServer", la nativa
  // di Chrome è "ModelContext".
  if (mc.constructor?.name === "ModelContext") return "native";
  if ("provideContext" in mc || "callTool" in mc) return "polyfill";
  return "native";
}

export async function ensureWebMCP(): Promise<WebMCPMode> {
  if (typeof window === "undefined") return "unavailable";
  const existing = (window.navigator as { modelContext?: object }).modelContext;
  if (existing) return detectKind(existing);
  try {
    await import("@mcp-b/global");
    const installed = (window.navigator as { modelContext?: object }).modelContext;
    if (installed) return detectKind(installed);
    return "unavailable";
  } catch (err) {
    console.warn("[webmcp] polyfill load failed:", err);
    return "unavailable";
  }
}

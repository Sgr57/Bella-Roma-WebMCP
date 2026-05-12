export type WebMCPMode = "native" | "polyfill" | "unavailable";

export async function ensureWebMCP(): Promise<WebMCPMode> {
  if (typeof window === "undefined") return "unavailable";
  if ("modelContext" in window.navigator) {
    return "native";
  }
  try {
    await import("@mcp-b/global");
    if ("modelContext" in window.navigator) {
      return "polyfill";
    }
    return "unavailable";
  } catch (err) {
    console.warn("[webmcp] polyfill load failed:", err);
    return "unavailable";
  }
}

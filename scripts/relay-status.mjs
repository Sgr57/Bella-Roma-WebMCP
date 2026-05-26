#!/usr/bin/env node
// Quick CLI to check which browser sources are currently connected to the
// local WebMCP relay. Uses the relay's built-in `webmcp-discovery.v1`
// WebSocket subprotocol — same one client-mode relays use to discover
// the server-mode relay's sources. No relay patches required.
//
// Usage:
//   node scripts/relay-status.mjs           # default 127.0.0.1:9333
//   WEBMCP_RELAY_PORT=9334 node scripts/relay-status.mjs
//   npm run relay:status                    # via package.json script

const HOST = process.env.WEBMCP_RELAY_HOST ?? "127.0.0.1";
const PORT = Number(process.env.WEBMCP_RELAY_PORT ?? 9333);
const TIMEOUT_MS = 3000;

const url = `ws://${HOST}:${PORT}`;

const ws = new WebSocket(url, ["webmcp-discovery.v1"]);

const timeout = setTimeout(() => {
  console.error(`✗ Timeout connecting to relay at ${url}`);
  console.error(`  Is Claude Desktop running with the patched relay?`);
  process.exit(2);
}, TIMEOUT_MS);

let serverHello = null;
let resolved = false;

ws.addEventListener("open", () => {
  ws.send(JSON.stringify({ type: "relay/hello" }));
  ws.send(JSON.stringify({ type: "relay/list-tools" }));
});

ws.addEventListener("error", () => {
  clearTimeout(timeout);
  console.error(`✗ Cannot reach relay at ${url}`);
  console.error(`  Is Claude Desktop running? Is the patched relay binary configured?`);
  process.exit(2);
});

ws.addEventListener("message", (ev) => {
  let msg;
  try {
    msg = JSON.parse(String(ev.data));
  } catch {
    return;
  }
  if (msg.type === "server-hello") {
    serverHello = msg;
    return;
  }
  if (msg.type === "relay/tools" && !resolved) {
    resolved = true;
    clearTimeout(timeout);
    render(serverHello, msg);
    ws.close();
    process.exit(0);
  }
});

function render(hello, snapshot) {
  const label = hello?.label ?? "(unlabeled)";
  const host = `${hello?.host ?? HOST}:${hello?.port ?? PORT}`;
  console.log(`Relay: ${label} @ ${host}`);
  console.log(`Service: ${hello?.service ?? "unknown"} v${hello?.version ?? "?"}`);
  if (hello?.workspace) console.log(`Workspace: ${hello.workspace}`);
  console.log("");

  const sources = snapshot.sources ?? [];
  if (sources.length === 0) {
    console.log("✗ No browser tabs connected.");
    console.log("");
    console.log("  Open a WebMCP-enabled site (e.g. https://bella-roma-web*.vercel.app/)");
    console.log("  in your browser to register tools.");
    return;
  }

  console.log(`✓ ${sources.length} connected source${sources.length === 1 ? "" : "s"}:`);
  console.log("");
  for (const s of sources) {
    const title = s.title ? ` — ${s.title}` : "";
    console.log(`  • ${s.origin ?? "(no origin)"}${title}`);
    if (s.url) console.log(`    url:   ${s.url}`);
    console.log(`    tools: ${s.toolCount ?? 0}`);
    if (s.sourceId) console.log(`    id:    ${String(s.sourceId).slice(0, 12)}…`);
    if (s.connectedAt) {
      const ageSec = Math.round((Date.now() - s.connectedAt) / 1000);
      console.log(`    since: ${ageSec}s ago`);
    }
    console.log("");
  }

  const tools = snapshot.tools ?? [];
  if (tools.length > 0) {
    console.log(`Tools (${tools.length}):`);
    for (const t of tools) console.log(`  - ${t.name}`);
  }
}

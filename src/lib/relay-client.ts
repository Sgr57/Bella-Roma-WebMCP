import type { Tool, ToolResult } from "./webmcp";
import { RELAY_WS_URL } from "./relay-config";

export type RelayState = "idle" | "connecting" | "open" | "closed" | "error";

const RELAY_URL = RELAY_WS_URL;
const INITIAL_RECONNECT_MS = 2000;
const MAX_RECONNECT_MS = 30000;

const listeners = new Set<(s: RelayState) => void>();
let currentState: RelayState = "idle";

function setState(s: RelayState): void {
  if (s === currentState) return;
  currentState = s;
  for (const l of listeners) l(s);
}

export function getRelayState(): RelayState {
  return currentState;
}

export function onRelayState(l: (s: RelayState) => void): () => void {
  listeners.add(l);
  l(currentState);
  return () => {
    listeners.delete(l);
  };
}

type FakeClient = {
  requestUserInteraction: <T>(cb: () => Promise<T> | T) => Promise<T>;
};

function serializeTool(t: Tool) {
  const out: {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    _meta?: Record<string, unknown>;
  } = {
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  };
  // Forward MCP Apps `_meta` (e.g. `ui.resourceUri`) on the native-WS path
  // so hosts can mount the matching widget. This mirrors the polyfill-embed
  // path's `_meta` preservation through `getToolInfos`.
  if (t._meta) out._meta = t._meta;
  return out;
}

async function dispatch(
  tools: Tool[],
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const tool = tools.find((t) => t.name === toolName);
  if (!tool) {
    return {
      content: [{ type: "text", text: `Tool "${toolName}" non trovato.` }],
      isError: true,
    };
  }
  const fakeClient: FakeClient = {
    requestUserInteraction: async (cb) => cb(),
  };
  try {
    return await tool.execute(args ?? {}, fakeClient);
  } catch (e) {
    return {
      content: [{ type: "text", text: `Errore: ${(e as Error).message}` }],
      isError: true,
    };
  }
}

export function startRelayClient(tools: Tool[]): () => void {
  let ws: WebSocket | null = null;
  let stopped = false;
  let reconnectMs = INITIAL_RECONNECT_MS;
  let reconnectHandle: ReturnType<typeof setTimeout> | null = null;
  const tabId = crypto.randomUUID();

  const send = (msg: unknown) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };

  const scheduleReconnect = () => {
    if (stopped) return;
    if (reconnectHandle) return;
    reconnectHandle = setTimeout(() => {
      reconnectHandle = null;
      connect();
    }, reconnectMs);
    reconnectMs = Math.min(reconnectMs * 2, MAX_RECONNECT_MS);
  };

  const onMessage = async (ev: MessageEvent) => {
    let msg: { type: string; [k: string]: unknown };
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    switch (msg.type) {
      case "server-hello": {
        send({
          type: "hello",
          tabId,
          origin: location.origin,
          url: location.href,
          title: document.title,
        });
        send({
          type: "tools/list",
          tools: tools.map(serializeTool),
        });
        break;
      }
      case "hello/accepted":
        setState("open");
        reconnectMs = INITIAL_RECONNECT_MS;
        break;
      case "hello/rejected":
        console.warn(
          "[relay-client] hello rejected:",
          msg.reason,
          msg.message,
        );
        stopped = true;
        ws?.close();
        setState("error");
        break;
      case "ping":
        send({ type: "pong" });
        break;
      case "invoke": {
        const callId = msg.callId as string;
        const toolName = msg.toolName as string;
        const args = (msg.args as Record<string, unknown>) ?? {};
        const result = await dispatch(tools, toolName, args);
        send({ type: "result", callId, result });
        break;
      }
      case "reload":
        window.location.reload();
        break;
      default:
        break;
    }
  };

  const connect = () => {
    if (stopped) return;
    setState("connecting");
    try {
      ws = new WebSocket(RELAY_URL);
    } catch (e) {
      console.warn("[relay-client] connect failed:", e);
      setState("error");
      scheduleReconnect();
      return;
    }
    ws.addEventListener("message", onMessage);
    ws.addEventListener("close", () => {
      if (!stopped) {
        setState("closed");
        scheduleReconnect();
      }
    });
    ws.addEventListener("error", () => {
      setState("error");
    });
  };

  connect();

  return () => {
    stopped = true;
    if (reconnectHandle) {
      clearTimeout(reconnectHandle);
      reconnectHandle = null;
    }
    ws?.close();
    ws = null;
    setState("idle");
  };
}

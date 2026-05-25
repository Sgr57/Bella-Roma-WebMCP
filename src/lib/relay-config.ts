/**
 * Single source of truth for the local WebMCP relay endpoint.
 *
 * In dev, the relay is started via the Claude Desktop config and listens on
 * `127.0.0.1:9333`. In Vercel preview / production no relay runs, and the
 * relay-client path becomes inert (the WebSocket simply fails to connect).
 *
 * Both `relay-client.ts` (the WebSocket origin) and `webmcp.ts` (the widget
 * iframe CSP `connectDomains`) must agree on this host/port — hence the
 * single constants block here.
 */

export const RELAY_HOST = "127.0.0.1";
export const RELAY_PORT = 9333;
export const RELAY_WS_URL = `ws://${RELAY_HOST}:${RELAY_PORT}`;
export const RELAY_HTTP_URL = `http://${RELAY_HOST}:${RELAY_PORT}`;

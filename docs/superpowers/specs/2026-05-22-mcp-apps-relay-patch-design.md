# MCP Apps `ui://` Widget Rendering — Investigation & Plan

> **Status:** checkpoint, 2026-05-25 (decisions answered, Phase 1 ready to dispatch). Investigation phase complete; implementation NOT started.
> **Latest decisions:**
>   - 2026-05-22: user chose option A (patch the relay + polyfill) over C+D (accept gap + wait).
>   - 2026-05-25 (am): scope expanded — target is **WebMCP + MCP Apps coexistence** across **all MCP-Apps-capable clients** (not Claude Desktop Chat alone). See [Scope update (2026-05-25)](#scope-update-2026-05-25).
>   - 2026-05-25 (pm): pre-Phase-0 verification confirmed plan is still valid. See [Pre-Phase-0 verification (2026-05-25)](#pre-phase-0-verification-2026-05-25).
>   - 2026-05-25 (pm): **Q7 = (a)** npm fork only, no parallel upstream PR. **Q8 = (b)** SKIP Phase 0 validation gate. **Q9 = (a)** target spec stable 2026-01-26. See [Decisions answered (2026-05-25)](#decisions-answered-2026-05-25).
> **Next session resume here:** dispatch Phase 1 (fork relay) — Phase 0 skipped per Q8=(b).

---

## TL;DR

BellaRoma WebMCP renders beautifully in Claude Desktop **Cowork** tab today (status quo on `main`, via `resource_link` + jsdelivr CDN auto-composed into an MCP App card by the model's internal `show_widget` capability). Same payload in Claude Desktop **Chat** tab collapses to a "Show Image" click-to-view widget — the actual UX gap we want to close.

The only spec-compliant path to inline rich rendering in Chat is the official **MCP Apps** extension: declare `_meta.ui.resourceUri` on tool definitions and expose `resources/list` / `resources/read` server-side. The mcp-b local-relay BellaRoma uses (`@mcp-b/webmcp-local-relay`) does NOT forward `resources/*` calls, and the browser polyfill (`@mcp-b/webmcp-polyfill`) does NOT expose `listResources`/`readResource` on `navigator.modelContext`. Closing both gaps requires forking two packages and modifying `claude_desktop_config.json` to point at the forks.

Cost estimate: **~2 working days + ongoing fork maintenance**, BUT with material risk that Chat tab does not yet have MCP Apps rendering enabled at all (per-tab rollout — Code received it only 2026-05-08). A **Phase 0 validation gate** (~4 hours, standalone stub server) is proposed to de-risk before sinking the full investment.

> 2026-05-25 note: per-tab risk on Claude Desktop Chat remains, but ROI no longer depends on it — see scope update below. Eight clients now in the target surface, including ChatGPT and Cursor.

---

## Scope update (2026-05-25)

Three discoveries shifted the framing of this work between the 2026-05-22 checkpoint and 2026-05-25:

### 1. MCP Apps client surface is much wider than expected

Per the official matrix at [modelcontextprotocol.io/extensions/client-matrix](https://modelcontextprotocol.io/extensions/client-matrix), MCP Apps is supported by **8 hosts**, not just Claude Desktop. ROI is no longer "Claude Desktop Chat parity" — it's a portable rendering layer.

| Client | MCP Apps | Notes |
|---|:---:|---|
| Claude (web) | ✅ | Auto-composes cards today via `resource_link`; widget rendering on top |
| Claude Desktop — Cowork | ✅ | Confirmed empirically 2026-05-22 |
| Claude Desktop — Code | ✅ | Since v1.6889.0 (2026-05-08) |
| Claude Desktop — Chat | ❓ | Per-tab rollout uncertain — Phase 0 validates |
| **ChatGPT** | ✅ | First-party via OpenAI "Apps SDK" / "MCP Apps in ChatGPT" |
| **Cursor** | ✅ | Per official matrix |
| VS Code GitHub Copilot | ✅ | Per official matrix |
| Goose | ✅ | Per official matrix |
| Postman | ✅ | Per official matrix |
| MCPJam | ✅ | Per official matrix |
| **Gemini** | ❌ | Supports MCP protocol but NOT the Apps extension. Widgets won't mount; tools work text-only. |

### 2. WebMCP and MCP Apps coexist, not compete

They're complementary layers, not alternatives:

- **WebMCP** (existing): how the browser exposes tools (`navigator.modelContext.registerTool` → relay → host). **Unchanged.**
- **MCP Apps** (to add): rendering extension layered on top. Selected tools declare `_meta.ui.resourceUri` and serve HTML via `resources/read`.

```
Browser (BellaRoma SPA)
  ├─ navigator.modelContext.registerTool(...)         ← WebMCP, today
  └─ navigator.modelContext.resources.register(...)   ← MCP Apps, to add (polyfill patch)
       │
       │ WS (mcp-b protocol + new resources/* messages)
       ▼
  webmcp-local-relay (stdio)
       │  tools/*  (existing)
       │  resources/*  (patched)
       ▼
  Host (Claude / ChatGPT / Cursor / Copilot / ...) — mounts sandboxed iframe
       │  postMessage ↔ widget (JSON-RPC dialect)
       ▼
  ui:// widget HTML — calls tools/call back through host
```

The widget invokes existing BellaRoma tools (`add_to_cart`, `get_cart`, ...) via postMessage → host routes via `tools/call` → relay → polyfill → WebMCP tool implementation already in `src/lib/webmcp.ts`. **No execution path changes for existing tools.**

### 3. No new backend required

The HTML for each widget is **static** (bundled with the SPA). The MCP-server role that hosts `resources/list` / `resources/read` is already filled by the existing `webmcp-local-relay` + polyfill; the patch just adds `resources/*` forwarding alongside the existing `tools/*`. No Express server, no DB, no new HTTP endpoints. Dynamic data flows through postMessage → `tools/call` → existing WebMCP tools.

### Tool-by-tool plan (drives Phase 3)

Of the 10 tools in `src/lib/webmcp.ts`, only the 3 that benefit from rich rendering get `_meta.ui.resourceUri`. The others stay text-only and are invoked **by the widgets** via postMessage:

| Tool | Widget? | Widget purpose | Invoked by |
|---|:---:|---|---|
| `search_products` | ✅ | Product grid / carousel with click-to-add | Model |
| `get_product` | ✅ | Card: image + details + size/milk/sweetness configurator + live price | Model |
| `get_cart` | ✅ | Live cart: stepper, remove row, coupon input, totals | Model |
| `add_to_cart` | ❌ | — | Model **and** widgets |
| `remove_from_cart` | ❌ | — | Model **and** widgets |
| `apply_coupon` | ❌ | — | Model **and** widgets |
| `remove_coupon` | ❌ | — | Model **and** widgets |
| `clear_cart` | ❌ | — | Model **and** widgets |
| `checkout` | ❌ | (already uses `checkout-bridge.ts` for confirm UI) | Model |
| `show_product_image` | — | DEPRECATED once `get_product` ships; keep as fallback for non-MCP-Apps clients during transition, then remove |

### Fallback graceful (zero-regression requirement)

Every tool with `_meta.ui.resourceUri` MUST also return `text` + (where applicable) `resource_link` content blocks. Clients without MCP Apps support (Gemini today; any future host) get the current text/CDN-image experience unchanged. **Zero-regression on non-MCP-Apps clients is a hard merge requirement.**

---

## Pre-Phase-0 verification (2026-05-25)

Before answering Q7/Q8 and dispatching Phase 0, verified all moving pieces. **Plan stands; no scope or strategy changes required, but a few details to fold into Phase 1–3.**

### Installed vs latest (all already at latest)

| Package | Installed | Latest npm | Notes |
|---|---|---|---|
| `@mcp-b/webmcp-local-relay` | 2.3.2 (npx cache `894e1749ce338fed`) | **2.3.2** (2026-05-12) | Claude Desktop config invokes `npx -y @latest` |
| `@mcp-b/webmcp-polyfill` | 2.3.2 (`node_modules`) | **2.3.2** | — |
| `@mcp-b/global` | 2.3.2 (declared in `package.json`) | 2.3.2 | — |

Confirms the fork target is exactly the bundle audited in the original plan (`dist/mcpRelayServer-BL8kNwIK.mjs`, 2144 lines).

### Upstream WebMCP-org/npm-packages — no `resources/*` work

Last push 2026-05-24, but every PR/issue since 2026-05-12 is dependabot or unrelated.

- **PR #198** (merged 2026-05-07) — *"track April 23 2026 WebMCP draft"*: only adds `AbortSignal` to `registerTool`, deprecates `unregisterTool`, adds `ToolAnnotations.untrustedContentHint`. **No resources/\* support.**
- **PR #207** (open) — extension-tools Zod contracts. Irrelevant.
- **Issue #209** — `prepack` regression in 2.3.0/2.3.1 but on `@mcp-b/chrome-devtools-mcp`, NOT `@mcp-b/webmcp-local-relay@2.3.x`. Not a blocker for us. Mentioned here so it isn't mistakenly conflated.
- GitHub search across `ui://`, `resources/list`, `resources/read`, `readResource`, `listResources`: **0 results**. The gap is intact.

Implication: **no point waiting for upstream**. Q7 hybrid (a+c) still the right call; the (c) PR is greenfield work, not joining an existing thread.

### MCP Apps spec — 3 releases since 2026-01-26 (stable), draft diverged

Stable (`specification/2026-01-26/apps.mdx`) is **59,181 bytes**; draft (`specification/draft/apps.mdx`) is **89,256 bytes** (+50%). Six releases since: 1.5.0 → 1.6.0 → 1.7.0 → 1.7.1 → 1.7.2 (2026-05-15).

**Confirmations (plan unchanged):**
- HTML content delivery REMAINS exclusively via `resources/read`. No inline/embedded path added. B' would still fail. **Fork is unavoidable.**
- `_meta.ui.resourceUri` (nested) is the canonical form; flat `_meta["ui/resourceUri"]` is officially deprecated. The plan already uses the right form.

**New items to fold into impl phases:**
- **`_meta.ui.visibility: Array<"model" | "app">`** — controls whether a tool appears in the agent's tool list, the App's internal surface, or both. Phase 3 should decide per-tool. Default (omitted) ≡ visible to both, which is what BellaRoma wants for `search_products` / `get_product` / `get_cart`.
- **Optional `resources/list`** — spec now says *"Servers MAY omit UI-only resources from `resources/list`"* since discovery is via `_meta.ui.resourceUri` in tool metadata. **Possible Phase 1 simplification:** relay could implement only `resources/read` and skip `resources/list` plumbing. Reduces patch size; revisit if any client requires `resources/list` to populate its app catalog.
- **New sections in draft** (App-Provided Tools, Display Modes, Theming, Container Dimensions, Sandbox Proxy, `ui/download-file`) — not needed for our minimal flow. Display Modes (inline/fullscreen/pip) is interesting future polish for product-card / cart-panel but out of scope for first ship.

**Open sub-decision for Phase 0 (Q9 below):** target spec version. Probe stub should follow whichever the hosts implement. Stable 2026-01-26 is safer first attempt; draft features (`visibility`, sandbox-proxy semantics) only relevant if Phase 0 reveals a host that needs them.

### Claude Desktop Chat tab — still unconfirmed

Latest Claude Desktop release is **1.7196.0** (2026-05-12). Changelog scanned through this build:
- 1.6889.0 (2026-05-08) added MCP App widget rendering in **Code tab**. No Chat tab mention.
- 1.7196.0 (2026-05-12) added no MCP-related entries.
- No release between 2026-05-12 and 2026-05-25 (13 days of silence).

**Chat tab MCP Apps rendering remains untested empirically and unannounced in the changelog.** Per-tab rollout pattern means we still cannot assume Chat will render. **Phase 0 validation gate is more justified than ever — Q8 = (a) recommendation rests on hard ground.**

### Net effect on plan

| Item | Status |
|---|---|
| Option A (fork relay + polyfill) | ✅ Confirmed. No shortcut, no upstream work to wait on. |
| Phase 0 validation gate | ✅ Even more justified — Chat tab still uncertain |
| Phase 1 patch scope | Possible minor simplification: skip `resources/list`, implement only `resources/read` (spec allows) |
| Phase 3 per-tool decoration | Add `_meta.ui.visibility` consideration to tool-by-tool table |
| Q7 (fork strategy) | Unchanged. Hybrid (d) still recommended; no upstream thread to join. |
| Q8 (validation gate) | Unchanged. (a) strongly recommended. |
| **New Q9** | Target spec version: stable 2026-01-26 (safer) vs draft (more features). Default to stable for Phase 0 probe; reassess if any host requires draft features. |

---

## Decisions answered (2026-05-25)

The user closed the three open decisions in the late-afternoon checkpoint:

| # | Decision | Choice | Rationale / consequences |
|---|---|---|---|
| Q7 | Fork strategy | **(a)** npm fork only — publish `@sgra57/webmcp-local-relay` + `@sgra57/webmcp-polyfill`, point `claude_desktop_config.json` at them. Upstream PR deferred until **after** end-to-end test cycle (Phase 4) completes. Not in parallel. | Slightly less elegant than the (d) hybrid recommendation, but avoids opening an upstream thread we can't yet defend with empirical "it works on N hosts" evidence. Phase 6 becomes sequential, not parallel. |
| Q8 | Phase 0 validation gate | **(b)** SKIP — go directly to Phase 1. | User accepts the risk that Chat tab may not render. ROI is mitigated by the 2026-05-25 (am) scope expansion: even if Chat tab fails, value remains across the other 7 MCP-Apps hosts (Cowork, Code, ChatGPT, Cursor, Copilot, Goose, Postman/MCPJam). Phase 0 stub work is dropped. |
| Q9 | Target spec version | **(a)** Stable `2026-01-26`. | Implement the canonical `resources/list` + `resources/read` + `_meta.ui.resourceUri` (nested) path. No draft-only features (`visibility`, `download-file`, sandbox-proxy) in v1. Revisit only if a Phase 4 host turns out to require them. |

### Implications for the implementation phases

- **Phase 0 — SKIPPED.** Section retained below for reference but not executed.
- **Phase 1 — STARTS NEXT.** Fork strategy = npm-publish, no parallel upstream work. Target spec = stable 2026-01-26 only.
- **Phase 4 (E2E validation) — promoted to risk-bearing gate.** Without a Phase 0 stub probe, Phase 4 is the first empirical confirmation that anything renders. The Phase 4 decision matrix already covers the outcomes (priority tier all ✅ / ≥3 of 5 / only some / nothing) — no change required.
- **Phase 6 (upstream contribution) — sequenced AFTER Phase 4, not in parallel with Phase 1.** Open the upstream PR only once the fork has empirical "works on N clients" evidence to defend. If Phase 4 reveals broken hosts, fix in-fork first, then upstream the validated patch.

### What the next session does

1. Skip directly to Phase 1: fork `@mcp-b/webmcp-local-relay`.
2. Implement the relay-side `resources/list` + `resources/read` forwarding (spec 2026-01-26).
3. Phase 2 right after: fork `@mcp-b/webmcp-polyfill`, add `navigator.modelContext.resources` namespace.
4. Phase 3: BellaRoma integration of 3 widgetized tools.
5. Phase 4: multi-client validation (this IS the gate now).
6. Phase 5: merge / shelf decision per existing matrix.
7. Phase 6: upstream PR after Phase 4 if it succeeded.

---

## Goal

Enable inline rich widget rendering for BellaRoma products in **Claude Desktop Chat tab** — parity with what Cowork already provides — using the MCP Apps spec `ui://` resources path.

Secondary goal: unlock truly interactive widgets (buttons that call tools back via postMessage → `tools/call`, e.g., a working "Aggiungi al carrello" button), across all surfaces that support MCP Apps.

---

## Background — Surface matrix

| Surface | `resource_link` + CDN image | MCP Apps `ui://` rendering |
|---|---|---|
| claude.ai web | ✅ auto-composes rich card | ✅ |
| Desktop **Chat** tab | ❌ collapses to "Show Image" click-to-view | ❓ unknown, likely no (untested empirically; per-tab rollout) |
| Desktop **Cowork** tab | ✅ model invokes internal `show_widget` → rich inline card | ✅ |
| Desktop **Code** tab | ❓ | ✅ since v1.6889.0 (2026-05-08, per changelog) |

Per-tab rollout pattern (Code received MCP Apps rendering only on 2026-05-08) suggests Anthropic is enabling these features tab-by-tab. Chat may or may not have MCP Apps rendering enabled today.

See also: `~/.claude/projects/-Users-emanuele-Projects-BellaRoma/memory/claude-desktop-image-rendering-limit.md` for the canonical state of empirical findings.

---

## What we tested this session — probe B' (failed)

### Hypothesis

If a tool returns an embedded resource content block inside the `tools/call` result — i.e.

```json
{
  "content": [{
    "type": "resource",
    "resource": {
      "uri": "ui://bellaroma/product-card/cappuccino",
      "mimeType": "text/html;profile=mcp-app",
      "text": "<html>...rich card HTML...</html>"
    }
  }]
}
```

— Claude Desktop's renderer might mount it as an MCP App widget WITHOUT requiring the server to expose `resources/list`/`resources/read`. If true, this bypasses the relay limitation entirely.

### Setup

Branch: `experiment/mcp-app-embedded-resource`
Preview URL: `https://bella-roma-web-mcp-git-experiment-98a4f9-sgra57-8128s-projects.vercel.app/`
Tool added: `show_product_widget` (parallel to existing `show_product_image`, status quo untouched).

Widget HTML included **two unmistakable visual markers**:
- Magenta `#ff00aa` solid background on the body
- Blue `#0044ff` text on title/description/metadata
- Corner debug pill: `🧪 show_product_widget`

If Claude rendered our HTML, all three would have been visible. If Claude auto-composed its own card, none would appear.

### Variants tested

| Variant | SHA | Image delivery | Payload size | Result |
|---|---|---|---|---|
| V1 | `e989843` | base64 data URI inlined (~20KB) | ~22KB total | ❌ none of magenta/blue/badge visible — Claude auto-composed |
| V2 | `09a0690` | `<img src="https://cdn.jsdelivr.net/.../cappuccino.webp">` | ~3KB total | ❌ same — Claude auto-composed |

### Empirical conclusion

The embedded `type: "resource"` content block with `mimeType: "text/html;profile=mcp-app"` is **silently dropped by Claude Desktop's renderer in Cowork**, regardless of payload size. Claude falls back to auto-composing its own card from the surrounding textual content of the tool response (which is why the Cowork card looked good — it's pulling structured data from the tool response, but NOT our HTML).

Side-observation from the negative result: Cowork's auto-composed card is still mounted in an `mcp_apps` iframe (visible from the "📶 WebMCP" host-chrome pill in the top-right corner of the rendered card). The renderer IS willing to allocate a widget iframe for our tool output — it just refuses to populate it from an embedded resource block. The only way to populate it with our HTML is the spec-compliant `_meta.ui.resourceUri` + `resources/read` path.

### Status of the experiment branch

Preserved on remote as evidence trail. **DO NOT MERGE.** The `show_product_widget` tool exists but is a dead-end implementation. Useful to keep for future "did anyone try X" questions, or to delete after this design doc lands in main.

---

## Research findings (also from this session)

### MCP Apps spec (version 2026-01-26, official extension)

**Source:** `https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx`

- HTML for a widget is delivered **only** via `resources/read`. There is NO supported inline-in-tool-result variant (confirmed empirically above; spec explicit: *"Content MUST be provided via either `text` (string) or `blob` (base64-encoded)"* in the `resources/read` response).
- Tool declaration (in `tools/list`) must carry `_meta.ui.resourceUri = "ui://..."`.
- Resource MIME type: **`text/html;profile=mcp-app`** (not plain `text/html`).
- CSP default for the iframe is restrictive:

  ```
  default-src 'none';
  script-src 'self' 'unsafe-inline';
  style-src  'self' 'unsafe-inline';
  img-src    'self' data:;
  connect-src 'none';
  ```

  Allow external hosts via `_meta.ui.csp` on the resource: `resourceDomains` for img/script/style/font sources, `connectDomains` for fetch/WS callbacks.
- Widget ↔ host comms over `postMessage` with JSON-RPC dialect. Widget can call back `tools/call` (relayed by host to the MCP server). Methods like `ui/initialize`, `ui/notifications/tool-input`, `ui/notifications/tool-result`, `ui/message`.
- Official SDK: `@modelcontextprotocol/ext-apps` (host + widget bindings).
- Example servers: `https://github.com/modelcontextprotocol/ext-apps/tree/main/examples` (React/Vue/Svelte/Solid/vanilla — no product-card example specifically; `budget-allocator-server` and `cohort-heatmap-server` are closest).

### Local relay (`@mcp-b/webmcp-local-relay@2.3.2`)

**Path on disk (npx cache):** `/Users/emanuele/.npm/_npx/894e1749ce338fed/node_modules/@mcp-b/webmcp-local-relay/`
**Invoked from:** `~/Library/Application Support/Claude/claude_desktop_config.json` via `npx -y @mcp-b/webmcp-local-relay@latest`
**Bundle:** `dist/mcpRelayServer-BL8kNwIK.mjs` (2144 lines, minified single-line but readable). CLI entry: `dist/cli.mjs`.

Architecture:
- Uses `@modelcontextprotocol/sdk@1.26.0` server inside.
- Registers handlers ONLY for `ListTools` (`:1711`) and `CallTool` (implicit via `mcpServer.registerTool(...)` at `:1722` static / `:2082` dynamic).
- NO handlers for `resources/*`, `prompts/*`, `logging/*`. These methods are not declared in `serverCapabilities`.
- WS protocol browser↔relay (`:449`, `:519`) only knows: `hello`, `tools/list`, `tools/changed`, `result`, `pong`, `elicitation-request` browser→relay; `invoke`, `ping`, `reload`, `server-hello`, `hello/accepted`, `hello/rejected`, `elicitation-response` relay→browser.
- No CLI flag for "transparent JSON-RPC passthrough". CLI accepts only `--host`, `--port`, `--widget-origin`, `--label`, `--relay-id`, `--workspace`.

Latest version (2.3.2) published 2026-05-12, no `resources/*` support in changelog.

### Browser polyfill (`@mcp-b/webmcp-polyfill`)

**Path:** `node_modules/@mcp-b/webmcp-polyfill/dist/index.js`
**Surface:** `navigator.modelContext.listTools()` / `callTool()` only. NO `listResources` / `readResource`.

Type definitions (`webmcp-types/dist/model-context.d.ts:221-293`):
- `ModelContextExtensions` has only `listTools` and `callTool`.
- `embedded resource` (in `common.d.ts:147`) appears only as a content-block discriminator inside a tool result, not as a resource provisioning API.

Implication: even if we patch the relay to forward `resources/*`, the browser-side has no API for the BellaRoma app to register `ui://` resources. We must invent that API (or fork the polyfill).

### Polyfill boundary stripping behavior

`normalizeToolDescriptor` does `...tool` spread (preserves arbitrary `_meta`), BUT `getToolInfos()` re-exports only `{name, description, inputSchema}` (file `node_modules/@mcp-b/webmcp-polyfill/dist/index.js:73-86`). So `_meta.ui.resourceUri` is stripped at the boundary the embed reads from in the `?relay=true` CDN path.

The custom WS relay client (`src/lib/relay-client.ts` in this repo) forwards `_meta` explicitly, so the hint survives ONLY through that path — not via the CDN-loaded embed. Need to confirm during Phase 3 whether this matters.

---

## Decision history this session

| Option | Description | Verdict |
|---|---|---|
| **B'** (embedded resource) | Cheap shortcut, no relay patch | ❌ tested, failed in both 22KB and 3KB variants |
| **C** (accept gap) | Lightly clean Chat payload, document Cowork-only | Recommended (still on table if A fails) |
| **D** (wait & watch) | Monitor Anthropic changelog for Chat enablement | Recommended as companion to C |
| **A** (full patch) | Fork relay + polyfill, implement `ui://` properly | ✅ Chosen by user 2026-05-22 |

---

## Proposed plan (option A)

### Phase 0 — Validation gate (~~CRITICAL~~ **SKIPPED — Q8=(b), 2026-05-25**)

> **Status: not executing.** User chose to accept the risk and go directly to Phase 1. Phase 4 is now the empirical gate. Section preserved below for reference only.

**Why this exists:** before sinking 2 days into forking two packages, prove empirically that Claude Desktop **Chat tab** will actually render an MCP Apps widget. If Chat does not render even the canonical case, A is wasted; revert to C+D.

**What to build:**
- Standalone MCP server, stdio transport, vanilla TypeScript (~150 LOC, zero `@mcp-b/*` deps).
- One tool, e.g., `show_probe_card`. Tool definition declares `_meta.ui.resourceUri = "ui://probe/card"`.
- Implements `resources/list` → returns `[{uri: "ui://probe/card", mimeType: "text/html;profile=mcp-app", name: "Probe card"}]`.
- Implements `resources/read` → returns HTML with magenta `#ff00aa` background, blue `#0044ff` text, a corner badge `🧪 probe-card-from-resources-read`.
- Register in `claude_desktop_config.json` as a stdio MCP server, e.g.:

  ```json
  "mcp-probe": {
    "command": "node",
    "args": ["/Users/emanuele/Projects/BellaRoma/probe-server/dist/index.js"]
  }
  ```

  (Path TBD — could live under `tools/probe-server/` in this repo or as a standalone repo.)

**Test plan (multi-client, updated 2026-05-25):**

Run the same prompt — *"Use show_probe_card to display the probe card."* — fresh session each time, in each priority client. Record: did the renderer mount an iframe with our HTML? (Magenta bg + blue text + probe badge present = yes.)

Priority tier (run all):
1. **Claude Desktop — Chat tab** (the main rollout uncertainty)
2. **Claude Desktop — Cowork tab** (expected ✅; sanity check)
3. **Claude Desktop — Code tab** (expected ✅ since v1.6889.0)
4. **ChatGPT** (major user surface; OpenAI "Apps SDK")
5. **Cursor** (large dev audience)

Secondary tier (run if time permits, or after Phase 1 ships):
6. VS Code GitHub Copilot
7. Goose
8. Postman / MCPJam (mostly testing tools but in matrix)

For each client, capture: renders ✅ / fails ❌ / not reachable ⚠ (e.g., client doesn't accept stdio MCP servers). Note any client-specific registration friction.

**Decision gate (must be made at end of Phase 0):**

| Result | Action |
|---|---|
| Priority tier all ✅ | ✅ proceed Phase 1 with confidence — broad ROI confirmed |
| ≥3 of 5 priority clients ✅ (incl. ChatGPT or Cursor) | ✅ proceed Phase 1 — ship for the supported subset, document gaps |
| Only Claude Desktop Cowork/Code render | Discuss with user: marginal but interactive Cowork is still a real win; lean toward proceed |
| Only ChatGPT renders | Surprising but acceptable; large user base. Proceed |
| Nothing renders anywhere | ❌ MCP Apps broadly broken in 2026-05 builds. Shelf A, fall back to C+D, file bugs upstream |

**Hard rule:** do not proceed to Phase 1 without making this decision explicitly. Record the matrix outcome inline in this doc.

### Phase 1 — Fork the local relay (~1 day, ~80-120 LOC)

**What to fork:** `WebMCP-org/npm-packages` monorepo, package `@mcp-b/webmcp-local-relay`.

**Where to patch (in `dist/mcpRelayServer-BL8kNwIK.mjs` — or ideally in the source if upstream monorepo provides it):**

1. Add new WS message schemas:
   - browser→relay: `BrowserResourcesListMessageSchema`, `BrowserResourceReadResultSchema`
   - relay→browser: `RelayReadResourceMessageSchema`
   - Update unions at `:449` and `:519`.

2. In `LocalRelayMcpServer.constructor` (`:1625`):
   - Add capability `resources: {}` to server capabilities.
   - Register handlers:

     ```js
     this.mcpServer.server.setRequestHandler(ListResourcesRequestSchema, async () => {
       return { resources: await this.bridge.listResources() };
     });
     this.mcpServer.server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
       return await this.bridge.readResource(req.params.uri);
     });
     ```

3. In `RelayBridgeServer`:
   - Add `listResources()` and `readResource(uri)` methods, mirroring `invokeTool` (`:924`) with a `pendingResourceReads` map indexed by `callId` (separate from `pendingInvocations` to avoid namespace collision).
   - Add new cases in `onSocketMessage` (`:990`) for `resources/list` (cache by connection) and `resource-result`.

**Publishing:** see Q7 (open decision below).

**Risks (from agent assessment):**
- `npx -y @latest` in `claude_desktop_config.json` re-downloads upstream each launch → patch lost. Must pin to fork.
- Bundle is minified single-line if patching post-build; prefer forking the monorepo source.
- Capability handshake: if browser tab has no resources registered, `resources/list` returns `[]` — innocuous.
- `tools/changed` vs `resources/changed` ordering — implement `sendResourceListChanged()` alongside existing `sendToolListChanged()` (`:2068`).

### Phase 2 — Extend the browser polyfill (~4 hours, ~40-60 LOC)

**What to fork:** `@mcp-b/webmcp-polyfill` (same monorepo).

**What to add:**
- New `navigator.modelContext.resources` namespace with:
  - `register(uri: string, provider: () => Promise<{ text?: string; blob?: string; mimeType: string; meta?: any }>): void`
  - `unregister(uri: string): void`
- Plumb to the relay client (`embed.js` and/or this repo's `src/lib/relay-client.ts`) so:
  - On `tools/list` time, also send `resources/list` with registered URIs.
  - On incoming `resources/read` request from relay, call the matching provider and return result.
- Persist registry across page lifecycle (in-memory, no localStorage).

**Coexistence with existing `tools/list` & `callTool`:** sibling namespace, no interference.

### Phase 3 — BellaRoma integration (~4–6 hours, revised 2026-05-25)

Scope follows the tool-by-tool plan in [Scope update](#scope-update-2026-05-25): 3 widgets, 7 text-only tools unchanged.

1. In `src/lib/webmcp.ts`, add `_meta.ui.resourceUri` to the **three** chosen tools:
   - `search_products` → `ui://bellaroma/product-grid`
   - `get_product` → `ui://bellaroma/product-card/<id>` (or a single template URI parameterized at render time — decide during impl)
   - `get_cart` → `ui://bellaroma/cart-panel`
2. Register the corresponding resources via the new `navigator.modelContext.resources.register(...)` API (introduced by the polyfill patch in Phase 2). Each provider returns:
   - The widget HTML (product-card can start from the styled HTML on `experiment/mcp-app-embedded-resource` — rebrand from magenta debug to Bella Roma palette).
   - `_meta.ui.csp.resourceDomains` declaring `cdn.jsdelivr.net` for product images.
   - `_meta.ui.csp.connectDomains` declaring the relay origin for postMessage callbacks.
3. **Fallback graceful (hard requirement):** every widgetized tool's `execute()` returns BOTH the existing text/resource_link content blocks AND the `_meta.ui.resourceUri` hint. Clients without MCP Apps (Gemini, future hosts) see no change.
4. Widget interactivity — implement postMessage → `tools/call` for:
   - product-grid: "Aggiungi" button per card → `add_to_cart`
   - product-card: size/milk/sweetness controls, "Aggiungi" → `add_to_cart` with options
   - cart-panel: stepper → `add_to_cart`/`remove_from_cart`, coupon input → `apply_coupon`/`remove_coupon`, "Svuota" → `clear_cart`, "Checkout" → `checkout`
5. Cleanup:
   - Delete the failed-probe `show_product_widget` tool from `experiment/mcp-app-embedded-resource` (its purpose is documented in this doc; branch can be deleted after Phase 5 merge).
   - Mark `show_product_image` as deprecated in description but keep it for non-MCP-Apps clients; plan removal after one release cycle confirms no regressions.

### Phase 4 — End-to-end validation (~3–4 hours, revised 2026-05-25)

- Deploy to a new branch / new Vercel preview.
- Re-run the **Phase 0 client matrix** with the real BellaRoma widgets (not the probe stub) in priority order: Claude Desktop Chat/Cowork/Code, ChatGPT, Cursor. Secondary tier as time permits.
- For each client, validate:
  - Widget mounts and renders correctly (CSP allows jsdelivr image).
  - postMessage callbacks work end-to-end (click "Aggiungi" → cart state updates → next `get_cart` reflects it).
  - Configurator (size/milk/sweetness on `get_product`) computes prices correctly and adds with the right options.
  - Coupon flow on cart-panel works (BENVENUTO, STUDENTI).
  - Checkout flow works (interaction with existing `checkout-bridge.ts`).
- Validate fallback graceful: on **Gemini** (or any non-MCP-Apps client we can reach), confirm tools still respond with text/resource_link as before — no regression.
- A/B compare against `show_product_image` status quo where applicable.

### Phase 5 — Merge or shelf (revised 2026-05-25)

Decision matrix uses the Phase 4 multi-client outcome:

| Phase 4 outcome | Action |
|---|---|
| Priority tier (Claude Desktop tabs + ChatGPT + Cursor) all ✅ with interactivity | ✅ merge to `main`, announce broadly in README |
| ≥3 of 5 priority clients ✅ | ✅ merge, README documents the supported subset honestly |
| Only Claude Desktop Cowork/Code ✅ (Chat & ChatGPT fail) | Merge if the Cowork interactive demo justifies fork maintenance; otherwise shelf and revisit when ChatGPT/Chat enablement lands |
| Only ChatGPT ✅ | Surprising but acceptable; large surface. Merge |
| Mixed minor results without ChatGPT or Claude Desktop | Marginal. Likely shelf |
| Fallback graceful regresses on any client | ❌ block merge until fixed |
| Nothing meaningfully better than status quo | Revert, fork-on-ice until upstream merges (Phase 6) |

### Phase 6 — Upstream contribution (sequential after Phase 4, per Q7=(a) — 2026-05-25)

> **Re-sequenced:** originally proposed as parallel-with-Phase-1, the user chose to defer the upstream PR until **after** the end-to-end test cycle (Phase 4) demonstrates the patch works empirically across multiple hosts. Rationale: defend the PR with "validated on N clients" evidence rather than design intent alone.

Open PR to `WebMCP-org/npm-packages` proposing `resources/*` forwarding in the relay + `navigator.modelContext.resources` namespace in the polyfill. Reference the BellaRoma integration as the proving ground. If accepted, decommission the `@sgra57/...` fork. If rejected/stalled, maintain the fork indefinitely.

---

## Open decisions (RESUME HERE NEXT SESSION)

### Q7 — Fork strategy for relay + polyfill

Options:

- **a)** Hard fork published on npm as e.g. `@sgra57/webmcp-local-relay` and `@sgra57/webmcp-polyfill`. Update `claude_desktop_config.json` to invoke our package. Portable, reproducible, but adds npm publishing maintenance burden.
- **b)** Local-only fork built under `~/Projects/...`. Override `command:` in config to absolute path. Zero external setup but breaks portability and fails on machine moves.
- **c)** Upstream-first: open PR before doing anything local. Wait for merge (weeks?). Blocks everything else but no fork to maintain.
- **d)** Hybrid: (a) as immediate baseline + (c) in parallel as escape hatch. When upstream merges, decommission fork.

**Recommended: (d).** Unblocks now, exits cleanly later.

### Q8 — Phase 0 validation gate

- **a)** Yes, do the gate before any forking. ~4 hours, prevents 2-day wasted investment.
- **b)** Skip and go direct to Phase 1. Accept the risk.

**Recommended: (a).** Strongly. ROI of de-risking is enormous given the per-tab rollout uncertainty.

### Q9 — Target spec version for Phase 0 probe (added 2026-05-25)

The MCP Apps spec stable (2026-01-26) and draft have diverged ~50% in size since the original plan was written.

- **a)** Stable `2026-01-26`. Safer — every conforming host should implement it. Minimal feature set sufficient for our probe (one tool, one `ui://` resource, `resources/read`).
- **b)** Draft. Includes `_meta.ui.visibility`, `ui/download-file`, sandbox-proxy semantics, etc. Only worth targeting if a Phase 0 host turns out to require draft-only behavior.
- **c)** Both, sequentially: probe with stable first; if any host fails, retry with draft to see whether feature-version is the variable.

**Recommended: (a) as default, fall through to (c) only if Phase 0 reveals a stable-only failure on a priority host.** Keeps the probe ~150 LOC and decision-clean.

---

## Artifacts left in the repo

- **`main`:** untouched. Status quo `show_product_image` with `resource_link` + jsdelivr CDN. Cowork rendering works.
- **`experiment/mcp-app-embedded-resource`** @ `09a0690`: failed-probe branch. Adds `show_product_widget` tool that returns embedded resource block. Magenta+blue+CDN visual markers. Preview URL: `https://bella-roma-web-mcp-git-experiment-98a4f9-sgra57-8128s-projects.vercel.app/`. **DO NOT MERGE.** Useful as evidence trail.
- **Temporary worktree:** `.claude/worktrees/agent-a97a2ca6d1b4bbaac` (and possibly others from later agent runs). Can be cleaned up with `git worktree remove` / `git worktree prune` when no longer useful.

## Reference URLs

External:
- MCP Apps spec: https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx
- MCP Apps overview: https://modelcontextprotocol.io/extensions/apps/overview
- **MCP Apps client support matrix:** https://modelcontextprotocol.io/extensions/client-matrix (source of truth for the 8-client surface in the 2026-05-25 scope update)
- MCP Apps blog post: https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/
- Examples repo: https://github.com/modelcontextprotocol/ext-apps/tree/main/examples
- OpenAI Apps SDK (MCP Apps in ChatGPT): https://developers.openai.com/apps-sdk
- mcp-b monorepo: `WebMCP-org/npm-packages` on GitHub
- Claude Desktop changelog: https://code.claude.com/docs/en/desktop-changelog (entry v1.6889.0 2026-05-08: "Added MCP App widget rendering in Code tab sessions")
- Interactive connectors docs: https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude
- 3P inference issue: https://github.com/anthropics/claude-ai-mcp/issues/236

Internal:
- Memory (canonical empirical state): `~/.claude/projects/-Users-emanuele-Projects-BellaRoma/memory/claude-desktop-image-rendering-limit.md`
- Memory (deploy flow): `~/.claude/projects/-Users-emanuele-Projects-BellaRoma/memory/bellaroma-vercel-deployment-flow.md`
- Probe preview deploy: https://bella-roma-web-mcp-git-experiment-98a4f9-sgra57-8128s-projects.vercel.app/

## Resume protocol for next session

> Updated 2026-05-25: decisions Q7/Q8/Q9 are now answered. Phase 0 is skipped. Resume from Phase 1.

1. Read this doc top-to-bottom — especially the [Decisions answered](#decisions-answered-2026-05-25) section.
2. Dispatch Phase 1: fork `@mcp-b/webmcp-local-relay@2.3.2` in an isolated worktree. Brief mirrors the Phase 1 spec above. Publish as `@sgra57/webmcp-local-relay`. Target MCP Apps spec stable `2026-01-26`.
3. Dispatch Phase 2 right after: fork `@mcp-b/webmcp-polyfill@2.3.2` → `@sgra57/webmcp-polyfill`. Add `navigator.modelContext.resources` namespace.
4. Update `claude_desktop_config.json` to point at `@sgra57/webmcp-local-relay@latest`.
5. Phase 3: BellaRoma integration (3 widgetized tools, fallback graceful).
6. Phase 4: multi-client validation (this IS the empirical gate now, per Q8=(b)).
7. Apply Phase 5 decision matrix.
8. Phase 6 (optional, only if Phase 4 succeeded): upstream PR to `WebMCP-org/npm-packages`.
9. Update this doc with results inline at each phase boundary (don't create a new doc — keep the trail in one place).

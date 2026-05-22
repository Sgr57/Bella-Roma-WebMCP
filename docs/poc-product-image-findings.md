# POC: foto prodotto inline nella chat — finding

> **Branch**: `poc-product-image` · **Stato**: chiuso a maggio 2026 senza merge.
> **Preview live del POC**: <https://bella-roma-web-88ewnqgct-sgra57-8128s-projects.vercel.app/> (deploy Vercel sul commit HEAD del branch).
> **Domanda di partenza**: si possono mostrare foto dei prodotti direttamente in chat (Claude Desktop / claude.ai / altri client) quando l'agente chiama un tool WebMCP come `get_product`?
> **Risposta sintetica**: oggi, con il bridge `@mcp-b/webmcp-local-relay` v2.3.2 (lo stesso che la live demo monta in Claude Desktop), **no, non inline**. Si arriva al massimo a un widget *click-to-view* "Show Image". Il path per l'inline vero esiste (MCP Apps, spec del 26 gennaio 2026) ma richiede patch upstream del relay.

## Cosa abbiamo provato

Il tool `get_product` (in [`src/lib/webmcp.ts`](../src/lib/webmcp.ts)) è stato esteso per tornare contemporaneamente tre canali, in ordine di "ambizione" crescente, così da coprire qualunque client:

1. **MCP `image` content block** — `{type: "image", data: <base64 webp>, mimeType: "image/webp"}` accodato al risultato. Path nativo dello spec MCP standard.
2. **Markdown image URL nel testo** — riga `![Nome](https://<vercel>.app/products/editorial/<id>.webp)` con URL assoluta verso l'asset pubblico. Il modello la rieccheggia nella sua risposta, dove dovrebbe essere renderizzata come markdown dal chat client. Fallback "universale".
3. **MCP App resource block inline** — `{type: "resource", resource: {uri: "ui://bellaroma/product-card/<id>", mimeType: "text/html;profile=mcp-app", text: "<html>...</html>"}}` con la foto embeddata come `data:` URL nell'HTML. Tentativo di scorciatoia: inlineare la UI resource invece di registrarla a parte (la forma spec-correct usa `_meta.ui.resourceUri` + `resources/read`).

Tutti e tre i canali sono attivi contemporaneamente nel tool: vedi il blocco `if (img)` in `src/lib/webmcp.ts`. La logica produce un array `content` di 3 elementi quando l'asset esiste, 1 elemento (solo testo) se l'asset manca.

## Risultati su Claude Desktop (build maggio 2026)

| Canale | Cosa fa Claude Desktop |
|---|---|
| `image` content block | Lo riceve (raw output del tool lo mostra). Renderizza un widget "Show Image" cliccabile — non inline. |
| Markdown URL nella risposta del modello | Il modello la rieccheggia correttamente nella sua risposta. Anche con l'URL pubblica fetchabile (Vercel preview con Deployment Protection disattivata, verificato 200 OK con `curl`), Claude Desktop la trasforma comunque nel **medesimo** widget "Show Image" anziché `<img>` inline. È evidentemente una policy del chat renderer (probabile: anti-tracking-pixel su output del modello). |
| MCP App resource block inline | Il relay forwarda il content block fino a Claude Desktop (verificato via Playwright che il browser lo produce). Claude Desktop **ignora il blocco** — non lo apre come iframe. La spec MCP Apps prevede infatti l'indirezione via `_meta.ui.resourceUri` + `resources/read`, non un blocco inline. |

Conclusione: **due dei tre canali producono lo stesso widget click-to-view; il terzo viene scartato.** Nessuno dà rendering inline.

## Perché il path MCP App "corretto" non è applicabile oggi

La spec ufficiale ([modelcontextprotocol/ext-apps, 2026-01-26](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)) prevede questo flusso:

1. Tool dichiara `_meta.ui.resourceUri: "ui://..."` nel manifest.
2. Server registra a parte una resource `ui://...` con `mimeType: text/html;profile=mcp-app` e HTML payload.
3. Client (Claude Desktop) chiama `resources/read("ui://...")` quando vede il `_meta.ui` sul tool.
4. Client renderizza l'HTML in un iframe sandboxed inline nella chat.

Tutto il path è possibile lato browser: il polyfill `@mcp-b/global` v2.3.2 espone `navigator.modelContext.registerResource({uri, mimeType, read})` per registrare risorse.

**Il blocco è nel bridge**. Il relay `@mcp-b/webmcp-local-relay` v2.3.2 (sia stable che beta `0.0.0-beta-20260414175800`) implementa solo `setRequestHandler(ListToolsRequestSchema, …)` (verifica: `gh api repos/WebMCP-org/npm-packages/contents/packages/webmcp-local-relay/src/mcpRelayServer.ts | base64 -d | grep -E "setRequestHandler|RequestSchema"`). Non c'è `ListResourcesRequestSchema`, non c'è `ReadResourceRequestSchema`, e il protocollo browser↔relay non ha messaggi per le risorse. Quindi anche registrando correttamente la risorsa lato browser, Claude Desktop non riesce a leggerla.

## Cosa servirebbe per chiudere

In ordine di scopo crescente:

1. **Estendere `@mcp-b/webmcp-local-relay`** con:
   - Messaggi `WEBMCP_LIST_RESOURCES` e `WEBMCP_READ_RESOURCE` nel protocollo browser↔relay.
   - Lato browser (`@mcp-b/global`): wiring fra `registerResource()` e i nuovi messaggi.
   - Lato relay (`mcpRelayServer.ts`): handler `ListResourcesRequestSchema` e `ReadResourceRequestSchema` che proxano al browser.
   - Stima: 50–200 LOC + test, ~mezza giornata.
2. **Modificare `claude_desktop_config.json`** per eseguire il fork al posto della versione npm.
3. **Verificare** che Claude Desktop emetta davvero `resources/read` su un tool con `_meta.ui.resourceUri`. La spec lo richiede ma il comportamento di Claude Desktop su questo specifico flusso è documentato come "unclear — needs experimentation" — vedi research del 2026-05-22.

In alternativa, **aspettare** che `@mcp-b` rilasci il supporto resources (issue o PR ufficiale assente al 2026-05-22) oppure che Claude Desktop / claude.ai rendano inline anche i `<img>` da markdown del modello (cambio di policy lato Anthropic).

## Modifiche collaterali nel branch

Oltre all'estensione di `get_product`, il branch contiene una piccola modifica non strettamente legata al POC sull'immagine ma utile alla demo end-to-end:

- **Relay default-on** ([commit `f77be95`](https://github.com/Sgr57/Bella-Roma-WebMCP/commit/f77be95)): in `src/lib/relay.ts` il flag `?relay=...` ha semantica invertita — il relay è attivo di default, e si disabilita con `?relay=false` (prima era l'opposto). Il toggle in header continua a funzionare allo stesso modo. Razionale: il caso d'uso primario della demo è "bridge a Claude Desktop attivo", quindi conviene non costringere a un click manuale.

## Note operative per chi riprende il lavoro

- **Vercel Deployment Protection è stata disattivata** sul progetto `bella-roma-web-mcp` durante il POC (per consentire al fetcher di Claude Desktop di scaricare gli asset preview senza autenticazione). Se viene riattivata, i preview restituiscono `401` e qualunque approccio basato su URL pubblica (canale 2 di sopra) smette di funzionare. La prod resta sempre pubblica.
- **Tunnel locali tipo `cloudflared`** non funzionano su alcune reti corporate (UDP/TCP 7844 bloccati in egress). Su quella rete il path consigliato è il preview Vercel del branch — l'asset URL pattern è `https://bella-roma-web-mcp-git-<branch-slug-truncato>-<hash>-sgra57-8128s-projects.vercel.app/`. Per trovare l'URL di un commit specifico: `gh api repos/Sgr57/Bella-Roma-WebMCP/deployments?sha=<sha>` poi `gh api .../deployments/<id>/statuses` e leggere `environment_url`.
- **Per buttare via il POC** e tornare a `main`: `git checkout main && git push origin :poc-product-image && git branch -D poc-product-image` (la branch sopravvive solo localmente fino al pull; se è già stata tirata su un'altra macchina sostituire i comandi locali con `git branch -D` post-checkout). Per ripartire dal punto in cui ci siamo fermati: si parte da questo branch e si lavora sul relay (vedi [Cosa servirebbe per chiudere](#cosa-servirebbe-per-chiudere)).

## Riferimenti

- Spec MCP Apps: https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx
- Annuncio: https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/
- Quickstart example: https://github.com/modelcontextprotocol/ext-apps/blob/main/examples/quickstart/server.ts
- Esempio con CSP per asset esterni: https://github.com/modelcontextprotocol/ext-apps/blob/main/examples/map-server/server.ts
- WebMCP polyfill `registerResource`: https://github.com/WebMCP-org/npm-packages/blob/main/packages/webmcp-ts-sdk/src/browser-server.ts
- WebMCP local relay (tools-only): https://github.com/WebMCP-org/npm-packages/blob/main/packages/webmcp-local-relay/src/mcpRelayServer.ts
- mcp-ui (alternativa concettuale a MCP Apps): https://mcpui.dev/

# Bella Roma Coffee — Demo WebMCP

Single-page React app che simula la torrefazione fittizia **Bella Roma Coffee** ed espone le sue azioni come 6 tool WebMCP invocabili da un agente AI direttamente nel browser tramite `navigator.modelContext`. Costruita per una demo da 60 secondi davanti a manager.

## Quick start

```bash
npm install
npm run dev
```

Apri http://localhost:5173

## Demo: collegare un agente AI

Hai due strade. Per la demo dal vivo l'**opzione B** è la più affidabile.

### Opzione A — Chrome Canary 146+ (WebMCP nativo)

1. Installa **Chrome Canary 146** o superiore.
2. Iscriviti all'**EPP (Early Preview Program)** WebMCP: https://developer.chrome.com/docs/ai/join-epp
3. Segui le istruzioni che ti arrivano via email (il flag specifico non è documentato pubblicamente, è gated dietro l'EPP).
4. Apri la demo: l'header mostra 🟢 *WebMCP nativo attivo*.
5. Usa l'assistente AI integrato di Chrome (o un'estensione compatibile).

> Realisticamente la signup EPP può richiedere giorni. Per una demo imminente usa l'opzione B.

### Opzione B — Claude Desktop + webmcp-local-relay (consigliato)

Niente estensioni Chrome richieste. Il bridge è un piccolo MCP server locale che Claude Desktop avvia tramite `npx` e che riceve via WebSocket i tool dalla tab del browser.

**1. Configura Claude Desktop**

Apri (o crea) `~/Library/Application Support/Claude/claude_desktop_config.json` su macOS (o l'equivalente per Windows / Linux) e aggiungi sotto `mcpServers`:

```json
{
  "mcpServers": {
    "webmcp-local-relay": {
      "command": "npx",
      "args": ["-y", "@mcp-b/webmcp-local-relay@latest"]
    }
  }
}
```

**2. Riavvia completamente Claude Desktop** (⌘Q + riapri — non basta chiudere la finestra).

**3. Apri o ricarica** la demo su http://localhost:5173. L'header mostra 🟡 *Polyfill MCP-B attivo*. La tab si collega automaticamente al relay tramite WebSocket su `ws://127.0.0.1:9333` (vedi sezione "Come funziona il bridge" sotto).

**4. In Claude Desktop chiedi**: *"List the connected WebMCP sources"*. Deve elencare la tab "Bella Roma Coffee" con i 6 tool.

**5. Lancia il flusso demo** con uno dei prompt del banner:
- *"Ordina 2 espresso e 1 cappuccino, applica BENVENUTO e fai checkout"*
- *"Mostrami solo i caffè sotto i 2 euro"*
- *"Svuota il carrello e ricomincia"*

L'agente invoca i tool, vedrai i prodotti volare nel carrello, il coupon applicarsi, e al `checkout` apparirà un modale di conferma — è il momento clou: l'AI non agisce alle tue spalle.

### Come funziona il bridge (Opzione B)

```
┌────────────────┐    stdio MCP    ┌──────────────────────┐
│ Claude Desktop │ ◀─────────────▶ │ webmcp-local-relay   │
└────────────────┘                 │ (avviato da Claude)  │
                                   └──────────┬───────────┘
                                              │  ws://127.0.0.1:9333
                                              ▼
                                   ┌──────────────────────┐
                                   │ Bella Roma tab       │
                                   │ (polyfill + embed)   │
                                   └──────────────────────┘
```

La pagina usa **due pezzi** lato browser, entrambi già configurati nel progetto:

1. **`@mcp-b/global`** (npm dep): polyfilla `navigator.modelContext` in-page così l'app può chiamare `provideContext({tools})` e registrare i 6 tool.
2. **Embed script** in `index.html` (caricato da CDN jsDelivr): apre il WebSocket *client* verso il relay locale, inoltra l'elenco dei tool e gestisce le chiamate.

```html
<!-- in index.html -->
<script src="https://cdn.jsdelivr.net/npm/@mcp-b/webmcp-local-relay@latest/dist/browser/embed.js"></script>
```

Senza l'embed, il polyfill funziona ma i tool restano "intrappolati" nella pagina e Claude Desktop non li vede. Per usare la pagina **offline / senza relay**, basta togliere lo script — la UI manuale resta utilizzabile.

## Tool esposti

| Tool | Cosa fa | Conferma utente |
|---|---|---|
| `search_products` | Filtra catalogo per categoria/prezzo/testo | no |
| `add_to_cart` | Aggiunge prodotto al carrello | no |
| `remove_from_cart` | Rimuove riga | no |
| `apply_coupon` | Applica `BENVENUTO` (-10%) o `STUDENTI` (-20% max €5) | no |
| `get_cart` | Ritorna stato carrello | no |
| `checkout` | Conferma ordine | **sì** (modale `requestUserInteraction`) |

## Test

```bash
npm test            # esegue Vitest una volta
npm run test:watch  # watch mode
```

Test su `store/cart`, `lib/products`, `lib/webmcp` (catalogo, store, tool adapter). Niente test E2E: la verifica visuale + il dry-run con un agente vero sono sufficienti per una demo.

## Architettura

- **Zustand** (`src/store/cart.ts`) è la *single source of truth* per carrello, coupon applicato e log delle invocazioni dei tool.
- **`src/lib/webmcp.ts`** è l'**adapter** tra l'API WebMCP e lo store. Espone `buildTools()` (6 tool) e `registerTools()` che chiama `navigator.modelContext.provideContext({tools})`.
- **`src/lib/polyfill.ts`** carica `@mcp-b/global` se `navigator.modelContext` non è disponibile nativamente, e ritorna lo stato (`native` / `polyfill` / `unavailable`) all'header per l'indicatore di connessione.
- **Embed script** in `index.html` (CDN jsDelivr): apre il WebSocket verso il relay locale ed espone i tool registrati su `navigator.modelContext` a Claude Desktop. Necessario per il path Claude Desktop; può essere rimosso se la pagina è usata stand-alone.
- **`src/lib/checkout-bridge.ts`** è un piccolo event-bridge: il tool `checkout` invoca `requestCheckoutConfirmation(total)` dentro `agent.requestUserInteraction(...)`; un componente React (`CheckoutModal`) si registra come listener e mostra il modale stilato.
- I componenti React (`Header`, `DemoBanner`, `ProductGrid`, `ProductCard`, `Cart`, `ToolActivityLog`, `CheckoutModal`) leggono dallo store: la UI manuale (click) e quella agentica (tool) passano dagli stessi update — *esattamente il vantaggio chiave di WebMCP*.

Design completo in [`docs/superpowers/specs/2026-05-12-bella-roma-coffee-demo-design.md`](docs/superpowers/specs/2026-05-12-bella-roma-coffee-demo-design.md).
Piano di implementazione in [`docs/superpowers/plans/2026-05-12-bella-roma-coffee-demo.md`](docs/superpowers/plans/2026-05-12-bella-roma-coffee-demo.md).

## Stack

Vite 6 · React 18 · TypeScript 5 · Tailwind CSS 3 · Zustand · Framer Motion · `@mcp-b/global` polyfill · Vitest + Testing Library

## Note per la demo dal vivo

- **Banner istruzioni**: ha 3 prompt pronti al copia-incolla.
- **Reset demo**: bottone in header. Svuota carrello, rimuove coupon, pulisce il Tool Activity Log.
- **Tool Activity Log**: pannello in basso a destra che mostra in tempo reale ogni invocazione di tool (nome, args, risultato, timestamp).
- **Fallback manuale**: il bottone "Checkout" in carrello funziona anche senza agente (utile per smoke test e in caso di problemi di connessione il giorno della demo).
- **Niente backend**: catalogo e coupon sono in memoria (`src/lib/products.ts`). Refresh = stato pulito.

## Troubleshooting

**"There are no connected WebMCP sources" in Claude Desktop**
- Riavvia Claude Desktop completamente dopo aver modificato `claude_desktop_config.json` (⌘Q, non basta chiudere la finestra).
- Ricarica la tab della demo **dopo** che Claude Desktop è ripartito (la connessione WebSocket viene aperta al `load` della pagina).
- Verifica che il relay sia in ascolto: `lsof -nP -i :9333`. Devi vedere `node ... LISTEN` e poi `Google ... ESTABLISHED` quando apri la pagina.
- Verifica che l'embed script si carichi: in DevTools → Network filtra per `embed.js`, dovrebbe essere `200 OK`.

**L'indicatore in alto a destra resta ⚪ "Nessun agente collegato"**
- L'indicatore guarda solo `navigator.modelContext`, non lo stato della connessione al relay. Se vedi 🟡 e Claude Desktop comunque non vede la tab, il problema è la connessione WebSocket all'embed, non il polyfill.

**Il modale di checkout non appare quando l'agente chiama `checkout`**
- Verifica che `CheckoutModal` sia mounted (è in `App.tsx`). Senza modale registrato, `requestCheckoutConfirmation` fa fallback a `window.confirm`.

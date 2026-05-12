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
2. Vai a `chrome://flags/#enable-experimental-web-platform-features` e abilita.
3. Iscriviti all'**EPP (Early Preview Program)** WebMCP, se richiesto.
4. Apri la demo: l'header mostra 🟢 *WebMCP nativo attivo*.
5. Usa l'assistente AI integrato di Chrome (o un'estensione compatibile).

### Opzione B — Chrome stabile + estensione MCP-B + Claude Desktop (consigliato)

Più affidabile per una demo, perché Canary può cambiare comportamento da una notte all'altra.

1. Installa l'estensione **MCP-B** da [docs.mcp-b.ai](https://docs.mcp-b.ai/).
2. Installa **Claude Desktop** e configura il connettore MCP-B: l'estensione raccoglie i tool della tab attiva e li espone come server MCP locale.
3. Apri la demo: l'header mostra 🟡 *Polyfill MCP-B attivo*.
4. In Claude Desktop scrivi uno dei prompt suggeriti nel banner:
   - *"Ordina 2 espresso e 1 cappuccino, applica BENVENUTO e fai checkout"*
   - *"Mostrami solo i caffè sotto i 2 euro"*
   - *"Svuota il carrello e ricomincia"*

L'agente invocherà i tool, vedrai i prodotti volare nel carrello, il coupon applicarsi, e al `checkout` apparirà un modale di conferma — è il momento clou: l'AI non agisce alle tue spalle.

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
- **`src/lib/webmcp.ts`** è l'**adapter** tra l'API WebMCP e lo store. Espone `buildTools()` (6 tool) e `registerTools()`.
- **`src/lib/polyfill.ts`** carica `@mcp-b/global` se `navigator.modelContext` non è disponibile nativamente, e ritorna lo stato (`native` / `polyfill` / `unavailable`) all'header per l'indicatore di connessione.
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
- **Fallback**: il bottone "Checkout" in carrello funziona anche senza agente (utile per smoke test).
- **Niente backend**: catalogo e coupon sono in memoria (`src/lib/products.ts`). Refresh = stato pulito.

# Bella Roma Coffee — Demo WebMCP

> **Proof-of-Concept**: una vetrina e‑commerce *agent-ready*. Un agente AI (Claude Desktop) ordina caffè, applica coupon e fa checkout su una pagina React **senza** vedere il DOM, senza scraper, senza pilotare il cursore — chiama direttamente i tool che la pagina espone.

Single-page React app che simula la torrefazione fittizia **Bella Roma Coffee** ed espone le sue azioni come **6 tool WebMCP** invocabili da un agente AI nel browser tramite `navigator.modelContext`. Pensata per una demo da 60 secondi davanti a stakeholder non tecnici, ma costruita su standard reali (W3C Draft Community Group Report, febbraio 2026).

## Scopo

1. **Mostrare WebMCP all'opera** su un caso d'uso commerciale credibile (catalogo prodotti, carrello, coupon, checkout), non su uno snippet astratto.
2. **Confrontare i due percorsi di adozione**: il browser nativo (Chrome Canary EPP, `navigator.modelContext`) e il polyfill della community (`@mcp-b/global`) — *stesso codice di tool*, due bridge diversi, indicatori live in header per capirlo a colpo d'occhio.
3. **Provare l'ergonomia "user-in-the-loop"**: il `checkout` chiama `agent.requestUserInteraction(...)` e fa apparire un modale di conferma. L'AI **non agisce di nascosto** — la UI manuale e quella agentica condividono lo stesso store.
4. **Materiale di onboarding interno**: lo stack è volutamente minimo (Vite + React + Zustand) per essere leggibile in un'ora; tutta la logica WebMCP vive in ~5 file in `src/lib/`.

## Cos'è WebMCP

[WebMCP](https://github.com/webmachinelearning/webmcp) è una proposta di standard W3C (Web Machine Learning CG, editori Google + Microsoft) che permette a qualsiasi sito di **registrare tool** invocabili da agenti AI nel browser, senza scrivere uno scraper o pilotare la UI tramite DOM/screenshot. Disponibile in early preview in **Chrome 146 Canary** dietro flag. Per il contesto completo (storia, API, casi d'uso, confronto con MCP "classico") vedi [`RESEARCH.md`](RESEARCH.md).

## Quick start

```bash
npm install
npm run dev
```

Apri http://localhost:5173

## Demo: collegare un agente AI

Due strade, **entrambe affidabili**, entrambe selezionabili dallo **stesso toggle in header** o dal query param `?relay=true`. La pagina rileva il browser e instrada da sola al bridge giusto.

| Browser | Bridge selezionato | Estensione? | Polyfill? |
|---|---|---|---|
| Chrome Canary 146+ (EPP) | `relay-client.ts` in-page (nostro) | no | no — usa `navigator.modelContext` nativo |
| Chrome stable / qualunque | embed `@mcp-b/webmcp-local-relay` da CDN | no | sì (`@mcp-b/global`) |
| Toggle off | (nessuno) | — | — |

In tutti i casi il consumer è **Claude Desktop** (o qualunque client MCP stdio) tramite lo stesso relay locale `webmcp-local-relay` che gira su `127.0.0.1:9333`.

### Configurazione comune — Claude Desktop

Apri (o crea) `~/Library/Application Support/Claude/claude_desktop_config.json` su macOS (o l'equivalente Windows/Linux) e aggiungi sotto `mcpServers`:

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

Riavvia completamente Claude Desktop (⌘Q + riapri — non basta chiudere la finestra). Verifica che il relay sia in ascolto:

```bash
lsof -nP -i :9333
# devi vedere: node ... TCP 127.0.0.1:9333 (LISTEN)
```

### Apri la demo

```
http://localhost:5173/?relay=true
```

(oppure carica `http://localhost:5173/` e clicca **Relay: off** in header per attivarlo — fa lo stesso, ricaricando.)

L'header mostra due indicatori:

- **Connessione WebMCP** — 🟢 *nativo (Canary)* / 🟡 *Polyfill MCP-B (compat)* / ⚪ *nessun agente collegato*.
- **Bridge** — 🔵 *native WS (open)* / 🟣 *embed CDN* / 🟠 *connecting* / 🔴 *closed-error* / ▫ *off*.

Su Canary EPP dovresti vedere 🟢 + 🔵 *open*. Su Chrome stable: 🟡 + 🟣.

### Verifica end-to-end

In Claude Desktop chiedi:

> *"List the connected WebMCP sources"*

Deve elencare la tab **"Bella Roma Coffee"** con i 6 tool. Poi prova uno dei prompt del banner:

- *"Ordina 2 espresso e 1 cappuccino, applica BENVENUTO e fai checkout"*
- *"Mostrami solo i caffè sotto i 2 euro"*
- *"Svuota il carrello e ricomincia"*

L'agente invoca i tool, vedrai i prodotti volare nel carrello, il coupon applicarsi, e al `checkout` apparirà un modale di conferma — momento clou: l'AI non agisce alle tue spalle.

### Come funzionano i due bridge

```
                  ┌────────────────┐    stdio MCP    ┌──────────────────────┐
                  │ Claude Desktop │ ◀─────────────▶ │ webmcp-local-relay   │
                  └────────────────┘                 │  (avviato da Claude) │
                                                     └──────────┬───────────┘
                                                                │ ws://127.0.0.1:9333
                                  ┌─────────────────────────────┼─────────────────────────────┐
                                  ▼                                                           ▼
                ┌────────────────────────────────┐                          ┌──────────────────────────────┐
                │ Canary (native)                │                          │ Chrome stable (polyfill)     │
                │ navigator.modelContext         │                          │ @mcp-b/global polyfill       │
                │   registerTool ×6 (W3C spec)   │                          │   provideContext({tools})    │
                │                                │                          │                              │
                │ src/lib/relay-client.ts        │                          │ embed.js (CDN jsDelivr)      │
                │   apre WS → 9333               │                          │   inietta iframe hidden      │
                │   hello / tools/list / invoke  │                          │   iframe apre WS → 9333      │
                │   dispatch in-page             │                          │                              │
                └────────────────────────────────┘                          └──────────────────────────────┘
```

Tutto il routing tra i due bridge è in `src/lib/relay.ts` → `connectRelay(mode)`. La detection del mode (`native` vs `polyfill` vs `unavailable`) è in `src/lib/polyfill.ts`: distingue native vs polyfill confrontando `constructor.name === "ModelContext"` e l'assenza di `provideContext`, perché il solo `'modelContext' in navigator` non basta — alcuni setup caricano il polyfill come side-effect anche su browser nativi.

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
- **`src/lib/webmcp.ts`** è l'**adapter** tra l'API WebMCP e lo store. Espone `buildTools()` (6 tool) e `registerTools()` che è ora **dual-API**: usa `navigator.modelContext.registerTool(t)` (W3C spec, nativo) oppure `provideContext({tools})` (polyfill `@mcp-b/global`) a seconda di chi è presente. Idempotente (guard `registered` + dedup via `getTools()` quando disponibile).
- **`src/lib/polyfill.ts`** rileva la modalità (`native` / `polyfill` / `unavailable`) e carica `@mcp-b/global` solo se serve. Distingue native vs polyfill anche quando entrambi appaiono presenti, leggendo `constructor.name` e l'assenza di `provideContext`.
- **`src/lib/relay.ts`** (orchestratore) — legge il flag `?relay=true`, chiama `connectRelay(mode)` che instrada al bridge giusto:
  - `mode === "native"` → import dinamico di `relay-client.ts` (vedi sotto).
  - `mode === "polyfill"` → inietta lo `<script>` dell'embed CDN (`@mcp-b/webmcp-local-relay/dist/browser/embed.js`).
- **`src/lib/relay-client.ts`** (~165 LoC) — implementa il protocollo del relay direttamente: `WebSocket` verso `127.0.0.1:9333`, handshake `hello` + `tools/list`, gestione `invoke/result`, `ping/pong`, reconnect con backoff (2s → 30s). Nessuna dipendenza da `executeTool` non-spec di Chrome: dispatcha localmente chiamando `tool.execute(args, fakeClient)`. Espone `onRelayState(...)` per l'indicatore in Header.
- **`src/lib/checkout-bridge.ts`** è un piccolo event-bridge: il tool `checkout` invoca `requestCheckoutConfirmation(total)` dentro `agent.requestUserInteraction(...)` se l'agent è disponibile, altrimenti chiama il bridge diretto (il modale React si apre lo stesso).
- I componenti React (`Header`, `DemoBanner`, `ProductGrid`, `ProductCard`, `Cart`, `ToolActivityLog`, `CheckoutModal`) leggono dallo store: la UI manuale (click) e quella agentica (tool) passano dagli stessi update — *esattamente il vantaggio chiave di WebMCP*.

Design completo in [`docs/superpowers/specs/2026-05-12-bella-roma-coffee-demo-design.md`](docs/superpowers/specs/2026-05-12-bella-roma-coffee-demo-design.md).
Piano di implementazione in [`docs/superpowers/plans/2026-05-12-bella-roma-coffee-demo.md`](docs/superpowers/plans/2026-05-12-bella-roma-coffee-demo.md).

## Stack

Vite 6 · React 18 · TypeScript 5 · Tailwind CSS 3 · Zustand · Framer Motion · `@mcp-b/global` polyfill (solo path compat) · Vitest + Testing Library

## Note per la demo dal vivo

- **Banner istruzioni**: ha 3 prompt pronti al copia-incolla.
- **Reset demo**: bottone in header. Svuota carrello, rimuove coupon, pulisce il Tool Activity Log.
- **Tool Activity Log**: pannello in basso a destra che mostra in tempo reale ogni invocazione di tool (nome, args, risultato, timestamp).
- **Fallback manuale**: il bottone "Checkout" in carrello funziona anche senza agente (utile per smoke test e in caso di problemi di connessione il giorno della demo).
- **Niente backend**: catalogo e coupon sono in memoria (`src/lib/products.ts`). Refresh = stato pulito.

## Troubleshooting

**"There are no connected WebMCP sources" in Claude Desktop**
- Verifica che il toggle relay sia su **on** (header: 🔵 o 🟣) — `?relay=true` nell'URL.
- Riavvia Claude Desktop completamente dopo aver modificato `claude_desktop_config.json` (⌘Q, non basta chiudere la finestra).
- Verifica che il relay sia in ascolto: `lsof -nP -i :9333`. Devi vedere `node ... LISTEN` e una riga `Google ... ESTABLISHED` per ogni tab connessa.
- Ricarica la tab **dopo** che Claude Desktop è ripartito (la connessione WebSocket viene aperta al `load`).

**Path nativo (Canary): l'indicatore relay resta 🔴 closed/error**
- Significa che `relay-client.ts` non riesce a connettersi a `ws://127.0.0.1:9333`. Causa più comune: Claude Desktop non in esecuzione o config `mcpServers` non applicata. Backoff esponenziale fino a 30s tra tentativi.
- Cross-check con `lsof -nP -i :9333`: se vedi solo `LISTEN` senza `ESTABLISHED` dopo qualche secondo dal load, la connessione non è andata a buon fine.

**Path compat (Chrome stable): nessun iframe iniettato dall'embed**
- L'embed CDN usa il selettore `[data-webmcp-relay]` per la propria idempotenza: assicurati di non averlo applicato altrove a mano. Il nostro loader usa `data-webmcp-embed-loader` apposta per evitare la collisione.

**L'indicatore connessione resta ⚪ "Nessun agente collegato"**
- Significa che né la nativa né il polyfill sono caricati. Verifica che `npm install` sia andato a buon fine (il polyfill `@mcp-b/global` è una dipendenza npm; senza, su Chrome stable il fallback non parte).

**Il modale di checkout non appare quando l'agente chiama `checkout`**
- Verifica che `CheckoutModal` sia mounted (è in `App.tsx`). Senza modale registrato, `requestCheckoutConfirmation` fa fallback a `window.confirm`.

## Materiale di supporto

- [`RESEARCH.md`](RESEARCH.md) — Cos'è WebMCP, come si confronta con MCP "classico", quali use case sblocca.
- [`docs/presentazione.html`](docs/presentazione.html) — Slide deck HTML per la demo dal vivo.
- [`docs/HOW-TO-IMPLEMENT.html`](docs/HOW-TO-IMPLEMENT.html) — Guida passo-passo per integrare WebMCP in un sito esistente.

## Disclaimer

**Bella Roma Coffee** è una torrefazione fittizia creata per scopi dimostrativi. Marchio, logo, prodotti e prezzi non si riferiscono ad alcuna azienda reale. WebMCP è una specifica W3C ancora in evoluzione: l'API mostrata può cambiare nelle future revisioni del Draft Community Group Report.

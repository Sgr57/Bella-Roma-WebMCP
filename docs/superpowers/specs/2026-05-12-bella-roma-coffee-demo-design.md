# Bella Roma Coffee — Demo WebMCP

**Data:** 2026-05-12
**Autore:** Emanuele D'Orazio
**Audience demo:** Manager Reply (consulting interno)
**Obiettivo:** mostrare in 60 secondi le potenzialità di WebMCP (`navigator.modelContext`) con un'app riconoscibile e visivamente espressiva.

## 1. Obiettivo e criteri di successo

Costruire una single-page web app che simula la torrefazione fittizia **"Bella Roma Coffee"** ed espone le sue azioni principali come tool invocabili da un agente AI tramite l'API WebMCP. Lo scopo non è la completezza funzionale, ma trasmettere ai manager **tre messaggi chiave**:

1. **L'AI agisce nella UI**, non parla *intorno* alla UI: i prodotti si muovono nel carrello in tempo reale, lo sconto compare, il totale cambia.
2. **L'utente resta in controllo**: il checkout richiede conferma esplicita via `requestUserInteraction`.
3. **Niente DOM scraping, niente screenshot**: l'integrazione è strutturata, deterministica, riusa la stessa logica del frontend.

Criteri di successo per la demo:
- Eseguire il flusso completo (prompt → carrello pieno → coupon → conferma → ordine confermato) senza intoppi in ≤ 60 secondi.
- Funzionare senza rete (catalogo hardcoded) per essere resiliente a meeting room sfortunate.
- Restare utilizzabile a mano se nessun agent è collegato (fallback click manuale).

## 2. Flusso demo

1. Aprire la pagina: catalogo visibile, carrello vuoto, banner-demo in alto con 3 prompt copia-incollabili e l'icona di stato connessione agente (verde se WebMCP è attivo).
2. Da Claude Desktop con estensione MCP-B (o Chrome Canary 146 con flag EPP) inviare il prompt:
   > *"Ordina 2 espresso e 1 cappuccino, applica coupon BENVENUTO, poi vai al checkout."*
3. L'agente invoca in sequenza `add_to_cart` (×2), `apply_coupon`, `checkout`. Ogni invocazione:
   - Appare nel **Tool Activity Log** laterale con timestamp, nome tool, argomenti, risultato.
   - Produce un'animazione visibile (Framer Motion): la card del prodotto vola verso il carrello.
4. Al `checkout` compare il **modale di conferma**: *"Confermi il pagamento di €5,40?"* (è `requestUserInteraction`). L'utente clicca **Conferma**.
5. Toast *"Ordine confermato 🎉"*, il carrello si svuota, il Tool Activity Log mantiene lo storico.
6. Il presentatore può cliccare **Reset demo** in header per ripartire: svuota carrello, rimuove coupon, pulisce il Tool Activity Log.

Prompt suggeriti nel banner:
- *"Ordina 2 espresso e 1 cappuccino, applica BENVENUTO e fai checkout"*
- *"Mostrami solo i caffè sotto i 2 euro"*
- *"Svuota il carrello e ricomincia"*

## 3. Tool surface

Tutti i tool sono registrati una sola volta a mount dell'app tramite `navigator.modelContext.provideContext({ tools: [...] })`. Lo schema JSON Schema dichiarato per ciascun input è validato dal browser prima dell'esecuzione.

| Tool | Input schema | Side-effect | Conferma utente |
|---|---|---|---|
| `search_products` | `{ query?: string, category?: "espresso" \| "filtro" \| "decaf" \| "latte", max_price?: number }` | read-only, ritorna `Product[]` | no |
| `add_to_cart` | `{ product_id: string, quantity: number (1-10) }` | aggiunge righe al carrello, anima | no |
| `remove_from_cart` | `{ product_id: string }` | rimuove riga | no |
| `apply_coupon` | `{ code: string }` | applica sconto se valido, errore strutturato altrimenti | no |
| `get_cart` | `{}` | read-only, ritorna `{items, subtotal, discount, total}` | no |
| `checkout` | `{}` | svuota carrello, registra ordine in memoria | **sì** (`requestUserInteraction`) |

**Coupon precaricati:**
- `BENVENUTO` → -10% sull'imponibile
- `STUDENTI` → -20% sull'imponibile (massimo €5 di sconto)
- qualunque altro → risposta `isError: true` con messaggio "Coupon non valido" (utile per mostrare che l'agente riceve errori strutturati e li riporta naturalmente all'utente).

**Catalogo prodotti** (hardcoded in `lib/products.ts`, ~8 voci):
- Espresso Classico (`espresso`, €1,50)
- Cappuccino (`latte`, €2,50)
- Macchiato (`latte`, €2,00)
- Caffè Filtro Etiopia (`filtro`, €4,00)
- Caffè Filtro Colombia (`filtro`, €3,80)
- Decaffeinato (`decaf`, €1,80)
- Caffè Americano (`filtro`, €2,20)
- Latte Macchiato (`latte`, €3,00)

Ogni prodotto ha: `id`, `name`, `category`, `price`, `description` (1 riga), `imageUrl` (emoji-art o immagini SVG inline per evitare dipendenze di rete).

## 4. Architettura

### Stack

- **Vite + React 18 + TypeScript** — toolchain minimale, hot reload istantaneo.
- **Tailwind CSS** — styling rapido e coerente.
- **Framer Motion** — animazione "prodotto vola nel carrello" e transizioni Tool Activity Log.
- **Zustand** — un singolo store per carrello, coupon attivo, log invocazioni. Un file, niente boilerplate.
- **`@mcp-b/global`** — polyfill caricato condizionalmente se `navigator.modelContext` non è presente.

Nessun backend. Nessuna persistenza tra refresh (è una demo).

### Struttura file

```
/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── README.md                       # come avviarla + come collegare l'agente
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── styles.css
    ├── components/
    │   ├── Header.tsx              # logo + stato connessione agente + reset
    │   ├── DemoBanner.tsx          # banner con 3 prompt copia-incollabili
    │   ├── ProductGrid.tsx
    │   ├── ProductCard.tsx
    │   ├── Cart.tsx
    │   ├── CartItem.tsx
    │   ├── CheckoutModal.tsx       # modale chiamata da requestUserInteraction
    │   └── ToolActivityLog.tsx     # panel laterale invocazioni live
    ├── lib/
    │   ├── webmcp.ts               # registrazione tool + ponte con lo store
    │   ├── polyfill.ts             # carica @mcp-b/global se necessario
    │   └── products.ts             # catalogo + coupon hardcoded
    └── store/
        └── cart.ts                 # Zustand: items, coupon, log, actions
```

### Boundaries tra moduli

- `store/cart.ts` è la **single source of truth**. Espone azioni pure (`addToCart`, `removeFromCart`, `applyCoupon`, `checkout`, `reset`) e selettori (`getSubtotal`, `getDiscount`, `getTotal`). Non sa nulla di WebMCP.
- `lib/webmcp.ts` è l'**adapter** tra l'API WebMCP e lo store. Ogni `execute` traduce gli args, chiama l'azione corrispondente sullo store, e ritorna il content nel formato atteso dalla spec (`{ content: [{ type: "text", text: "..." }] }`). Logga l'invocazione nello store per il Tool Activity Log.
- I componenti React leggono lo store via hook Zustand e non parlano mai direttamente con WebMCP. In questo modo la UI manuale (click) e la UI agentica (tool) producono lo stesso effetto attraverso lo stesso codice — esattamente il vantaggio di WebMCP che vogliamo mostrare.
- `lib/polyfill.ts` espone una sola funzione `ensureWebMCP(): Promise<void>` che a init verifica `'modelContext' in navigator` e, se assente, importa dinamicamente `@mcp-b/global`. Chiamato una volta da `App.tsx` prima di registrare i tool.

### Stato di connessione agente

In header un indicatore con tre stati:
- 🟢 *WebMCP nativo attivo* (`navigator.modelContext` presente senza polyfill)
- 🟡 *Polyfill MCP-B attivo* (polyfill caricato, in attesa di estensione)
- ⚪ *Nessun agente* (la pagina è usabile a mano)

Lo stato viene determinato a init e aggiornato quando arriva la prima invocazione di tool.

## 5. Gestione errori e edge case

- **Coupon non valido**: `apply_coupon` ritorna `{ content: [{ type: "text", text: "Coupon X non valido" }], isError: true }`. L'agente vede l'errore e può riportarlo all'utente.
- **Quantità fuori range**: lo schema (`quantity: 1-10`) viene validato dalla runtime WebMCP. Se l'agente tenta `quantity: 0` o `quantity: 100`, riceve un errore schema senza che `execute` parta.
- **Prodotto inesistente**: `add_to_cart({product_id: "ghost"})` → `isError: true` con messaggio "Prodotto ghost non trovato".
- **Checkout su carrello vuoto**: `isError: true`, no modale.
- **Utente nega la conferma checkout**: `execute` ritorna `{ content: [{ type: "text", text: "Pagamento annullato dall'utente" }] }` (non è un errore tecnico, è una scelta utente). Il carrello resta intatto.
- **Polyfill non disponibile / offline**: la pagina avvisa "Connessione al polyfill fallita, demo solo manuale" ma resta funzionante.

## 6. Testing

Per una demo di questa scala il test rigoroso è sproporzionato, ma vogliamo evitare brutte sorprese il giorno dell'evento:

- **Smoke test manuale via UI**: ogni feature cliccabile (add, remove, apply coupon, checkout) funziona a mano, indipendentemente da WebMCP.
- **Test della tool surface**: piccolo file `__tests__/webmcp.test.ts` (Vitest) che invoca direttamente le funzioni `execute` registrate e verifica risposte e mutazioni dello store su:
  - happy path di ogni tool
  - errori previsti (coupon non valido, prodotto inesistente, checkout vuoto)
  - sequenza completa add→apply→checkout
- **Verifica end-to-end con agente vero**: dry-run con Claude Desktop + estensione MCP-B almeno una volta nelle 24h prima della demo, sullo stesso laptop e (se possibile) sulla stessa rete.

## 7. Roadmap di implementazione

1. Scaffold Vite + React + TS + Tailwind.
2. Catalogo, store Zustand, UI manuale completa (senza WebMCP). Validare a mano l'intero flusso.
3. Adapter `lib/webmcp.ts` con tutti i 6 tool, registrati in `App.tsx` dopo `ensureWebMCP()`.
4. Tool Activity Log + indicatore connessione agente.
5. Animazione Framer Motion + modale di conferma checkout via `requestUserInteraction`.
6. README con istruzioni Canary + estensione MCP-B + troubleshooting.
7. Test Vitest sulla tool surface.
8. Dry-run end-to-end con agente vero.

## 8. Cosa NON faremo (esplicitamente fuori scope)

- Autenticazione, login, account utente.
- Persistenza ordini (refresh = stato pulito).
- Pagamento reale o integrazione Stripe.
- Spedizione, indirizzi, profili.
- Internazionalizzazione: tutto in italiano, valuta EUR fissa.
- Catalogo dinamico o admin panel.
- Test E2E con Playwright (lo smoke manuale + Vitest sul tool layer è sufficiente per una demo).
- Mobile / responsive perfetto: la demo gira su un laptop con un browser desktop. Funziona su mobile ma non ottimizziamo.

# WebMCP Card-Ready Tools — Design

**Date:** 2026-05-26
**Branch:** new feature branch from `main` (TBD by writing-plans)
**Goal:** ottimizzare il layer dei tool WebMCP di Bella Roma in modo che Claude Desktop riesca a comporre in chat **card markdown ricche e coerenti** a partire dai dati restituiti dai tool, includendo opzioni di personalizzazione, immagini e hint sulle prossime azioni.

## Contesto e motivazione

Lo stato attuale (`main`, commit `59a64fd`) espone 10 tool WebMCP che ritornano **solo testo prosaico in italiano**. Claude Desktop, per renderizzare una "card" del prodotto, deve riparsare quel testo — spesso si arrende e fa eco al payload invece di ricomporlo. Manca anche la struttura sulle opzioni di personalizzazione (es. il selettore latte per il cappuccino non viene esposto in forma scegliibile).

Un tentativo precedente sul branch `feature/mcp-apps-widgets` ha cercato la strada opposta — widget HTML hard-coded serviti via `ui://` (MCP Apps) dal sito tramite polyfill patchato — ed è fallito per restrizioni della catena polyfill+relay e fragilità dei widget per-prodotto. Quel branch è abbandonato; il vendoring/patch del polyfill è deprecato. Si torna ai pacchetti `@mcp-b/global` e `@mcp-b/webmcp-local-relay` **ufficiali**.

Il vero "widget interattivo" (cliccabile) è rimandato a un'iterazione futura in cui ci sarà una chat dentro al sito BellaRoma con accesso diretto ai tool (out of scope qui).

## Goals

1. Le risposte di Claude Desktop dopo una `get_product` / `search_products` / `get_cart` devono apparire come card markdown ben strutturate (immagine, nome, prezzo, attributi a chip, opzioni numerate, CTA testuale).
2. Le opzioni di personalizzazione (size, milk, sweetness) devono essere esposte come **array tipizzato** con `price_delta` e `available` per option, così Claude sa cosa proporre all'utente e cosa è esaurito (con `alternatives` di rimpiazzo).
3. Dopo un `add_to_cart`/altro mutate, Claude deve poter mostrare il carrello aggiornato **senza una `get_cart` di follow-up**.
4. Demo: tutti i 7 prompt in `src/lib/prompts.ts` continuano a funzionare senza regressioni.
5. Demo: il numero di tool resta in fascia 8–12 (qui scende a 9).

## Non-goals

- Widget interattivi cliccabili in chat (rimandato alla chat in-site).
- MCP Apps `ui://` iframe (esplicitamente scartati).
- Cambi al `Product` data model in `src/lib/products.ts`.
- Cambi agli `inputSchema` dei tool — restano identici (toccando solo l'output).
- Cambi all'UI della pagina BellaRoma.
- Internazionalizzazione delle descrizioni (restano in italiano).

## Approccio scelto

**Approccio B — `outputSchema` + payload strutturato**. Ogni tool "view" dichiara un `outputSchema` MCP e ritorna `structuredContent` accanto a un breve `content[0].text` di summary (fallback per client che non leggono `structuredContent`). I tool di mutazione ritornano anche lo stato carrello aggiornato.

**Alternative valutate e scartate**:
- **A — solo descrizioni + JSON nel testo**: zero rischio MCP-feature, ma Claude vede JSON-come-stringa, non `structuredContent` tipizzato. Riparsing fragile.
- **C — ridisegno semantico dei nomi** (`browse`/`view`/`add`/...): rompe README, scenari documentati, log d'attività, polyfill cached. Costo > beneficio.

## Pre-flight (kill criterion)

Prima di toccare i 9 tool, **probe singolo `__probe_structured`** che ritorna:

```json
{
  "content": [{ "type": "text", "text": "ok" }],
  "structuredContent": { "hello": "world", "probe_version": 1 }
}
```

Test manuale: in Claude Desktop chiedere *"chiama __probe_structured e dimmi cosa hai ricevuto"*.
- Se Claude vede `hello: "world"` → via libera per B su entrambe le rotte (native Chrome Canary `registerTool` + polyfill `provideContext`).
- Se vede solo `"ok"` → la catena WebMCP→relay→Claude Desktop perde `structuredContent`. **Si rinuncia a B** e si ripiega su A (JSON stringificato nel `text`) senza forkare il polyfill (vedi [[bellaroma-mcp-packages-official]]).

Il probe va testato su entrambe le rotte:
1. Chrome Canary con `navigator.modelContext` nativo + relay locale.
2. Chrome stabile con polyfill `@mcp-b/global ^2.3.2` + relay locale.

Probe rimosso prima del merge.

## Lista finale dei tool (9, da 10)

| Tool | Tipo | structuredContent.kind | Note |
|---|---|---|---|
| `search_products` | view (lista) | `product_list` | Include `image_url` e `has_customization` per item |
| `get_product` | view (singolo) | `product_card` | Assorbe `show_product_image` come campo `image_url` |
| `get_cart` | view (carrello) | `cart` | Schema condiviso, vedi sotto |
| `add_to_cart` | mutate | `mutation_result` | Embed `cart` aggiornato |
| `remove_from_cart` | mutate | `mutation_result` | Embed `cart` aggiornato |
| `apply_coupon` | mutate | `mutation_result` | Embed `cart` aggiornato |
| `remove_coupon` | mutate | `mutation_result` | Embed `cart` aggiornato |
| `clear_cart` | mutate | `mutation_result` | Embed `cart` (vuoto) |
| `checkout` | mutate | `mutation_result` | Ricevuta + cassa azzerata |

`show_product_image` rimosso netto. Aggiornare README (lista "10 tool" → "9 tool" in introduzione + Step 4 della guida).

## Schemi `structuredContent`

### `kind: "product_card"` — output di `get_product`

```json
{
  "kind": "product_card",
  "product": {
    "id": "cappuccino",
    "name": "Cappuccino",
    "price": 2.50, "currency": "EUR",
    "image_url": "https://cdn.jsdelivr.net/gh/Sgr57/Bella-Roma-WebMCP@main/public/products/editorial/cappuccino.webp",
    "description": "Latte montato a velluto, equilibrio italiano classico.",
    "category": "latte", "type": "drink",
    "available": true,
    "tags": ["signature", "best-seller"],
    "attributes": {
      "intensity": { "value": 6, "scale": 10 },
      "origin": "Italia",
      "flavor_notes": ["chocolate", "nutty"],
      "dietary": [],
      "temperature": "hot",
      "time_of_day": ["morning"]
    },
    "customization": {
      "size": {
        "label": "Size", "default": "M",
        "options": [
          { "id": "S", "label": "Small",  "price_delta": 0.00, "available": true },
          { "id": "M", "label": "Medium", "price_delta": 0.00, "available": true },
          { "id": "L", "label": "Large",  "price_delta": 0.50, "available": true }
        ]
      },
      "milk": {
        "label": "Latte", "default": "milk-whole",
        "options": [
          { "id": "milk-whole",  "label": "Intero",          "price_delta": 0.00, "available": true },
          { "id": "milk-oat",    "label": "Avena",           "price_delta": 0.50, "available": true },
          { "id": "milk-soy",    "label": "Soia",            "price_delta": 0.50, "available": false,
            "alternatives": ["milk-oat", "milk-almond"] },
          { "id": "milk-almond", "label": "Mandorla",        "price_delta": 0.50, "available": true },
          { "id": "milk-lactose-free", "label": "Senza lattosio", "price_delta": 0.30, "available": true }
        ]
      },
      "sweetness": {
        "label": "Zucchero", "default": "normal",
        "options": [
          { "id": "none",   "label": "Senza" },
          { "id": "low",    "label": "Poco" },
          { "id": "normal", "label": "Normale" }
        ]
      }
    },
    "pairings": [
      { "id": "cornetto-vuoto", "name": "Cornetto Vuoto", "price": 1.50, "image_url": "…" }
    ],
    "related_products": [
      { "id": "beans-etiopia-250g", "name": "Chicchi Etiopia 250g",
        "price": 12.00, "image_url": "…", "relation": "take_home" }
    ],
    "alternatives": [],
    "next_actions": [
      {
        "tool": "add_to_cart",
        "intent": "aggiungi questo prodotto con le opzioni scelte",
        "args_template": {
          "product_id": "cappuccino", "quantity": 1,
          "options": { "size": "M", "milk": "milk-whole", "sweetness": "normal" }
        }
      }
    ]
  }
}
```

**Note di schema:**
- `attributes.intensity` è opzionale (mancante su food).
- `customization.*` è opzionale (mancante su prodotti senza opzioni).
- `customization.*.options[].available` opzionale; default `true` quando assente.
- `customization.*.options[].alternatives` opzionale, presente solo quando `available=false`.
- `pairings` e `related_products` sono array di **mini-card** (id + name + price + image_url; `relation` opzionale).
- `next_actions[]` deve avere almeno una entry per i prodotti vendibili.

### `kind: "product_list"` — output di `search_products`

```json
{
  "kind": "product_list",
  "query_summary": "leggero, fruttato, no latte, < €4",
  "total": 3,
  "items": [
    {
      "id": "filtro-etiopia", "name": "Filtro Etiopia",
      "price": 4.00, "currency": "EUR", "image_url": "…",
      "description": "Note floreali e di bergamotto, lavorato a umido.",
      "available": true,
      "intensity": 5, "origin": "Etiopia",
      "flavor_notes": ["floral", "fruity", "berry", "citrus"],
      "dietary": ["vegan", "lactose-free"],
      "tags": ["novità", "signature"],
      "has_customization": false,
      "next_actions": [
        { "tool": "get_product", "args_template": { "product_id": "filtro-etiopia" } },
        { "tool": "add_to_cart", "args_template": { "product_id": "filtro-etiopia", "quantity": 1 } }
      ]
    }
  ]
}
```

**Note di schema:**
- `query_summary` è una sintesi human-readable dei filtri applicati (lo costruisce il backend dall'input args).
- `has_customization: true` → Claude **deve** chiamare `get_product` prima di `add_to_cart`.
- `has_customization: false` → Claude può proporre `add_to_cart` diretto.
- Niente `customization` qui per tenere il payload lista snello (3-15 risultati tipici).

### `kind: "cart"` — output di `get_cart`, embedded nei `mutation_result`

```json
{
  "kind": "cart",
  "lines": [
    {
      "product_id": "cappuccino",
      "name": "Cappuccino",
      "image_url": "…",
      "quantity": 1,
      "options": { "size": "M", "milk": "milk-oat", "sweetness": "normal" },
      "options_label": "M, latte avena (+€0.50), zucchero normale",
      "unit_price": 3.00,
      "line_total": 3.00
    }
  ],
  "subtotal": 3.00,
  "coupon": { "code": "BENVENUTO", "label": "10% sconto", "discount": 0.30 },
  "total": 2.70,
  "currency": "EUR",
  "empty": false,
  "next_actions": [
    { "tool": "checkout",     "intent": "completa l'ordine" },
    { "tool": "apply_coupon", "intent": "applica un coupon" },
    { "tool": "clear_cart",   "intent": "ricomincia da zero" }
  ]
}
```

**Note di schema:**
- `coupon` è `null` se nessun coupon è attivo.
- `empty: true` → niente `lines` (array vuoto), `subtotal`/`total` = 0.
- `options_label` è la stringa pre-formattata pronta da incollare in una card.

### `kind: "mutation_result"` — output di tutti i 6 tool di mutazione

Successo:
```json
{
  "kind": "mutation_result", "ok": true,
  "tool": "add_to_cart",
  "message": "Cappuccino x1 (M, avena) aggiunto. Sconto BENVENUTO attivo.",
  "cart": { /* schema kind:"cart" ricalcolato */ }
}
```

Fallimento (es. milk_option esaurito):
```json
{
  "kind": "mutation_result", "ok": false,
  "tool": "add_to_cart",
  "error": {
    "code": "out_of_stock",
    "message": "Latte di soia esaurito",
    "alternatives": [
      { "id": "milk-oat",    "label": "Avena",    "price_delta": 0.50 },
      { "id": "milk-almond", "label": "Mandorla", "price_delta": 0.50 }
    ]
  },
  "cart": { /* schema kind:"cart" invariato */ }
}
```

**Codici di errore supportati:**
- `product_not_found` — id sconosciuto.
- `out_of_stock` — prodotto o opzione esaurita; `alternatives` popolato quando possibile.
- `invalid_option` — option richiesta non offerta da quel prodotto.
- `quantity_out_of_range` — quantità < 1 o > 10.
- `line_quantity_limit` — totale riga supererebbe 10 (es. esistente 7 + richiesta 5).
- `invalid_coupon` — codice coupon sconosciuto.
- `empty_cart` — checkout su carrello vuoto.
- `user_cancelled` — utente ha rifiutato la conferma checkout.
- `not_in_cart` — `remove_from_cart` su riga non presente.

`error.alternatives` è opzionale e popolato solo quando il codice di errore beneficia di suggerimenti concreti (`out_of_stock`, talvolta `invalid_option`).

### Fallback `content[0].text`

Ogni tool ritorna anche **una riga di summary leggibile** in `content[0].text` per i client che non leggono `structuredContent`:

- `get_product`: `"Cappuccino — €2,50 — Italia — intensità 6/10 — 3 opzioni di personalizzazione"`
- `search_products`: `"3 prodotti trovati per 'leggero fruttato no latte <€4'"`
- `get_cart`: `"Carrello: 2 righe, totale €5,70 (sconto BENVENUTO -€0,30)"`
- `add_to_cart` ok: `"Cappuccino x1 (M, avena) aggiunto. Sconto BENVENUTO attivo."`
- `add_to_cart` ko: `"Latte di soia esaurito. Alternative: avena, mandorla."`
- etc.

## Style guide delle descrizioni dei tool

Template fisso a **4 blocchi**, sempre in italiano, ≤6 righe.

```
[BLOCCO 1 – Purpose] Una frase: cosa fa il tool.
[BLOCCO 2 – Quando] Trigger naturali dell'utente che giustificano la chiamata.
[BLOCCO 3 – Output] structuredContent.kind="<kind>" — campi chiave + direttiva
                    di rendering esplicita ("Renderizza come card markdown con: …").
[BLOCCO 4 – Dopo]   Hint conversazionale: che next_action proporre, cosa chiedere
                    all'utente prima della prossima chiamata.
```

**Regole comuni:**
- Italiano coerente con il resto del catalogo.
- ≤6 righe totali (compreso lo schema input nella mente del lettore).
- Un solo verbo, un solo focus per tool — niente "fa X e Y e Z".
- La parola **Renderizza** è il segnale magico: dove appare, Claude capisce che è una card.
- Mai menzionare `content[0].text` o fallback — è plumbing, non guida la decisione del modello.

**Esempio applicato — `get_product`:**

```
Restituisce la scheda completa di un prodotto del catalogo Bella Roma.
Usalo dopo search_products, o quando l'utente nomina un prodotto specifico
("dimmi del cappuccino", "questo cos'è").
Output: structuredContent.kind="product_card" con image_url, attributes
(intensità/origine/note), customization (size/milk/sweetness con price_delta
e available), pairings, related_products, next_actions. Renderizza come card
markdown: ![immagine](image_url), titolo, prezzo, chip [intensità · origine ·
dietary], descrizione, sezione "Personalizza" con opzioni numerate (mostra
price_delta se > 0 e segnala ESAURITO con alternatives), CTA finale.
Dopo: se customization è presente chiedi le scelte all'utente PRIMA di
chiamare add_to_cart, usando args_template come baseline.
```

**Esempio — `add_to_cart`:**

```
Aggiunge una riga al carrello con quantità e opzioni scelte.
Usalo SOLO dopo che l'utente ha confermato le opzioni di customization
(quando esistono). Se l'utente dice solo "aggiungi cappuccino" e il prodotto
ha customization, chiedi prima latte/size/zucchero invece di assumere i default.
Output: structuredContent.kind="mutation_result" con ok, message, e cart
ricalcolato. Renderizza il message in 1 riga + la card del carrello aggiornata
(no doppia get_cart). In caso di ok=false leggi error.code e error.alternatives
per proporre rimpiazzi.
Dopo: chiedi se vuole completare con checkout o continuare a curiosare.
```

**Esempio — `search_products`:**

```
Cerca prodotti nel catalogo con filtri AND (testo, categoria, prezzo, tag,
dietary, note aromatiche, origine, intensità, momento del giorno).
Usalo quando l'utente chiede un'esplorazione ("qualcosa di leggero",
"cosa avete di vegano") o lista per criteri.
Output: structuredContent.kind="product_list" con query_summary e items[]
(ciascuno con image_url e has_customization). Renderizza come griglia
markdown di card compatte (3-6 risultati max visibili: ![img], nome+prezzo,
1 riga descrizione, chip principali). Se ci sono più di 6 risultati riassumi
in fondo "+N altri" e proponi di restringere.
Dopo: invita l'utente a scegliere uno per get_product, o aggiungere
direttamente se has_customization=false.
```

## Copertura scenari demo

Verifica che i 7 prompt in `src/lib/prompts.ts` siano supportati senza regressioni:

| ID | Prompt | Catena tool | OK |
|----|---|---|---|
| S1 | Leggero e fruttato, no latte, < €4 | `search_products(filters)` → utente sceglie → `add_to_cart(qty:1)` (no customization) | ✅ |
| S2 | Cappuccino + dolce non pesante | `get_product(cappuccino)` → chiedi opzioni → `add_to_cart(...options)` → `search_products(food, max_price:3)` → `add_to_cart` | ✅ |
| S3 | Cappuccino con latte di soia (ESAURITO) | `add_to_cart(milk:"milk-soy")` → `mutation_result.ok=false`, `error.code="out_of_stock"`, `error.alternatives=[milk-oat, milk-almond]` → proponi rimpiazzo → retry | ✅ |
| S4 | Colazione 3 persone max €15, uno decaf | `search_products` x2 + `add_to_cart` x3, budget tracciato via `cart.total` dei `mutation_result` (no `get_cart` extra) | ✅ |
| S5 | Voglio Filtro Etiopia 250g a casa | `get_product(filtro-etiopia)` → leggi `related_products[0]` (`beans-etiopia-250g`, relation: `take_home`) → `add_to_cart(beans)` | ✅ |
| S6 | Cappuccino L, avena, no zucchero | `add_to_cart(cappuccino, options:{size:"L", milk:"milk-oat", sweetness:"none"})` — utente ha specificato tutto, skip chiedi-prima | ✅ |
| S8 | Cosa va bene con quello che ho? | `get_cart()` → per ogni riga `get_product()` per leggere `pairings` → `search_products` se serve → render. N+1 tool call, accettato. | ✅ |

## Rischi e mitigazioni

| Rischio | Severità | Mitigazione |
|---|---|---|
| `structuredContent` si perde nella catena polyfill→relay→Claude Desktop | Alta | Pre-flight `__probe_structured` come kill criterion. Se fallisce, ripiega su Approccio A senza forkare il polyfill. |
| Claude ignora la direttiva "Renderizza come card markdown" e fa eco al JSON | Media | Validare su tutti e 7 i prompt durante implementazione; iterare la wording delle descrizioni se necessario. |
| Schema troppo verbose per i client che parsano `outputSchema` | Bassa | Schema sono concettualmente piccoli (<3KB JSON per `product_card`). Tutti i campi nullable opzionali. |
| `image_url` su Claude Desktop appare come "Show Image" pillola, non inline | Bassa | Documentato nel README. Aspettativa allineata col team. Inline è impossibile senza `ui://`. |
| Test esistenti in `src/lib/__tests__/webmcp.test.ts` falliscono | Media | I test si aspettano il vecchio formato testo; aggiornarli con asserzioni sul nuovo `structuredContent`. |
| `clear_cart`/`remove_coupon`/`checkout` non hanno `inputSchema`, ma il polyfill può richiederlo | Bassa | Già coperti con `{type:"object", properties:{}}` — comportamento preservato. |

## Out of scope (futuri)

- **Chat in-site con accesso diretto ai tool**: superficie alternativa dove i widget sono veri componenti React cliccabili, non card markdown. Approccio totalmente diverso, design separato.
- **Multilingua descrizioni**: oggi italiano fisso.
- **Tool nuovi** (es. `recommend`, `bundle_for_occasion`): YAGNI per ora.
- **Streaming/progress per `checkout`**: lo stato resta sync con `requestUserInteraction` esistente.

## Riferimenti

- Spec catalog precedente: `docs/superpowers/specs/2026-05-13-catalog-expansion-design.md`
- Branch abbandonato: `feature/mcp-apps-widgets` (4 commit, preservato come reference)
- Memorie collegate (auto-memory): `bellaroma-mcp-packages-official`, `claude-desktop-image-rendering-limit`

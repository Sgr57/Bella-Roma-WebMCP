# Catalog Expansion — Design

**Date:** 2026-05-13
**Branch:** `worktree-demo-catalog-expansion`
**Goal:** rendere la demo Bella Roma capace di mostrare 7 scenari "wow" diversi che dimostrano capacità distinte dei WebMCP, mantenendo un set di tool minimale e composto dall'agente.

## Audience & framing

Demo destinata a manager interni che la rivendono a clienti. Stile: catalogo ricco e ben taggato, libero per uso da parte dell'agente, **più** sezione "Prova con l'agente" visibile in UI con 7 prompt killer pre-pronti. Serve sia per improvvisazione in presentazione sia per persone che leggono i prompt e li riusano.

## Filosofia di design

**Tool unitari, agente compositore.** Aggiungiamo *un solo* tool nuovo (`get_product`) ed estendiamo due esistenti (`search_products`, `add_to_cart`). Tutti gli scenari complessi (bundle, pairing, upsell, sostituzione) vengono composti dall'agente combinando primitive piccole. Questa è la lezione narrativa per il cliente: i WebMCP non sono feature di alto livello, sono primitive che abilitano composizione.

## Scenari coperti

| ID | Prompt esempio | Capacità mostrata | Tool usati |
|----|---|---|---|
| S1 | "Qualcosa di leggero e fruttato, senza latte, sotto i 4€" | Filtri compositi da linguaggio naturale | `search_products` |
| S2 | "Sto prendendo un cappuccino, abbinaci qualcosa di dolce ma non pesante" | Ragionamento cross-prodotto via pairing | `get_product` + `search_products` + `add_to_cart` |
| S3 | "Cappuccino con latte di soia" *(soia OOS)* | Awareness stato live + sostituzione ragionata | `add_to_cart` (lazy) **o** `get_product` (eager) |
| S4 | "Ordine colazione per 3 persone, max 15€, uno deve essere decaffeinato" | Multi-step con vincoli | `search_products` × N + `add_to_cart` × N |
| S5 | "Mi è piaciuto il filtro Etiopia, voglio portarmene a casa 250g" | Cross-modal bar ↔ take-home | `get_product` + `add_to_cart` |
| S6 | "Cappuccino grande con latte d'avena, senza zucchero" | Customizzazione via options | `add_to_cart` con options |
| S8 | "Cosa va bene con quello che ho già nel carrello?" | Awareness del carrello | `get_cart` + `get_product` + `search_products` |

## Schema dati

### `Product` esteso

```ts
type ProductType = "drink" | "food" | "beans" | "capsule" | "milk_option";
type FlavorNote = "floral" | "fruity" | "chocolate" | "caramel"
                | "nutty" | "citrus" | "spicy" | "honey" | "berry";
type Dietary = "vegan" | "lactose-free" | "gluten-free" | "no-caffeine";
type TimeOfDay = "morning" | "afternoon" | "evening" | "anytime";
type Temperature = "hot" | "iced" | "ambient";
type SizeOption = "S" | "M" | "L";
type SweetnessOption = "none" | "low" | "normal";

interface ProductOptions {
  size?: {
    values: SizeOption[];
    price_modifier: Partial<Record<SizeOption, number>>;
    default: SizeOption;
  };
  milk?: {
    values: string[];      // ids di prodotti type="milk_option"
    default: string;
  };
  sweetness?: {
    values: SweetnessOption[];
    default: SweetnessOption;
  };
}

interface Product {
  id: string;
  name: string;
  type: ProductType;
  category: ProductCategory;          // legacy: espresso/filtro/decaf/latte; estesa con "food"/"beans"/"capsule"
  price: number;
  description: string;
  emoji: string;

  intensity?: number;                  // 1-10, per-product
  origin?: string;                     // "Etiopia", "Colombia", "Italia", "Brasile"
  flavor_notes?: FlavorNote[];
  dietary?: Dietary[];
  temperature?: Temperature;
  tags?: string[];                     // "signature", "best-seller", "limited", "novità"
  time_of_day?: TimeOfDay[];
  pairings?: string[];                 // ids di prodotti consigliati in pairing
  related_products?: string[];         // ids di varianti cross-modal
  available: boolean;
  alternatives?: string[];             // ids di alternative coerenti se OOS
  options?: ProductOptions;
}
```

### `ProductCategory` estesa

Da `"espresso"|"filtro"|"decaf"|"latte"` a aggiungere `"cold"|"food"|"beans"|"capsule"`.

### Semantica di `dietary`

`dietary` rappresenta i requisiti del prodotto **nella sua configurazione di default**, non con tutte le possibili `options.milk`. Esempi:

- `espresso.dietary = ["vegan", "lactose-free"]` (no latte intrinsecamente)
- `filtro-etiopia.dietary = ["vegan", "lactose-free"]`
- `cappuccino.dietary = []` (default = latte intero)
- `decaffeinato.dietary = ["no-caffeine"]`

Conseguenza: un prompt "qualcosa di vegan" trova i drink che lo sono di default. Per il cappuccino vegan è l'agente a comporre il flusso: `get_product(cappuccino)` → vede `options.milk` con valori plant-based → propone `add_to_cart(cappuccino, 1, {milk: "milk-oat"})`. Comportamento esplicito nello spec, l'agente deve essere capace di farlo.

`milk_option` ha proprio `dietary`: serve per filtri tipo "ho un'intolleranza al lattosio, che latti vegetali avete?".

### Cart row con options (S6)

Il `CartItem` corrente è `{ productId, quantity }`. Esteso:

```ts
interface CartItem {
  productId: string;
  quantity: number;
  options?: {
    size?: SizeOption;
    milk?: string;        // id del milk_option
    sweetness?: SweetnessOption;
  };
}
```

Righe con `options` differenti sono righe distinte nel carrello. Il prezzo della riga = `price_base + size_modifier + milk_modifier` (le altre options sono gratuite).

## Catalogo proposto

### Drink (13)

| id | nome | categoria | prezzo | intensità | origin | flavor | dietary | options | available |
|----|------|-----------|--------|-----------|--------|--------|---------|---------|----|
| espresso | Espresso Classico | espresso | 1.50 | 9 | Italia | chocolate, caramel | — | size, sweetness | ✓ |
| doppio | Doppio Espresso | espresso | 2.50 | 10 | Italia | chocolate, nutty | — | sweetness | ✓ |
| ristretto | Ristretto | espresso | 1.60 | 10 | Italia | chocolate, spicy | — | sweetness | ✓ |
| macchiato | Macchiato | latte | 2.00 | 8 | Italia | chocolate | — | milk, sweetness | ✓ |
| americano | Caffè Americano | filtro | 2.20 | 6 | Italia | chocolate | — | size, sweetness | ✓ |
| cappuccino | Cappuccino | latte | 2.50 | 6 | Italia | chocolate, nutty | — | size, milk, sweetness | ✓ |
| flat-white | Flat White | latte | 3.00 | 7 | Italia | chocolate, caramel | — | milk, sweetness | ✓ |
| latte-macchiato | Latte Macchiato | latte | 3.00 | 4 | Italia | nutty, honey | — | size, milk, sweetness | ✓ |
| mocha | Mocha | latte | 3.50 | 6 | Italia | chocolate | — | size, milk, sweetness | ✓ |
| shakerato | Caffè Shakerato | cold | 3.50 | 7 | Italia | chocolate, caramel | — | sweetness | ✓ |
| decaffeinato | Decaffeinato | decaf | 1.80 | 3 | Italia | chocolate, nutty | no-caffeine | size, milk, sweetness | ✓ |
| filtro-etiopia | Filtro Etiopia | filtro | 4.00 | 5 | Etiopia | floral, fruity, berry, citrus | — | — | ✓ |
| filtro-colombia | Filtro Colombia | filtro | 3.80 | 5 | Colombia | caramel, chocolate, nutty | — | — | ✓ |

Tag/time_of_day rilevanti:
- `cappuccino`, `latte-macchiato`, `cornetto*` → `time_of_day: ["morning"]`
- `espresso`, `doppio` → `time_of_day: ["anytime"]`, tag `["best-seller"]`
- `filtro-etiopia` → tag `["novità", "signature"]`, `time_of_day: ["morning","afternoon"]`
- `decaffeinato` → `time_of_day: ["evening","afternoon"]`, tag `["promo"]`
- `shakerato` → `temperature: "iced"`, tag `["limited", "estate"]`

Pairings drink→food (per S2):
- `cappuccino.pairings = ["cornetto-vuoto", "cornetto-cioccolato"]`
- `espresso.pairings = ["biscotti-cantucci", "tiramisu"]`
- `americano.pairings = ["cornetto-vuoto", "biscotti-cantucci"]`
- `mocha.pairings = ["biscotti-cantucci"]`

related_products drink→beans/capsule (per S5):
- `filtro-etiopia.related_products = ["beans-etiopia-250g"]`
- `filtro-colombia.related_products = ["beans-colombia-250g"]`
- `espresso.related_products = ["beans-italian-blend-250g", "capsule-espresso-10pz"]`
- `decaffeinato.related_products = ["capsule-decaf-10pz"]`

### Food (4)

| id | nome | prezzo | dietary | pairings |
|----|------|--------|---------|---|
| cornetto-vuoto | Cornetto Vuoto | 1.50 | — | cappuccino, americano |
| cornetto-cioccolato | Cornetto al Cioccolato | 1.80 | — | cappuccino |
| biscotti-cantucci | Cantucci alle Mandorle | 2.50 | — | espresso, americano |
| tiramisu | Tiramisù della Casa | 4.50 | — | espresso |

Tag: tutti `time_of_day: ["morning"]` tranne `tiramisu: ["afternoon","evening"]`.

### Beans take-home (3)

| id | nome | prezzo | origin | flavor | related_products |
|----|------|--------|--------|--------|---|
| beans-etiopia-250g | Chicchi Etiopia 250g | 12.00 | Etiopia | floral, fruity, citrus | filtro-etiopia |
| beans-colombia-250g | Chicchi Colombia 250g | 11.00 | Colombia | caramel, chocolate, nutty | filtro-colombia |
| beans-italian-blend-250g | Italian Blend 250g | 9.00 | Italia | chocolate, nutty | espresso |

### Capsule (2)

| id | nome | prezzo | related_products |
|----|------|--------|---|
| capsule-espresso-10pz | Capsule Espresso 10pz | 4.50 | espresso |
| capsule-decaf-10pz | Capsule Decaf 10pz | 5.00 | decaffeinato |

### Milk options (5, `type:"milk_option"`)

Non in vendita diretta. Riferiti via `options.milk.values` dei drink.

| id | nome | price_modifier | dietary | available |
|----|------|---------------|---------|----|
| milk-whole | Latte intero | +0.00 | — | ✓ |
| milk-oat | Latte d'avena | +0.50 | vegan, lactose-free | ✓ |
| milk-soy | Latte di soia | +0.50 | vegan, lactose-free | **✗ (OOS per S3)** |
| milk-almond | Latte di mandorla | +0.50 | vegan, lactose-free | ✓ |
| milk-lactose-free | Lactose-free | +0.30 | lactose-free | ✓ |

`milk-soy.alternatives = ["milk-oat", "milk-almond"]` (entrambi plant-based, profilo simile).

**Totale catalogo:** 13 drink + 4 food + 3 beans + 2 capsule + 5 milk = **27 entry**, di cui ~22 effettivamente in vendita diretta.

## Tool finali (7 totali)

### 1. `search_products` (esteso)

Input schema (campi nuovi in grassetto):

```json
{
  "query": "string?",
  "category": "espresso|filtro|decaf|latte|cold|food|beans|capsule",
  "max_price": "number?",
  "type": "drink|food|beans|capsule",
  "tags": "string[]?",
  "dietary": "(vegan|lactose-free|gluten-free|no-caffeine)[]?",
  "flavor_notes": "FlavorNote[]?",
  "origin": "string?",
  "intensity_min": "number?",
  "intensity_max": "number?",
  "time_of_day": "(morning|afternoon|evening|anytime)?",
  "in_stock_only": "boolean? (default false)"
}
```

Tutti i filtri sono in AND. Per `tags`, `dietary`, `flavor_notes` la semantica è "il prodotto deve avere tutti i valori richiesti".

Output: lista compatta `- {name} ({id}, {category}, intensità {n}, {origin}) — €{price} — {description}` (no pairings/related per non inquinare; usare get_product per dettagli).

I `milk_option` sono esclusi dai risultati a meno che `type:"milk_option"` non sia esplicito.

### 2. `get_product(product_id)` — **nuovo**

Input: `{ product_id: string }`.

Output: scheda formattata con tutti i campi del prodotto, incluse sezioni:
- Intensità, origin, flavor_notes, dietary, temperature, time_of_day, tags
- `available`. Se `available=false`, evidenziato + `alternatives` con nome dei prodotti (non solo id)
- `pairings`: lista `id — nome` (vuota se assente)
- `related_products`: idem
- `options`: per ogni option, valori disponibili + default + modifier di prezzo

Se `product_id` non esiste → error strutturato.

### 3. `add_to_cart(product_id, quantity, options?)` (esteso)

Input:

```json
{
  "product_id": "string",
  "quantity": "integer 1..10",
  "options": {
    "size": "S|M|L?",
    "milk": "string? (id di un milk_option)",
    "sweetness": "none|low|normal?"
  }
}
```

Logica:
1. Se `product_id` non esiste → errore.
2. Se `product_id` non è `available` → errore strutturato con `alternatives[]` del prodotto.
3. Se `options.milk` punta a un `milk_option` non `available` → errore strutturato con `alternatives[]` del milk option. **Questo è il path "lazy" di S3.**
4. Se le `options` richieste non sono offerte dal prodotto (es. `size` su un drink che non ha `options.size`) → errore esplicativo.
5. Altrimenti aggiunge al carrello una riga distinta per la combinazione `(product_id, options)`. Il prezzo è calcolato e mostrato nel messaggio di risposta.

L'errore strutturato è del tipo:

> Prodotto/Opzione "X" non disponibile. Alternative simili: latte d'avena (milk-oat, +0,50€), latte di mandorla (milk-almond, +0,50€).

### 4-7. `remove_from_cart`, `apply_coupon`, `get_cart`, `checkout`

Invariati. `remove_from_cart` accetta `product_id` e rimuove la **prima** riga matchante (sufficient per la demo). `get_cart` mostra ogni riga con le options nella descrizione: "Cappuccino L, latte d'avena, no zucchero (x1) — €3,50".

## Cart store changes

`src/store/cart.ts` deve gestire righe con `options`. Hash key per riga = `${productId}|${JSON.stringify(options ?? {})}`. `addItem` con stessa hash key incrementa `quantity`; altrimenti crea nuova riga.

## UI changes

### `ProductCard`
- Intensità mostrata da `product.intensity` (campo nuovo), non più derivata da categoria. Drink senza `intensity` → barra nascosta.
- Badge "Esaurito" se `!available`.
- Tag visibili come pill (max 2-3): `signature`, `novità`, `promo`, `limited` se presenti.
- "Aggiungi" disabilitato se `!available`.

### `ProductGrid`
- Aggiungere chip di filtro tipo (`Tutti / Drink / Food / Take-home`) in alto. Cliccabili lato browser, non modificano i tool.
- Sezione `non drink` (food/beans/capsule) sotto la griglia principale, con titolo "Per portare a casa" e "Da accompagnare".

### Nuovo componente `TryWithAgent` (sopra il catalogo)
Sezione visibile con titolo "Prova con l'agente" e 7 card-prompt cliccabili. Cliccare → copia il prompt negli appunti + toast "Copiato! Incollalo nell'agente.". Ogni card ha:
- Numero (S1..S8)
- Prompt
- Una riga di descrizione: "Filtri compositi" / "Pairing" / "Sostituzione live" / ...

### `CartItem`
- Mostra le options selezionate sotto il nome ("Grande · Avena · No zucchero").

## Test

- `products.test.ts`: schema del Product (presenza campi obbligatori, validità dei riferimenti `pairings`/`related_products`/`options.milk.values`).
- `cart.test.ts`: righe distinte per options diverse; incrementa la stessa riga se options identiche.
- `webmcp.test.ts`: testa i nuovi rami di `search_products` (tags, dietary, flavor_notes, intensity_min/max, in_stock_only) e `add_to_cart` (options valide, options non offerte, milk OOS con alternatives). Testa `get_product` su prodotto esistente, OOS, inesistente.

## Out of scope (per ora)

- Tool di alto livello (`build_bundle`, `suggest_pairings`, ecc.) — l'agente compone primitive.
- Sconti dinamici via tag eligibility (S7) — non scelto.
- Comparazione strutturata (S10) — non scelto.
- Stock numerico — solo boolean `available`.
- Multi-row select in carrello (rimuovere riga specifica con options) — `remove_from_cart` rimuove la prima riga matchante.

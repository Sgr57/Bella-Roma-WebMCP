# WebMCP — Ricerca e possibili utilizzi

> Sintesi aggiornata a maggio 2026. WebMCP è una proposta W3C ancora in evoluzione: dettagli specifici dell'API possono cambiare.

## 1. Che cos'è WebMCP

**WebMCP (Web Model Context Protocol)** è una proposta di standard web che permette a qualsiasi sito di esporre le proprie funzionalità come **tool** invocabili da agenti AI direttamente nel browser, senza dover scrivere uno scraper o pilotare la UI tramite DOM/screenshot.

- Sviluppato in **W3C Web Machine Learning Community Group**, editori da Google e Microsoft.
- **W3C Draft Community Group Report pubblicato il 10 febbraio 2026**.
- Disponibile in **early preview in Chrome 146 Canary** dietro flag; Edge in arrivo, Firefox e Safari non hanno ancora annunciato impegni.
- Repo di riferimento: [`webmachinelearning/webmcp`](https://github.com/webmachinelearning/webmcp); polyfill e SDK comunitari sotto l'org [`WebMCP-org`](https://github.com/WebMCP-org/) (ex MCP-B).

### Differenza con MCP "classico"

| | MCP (Anthropic) | WebMCP |
|---|---|---|
| Trasporto | JSON-RPC su stdio/HTTP | API JavaScript nel browser (`navigator.modelContext`) |
| Dove gira | Server (locale o hosted) | Lato client, dentro la pagina |
| Stato/sessione | Server mantiene contesto | La pagina viva è il contesto |
| Autenticazione | Gestita dal server MCP | Eredita la sessione del browser (cookies, SSO, ecc.) |
| Discovery | Catalogo MCP / config client | Tool registrati dalla pagina che l'utente sta visitando |

WebMCP **non sostituisce** MCP: è una superficie diversa per esporre tool al modello quando l'utente è già nel browser.

## 2. Come funziona l'API

Punto d'ingresso: `navigator.modelContext`.

### Esempio minimo (dalla spec)

```javascript
if ("modelContext" in window.navigator) {
  navigator.modelContext.provideContext({
    tools: [{
      name: "add-stamp",
      description: "Add a new stamp to the collection",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          year: { type: "number" }
        },
        required: ["name", "year"]
      },
      execute({ name, year }, agent) {
        addStamp(name, year);
        return { content: [{ type: "text", text: "Stamp added!" }] };
      }
    }]
  });
}
```

### Metodi principali

- `provideContext({ tools })` — registra l'intera lista, azzerando la precedente.
- `registerTool(tool)` / `unregisterTool(name)` — gestione incrementale dei tool.
- Ogni tool dichiara: `name` univoco, `description` in linguaggio naturale, `inputSchema` (JSON Schema), `execute(args, agent)` (async).

### Mediazione utente

L'agent passato a `execute` espone `requestUserInteraction()`, una API per richiedere conferma o input umano durante l'esecuzione del tool:

```javascript
const ok = await agent.requestUserInteraction(async () =>
  confirm("Vuoi davvero pagare €120,00?")
);
```

Le invocazioni sono **serializzate sul main thread**, così lo stato della UI rimane sincronizzato con quello che l'agent osserva.

### Integrazione React (SDK comunitario)

```javascript
import { useWebMCP } from "@mcp-b/react-webmcp";

useWebMCP({
  name: "search-products",
  description: "Search the catalog by query and category",
  inputSchema: { /* ... */ },
  execute: async ({ query, category }) => runSearch(query, category)
});
```

## 3. Stato del supporto

- **Chrome 146 Canary** (early preview, dietro flag, programma EPP).
- **Polyfill MCP-B** (`@mcp-b/global`) per browser non ancora compatibili, con estensione che bridge i tool delle tab aperte verso client MCP locali (es. Claude Desktop).
- **Cross-browser**: nessuna implementazione stabile. La spec è ancora Community Group, non Standards Track.

## 4. WebMCP vs alternative

| Approccio | Quando usarlo |
|---|---|
| **API REST / MCP server backend** | L'agent ha bisogno di accesso diretto a dati e sistemi, senza una pagina viva. |
| **Browser automation (Playwright, browser-use, Claude in Chrome)** | Devi operare la stessa UI di un umano: testing, automazione di siti terzi senza cooperazione, "computer use". |
| **WebMCP** | L'utente è già nel browser e usa la tua app; vuoi un'azione strutturata, idempotente, sotto il controllo dell'utente. |

Vantaggi rispetto a DOM scraping / vision:
- **Affidabilità**: nessuna inferenza su HTML o screenshot.
- **Token efficiency**: niente snapshot/accessibility tree giganti nel contesto del modello.
- **Riuso**: il tool riusa la stessa logica del frontend.
- **Sicurezza**: l'esecuzione resta nel sandbox del sito, eredita auth e CSP.

## 5. Possibili utilizzi

### 5.1 E-commerce
- Tool: `search_products`, `add_to_cart`, `apply_coupon`, `checkout`.
- Beneficio: l'agent completa ordini multi-step (ricerca → filtri → carrello → coupon → pagamento) senza simulare click su elementi che cambiano layout.
- Conferma utente prima di pagamenti / azioni irreversibili via `requestUserInteraction`.

### 5.2 SaaS / dashboard B2B
- CRM, project management, billing, analytics: l'agent traduce intenti in operazioni strutturate ("crea una opportunità da 50k per ACME chiusura Q3").
- Riduce la "curva di apprendimento" di tool enterprise complessi (AWS Console, Salesforce, Jira).
- **Implicazione strategica** (Builder.io): i copilot proprietari dei singoli SaaS diventano meno strategici se un assistente cross-app può agire ovunque tramite WebMCP. Il valore si sposta su dominio + accesso privilegiato ai dati.

### 5.3 Customer support / self-service
- Espone azioni come `get_order_status`, `start_return`, `escalate_to_human`, `update_address`.
- L'agent può completare flussi che normalmente richiedono operatore, con audit trail e consenso esplicito.

### 5.4 Travel & booking
- Tool: `search_flights`, `hold_seat`, `confirm_booking`.
- Combina sessione utente (preferenze, miglia) con esecuzione strutturata.

### 5.5 Accessibilità
- Espone azioni di alto livello (`add_to_cart` invece di "clicca questo bottone"): le tecnologie assistive possono offrire all'utente un'interfaccia conversazionale anche su app difficili da navigare con accessibility tree tradizionale.
- **Caveat**: WebMCP non sostituisce l'accessibilità tradizionale, la affianca. L'utente deve poter sempre prendere il controllo.

### 5.6 Sviluppo interno / automazioni
- Userscript AI: l'estensione MCP-B raccoglie tool dalle tab aperte e li espone a Claude Desktop, abilitando flussi tipo "aggrega dati da queste 3 dashboard interne e mandami un riassunto".
- Test E2E aumentati: tool WebMCP usati come hook deterministici da framework di testing.

### 5.7 Sviluppo developer-tooling
- Browser DevTools, IDE web (StackBlitz, CodeSandbox), notebook: l'agent può chiamare tool come `run_cell`, `format_code`, `open_file` invece di simulare scorciatoie da tastiera.

### 5.8 Finanza personale / accounting
- Tool sicuri per categorizzare transazioni, generare report, esportare CSV — con `requestUserInteraction` sui movimenti monetari.

### 5.9 Knowledge work / Copilot orizzontali
- Documenti collaborativi, lavagne (Figma/FigJam), wiki: il modello esegue azioni di editing/strutturazione invece di "scrivere intorno" al contenuto.

## 6. Rischi e questioni aperte

### 6.1 Sicurezza
- **Tool poisoning**: descrizioni o input schema malevoli possono iniettare istruzioni nel prompt del modello. La descrizione del tool è parte del contesto LLM ed è controllata dal sito.
- **Consenso utente**: la spec attuale lascia la trust decision al sito stesso. Manca (per ora) un meccanismo standard "il sito X vuole esporre N tool al tuo agent, autorizzi?".
- **Confused deputy**: l'agent può essere indotto da contenuti di terze parti (commenti, prodotti, email mostrate) a invocare tool sensibili a nome dell'utente.
- **Mitigazioni raccomandate**: least privilege sui tool, consenso esplicito su azioni distruttive/finanziarie, allowlist, log, conferma umana sintetizzata via `requestUserInteraction`.

### 6.2 Limiti della spec
- **Nessun headless**: serve un browsing context visibile; non utile per scraping/batch.
- **Discovery preliminare assente**: l'agent deve già essere sulla pagina per vedere i tool. Si discute un futuro manifest dichiarativo.
- **Schema vs implementazione**: oggi accoppiati; idea aperta di separarli per discovery senza esecuzione.
- **Approccio ibrido**: si valuta un evento DOM "toolcall" interrompibile (analogo a `fetch` event nei Service Worker) con `preventDefault()` / `respondWith()`.

### 6.3 SEO / GEO
- Esiste una corrente "AEO" (Agent Experience Optimization) che vede WebMCP come l'analogo agentico di structured data: chi non espone tool diventa invisibile per agenti che preferiscono integrazioni strutturate al DOM scraping. Da pesare con cautela: ancora poco supporto reale lato browser.

## 7. Roadmap di lavoro suggerita per una sperimentazione

1. Leggere proposta + esempi ufficiali (`webmachinelearning/webmcp`).
2. Provare il polyfill **MCP-B** (`@mcp-b/global`, `@mcp-b/react-webmcp`) su una mini-app React.
3. Definire 3–5 tool che coprano il flusso più frequente dell'app.
4. Aggiungere `requestUserInteraction` sui tool con side-effect.
5. Validare con: estensione MCP-B → Claude Desktop, oppure Chrome Canary 146 + flag EPP.
6. Stilare una "tool surface policy" (cosa esporre, a chi, con quali conferme).

## 8. Risorse principali

### Ufficiali
- [Spec — WebMCP draft](https://webmachinelearning.github.io/webmcp/)
- [Proposal — API design](https://webmachinelearning.github.io/webmcp/docs/proposal.html)
- [GitHub — webmachinelearning/webmcp](https://github.com/webmachinelearning/webmcp)
- [Chrome for Developers — WebMCP early preview](https://developer.chrome.com/blog/webmcp-epp)

### Implementazioni e SDK
- [WebMCP-org (ex MCP-B)](https://github.com/WebMCP-org/)
- [Examples repo (carrello, task manager)](https://github.com/WebMCP-org/examples)
- [`@mcp-b/webmcp-ts-sdk`](https://www.npmjs.com/package/@mcp-b/webmcp-ts-sdk)
- [MCP-B docs](https://docs.mcp-b.ai/)
- [Chrome DevTools + WebMCP quickstart](https://github.com/WebMCP-org/chrome-devtools-quickstart)

### Analisi e opinioni
- [VentureBeat — Chrome ships WebMCP in early preview](https://venturebeat.com/infrastructure/google-chrome-ships-webmcp-in-early-preview-turning-every-website-into-a)
- [Builder.io — Everyone's missing the point of WebMCP](https://www.builder.io/blog/webmcp)
- [Scalekit — Browser agents without DOM scraping](https://www.scalekit.com/blog/webmcp-the-missing-bridge-between-ai-agents-and-the-web)
- [Webfuse — What is WebMCP](https://www.webfuse.com/blog/what-is-webmcp-the-practical-guide-to-the-web-model-context-protocol)
- [Webfuse — WebMCP cheat sheet 2026](https://www.webfuse.com/webmcp-cheat-sheet)
- [innFactory — W3C standard analysis](https://innfactory.ai/en/blog/webmcp-w3c-web-standard-ai-agents/)
- [Arcade.dev — Interview with Alex Nahas](https://www.arcade.dev/blog/web-mcp-alex-nahas-interview/)
- [Bogdan Cerovac — Accessibility e WebMCP](https://cerovac.com/a11y/2026/03/webmcp-and-the-future-of-the-agentic-web-do-not-leave-accessibility-behind/)
- [Semrush — WebMCP per marketer/SEO](https://www.semrush.com/blog/webmcp/)

### Sicurezza
- [Known Security Issues With WebMCP (wiki)](https://github.com/MiguelsPizza/WebMCP/wiki/Known-Security-Issues-With-WebMCP)
- [Microsoft — Indirect prompt injection in MCP](https://developer.microsoft.com/blog/protecting-against-indirect-injection-attacks-mcp)
- [MCP Security best practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices)
- [Simon Willison — MCP prompt injection problems](https://simonwillison.net/2025/Apr/9/mcp-prompt-injection/)

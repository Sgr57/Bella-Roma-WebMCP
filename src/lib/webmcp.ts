import { PRODUCTS, getProductById, COUPONS } from "./products";
import { useCartStore } from "../store/cart";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

type Agent = {
  requestUserInteraction: <T>(fn: () => Promise<T> | T) => Promise<T>;
};

type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>, agent: Agent) => Promise<ToolResult>;
};

function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}
function err(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

function formatProduct(id: string, qty: number): string {
  const p = getProductById(id);
  if (!p) return `${id} x${qty}`;
  return `${p.name} x${qty} (€${(p.price * qty).toFixed(2)})`;
}

export function buildTools(): Tool[] {
  return [
    {
      name: "search_products",
      description:
        "Cerca prodotti nel catalogo del coffee shop. Permette di filtrare per categoria, prezzo massimo o testo libero.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Testo libero da cercare nel nome o descrizione",
          },
          category: {
            type: "string",
            enum: ["espresso", "filtro", "decaf", "latte"],
            description: "Categoria del prodotto",
          },
          max_price: { type: "number", description: "Prezzo massimo in euro" },
        },
      },
      async execute(args) {
        const { query, category, max_price } = args as {
          query?: string;
          category?: string;
          max_price?: number;
        };
        const q = (query ?? "").toLowerCase().trim();
        const results = PRODUCTS.filter((p) => {
          if (category && p.category !== category) return false;
          if (typeof max_price === "number" && p.price > max_price) return false;
          if (q && !`${p.name} ${p.description}`.toLowerCase().includes(q))
            return false;
          return true;
        });
        const result = results.length
          ? results
              .map(
                (p) =>
                  `- ${p.name} (id: ${p.id}, ${p.category}) — €${p.price.toFixed(
                    2
                  )} — ${p.description}`
              )
              .join("\n")
          : "Nessun prodotto trovato.";
        useCartStore
          .getState()
          .logToolCall("search_products", args, `${results.length} risultati`);
        return ok(result);
      },
    },
    {
      name: "add_to_cart",
      description: "Aggiunge un prodotto al carrello in una certa quantità.",
      inputSchema: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "L'id del prodotto" },
          quantity: { type: "integer", minimum: 1, maximum: 10 },
        },
        required: ["product_id", "quantity"],
      },
      async execute(args) {
        const { product_id, quantity } = args as {
          product_id: string;
          quantity: number;
        };
        const okAdd = useCartStore.getState().addItem(product_id, quantity);
        if (!okAdd) {
          useCartStore
            .getState()
            .logToolCall("add_to_cart", args, "errore: prodotto non trovato");
          return err(`Prodotto "${product_id}" non trovato.`);
        }
        const msg = `Aggiunto: ${formatProduct(product_id, quantity)}.`;
        useCartStore.getState().logToolCall("add_to_cart", args, msg);
        return ok(msg);
      },
    },
    {
      name: "remove_from_cart",
      description: "Rimuove un prodotto dal carrello.",
      inputSchema: {
        type: "object",
        properties: {
          product_id: { type: "string" },
        },
        required: ["product_id"],
      },
      async execute(args) {
        const { product_id } = args as { product_id: string };
        const removed = useCartStore.getState().removeItem(product_id);
        if (!removed) {
          useCartStore
            .getState()
            .logToolCall("remove_from_cart", args, "non era nel carrello");
          return err(`"${product_id}" non era nel carrello.`);
        }
        const msg = `Rimosso "${product_id}" dal carrello.`;
        useCartStore.getState().logToolCall("remove_from_cart", args, msg);
        return ok(msg);
      },
    },
    {
      name: "apply_coupon",
      description:
        "Applica un codice sconto al carrello. Codici disponibili: BENVENUTO (10%), STUDENTI (20% max €5).",
      inputSchema: {
        type: "object",
        properties: {
          code: { type: "string" },
        },
        required: ["code"],
      },
      async execute(args) {
        const { code } = args as { code: string };
        const okC = useCartStore.getState().applyCoupon(code);
        if (!okC) {
          useCartStore.getState().logToolCall("apply_coupon", args, "non valido");
          const available = Object.keys(COUPONS).join(", ");
          return err(`Coupon "${code}" non valido. Disponibili: ${available}.`);
        }
        const msg = `Coupon ${code.toUpperCase()} applicato.`;
        useCartStore.getState().logToolCall("apply_coupon", args, msg);
        return ok(msg);
      },
    },
    {
      name: "get_cart",
      description: "Ritorna il contenuto corrente del carrello con totali.",
      inputSchema: { type: "object", properties: {} },
      async execute() {
        const s = useCartStore.getState();
        if (s.items.length === 0) {
          useCartStore.getState().logToolCall("get_cart", {}, "vuoto");
          return ok("Il carrello è vuoto.");
        }
        const lines = s.items.map(
          (it) => `- ${formatProduct(it.productId, it.quantity)}`
        );
        const summary = [
          ...lines,
          `Subtotale: €${s.subtotal().toFixed(2)}`,
          s.coupon
            ? `Sconto (${s.coupon}): -€${s.discount().toFixed(2)}`
            : "Nessun coupon applicato",
          `Totale: €${s.total().toFixed(2)}`,
        ].join("\n");
        useCartStore
          .getState()
          .logToolCall("get_cart", {}, `${s.items.length} righe`);
        return ok(summary);
      },
    },
    {
      name: "checkout",
      description:
        "Conferma l'ordine e completa il pagamento. Richiede conferma esplicita dell'utente.",
      inputSchema: { type: "object", properties: {} },
      async execute(_args, agent) {
        const s = useCartStore.getState();
        if (s.items.length === 0) {
          useCartStore.getState().logToolCall("checkout", {}, "carrello vuoto");
          return err("Il carrello è vuoto, niente da pagare.");
        }
        const total = s.total();
        const confirmed = await agent.requestUserInteraction(async () => {
          return window.confirm(
            `Vuoi confermare il pagamento di €${total.toFixed(2)}?`
          );
        });
        if (!confirmed) {
          useCartStore
            .getState()
            .logToolCall("checkout", {}, "annullato dall'utente");
          return ok("Pagamento annullato dall'utente.");
        }
        const result = useCartStore.getState().checkout();
        const msg = `Ordine confermato! Totale pagato: €${result.total.toFixed(2)}.`;
        useCartStore.getState().logToolCall("checkout", {}, msg);
        return ok(msg);
      },
    },
  ];
}

export function registerTools(): void {
  if (!navigator.modelContext) {
    console.warn(
      "[webmcp] navigator.modelContext not available, skipping registration"
    );
    return;
  }
  // @mcp-b/global ambient types declare stricter ToolDescriptor/InputSchema
  // signatures than the WebMCP draft spec. Our local Tool shape matches the
  // spec and works at runtime; cast bridges the mismatch at the boundary.
  (navigator.modelContext as { provideContext: (cfg: { tools: unknown[] }) => void })
    .provideContext({ tools: buildTools() });
}

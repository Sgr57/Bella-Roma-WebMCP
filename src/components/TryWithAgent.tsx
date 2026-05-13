import { useState } from "react";

interface Prompt {
  id: string;
  capability: string;
  prompt: string;
}

const PROMPTS: Prompt[] = [
  {
    id: "S1",
    capability: "Filtri compositi da linguaggio naturale",
    prompt:
      "Qualcosa di leggero e fruttato, senza latte, sotto i 4 euro.",
  },
  {
    id: "S2",
    capability: "Pairing cross-categoria",
    prompt:
      "Sto prendendo un cappuccino, abbinaci qualcosa di dolce ma non pesante.",
  },
  {
    id: "S3",
    capability: "Sostituzione live su disponibilità",
    prompt: "Vorrei un cappuccino con latte di soia.",
  },
  {
    id: "S4",
    capability: "Ordine multi-item con vincoli",
    prompt:
      "Componi un ordine colazione per 3 persone, max 15 euro, uno deve essere decaffeinato.",
  },
  {
    id: "S5",
    capability: "Dal bar al take-home",
    prompt:
      "Mi è piaciuto il Filtro Etiopia, voglio portarmene a casa 250g.",
  },
  {
    id: "S6",
    capability: "Customizzazione drink",
    prompt: "Cappuccino grande con latte d'avena, senza zucchero.",
  },
  {
    id: "S8",
    capability: "Awareness del carrello",
    prompt: "Cosa va bene con quello che ho già nel carrello?",
  },
];

export function TryWithAgent() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (p: Prompt) => {
    try {
      await navigator.clipboard.writeText(p.prompt);
      setCopied(p.id);
      window.setTimeout(() => setCopied((c) => (c === p.id ? null : c)), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <section className="px-6 pt-10 pb-6 max-w-7xl mx-auto">
      <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-coffee-mid mb-2">
        Prova con l'agente
      </p>
      <h2 className="font-display text-3xl font-bold text-lavazza-deep mb-4">
        7 scenari per i WebMCP
      </h2>
      <p className="text-sm text-coffee-mid mb-6 max-w-2xl">
        Ogni card mostra un prompt che dimostra una capacità diversa dei
        WebMCP. Clicca per copiarlo e incollalo nel tuo agente.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {PROMPTS.map((p) => (
          <button
            key={p.id}
            onClick={() => copy(p)}
            className="text-left bg-white border border-lavazza-line rounded-md p-4 hover:border-coffee-dark hover:shadow-lavazza transition relative"
          >
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-[10px] font-mono font-bold text-coffee-accent">
                {p.id}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-coffee-mid">
                {p.capability}
              </span>
            </div>
            <p className="text-sm text-lavazza-deep leading-snug">
              "{p.prompt}"
            </p>
            <span
              className={`absolute top-2 right-3 text-[10px] uppercase tracking-wider transition-opacity ${
                copied === p.id ? "opacity-100 text-coffee-accent" : "opacity-0"
              }`}
            >
              copiato
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

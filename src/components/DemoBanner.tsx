const PROMPTS = [
  "Ordina 2 espresso e 1 cappuccino, applica BENVENUTO e fai checkout",
  "Mostrami solo i caffè sotto i 2 euro",
  "Svuota il carrello e ricomincia",
];

export function DemoBanner() {
  return (
    <div className="bg-coffee-cream border-b border-coffee-accent px-6 py-3">
      <p className="text-sm text-coffee-dark font-medium mb-1">
        ✨ Prova questi prompt con il tuo assistente AI collegato:
      </p>
      <ul className="space-y-1">
        {PROMPTS.map((p) => (
          <li
            key={p}
            className="text-sm text-coffee-mid font-mono bg-white/60 px-2 py-1 rounded inline-block mr-2"
          >
            "{p}"
          </li>
        ))}
      </ul>
    </div>
  );
}

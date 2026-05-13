const PROMPTS = [
  "Ordina 2 espresso e 1 cappuccino, applica BENVENUTO e fai checkout",
  "Mostrami solo i caffè sotto i 2 euro",
  "Svuota il carrello e ricomincia",
];

export function DemoBanner() {
  return (
    <section className="max-w-7xl mx-auto px-6 pt-6">
      <div className="rounded-2xl bg-lavazza-soft border border-lavazza-line p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xl">💡</span>
            <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-lavazza-deep">
              Suggerimenti per l'AI
            </p>
          </div>
          <ul className="flex flex-wrap gap-2 flex-1">
            {PROMPTS.map((p) => (
              <li
                key={p}
                className="text-xs text-coffee-mid bg-white px-3 py-1.5 rounded-pill border border-lavazza-line hover:border-coffee-dark hover:text-lavazza-deep transition cursor-default"
              >
                "{p}"
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

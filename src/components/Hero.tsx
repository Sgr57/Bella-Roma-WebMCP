export function Hero() {
  return (
    <section className="relative bg-lavazza-off overflow-hidden">
      {/* Decorative beans/leaves */}
      <div
        aria-hidden
        className="absolute left-4 top-1/2 -translate-y-1/2 text-5xl opacity-80 select-none hidden md:block"
        style={{ transform: "translateY(-50%) rotate(-18deg)" }}
      >
        🌿
      </div>
      <div
        aria-hidden
        className="absolute right-6 top-1/2 -translate-y-1/2 text-5xl opacity-80 select-none hidden md:block"
        style={{ transform: "translateY(-50%) rotate(22deg)" }}
      >
        ☕
      </div>

      <div className="max-w-3xl mx-auto px-6 py-14 md:py-20 text-center relative z-10">
        <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-coffee-mid mb-3">
          Bella Roma · Torrefazione dal 1962
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-bold text-lavazza-deep leading-tight">
          Caffè Bella Roma
        </h1>
        <p className="font-script text-3xl md:text-4xl text-lavazza-deep mt-3 leading-none">
          Una gamma unica di straordinarie miscele
        </p>
        <p className="text-sm md:text-base text-coffee-mid mt-5 max-w-xl mx-auto leading-relaxed">
          Vivi ogni giorno il piacere del caffè artigianale, unendo la
          tradizione italiana ai migliori chicchi selezionati da tutto il
          mondo. Scegli tra un'ampia gamma di espressi, filtri e specialty.
        </p>
        <button className="mt-7 text-xs uppercase tracking-[0.15em] font-semibold text-lavazza-deep border-b-2 border-lavazza-deep pb-1 hover:text-coffee-accent hover:border-coffee-accent transition">
          Mostra di più
        </button>
      </div>
    </section>
  );
}

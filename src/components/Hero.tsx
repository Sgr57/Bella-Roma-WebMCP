export function Hero() {
  return (
    <section className="relative bg-white overflow-hidden">
      <div className="relative max-w-screen-2xl mx-auto">
        {/* Transparent PNG/WebP: elements (cup, beans, leaves, sack, spoon)
            float directly on the section bg — no rectangular boundary, no
            color seam to worry about. */}
        <img
          src="/hero/banner.webp"
          alt=""
          aria-hidden="true"
          className="block w-full h-auto max-h-[640px] object-contain"
        />

        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <div className="relative isolate max-w-3xl">
            {/* Soft halo of the section bg color behind the text: lifts the
                headline off the image elements (sack, beans, leaves) without
                drawing any visible rectangle. `isolate` keeps -z-10 within
                this stacking context so the halo only sits behind THESE
                children, not behind the hero image. */}
            <div
              aria-hidden
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[160%] bg-white/90 blur-3xl rounded-full -z-10 pointer-events-none"
            />
            <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-coffee-mid mb-3">
              Bella Roma · Torrefazione dal 1962
            </p>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-lavazza-deep leading-tight">
              Caffè Bella Roma
            </h1>
            <p className="font-script text-3xl md:text-4xl text-lavazza-deep mt-3 leading-none">
              Una gamma unica di straordinarie miscele
            </p>
            <p className="hidden md:block text-sm md:text-base text-coffee-mid mt-5 max-w-xl mx-auto leading-relaxed">
              Vivi ogni giorno il piacere del caffè artigianale, unendo la
              tradizione italiana ai migliori chicchi selezionati da tutto il
              mondo. Scegli tra un'ampia gamma di espressi, filtri e specialty.
            </p>
            <button className="mt-7 text-xs uppercase tracking-[0.15em] font-semibold text-lavazza-deep border-b-2 border-lavazza-deep pb-1 hover:text-coffee-accent hover:border-coffee-accent transition">
              Mostra di più
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

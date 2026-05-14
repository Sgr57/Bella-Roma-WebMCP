const COLUMNS: { title: string; links: string[] }[] = [
  {
    title: "Prodotti",
    links: [
      "Caffè",
      "Grani",
      "Macinato",
      "Capsule",
      "Cialde",
      "Solubile",
      "Macchine",
      "Accessori",
    ],
  },
  {
    title: "Bella Roma",
    links: [
      "La nostra storia",
      "Torrefazione",
      "Sostenibilità",
      "Lavora con noi",
      "Stories",
      "Press",
    ],
  },
  {
    title: "Aiuto e Contatti",
    links: [
      "FAQ",
      "Spedizioni e consegne",
      "Resi e rimborsi",
      "Tracking ordine",
      "Contattaci",
      "Negozi",
    ],
  },
  {
    title: "Note Legali e Privacy",
    links: [
      "Termini e condizioni",
      "Informativa privacy",
      "Cookie policy",
      "Whistleblowing",
      "Dichiarazione di accessibilità",
    ],
  },
];

const PAYMENT = ["Visa", "Mastercard", "Maestro", "Amex", "PayPal"];

export function Footer() {
  return (
    <footer className="bg-lavazza-off border-t border-lavazza-line mt-12">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Top: brand line + country */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-10 border-b border-lavazza-line">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <img
                src="/brand/mark.webp"
                alt="Bella Roma"
                className="h-10 w-10 object-contain"
                decoding="async"
              />
              <h2 className="font-display text-xl font-bold text-lavazza-deep tracking-tight">
                Bella Roma
              </h2>
            </div>
            <p className="font-script text-2xl text-lavazza-deep leading-none">
              Il piacere di un caffè italiano
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-coffee-mid mb-2">
              Scegli il tuo paese
            </p>
            <button className="flex items-center gap-2 text-sm text-lavazza-deep font-medium hover:text-coffee-accent transition">
              <span aria-hidden>🇮🇹</span>
              <span>Italia</span>
              <span aria-hidden className="text-xs">▾</span>
            </button>
          </div>
        </div>

        {/* Columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-10 border-b border-lavazza-line">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-lavazza-deep mb-4">
                {col.title}
              </h3>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l}>
                    <a
                      href="#"
                      className="text-sm text-coffee-dark hover:text-coffee-accent transition"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Social + payment */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 py-8 border-b border-lavazza-line">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-lavazza-deep mb-3">
              Seguici
            </p>
            <div className="flex items-center gap-3">
              {[
                { name: "Facebook", icon: "f" },
                { name: "Instagram", icon: "◉" },
                { name: "YouTube", icon: "▶" },
                { name: "LinkedIn", icon: "in" },
              ].map((s) => (
                <a
                  key={s.name}
                  href="#"
                  aria-label={s.name}
                  className="w-10 h-10 rounded-full bg-coffee-dark text-white flex items-center justify-center text-sm font-bold hover:bg-coffee-accent transition"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-lavazza-deep mb-3 md:text-right">
              Pagamenti sicuri
            </p>
            <div className="flex items-center gap-2 flex-wrap md:justify-end">
              {PAYMENT.map((p) => (
                <span
                  key={p}
                  className="px-2.5 py-1.5 bg-white border border-lavazza-line rounded text-[11px] font-semibold text-lavazza-deep tracking-wide"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom strip */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-8 text-xs text-coffee-mid">
          <p>
            © {new Date().getFullYear()} Bella Roma Coffee Demo · WebMCP POC ·
            Tutti i diritti riservati.
          </p>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <li>
              <a href="#" className="hover:text-coffee-accent transition">
                Cookie Policy
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-coffee-accent transition">
                Impostazioni Cookie
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-coffee-accent transition">
                Privacy
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-coffee-accent transition">
                Accessibilità
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

import { useState } from "react";
import { TOP_PROMPTS } from "../lib/prompts";

function ClipboardIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3 h-3"
      aria-hidden="true"
    >
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <path d="M9 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3 h-3"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function DemoBanner() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (p: string) => {
    try {
      await navigator.clipboard.writeText(p);
      setCopied(p);
      window.setTimeout(() => setCopied((c) => (c === p ? null : c)), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-6 pt-4 pb-6">
      <div className="rounded-xl bg-lavazza-soft/60 border border-lavazza-line/70 px-4 py-2.5">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-[10px] uppercase tracking-[0.18em] font-medium text-coffee-mid shrink-0">
            💡 I più chiesti
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {TOP_PROMPTS.map(({ id, text: p }) => {
              const flash = copied === p;
              return (
                <li key={id}>
                  <button
                    onClick={() => copy(p)}
                    aria-label={`Copia prompt: ${p}`}
                    className={`group text-[11px] pl-2.5 pr-2 py-0.5 rounded-pill border transition-colors duration-200 inline-flex items-center gap-1.5 ${
                      flash
                        ? "text-coffee-accent border-coffee-accent bg-white"
                        : "text-coffee-mid border-lavazza-line/70 bg-white/70 hover:text-lavazza-deep hover:border-coffee-dark/60"
                    }`}
                  >
                    <span>"{p}"</span>
                    <span
                      className={`transition-opacity ${
                        flash
                          ? "opacity-100"
                          : "opacity-40 group-hover:opacity-80"
                      }`}
                    >
                      {flash ? <CheckIcon /> : <ClipboardIcon />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

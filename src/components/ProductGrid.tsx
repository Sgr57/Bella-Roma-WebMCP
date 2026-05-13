import { useState } from "react";
import { getProductsByType, type Product } from "../lib/products";
import { ProductCard } from "./ProductCard";

type FilterKey = "all" | "bar" | "food" | "take-home";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tutto" },
  { key: "bar", label: "Al bar" },
  { key: "food", label: "Pasticceria" },
  { key: "take-home", label: "Da asporto" },
];

function Section({
  title,
  eyebrow,
  products,
}: {
  title: string;
  eyebrow: string;
  products: Product[];
}) {
  if (products.length === 0) return null;
  return (
    <div className="mb-12">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-coffee-mid mb-2">
            {eyebrow}
          </p>
          <h2 className="font-display text-3xl font-bold text-lavazza-deep">
            {title}
          </h2>
        </div>
        <p className="text-xs uppercase tracking-wider text-coffee-mid">
          {products.length} prodotti
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}

export function ProductGrid() {
  const [filter, setFilter] = useState<FilterKey>("all");

  const showDrink = filter === "all" || filter === "bar";
  const showFood = filter === "all" || filter === "food";
  const showTakeHome = filter === "all" || filter === "take-home";

  return (
    <section className="px-6 pt-8 pb-12">
      <div className="mb-6 flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs uppercase tracking-wider px-4 py-2 rounded-pill border transition ${
              filter === f.key
                ? "bg-coffee-dark text-white border-coffee-dark"
                : "bg-white text-coffee-mid border-lavazza-line hover:border-coffee-dark"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {showDrink && (
        <Section
          title="Il nostro caffè"
          eyebrow="Catalogo"
          products={getProductsByType("drink")}
        />
      )}
      {showFood && (
        <Section
          title="Da accompagnare"
          eyebrow="Pasticceria"
          products={getProductsByType("food")}
        />
      )}
      {showTakeHome && (
        <Section
          title="Per portare a casa"
          eyebrow="Take-home"
          products={[
            ...getProductsByType("beans"),
            ...getProductsByType("capsule"),
          ]}
        />
      )}
    </section>
  );
}

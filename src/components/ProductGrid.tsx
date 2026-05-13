import { PRODUCTS } from "../lib/products";
import { ProductCard } from "./ProductCard";

export function ProductGrid() {
  return (
    <section className="px-6 pt-8 pb-12">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-coffee-mid mb-2">
            Catalogo
          </p>
          <h2 className="font-display text-3xl font-bold text-lavazza-deep">
            Il nostro caffè
          </h2>
        </div>
        <p className="text-xs uppercase tracking-wider text-coffee-mid">
          {PRODUCTS.length} prodotti
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {PRODUCTS.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

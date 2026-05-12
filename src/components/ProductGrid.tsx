import { PRODUCTS } from "../lib/products";
import { ProductCard } from "./ProductCard";

export function ProductGrid() {
  return (
    <section className="p-6">
      <h2 className="font-display text-2xl text-coffee-dark mb-4">Il nostro catalogo</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {PRODUCTS.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

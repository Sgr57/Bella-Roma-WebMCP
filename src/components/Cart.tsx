import { useCartStore } from "../store/cart";
import { CartItem } from "./CartItem";

export function Cart() {
  const items = useCartStore((s) => s.items);
  const coupon = useCartStore((s) => s.coupon);
  const subtotal = useCartStore((s) => s.subtotal());
  const discount = useCartStore((s) => s.discount());
  const total = useCartStore((s) => s.total());
  const clearCoupon = useCartStore((s) => s.clearCoupon);

  return (
    <aside className="bg-white rounded-lg shadow-sm border border-coffee-cream p-4 sticky top-4">
      <h2 className="font-display text-xl text-coffee-dark mb-2">Carrello</h2>
      {items.length === 0 ? (
        <p className="text-sm text-coffee-mid italic">Il carrello è vuoto.</p>
      ) : (
        <>
          <ul className="mb-3">
            {items.map((i) => (
              <CartItem key={i.productId} item={i} />
            ))}
          </ul>
          <div className="text-sm space-y-1 border-t border-coffee-cream pt-2">
            <div className="flex justify-between">
              <span>Subtotale</span>
              <span>€{subtotal.toFixed(2)}</span>
            </div>
            {coupon && (
              <div className="flex justify-between text-green-700">
                <span>
                  Coupon {coupon}{" "}
                  <button
                    onClick={clearCoupon}
                    className="text-xs underline opacity-70 hover:opacity-100"
                  >
                    rimuovi
                  </button>
                </span>
                <span>-€{discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1 border-t border-coffee-cream">
              <span>Totale</span>
              <span>€{total.toFixed(2)}</span>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}

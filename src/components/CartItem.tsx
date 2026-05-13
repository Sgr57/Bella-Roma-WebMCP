import { getProductById } from "../lib/products";
import { useCartStore, type CartItem as CartItemType } from "../store/cart";

interface Props {
  item: CartItemType;
}

export function CartItem({ item }: Props) {
  const product = getProductById(item.productId);
  const remove = useCartStore((s) => s.removeItem);
  if (!product) return null;
  return (
    <li className="flex justify-between items-center py-2.5 border-b border-lavazza-line last:border-b-0">
      <div>
        <p className="font-medium text-sm text-lavazza-deep">{product.name}</p>
        <p className="text-xs text-coffee-mid">
          €{product.price.toFixed(2)} × {item.quantity}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-lavazza-deep">
          €{(product.price * item.quantity).toFixed(2)}
        </span>
        <button
          onClick={() => remove(item.productId)}
          className="text-coffee-mid hover:text-coffee-accent text-sm transition"
          aria-label={`Rimuovi ${product.name}`}
        >
          ✕
        </button>
      </div>
    </li>
  );
}

import { getProductById } from "../lib/products";
import {
  lineUnitPrice,
  useCartStore,
  type CartItem as CartItemType,
} from "../store/cart";

interface Props {
  item: CartItemType;
}

function optionsLine(item: CartItemType): string | null {
  if (!item.options) return null;
  const bits: string[] = [];
  if (item.options.size) {
    const size = item.options.size;
    bits.push(size === "L" ? "Grande" : size === "S" ? "Piccolo" : "Medio");
  }
  if (item.options.milk) {
    const m = getProductById(item.options.milk);
    if (m) bits.push(m.name);
  }
  if (item.options.sweetness) {
    bits.push(
      item.options.sweetness === "none"
        ? "Senza zucchero"
        : item.options.sweetness === "low"
          ? "Poco zucchero"
          : "Normale",
    );
  }
  return bits.length ? bits.join(" · ") : null;
}

export function CartItem({ item }: Props) {
  const product = getProductById(item.productId);
  const remove = useCartStore((s) => s.removeItem);
  if (!product) return null;
  const unit = lineUnitPrice(item);
  const optsLine = optionsLine(item);
  return (
    <li className="flex justify-between items-start py-2.5 border-b border-lavazza-line last:border-b-0">
      <div className="min-w-0 flex-1 pr-2">
        <p className="font-medium text-sm text-lavazza-deep truncate">
          {product.name}
        </p>
        {optsLine && (
          <p className="text-[11px] text-coffee-mid">{optsLine}</p>
        )}
        <p className="text-xs text-coffee-mid">
          €{unit.toFixed(2)} × {item.quantity}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-bold text-lavazza-deep">
          €{(unit * item.quantity).toFixed(2)}
        </span>
        <button
          onClick={() => remove(item.productId, item.options)}
          className="text-coffee-mid hover:text-coffee-accent text-sm transition"
          aria-label={`Rimuovi ${product.name}`}
        >
          ✕
        </button>
      </div>
    </li>
  );
}

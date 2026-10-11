import { formatNumber, priceLabel, unitLabel } from "../lib/format.ts";
import type { ProductListItem } from "../lib/types.ts";
import { Placeholder } from "./Placeholder.tsx";

export function ProductCard({ product }: { product: ProductListItem }) {
  const price = priceLabel(product);
  return (
    <a href={`/products/${encodeURIComponent(product.id)}`} class="rs-card">
      <Placeholder id={product.id} name={product.name} />
      <div class="rs-card__body">
        <span class="rs-card__name">{product.name}</span>
        <span class="rs-card__desc">{product.description}</span>
        <span class="rs-card__price">
          {price.kind === "none" && "Unavailable"}
          {price.kind === "single" && (
            <>
              <b>{formatNumber(price.price)}</b> {unitLabel(price.price)}
            </>
          )}
          {price.kind === "range" && (
            <>
              from <b>{formatNumber(price.from)}</b> {unitLabel(price.from)}
            </>
          )}
        </span>
      </div>
    </a>
  );
}

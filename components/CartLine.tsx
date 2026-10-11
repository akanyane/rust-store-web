import { canDecrease, canIncrease, flagInfo, lineTitle } from "../lib/cart.ts";
import { formatNumber, unitLabel } from "../lib/format.ts";
import type { CartItem } from "../lib/types.ts";
import { Icon } from "./Icon.tsx";
import { Placeholder } from "./Placeholder.tsx";

/** Uma linha do carrinho. Os botões −, + e remover são do formulário: funcionam sem JavaScript. */
export function CartLine({ item }: { item: CartItem }) {
  const flag = item.unavailable_reason
    ? flagInfo(item.unavailable_reason)
    : undefined;
  const action = `/cart/items/${encodeURIComponent(item.variant_id)}`;
  const title = lineTitle(item);
  return (
    <li class={`rs-cartline ${flag ? "rs-cartline--flagged" : ""}`}>
      <div class="rs-cartline__item">
        <Placeholder
          id={item.product_id}
          name={item.product_name}
          class="rs-cartline__ph"
        />
        <div class="rs-cartline__text">
          <a
            href={`/products/${encodeURIComponent(item.product_id)}`}
            class="rs-cartline__name"
            aria-current="false"
          >
            {title}
          </a>
          <span class="rs-sku">SKU {item.sku}</span>
          {flag && (
            <span class="rs-flag-wrap">
              <span class={`rs-flag rs-flag--${flag.tone}`}>
                <Icon name={flag.icon} />
                {flag.label}
              </span>
              <span class="rs-flag-help">{flag.help}</span>
            </span>
          )}
        </div>
      </div>

      <span class="rs-cartline__unit rs-nums">
        {formatNumber(item.unit_price)}{" "}
        <span class="rs-muted-unit">{unitLabel(item.unit_price)}</span>
      </span>

      <form method="post" action={action} class="rs-cartline__qty">
        <div
          class={`rs-stepper rs-stepper--sm ${
            item.unavailable_reason === "inactive" ? "rs-stepper--locked" : ""
          }`}
          role="group"
          aria-label={`Quantity for ${title}`}
        >
          <button
            type="submit"
            name="action"
            value="dec"
            class="rs-stepper__btn"
            aria-label={`Decrease quantity of ${title}`}
            disabled={!canDecrease(item)}
          >
            −
          </button>
          <span class="rs-stepper__value rs-nums" aria-live="polite">
            {item.quantity}
          </span>
          <button
            type="submit"
            name="action"
            value="inc"
            class="rs-stepper__btn"
            aria-label={`Increase quantity of ${title}`}
            disabled={!canIncrease(item)}
          >
            +
          </button>
        </div>
      </form>

      <span class="rs-cartline__total rs-nums">
        {formatNumber(item.line_total)}{" "}
        <span class="rs-muted-unit">{unitLabel(item.line_total)}</span>
      </span>

      <form method="post" action={action} class="rs-cartline__remove">
        <button
          type="submit"
          name="action"
          value="remove"
          class="rs-iconbtn"
          aria-label={`Remove ${title}`}
        >
          <Icon name="trash" size={18} />
        </button>
      </form>
    </li>
  );
}

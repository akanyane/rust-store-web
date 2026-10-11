import { formatNumber, unitLabel } from "../lib/format.ts";
import { orderItemTitle } from "../lib/orders.ts";
import type { Order } from "../lib/types.ts";

/** Itens do pedido: um retrato do momento da compra (nome, SKU e preço daquela hora). */
export function OrderItemsTable({ order }: { order: Order }) {
  return (
    <div class="rs-order-items">
      <div class="rs-order-items__header" aria-hidden="true">
        <span>Item</span>
        <span>Unit price</span>
        <span>Qty</span>
        <span class="rs-order-items__right">Line total</span>
      </div>
      <ul class="rs-order-items__list">
        {order.items.map((item) => (
          <li key={item.variant_id} class="rs-order-item">
            <div class="rs-order-item__id">
              <span class="rs-order-item__name">{orderItemTitle(item)}</span>
              <span class="rs-sku">SKU {item.sku}</span>
            </div>
            <span class="rs-order-item__unit rs-nums">
              {formatNumber(item.unit_price)}{" "}
              <span class="rs-muted-unit">{unitLabel(item.unit_price)}</span>
            </span>
            <span class="rs-order-item__qty rs-nums">× {item.quantity}</span>
            <span class="rs-order-item__total rs-nums">
              {formatNumber(item.line_total)}{" "}
              <span class="rs-muted-unit">{unitLabel(item.line_total)}</span>
            </span>
          </li>
        ))}
      </ul>
      <div class="rs-order-items__footer">
        <span>Total</span>
        <span>
          <b class="rs-nums">{formatNumber(order.total)}</b>{" "}
          <span class="rs-muted-unit">{unitLabel(order.total)}</span>
        </span>
      </div>
    </div>
  );
}

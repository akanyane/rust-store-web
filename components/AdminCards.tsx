import type {
  AdminCustomerListItem,
  AdminOrder,
  Product,
} from "../lib/types.ts";
import { customerHref, formatCreated } from "../lib/admin.ts";
import { formatNumber, unitLabel } from "../lib/format.ts";
import { shortOrderId } from "../lib/orders.ts";
import { ProductStatusBadge } from "./ProductStatusBadge.tsx";
import { StatusBadge } from "./StatusBadge.tsx";

/** Um dia curto (`Oct 9`), em UTC, para a segunda linha dos cartões. */
function shortDay(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

/** Pedidos como cartões, para o celular: número e status em cima, cliente, dia e total embaixo. */
export function OrderCards({ orders }: { orders: AdminOrder[] }) {
  return (
    <ul class="rs-cardlist rs-mob-only">
      {orders.map((order) => (
        <li key={order.id}>
          <a
            href={`/admin/orders/${encodeURIComponent(order.id)}`}
            class="rs-itemcard"
            aria-current="false"
          >
            <span class="rs-itemcard__top">
              <b class="rs-mono">{shortOrderId(order.id)}</b>
              <StatusBadge status={order.status} />
            </span>
            <span class="rs-itemcard__bottom">
              <span class="rs-itemcard__meta">
                Customer{" "}
                <span class="rs-mono-cell">
                  {order.customer_id.slice(0, 8)}
                </span>
                {" · "}
                {shortDay(order.created_at)}
              </span>
              <b class="rs-nums">
                {formatNumber(order.total)}{" "}
                <span class="rs-muted-unit">{unitLabel(order.total)}</span>
              </b>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Produtos como cartões: nome, "ID … · data" e a seta; os inativos ficam esmaecidos. */
export function ProductCards({ products }: { products: Product[] }) {
  return (
    <ul class="rs-cardlist rs-mob-only">
      {products.map((product) => (
        <li key={product.id}>
          <a
            href={`/admin/products/${encodeURIComponent(product.id)}`}
            class={product.active
              ? "rs-itemcard rs-itemcard--row"
              : "rs-itemcard rs-itemcard--row rs-itemcard--off"}
            aria-current="false"
          >
            <span class="rs-itemcard__main">
              <span class="rs-itemcard__top">
                <b>{product.name}</b>
                {!product.active && <ProductStatusBadge active={false} />}
              </span>
              <span class="rs-itemcard__meta">
                ID <span class="rs-mono-cell">{product.id.slice(0, 8)}</span>
                {" · "}
                {formatCreated(product.created_at)}
              </span>
            </span>
            <span class="rs-itemcard__chevron" aria-hidden="true">›</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Clientes como cartões: username e id, pedidos e valor gasto. */
export function CustomerCards(
  { customers }: { customers: AdminCustomerListItem[] },
) {
  return (
    <ul class="rs-cardlist rs-mob-only">
      {customers.map((customer) => (
        <li key={customer.id}>
          <a
            href={customerHref(customer.id)}
            class="rs-itemcard rs-itemcard--row"
            aria-current="false"
          >
            <span class="rs-itemcard__main">
              <b>{customer.username}</b>
              <span class="rs-itemcard__meta">
                {formatNumber(customer.orders)}{" "}
                {customer.orders === 1 ? "order" : "orders"} ·{" "}
                {formatNumber(customer.spent)} {unitLabel(customer.spent)}
              </span>
            </span>
            <span class="rs-itemcard__chevron" aria-hidden="true">›</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

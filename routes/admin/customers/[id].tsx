import { HttpError, page } from "fresh";
import { Head } from "fresh/runtime";
import { define } from "../../../utils.ts";
import { getAdminCustomer, listAdminOrders } from "../../../lib/api.ts";
import {
  adminOrdersHref,
  CUSTOMER_RECENT_ORDERS,
  customerCards,
  customerStatusLinks,
} from "../../../lib/admin.ts";
import { formatNumber, unitLabel } from "../../../lib/format.ts";
import { adminAuthed, requireAdmin } from "../../../lib/guard.ts";
import { formatDateTime, shortOrderId } from "../../../lib/orders.ts";
import type { AdminCustomer, AdminOrder } from "../../../lib/types.ts";
import { StatusBadge } from "../../../components/StatusBadge.tsx";

interface Data {
  customer: AdminCustomer;
  recent: AdminOrder[];
}

export const handler = define.handlers({
  async GET(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;
    const id = ctx.params.id;

    const loaded = await adminAuthed(
      ctx,
      ctx.url.pathname,
      async (token) => {
        const [customer, recent] = await Promise.all([
          getAdminCustomer(token, id),
          listAdminOrders(token, {
            q: id,
            limit: CUSTOMER_RECENT_ORDERS,
            offset: 0,
          }),
        ]);
        return { customer, recent: recent.orders };
      },
    );
    if (!loaded.ok) return loaded.response;
    const { customer, recent } = loaded.value;
    if (!customer) throw new HttpError(404);
    // A busca é por prefixo: só os pedidos deste cliente entram, nunca os de outro id parecido.
    return page<Data>({
      customer,
      recent: recent.filter((order) => order.customer_id === customer.id),
    });
  },
});

export default define.page<typeof handler>(function Customer({ data }) {
  const { customer, recent } = data;
  const cards = customerCards(customer);
  const statuses = customerStatusLinks(customer);
  return (
    <>
      <Head>
        <title>{customer.username} · Customer · Admin · Rust Store</title>
      </Head>
      <a href="/admin/orders" class="rs-back" aria-current="false">← Orders</a>
      <div class="rs-admin__head">
        <h1 class="rs-h1">{customer.username}</h1>
        <span class="rs-admin__sub">
          Customer <span class="rs-mono">{customer.id}</span>
        </span>
      </div>

      <div class="rs-statgrid">
        {cards.map((card) => (
          <div key={card.key} class="rs-stat">
            <span class="rs-stat__label">{card.label}</span>
            <b class="rs-stat__value">{card.value}</b>
            <span class="rs-stat__hint">{card.hint}</span>
          </div>
        ))}
      </div>

      {statuses.length > 0 && (
        <section class="rs-dash-section" aria-labelledby="by-status-title">
          <h2 id="by-status-title" class="rs-h2">Orders by status</h2>
          <ul class="rs-statuslinks">
            {statuses.map((entry) => (
              <li key={entry.status}>
                <a href={entry.href} aria-current="false">
                  <StatusBadge status={entry.status} />
                  <b>{formatNumber(entry.count)}</b>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section class="rs-dash-section" aria-labelledby="orders-title">
        <div class="rs-admin__head">
          <h2 id="orders-title" class="rs-h2">Recent orders</h2>
          {customer.orders.total > 0 && (
            <a
              href={adminOrdersHref({ q: customer.id })}
              aria-current="false"
            >
              View all orders
            </a>
          )}
        </div>
        {recent.length === 0
          ? (
            <div class="rs-empty">
              <b>No orders yet</b>
              <p>This customer has not placed an order.</p>
            </div>
          )
          : (
            <div class="rs-tablewrap">
              <table class="rs-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Status</th>
                    <th class="rs-table__right">Total</th>
                    <th class="rs-col-wide">Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {recent.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <a
                          href={`/admin/orders/${encodeURIComponent(order.id)}`}
                          class="rs-mono-link"
                          aria-current="false"
                        >
                          {shortOrderId(order.id)}
                        </a>
                      </td>
                      <td>
                        <StatusBadge status={order.status} />
                      </td>
                      <td class="rs-table__right rs-nums">
                        {formatNumber(order.total)}{" "}
                        <span class="rs-muted-unit">
                          {unitLabel(order.total)}
                        </span>
                      </td>
                      <td class="rs-col-wide">
                        {formatDateTime(order.created_at)}
                      </td>
                      <td>
                        <a
                          href={`/admin/orders/${encodeURIComponent(order.id)}`}
                          aria-current="false"
                        >
                          Open
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
    </>
  );
});

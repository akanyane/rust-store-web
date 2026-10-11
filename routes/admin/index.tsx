import { page } from "fresh";
import { Head } from "fresh/runtime";
import { define } from "../../utils.ts";
import { getAdminStats, listAdminOrders } from "../../lib/api.ts";
import {
  adminOrdersHref,
  DASHBOARD_RECENT_ORDERS,
  dashboardCards,
  lowStockHref,
} from "../../lib/admin.ts";
import { formatNumber, stockStatus, unitLabel } from "../../lib/format.ts";
import { adminAuthed, requireAdmin } from "../../lib/guard.ts";
import { formatDateTime, shortOrderId } from "../../lib/orders.ts";
import type { AdminOrder, AdminStats } from "../../lib/types.ts";
import { StatusBadge } from "../../components/StatusBadge.tsx";

interface Data {
  stats: AdminStats;
  recent: AdminOrder[];
}

export const handler = define.handlers({
  async GET(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;

    const loaded = await adminAuthed(ctx, ctx.url.pathname, async (token) => {
      const [stats, recent] = await Promise.all([
        getAdminStats(token),
        listAdminOrders(token, {
          limit: DASHBOARD_RECENT_ORDERS,
          offset: 0,
        }),
      ]);
      return { stats, recent: recent.orders };
    });
    if (!loaded.ok) return loaded.response;
    return page<Data>(loaded.value);
  },
});

export default define.page<typeof handler>(function Dashboard({ data }) {
  const { stats, recent } = data;
  const cards = dashboardCards(stats);
  return (
    <>
      <Head>
        <title>Dashboard · Admin · Rust Store</title>
      </Head>
      <div class="rs-admin__head">
        <h1 class="rs-h1">Dashboard</h1>
        <span class="rs-admin__sub">
          {formatNumber(stats.orders.total)}{" "}
          {stats.orders.total === 1 ? "order" : "orders"} in total
        </span>
      </div>

      <div class="rs-statgrid">
        {cards.map((card) => (
          <a
            key={card.key}
            href={card.href}
            class={`rs-stat ${card.attention ? "rs-stat--attention" : ""}`}
            aria-current="false"
          >
            <span class="rs-stat__label">{card.label}</span>
            <b class="rs-stat__value">{card.value}</b>
            <span class="rs-stat__hint">{card.hint}</span>
          </a>
        ))}
      </div>

      <section class="rs-dash-section" aria-labelledby="recent-title">
        <div class="rs-admin__head">
          <h2 id="recent-title" class="rs-h2">Recent orders</h2>
          <a href={adminOrdersHref()} aria-current="false">View all orders</a>
        </div>
        {recent.length === 0
          ? (
            <div class="rs-empty">
              <b>No orders yet</b>
              <p>Orders will show up here as customers place them.</p>
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

      <section class="rs-dash-section" aria-labelledby="stock-title">
        <div class="rs-admin__head">
          <h2 id="stock-title" class="rs-h2">Low stock</h2>
          <span class="rs-admin__sub">5 units or fewer, emptiest first</span>
        </div>
        {stats.low_stock.length === 0
          ? (
            <div class="rs-empty">
              <b>Nothing is running low</b>
              <p>Active variants with 5 units or fewer will show up here.</p>
            </div>
          )
          : (
            <div class="rs-tablewrap">
              <table class="rs-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th class="rs-col-wide">SKU</th>
                    <th class="rs-table__right">Stock</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {stats.low_stock.map((item) => {
                    const status = stockStatus(item.stock);
                    return (
                      <tr key={item.variant_id}>
                        <td>
                          <div class="rs-table__stack">
                            <a
                              href={lowStockHref(item)}
                              class="rs-table__name"
                              aria-current="false"
                            >
                              {item.product_name}
                            </a>
                            <span class="rs-table__desc">
                              {item.variant_name}
                            </span>
                          </div>
                        </td>
                        <td class="rs-mono-cell rs-col-wide">{item.sku}</td>
                        <td
                          class={`rs-table__right rs-nums ${
                            item.stock === 0
                              ? "rs-stock-cell--out"
                              : "rs-stock-cell--low"
                          }`}
                        >
                          {status.label}
                        </td>
                        <td>
                          <a href={lowStockHref(item)} aria-current="false">
                            Edit
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </section>
    </>
  );
});

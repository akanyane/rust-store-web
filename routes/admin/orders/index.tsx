import { page } from "fresh";
import { Head } from "fresh/runtime";
import { define } from "../../../utils.ts";
import { listAdminOrders } from "../../../lib/api.ts";
import {
  ADMIN_PAGE_SIZE,
  adminOrdersHref,
  ORDER_FILTERS,
  parseOrderFilter,
} from "../../../lib/admin.ts";
import { formatNumber, unitLabel } from "../../../lib/format.ts";
import { adminAuthed, requireAdmin } from "../../../lib/guard.ts";
import { formatDateTime, shortOrderId } from "../../../lib/orders.ts";
import { type PageInfo, pageInfo, parsePage } from "../../../lib/pagination.ts";
import type { AdminOrder } from "../../../lib/types.ts";
import { FilterGroup } from "../../../components/FilterGroup.tsx";
import { Pagination } from "../../../components/Pagination.tsx";
import { StatusBadge } from "../../../components/StatusBadge.tsx";

interface Data {
  orders: AdminOrder[];
  info: PageInfo;
  status: ReturnType<typeof parseOrderFilter>;
}

export const handler = define.handlers({
  async GET(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;
    const status = parseOrderFilter(ctx.url.searchParams.get("status"));
    const requested = parsePage(ctx.url.searchParams.get("page"));

    const loaded = await adminAuthed(
      ctx,
      ctx.url.pathname + ctx.url.search,
      (token) =>
        listAdminOrders(token, {
          status: status === "all" ? undefined : status,
          limit: ADMIN_PAGE_SIZE,
          offset: (requested - 1) * ADMIN_PAGE_SIZE,
        }),
    );
    if (!loaded.ok) return loaded.response;

    const info = pageInfo(loaded.value.total, requested, ADMIN_PAGE_SIZE);
    // `?page=` além da última: leva para a última, sem erro.
    if (info.page !== requested) {
      return ctx.redirect(adminOrdersHref({ status, page: info.page }));
    }
    return page<Data>({ orders: loaded.value.orders, info, status });
  },
});

export default define.page<typeof handler>(function AdminOrders({ data }) {
  const { orders, info, status } = data;
  const filterLabel = ORDER_FILTERS.find((filter) =>
    filter.key === status
  )?.label ?? "All";
  return (
    <>
      <Head>
        <title>Orders · Admin · Rust Store</title>
      </Head>
      <div class="rs-admin__head">
        <h1 class="rs-h1">Orders</h1>
        <span class="rs-admin__sub">Newest first</span>
      </div>

      <FilterGroup
        label="Status"
        items={ORDER_FILTERS.map((filter) => ({
          label: filter.label,
          href: adminOrdersHref({ status: filter.key }),
          current: filter.key === status,
        }))}
      />

      {orders.length === 0
        ? (
          <div class="rs-empty">
            <b>
              No {status === "all" ? "" : `${filterLabel.toLowerCase()} `}orders
            </b>
            <p>
              {status === "all"
                ? "Orders will show up here as customers place them."
                : "Nothing matches this status right now."}
            </p>
            {status !== "all" && (
              <a href={adminOrdersHref()} class="rs-btn" aria-current="false">
                Show all orders
              </a>
            )}
          </div>
        )
        : (
          <div class="rs-tablewrap">
            <table class="rs-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th class="rs-table__right">Total</th>
                  <th>Created</th>
                  <th>Paid</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
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
                    <td class="rs-mono-cell">{order.customer_id}</td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td class="rs-table__right rs-nums">
                      {formatNumber(order.total)}{" "}
                      <span class="rs-muted-unit">
                        {unitLabel(order.total)}
                      </span>
                    </td>
                    <td>{formatDateTime(order.created_at)}</td>
                    <td>
                      {order.paid_at ? formatDateTime(order.paid_at) : "—"}
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

      {orders.length > 0 && (
        <Pagination
          info={info}
          href={(p) => adminOrdersHref({ status, page: p })}
        />
      )}
    </>
  );
});

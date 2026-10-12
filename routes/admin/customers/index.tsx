import { page } from "fresh";
import { Head } from "fresh/runtime";
import { define } from "../../../utils.ts";
import { listAdminCustomers } from "../../../lib/api.ts";
import {
  ADMIN_PAGE_SIZE,
  adminCustomersHref,
  CUSTOMER_SORTS,
  customerHref,
  formatCreated,
  parseCustomerSort,
  parseSearch,
} from "../../../lib/admin.ts";
import { formatNumber, unitLabel } from "../../../lib/format.ts";
import { adminAuthed, requireAdmin } from "../../../lib/guard.ts";
import { type PageInfo, pageInfo, parsePage } from "../../../lib/pagination.ts";
import type { AdminCustomerListItem } from "../../../lib/types.ts";
import { FilterGroup } from "../../../components/FilterGroup.tsx";
import { CustomerCards } from "../../../components/AdminCards.tsx";
import { Pagination } from "../../../components/Pagination.tsx";

interface Data {
  customers: AdminCustomerListItem[];
  info: PageInfo;
  sort: ReturnType<typeof parseCustomerSort>;
  /** O termo da busca já aparado; vazio quando não há busca. */
  q: string;
}

export const handler = define.handlers({
  async GET(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;
    const q = parseSearch(ctx.url.searchParams.get("q"));
    const sort = parseCustomerSort(ctx.url.searchParams.get("sort"));
    const requested = parsePage(ctx.url.searchParams.get("page"));

    const loaded = await adminAuthed(
      ctx,
      ctx.url.pathname + ctx.url.search,
      (token) =>
        listAdminCustomers(token, {
          q: q || undefined,
          sort,
          limit: ADMIN_PAGE_SIZE,
          offset: (requested - 1) * ADMIN_PAGE_SIZE,
        }),
    );
    if (!loaded.ok) return loaded.response;

    const info = pageInfo(loaded.value.total, requested, ADMIN_PAGE_SIZE);
    // `?page=` além da última: leva para a última, sem erro.
    if (info.page !== requested) {
      return ctx.redirect(adminCustomersHref({ q, sort, page: info.page }));
    }
    return page<Data>({ customers: loaded.value.customers, info, sort, q });
  },
});

export default define.page<typeof handler>(function AdminCustomers({ data }) {
  const { customers, info, sort, q } = data;
  return (
    <>
      <Head>
        <title>Customers · Admin · Rust Store</title>
      </Head>
      <div class="rs-admin__head">
        <h1 class="rs-h1">Customers</h1>
        <span class="rs-admin__sub">
          {sort === "username" ? "By username" : "Newest first"}
        </span>
      </div>

      <form
        method="get"
        action="/admin/customers"
        role="search"
        class="rs-search"
      >
        {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}
        <div class="rs-search__field">
          <input
            aria-label="Search customers"
            type="search"
            name="q"
            value={q}
            maxLength={64}
            placeholder="Username or customer id"
            autocomplete="off"
            class="rs-input rs-search__input"
          />
        </div>
        <button type="submit" class="rs-btn rs-btn--primary">Search</button>
        {q && (
          <a
            href={adminCustomersHref({ sort })}
            class="rs-search__clear"
            aria-current="false"
          >
            Clear
          </a>
        )}
      </form>

      <FilterGroup
        label="Sort"
        items={CUSTOMER_SORTS.map((option) => ({
          label: option.label,
          href: adminCustomersHref({ q, sort: option.key }),
          current: option.key === sort,
        }))}
      />

      {customers.length === 0
        ? q
          ? (
            <div class="rs-empty">
              <b>No customers match "{q}"</b>
              <p>
                Try a username or a customer id. It matches the start of either.
              </p>
              <a
                href={adminCustomersHref({ sort })}
                class="rs-btn"
                aria-current="false"
              >
                Clear search
              </a>
            </div>
          )
          : (
            <div class="rs-empty">
              <b>No customers yet</b>
              <p>Accounts will show up here as people sign up.</p>
            </div>
          )
        : (
          <>
            <CustomerCards customers={customers} />
            <div class="rs-tablewrap rs-desk-only">
              <table class="rs-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th class="rs-table__right">Orders</th>
                    <th class="rs-table__right">Spent</th>
                    <th class="rs-col-wide">Customer since</th>
                    <th class="rs-col-wide">Last order</th>
                    <th class="rs-col-wide" />
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <div class="rs-table__stack">
                          <a
                            href={customerHref(customer.id)}
                            class="rs-table__name"
                            aria-current="false"
                          >
                            {customer.username}
                          </a>
                          <span class="rs-mono-cell rs-table__desc rs-col-wide">
                            {customer.id}
                          </span>
                        </div>
                      </td>
                      <td class="rs-table__right rs-nums">
                        {formatNumber(customer.orders)}
                      </td>
                      <td class="rs-table__right rs-nums">
                        {formatNumber(customer.spent)}{" "}
                        <span class="rs-muted-unit">
                          {unitLabel(customer.spent)}
                        </span>
                      </td>
                      <td class="rs-col-wide">
                        {formatCreated(customer.created_at)}
                      </td>
                      <td class="rs-col-wide">
                        {customer.last_order_at
                          ? formatCreated(customer.last_order_at)
                          : "—"}
                      </td>
                      <td class="rs-col-wide">
                        <a
                          href={customerHref(customer.id)}
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
          </>
        )}

      {customers.length > 0 && (
        <Pagination
          info={info}
          href={(p) => adminCustomersHref({ q, sort, page: p })}
          extra={q ? `matching "${q}"` : undefined}
        />
      )}
    </>
  );
});

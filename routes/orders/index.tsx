import { page } from "fresh";
import { Head } from "fresh/runtime";
import { define } from "../../utils.ts";
import { ApiError, createOrder, listOrders } from "../../lib/api.ts";
import { formatNumber, unitLabel } from "../../lib/format.ts";
import { authed, requireCustomer } from "../../lib/guard.ts";
import {
  formatDateTime,
  formatShortDate,
  itemsLabel,
  shortOrderId,
} from "../../lib/orders.ts";
import type { Order } from "../../lib/types.ts";
import { StatePanel } from "../../components/StatePanel.tsx";
import { StatusBadge } from "../../components/StatusBadge.tsx";

interface Data {
  orders: Order[];
}

export const handler = define.handlers({
  async GET(ctx) {
    const denied = requireCustomer(ctx);
    if (denied) return denied;
    const loaded = await authed(ctx, "/orders", listOrders);
    if (!loaded.ok) return loaded.response;
    return page<Data>({ orders: loaded.value });
  },

  /** Checkout: o carrinho vira um pedido pendente e a pessoa vai para a página dele. */
  async POST(ctx) {
    try {
      const result = await authed(ctx, "/cart", createOrder);
      if (!result.ok) return result.response;
      ctx.state.pendingFlash = {
        scope: "order",
        tone: "success",
        message: "Order placed.",
      };
      return ctx.redirect(
        `/orders/${encodeURIComponent(result.value.id)}`,
        303,
      );
    } catch (error) {
      // 409: estoque que acabou, item que saiu de venda ou carrinho vazio. A mensagem é da API
      // e aparece no carrinho, que já recarrega com as linhas sinalizadas.
      if (!(error instanceof ApiError)) throw error;
      ctx.state.pendingFlash = {
        scope: "cart",
        tone: "error",
        message: `Order not placed: ${error.message}`,
      };
      return ctx.redirect("/cart", 303);
    }
  },
});

export default define.page<typeof handler>(function Orders({ data }) {
  const { orders } = data;
  if (orders.length === 0) {
    return (
      <>
        <Head>
          <title>Your orders · Rust Store</title>
        </Head>
        <StatePanel
          title="No orders yet"
          action={{ href: "/", label: "Browse the catalog" }}
        >
          When you place an order, it will show up here.
        </StatePanel>
      </>
    );
  }

  return (
    <main class="rs-main">
      <Head>
        <title>Your orders · Rust Store</title>
      </Head>
      <h1 class="rs-h1">Your orders</h1>
      <div class="rs-orders">
        <div class="rs-orders__header" aria-hidden="true">
          <span>Order</span>
          <span>Created</span>
          <span>Status</span>
          <span>Items</span>
          <span class="rs-orders__right">Total</span>
          <span />
        </div>
        <ul class="rs-orders__list">
          {orders.map((order) => (
            <li key={order.id}>
              <a
                href={`/orders/${encodeURIComponent(order.id)}`}
                class="rs-orderrow"
                aria-current="false"
              >
                <span class="rs-orderrow__id">{shortOrderId(order.id)}</span>
                <span class="rs-orderrow__created">
                  <span class="rs-orderrow__long">
                    {formatDateTime(order.created_at)}
                  </span>
                  <span class="rs-orderrow__short">
                    {formatShortDate(order.created_at)}
                  </span>
                </span>
                <span class="rs-orderrow__status">
                  <StatusBadge status={order.status} />
                </span>
                <span class="rs-orderrow__items">{itemsLabel(order)}</span>
                <span class="rs-orderrow__total rs-nums">
                  {formatNumber(order.total)}{" "}
                  <span class="rs-muted-unit">{unitLabel(order.total)}</span>
                </span>
                <span class="rs-orderrow__chev" aria-hidden="true">›</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div class="rs-orders__count">
        Showing <b>1–{orders.length}</b> of <b>{orders.length}</b>
      </div>
    </main>
  );
});

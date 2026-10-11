import { HttpError, page } from "fresh";
import { Head } from "fresh/runtime";
import { define } from "../../utils.ts";
import { getOrder } from "../../lib/api.ts";
import type { Flash } from "../../lib/flash.ts";
import { formatUnits } from "../../lib/format.ts";
import { authed, requireCustomer } from "../../lib/guard.ts";
import {
  canCancel,
  canPay,
  isPaidOrBeyond,
  paidLabel,
  shortOrderId,
} from "../../lib/orders.ts";
import type { Order } from "../../lib/types.ts";
import { Alert } from "../../components/Alert.tsx";
import { Icon } from "../../components/Icon.tsx";
import { OrderItemsTable } from "../../components/OrderItemsTable.tsx";
import { OrderTimeline } from "../../components/OrderTimeline.tsx";
import { StatusBadge } from "../../components/StatusBadge.tsx";
import PendingButton from "../../islands/PendingButton.tsx";
import { formatDateTime } from "../../lib/orders.ts";

interface Data {
  order: Order;
  /** `?confirm=cancel`: mostra a confirmação de cancelamento sobre a página. */
  confirmCancel: boolean;
  flash?: Flash;
}

export const handler = define.handlers({
  async GET(ctx) {
    const denied = requireCustomer(ctx);
    if (denied) return denied;
    const id = ctx.params.id;
    const loaded = await authed(
      ctx,
      ctx.url.pathname,
      (token) => getOrder(token, id),
    );
    if (!loaded.ok) return loaded.response;
    // Pedido de outro cliente aparece como inexistente: a API já responde 404 nos dois casos.
    const order = loaded.value;
    if (!order) throw new HttpError(404);
    const flash = ctx.state.flash?.scope === "order"
      ? ctx.state.flash
      : undefined;
    return page<Data>({
      order,
      confirmCancel: ctx.url.searchParams.get("confirm") === "cancel" &&
        canCancel(order),
      flash,
    });
  },
});

export default define.page<typeof handler>(function OrderPage({ data }) {
  const { order, flash } = data;
  const id = encodeURIComponent(order.id);
  const number = shortOrderId(order.id);
  const timeline = order.status !== "cancelled";

  return (
    <main class="rs-main">
      <Head>
        <title>Order {number} · Rust Store</title>
      </Head>
      <a href="/orders" class="rs-back" aria-current="false">← Your orders</a>

      <div class="rs-order-head">
        <h1 class="rs-h1">
          Order <span class="rs-mono">{number}</span>
        </h1>
        <StatusBadge status={order.status} large />
      </div>
      <div class="rs-order-meta">
        <span>
          Created <b>{formatDateTime(order.created_at)}</b>
        </span>
        <span>
          Paid <b>{paidLabel(order)}</b>
        </span>
      </div>

      {flash && (
        <Alert
          tone={flash.tone === "success" ? "success" : "danger"}
          title={flash.message}
        />
      )}

      <div class="rs-order-layout">
        <div class="rs-order-main">
          {timeline
            ? (
              <div class="rs-card-box">
                <OrderTimeline order={order} />
              </div>
            )
            : (
              <div class="rs-cancelled" role="note">
                <span class="rs-cancelled__icon">
                  <Icon name="x" size={18} />
                </span>
                <div>
                  <b>This order was cancelled</b>
                  <p>
                    The items went back into stock. Cancelled orders are final
                    and can't be reopened.
                  </p>
                </div>
              </div>
            )}
          <OrderItemsTable order={order} />
          <span class="rs-order-note">
            Prices are a snapshot from when the order was placed.
          </span>
        </div>

        {canPay(order) && (
          <aside
            class="rs-card-box rs-order-actions"
            aria-labelledby="actions-title"
          >
            <h2 id="actions-title">Waiting for payment</h2>
            <p class="rs-muted">
              Stock is reserved for this order. Paying is simulated; no money
              moves.
            </p>
            <form method="post" action={`/orders/${id}/pay`}>
              <PendingButton
                label={`Pay ${formatUnits(order.total)} (simulated)`}
                pendingLabel="Paying…"
                variant="primary"
                block
              />
            </form>
            <a
              href={`/orders/${id}?confirm=cancel`}
              class="rs-btn rs-btn--block"
              aria-current="false"
            >
              Cancel order
            </a>
            <p class="rs-info-note">
              <Icon name="info" />
              Cancelling returns the items to stock. Once paid, an order can't
              be cancelled.
            </p>
          </aside>
        )}
        {isPaidOrBeyond(order.status) && (
          <aside
            class="rs-card-box rs-order-actions"
            aria-label="Order actions"
          >
            <p class="rs-info-note">
              <Icon name="info" />
              This order can't be cancelled. It has been paid, and this store
              has no refunds.
            </p>
          </aside>
        )}
      </div>

      {data.confirmCancel && (
        <div class="rs-modal" role="presentation">
          <div
            class="rs-modal__box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-title"
          >
            <h2 id="cancel-title">Cancel order {number}?</h2>
            <p>The items go back into stock. This can't be undone.</p>
            <div class="rs-modal__actions">
              <a
                href={`/orders/${id}`}
                class="rs-btn"
                autofocus
                aria-current="false"
              >
                Keep order
              </a>
              <form method="post" action={`/orders/${id}/cancel`}>
                <PendingButton
                  label="Cancel order"
                  pendingLabel="Cancelling…"
                  variant="danger"
                />
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
});

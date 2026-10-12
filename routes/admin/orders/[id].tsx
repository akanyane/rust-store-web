import { HttpError, page } from "fresh";
import { Head } from "fresh/runtime";
import { define } from "../../../utils.ts";
import { ApiError, getAdminOrder, setOrderStatus } from "../../../lib/api.ts";
import {
  allowedTransitions,
  customerHref,
  FINAL_TEXT,
  isOfferedTransition,
} from "../../../lib/admin.ts";
import type { Flash } from "../../../lib/flash.ts";
import { field } from "../../../lib/form.ts";
import { formatNumber, unitLabel } from "../../../lib/format.ts";
import { adminAuthed, requireAdmin } from "../../../lib/guard.ts";
import {
  formatDateTime,
  orderItemTitle,
  shortOrderId,
} from "../../../lib/orders.ts";
import type { AdminOrder } from "../../../lib/types.ts";
import { Alert } from "../../../components/Alert.tsx";
import { Icon } from "../../../components/Icon.tsx";
import { StatusBadge } from "../../../components/StatusBadge.tsx";
import { statusInfo } from "../../../lib/orders.ts";

interface Data {
  order: AdminOrder;
  flash?: Flash;
}

export const handler = define.handlers({
  async GET(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;
    const id = ctx.params.id;
    const loaded = await adminAuthed(
      ctx,
      ctx.url.pathname,
      (token) => getAdminOrder(token, id),
    );
    if (!loaded.ok) return loaded.response;
    if (!loaded.value) throw new HttpError(404);
    const flash = ctx.state.flash?.scope === "admin"
      ? ctx.state.flash
      : undefined;
    return page<Data>({ order: loaded.value, flash });
  },

  /** Muda o status. O valor enviado só vale se for um dos próximos passos oferecidos. */
  async POST(ctx) {
    const id = ctx.params.id;
    const back = `/admin/orders/${encodeURIComponent(id)}`;
    const to = field(await ctx.req.formData(), "status");

    try {
      const result = await adminAuthed(ctx, back, async (token) => {
        const current = await getAdminOrder(token, id);
        if (!current) throw new HttpError(404);
        // Um status fora do ciclo (formulário forjado) nem chega à API.
        if (!isOfferedTransition(current.status, to)) {
          return "not-offered" as const;
        }
        await setOrderStatus(token, id, to);
        return "changed" as const;
      });
      if (!result.ok) return result.response;
      ctx.state.pendingFlash = result.value === "changed"
        ? {
          scope: "admin",
          tone: "success",
          message: `Status changed to ${statusInfo(to as never).label}.`,
        }
        : {
          scope: "admin",
          tone: "error",
          message:
            "Not changed: that status isn't a valid next step for this order.",
        };
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.status === 404) throw new HttpError(404);
      // 409: o pedido mudou enquanto a tela estava aberta (por exemplo, o cliente cancelou).
      ctx.state.pendingFlash = {
        scope: "admin",
        tone: "error",
        message: `Not changed (${error.status}): ${error.message}`,
      };
    }
    return ctx.redirect(back, 303);
  },
});

export default define.page<typeof handler>(function AdminOrder({ data }) {
  const { order, flash } = data;
  const transitions = allowedTransitions(order.status);
  const number = shortOrderId(order.id);
  return (
    <>
      <Head>
        <title>Order {number} · Admin · Rust Store</title>
      </Head>
      <a href="/admin/orders" class="rs-back" aria-current="false">← Orders</a>
      <div class="rs-order-head">
        <h1 class="rs-h1">
          Order <span class="rs-mono">{number}</span>
        </h1>
        <StatusBadge status={order.status} large />
      </div>

      <dl class="rs-meta">
        <div>
          <dt>Customer</dt>
          <dd class="rs-mono-cell">
            <a
              href={customerHref(order.customer_id)}
              class="rs-mono-link"
              aria-current="false"
            >
              {order.customer_id}
            </a>
          </dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatDateTime(order.created_at)}</dd>
        </div>
        <div>
          <dt>Paid</dt>
          <dd>
            {order.paid_at ? formatDateTime(order.paid_at) : "—"}
          </dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd class="rs-nums">
            {formatNumber(order.total)} {unitLabel(order.total)}
          </dd>
        </div>
      </dl>

      <div class="rs-admin__split">
        <div class="rs-tablewrap">
          <table class="rs-table">
            <thead>
              <tr>
                <th>Item</th>
                <th class="rs-col-wide">SKU</th>
                <th class="rs-table__right rs-col-wide">Unit price</th>
                <th class="rs-table__right">Qty</th>
                <th class="rs-table__right">Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.variant_id}>
                  <td>{orderItemTitle(item)}</td>
                  <td class="rs-mono-cell rs-col-wide">{item.sku}</td>
                  <td class="rs-table__right rs-nums rs-col-wide">
                    {formatNumber(item.unit_price)}
                  </td>
                  <td class="rs-table__right rs-nums">{item.quantity}</td>
                  <td class="rs-table__right rs-nums">
                    {formatNumber(item.line_total)}
                  </td>
                </tr>
              ))}
              <tr class="rs-table__total">
                <td>Total</td>
                <td class="rs-col-wide" />
                <td class="rs-col-wide" />
                <td />
                <td class="rs-table__right rs-nums">
                  {formatNumber(order.total)} {unitLabel(order.total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <section class="rs-card-box" aria-labelledby="status-title">
          <h2 id="status-title">Change status</h2>
          {transitions.length === 0
            ? (
              <p class="rs-locked-note">
                <Icon name="lock" size={16} />
                {FINAL_TEXT}
              </p>
            )
            : (
              <form method="post" class="rs-form">
                <p class="rs-muted">
                  From <b>{statusInfo(order.status).label}</b> you can move to:
                </p>
                <div class="rs-transitions">
                  {transitions.map((transition) => (
                    <div key={transition.to} class="rs-transition">
                      <button
                        type="submit"
                        name="status"
                        value={transition.to}
                        class={`rs-btn ${
                          transition.tone === "primary"
                            ? "rs-btn--primary"
                            : "rs-btn--danger-outline"
                        }`}
                      >
                        {transition.label}
                      </button>
                      {transition.hint && (
                        <span class="rs-muted">· {transition.hint}</span>
                      )}
                    </div>
                  ))}
                </div>
              </form>
            )}
          {flash && (
            <Alert
              tone={flash.tone === "success" ? "success" : "danger"}
              title={flash.message}
            >
              {flash.tone === "error" && (
                <>
                  The order may have changed while this page was open.{" "}
                  <a
                    href={`/admin/orders/${encodeURIComponent(order.id)}`}
                    aria-current="false"
                  >
                    Reload
                  </a>
                </>
              )}
            </Alert>
          )}
        </section>
      </div>
    </>
  );
});

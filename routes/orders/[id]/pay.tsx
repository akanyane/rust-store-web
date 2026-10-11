import { HttpError } from "fresh";
import { define } from "../../../utils.ts";
import { ApiError, payOrder } from "../../../lib/api.ts";
import { authed } from "../../../lib/guard.ts";

export const handler = define.handlers({
  // Quem chega por link volta ao pedido: só o POST (o botão) paga.
  GET(ctx) {
    return ctx.redirect(`/orders/${encodeURIComponent(ctx.params.id)}`, 302);
  },

  async POST(ctx) {
    const id = ctx.params.id;
    const back = `/orders/${encodeURIComponent(id)}`;
    try {
      const result = await authed(ctx, back, (token) => payOrder(token, id));
      if (!result.ok) return result.response;
      ctx.state.pendingFlash = {
        scope: "order",
        tone: "success",
        message: "Payment received (simulated).",
      };
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.status === 404) throw new HttpError(404);
      // 409: o pedido já foi pago ou cancelado (por exemplo, em outra aba).
      ctx.state.pendingFlash = {
        scope: "order",
        tone: "error",
        message: `Couldn't pay this order: ${error.message}`,
      };
    }
    return ctx.redirect(back, 303);
  },
});

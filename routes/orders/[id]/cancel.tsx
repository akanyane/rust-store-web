import { HttpError } from "fresh";
import { define } from "../../../utils.ts";
import { ApiError, cancelOrder } from "../../../lib/api.ts";
import { authed } from "../../../lib/guard.ts";

export const handler = define.handlers({
  // Quem chega por link vê a confirmação: só o POST (o botão da confirmação) cancela.
  GET(ctx) {
    return ctx.redirect(
      `/orders/${encodeURIComponent(ctx.params.id)}?confirm=cancel`,
      302,
    );
  },

  async POST(ctx) {
    const id = ctx.params.id;
    const back = `/orders/${encodeURIComponent(id)}`;
    try {
      const result = await authed(ctx, back, (token) => cancelOrder(token, id));
      if (!result.ok) return result.response;
      ctx.state.pendingFlash = {
        scope: "order",
        tone: "success",
        message: "Order cancelled. The items went back into stock.",
      };
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.status === 404) throw new HttpError(404);
      // 409: o pedido já foi pago ou cancelado; a mensagem é da API.
      ctx.state.pendingFlash = {
        scope: "order",
        tone: "error",
        message: `Couldn't cancel this order: ${error.message}`,
      };
    }
    return ctx.redirect(back, 303);
  },
});

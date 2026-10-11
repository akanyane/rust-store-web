import { HttpError } from "fresh";
import { define } from "../../../utils.ts";
import {
  ApiError,
  getCart,
  removeFromCart,
  setCartQuantity,
} from "../../../lib/api.ts";
import { field } from "../../../lib/form.ts";
import { authed } from "../../../lib/guard.ts";

type Action = "inc" | "dec" | "remove";

export const handler = define.handlers({
  // Quem chega por link volta ao carrinho: só o POST (os botões da linha) mexe nele.
  GET(ctx) {
    return ctx.redirect("/cart", 302);
  },

  async POST(ctx) {
    const action = field(await ctx.req.formData(), "action");
    if (action !== "inc" && action !== "dec" && action !== "remove") {
      throw new HttpError(400);
    }
    const variantId = ctx.params.variantId;

    try {
      const result = await authed(ctx, "/cart", async (token) => {
        // O servidor lê a quantidade atual: o formulário não manda número, então não dá para
        // forjar uma quantidade, e dois cliques seguidos somam certo.
        const line = (await getCart(token)).items.find((item) =>
          item.variant_id === variantId
        );
        if (!line) return;
        const kind = action as Action;
        if (kind === "remove") await removeFromCart(token, variantId);
        else if (kind === "inc") {
          await setCartQuantity(token, variantId, line.quantity + 1);
        } else if (line.quantity > 1) {
          await setCartQuantity(token, variantId, line.quantity - 1);
        }
      });
      if (!result.ok) return result.response;
    } catch (error) {
      // 409: faltou estoque ao aumentar (a API diz quantos restam), ou a variante saiu de venda.
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.status === 404)
      ) {
        ctx.state.pendingFlash = {
          scope: "cart",
          tone: "error",
          message: `Couldn't update the cart: ${error.message}`,
        };
      } else {
        throw error;
      }
    }
    return ctx.redirect("/cart", 303);
  },
});

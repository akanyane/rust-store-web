import { define } from "../../utils.ts";

export const handler = define.handlers({
  // `/admin` não tem página própria: o console abre nos pedidos.
  GET(ctx) {
    return ctx.redirect("/admin/orders", 302);
  },
});

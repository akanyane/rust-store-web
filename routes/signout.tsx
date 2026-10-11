import { define } from "../utils.ts";
import { signOut } from "../lib/api.ts";

export const handler = define.handlers({
  // Só POST encerra a sessão: um link ou uma imagem de outro site não pode deslogar ninguém.
  GET(ctx) {
    return ctx.redirect("/", 302);
  },

  async POST(ctx) {
    const refresh = ctx.state.session.refresh;
    if (refresh) {
      try {
        await signOut(refresh);
      } catch {
        // Se a API não respondeu, a sessão dela expira sozinha; aqui os cookies saem de qualquer jeito.
      }
    }
    ctx.state.session.clear();
    ctx.state.forgetUser = true;
    return ctx.redirect("/", 303);
  },
});

import { App, staticFiles } from "fresh";
import { define, type State } from "./utils.ts";
import { themeFromCookie } from "./lib/theme.ts";

export const app = new App<State>();

app.use(staticFiles());

// Lê o tema salvo (cookie `theme`) para o servidor já renderizar o `data-theme` certo.
app.use(define.middleware((ctx) => {
  ctx.state.theme = themeFromCookie(ctx.req.headers.get("cookie"));
  return ctx.next();
}));

// Rotas baseadas em arquivos (routes/).
app.fsRoutes();

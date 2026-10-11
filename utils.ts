import { createDefine } from "fresh";
import type { Theme } from "./lib/theme.ts";

// O tipo de `ctx.state`, compartilhado entre middlewares, layouts e rotas.
export interface State {
  /** Tema do cookie `theme`; sem ele, o navegador decide pelo sistema. */
  theme?: Theme;
}

export const define = createDefine<State>();

import { createDefine } from "fresh";
import type { Flash } from "./lib/flash.ts";
import type { SessionManager } from "./lib/session.ts";
import type { Theme } from "./lib/theme.ts";
import type { Customer, Role } from "./lib/types.ts";

// O tipo de `ctx.state`, compartilhado entre middlewares, layouts e rotas.
export interface State {
  /** Tema do cookie `theme`; sem ele, o navegador decide pelo sistema. */
  theme?: Theme;
  /** Tokens da requisição e a renovação automática (ver lib/session.ts). */
  session: SessionManager;
  /** Papel de quem está logado (`GET /auth/session`), só nas requisições GET. */
  role?: Role;
  /** Username de quem está logado. */
  username?: string;
  /** O cliente logado, quando deu para carregá-lo (só nas requisições GET). */
  customer?: Customer;
  /** Selo do carrinho no cabeçalho: soma das quantidades. */
  cartCount: number;
  /** A API não respondeu ao carregar os dados do cabeçalho. */
  apiDown: boolean;
  /** Mensagem de uma vez, vinda do redirecionamento anterior. */
  flash?: Flash;
  /** Mensagem para a PRÓXIMA página: o middleware grava o cookie. */
  pendingFlash?: Flash;
  /** O acesso é por HTTPS (cookies `Secure`). */
  secure: boolean;
}

export const define = createDefine<State>();

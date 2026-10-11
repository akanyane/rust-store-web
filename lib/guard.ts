import { type FreshContext, HttpError } from "fresh";
import { ApiUnavailableError } from "./api.ts";
import { NotSignedInError, SessionExpiredError } from "./session.ts";
import { signInHref } from "./redirect.ts";
import type { State } from "../utils.ts";

/**
 * Para páginas GET que exigem login. Devolve `undefined` quando o cliente está logado, ou o
 * redirecionamento para `/signin?next=…` (com `expired=1` se a sessão acabou). Se a API
 * estava fora do ar ao carregar o cliente, responde 503 em vez de mandar para o login.
 */
export function requireCustomer(
  ctx: FreshContext<State>,
): Response | undefined {
  if (ctx.state.customer) return undefined;
  if (ctx.state.apiDown) throw new HttpError(503);
  return ctx.redirect(
    signInHref(ctx.url.pathname + ctx.url.search, ctx.state.session.expired),
    302,
  );
}

export type Authed<T> = { ok: true; value: T } | {
  ok: false;
  response: Response;
};

/**
 * Para ações POST: roda `fn` com o session token (renovando se preciso). Sem login ou com a
 * sessão perdida, devolve o redirecionamento para o login; a API fora do ar vira 503. Erros
 * 4xx da API (409, 422…) seguem para a rota tratar.
 */
export async function authed<T>(
  ctx: FreshContext<State>,
  nextPath: string,
  fn: (token: string) => Promise<T>,
): Promise<Authed<T>> {
  try {
    return { ok: true, value: await ctx.state.session.call(fn) };
  } catch (error) {
    if (error instanceof NotSignedInError) {
      return { ok: false, response: ctx.redirect(signInHref(nextPath), 303) };
    }
    if (error instanceof SessionExpiredError) {
      return {
        ok: false,
        response: ctx.redirect(signInHref(nextPath, true), 303),
      };
    }
    if (error instanceof ApiUnavailableError) throw new HttpError(503);
    throw error;
  }
}

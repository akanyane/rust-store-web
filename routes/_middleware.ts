import { define, type State } from "../utils.ts";
import { getCart, getMe } from "../lib/api.ts";
import { ApiUnavailableError } from "../lib/api.ts";
import { cartCount } from "../lib/cart.ts";
import {
  clearFlashCookie,
  clearSessionCookies,
  FLASH_COOKIE,
  readCookie,
  readSessionCookies,
  writeFlashCookie,
  writeSessionCookies,
} from "../lib/cookies.ts";
import { parseFlash, serializeFlash } from "../lib/flash.ts";
import { SessionExpiredError, SessionManager } from "../lib/session.ts";

/** Quem está logado e quantos itens há no carrinho, para o cabeçalho (duas chamadas em paralelo). */
async function loadHeaderData(state: State): Promise<void> {
  const [me, cart] = await Promise.allSettled([
    state.session.call(getMe),
    state.session.call(getCart),
  ]);
  if (me.status === "fulfilled") state.customer = me.value;
  else if (me.reason instanceof ApiUnavailableError) state.apiDown = true;
  // SessionExpiredError: o SessionManager já marcou `expired` e vai apagar os cookies.
  else if (!(me.reason instanceof SessionExpiredError)) {
    console.error("header: /me failed", me.reason);
  }
  if (cart.status === "fulfilled") state.cartCount = cartCount(cart.value);
}

export default define.middleware(async (ctx) => {
  const headers = ctx.req.headers;
  const state = ctx.state;
  state.secure = ctx.url.protocol === "https:" ||
    headers.get("x-forwarded-proto") === "https";
  state.session = new SessionManager(readSessionCookies(headers));
  state.cartCount = 0;
  state.apiDown = false;

  const isRead = ctx.req.method === "GET";
  const flashCookie = readCookie(headers, FLASH_COOKIE);
  if (isRead) state.flash = parseFlash(flashCookie);
  if (isRead && state.session.hasCredentials) await loadHeaderData(state);

  const response = await ctx.next();

  // Uma cópia: assim os cabeçalhos podem ser alterados mesmo em respostas "imutáveis".
  const result = new Response(response.body, response);
  if (state.session.cleared) clearSessionCookies(result.headers);
  else if (
    state.session.changed && state.session.session && state.session.refresh
  ) {
    writeSessionCookies(
      result.headers,
      {
        session_token: state.session.session,
        refresh_token: state.session.refresh,
      },
      state.secure,
    );
  }
  if (state.pendingFlash) {
    writeFlashCookie(
      result.headers,
      serializeFlash(state.pendingFlash),
      state.secure,
    );
  } else if (isRead && flashCookie) {
    clearFlashCookie(result.headers);
  }
  // Páginas de quem está logado têm dados pessoais: nada de cache compartilhado.
  if (
    state.session.hasCredentials || state.session.cleared ||
    state.session.changed
  ) {
    result.headers.set("cache-control", "private, no-store");
    result.headers.append("vary", "cookie");
  }
  return result;
});

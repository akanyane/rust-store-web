import { ApiError, refreshTokens } from "./api.ts";
import type { SessionCookies } from "./cookies.ts";
import type { Tokens } from "./types.ts";

/** Não há sessão nem refresh token: o visitante não está logado. */
export class NotSignedInError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "NotSignedInError";
  }
}

/** Havia sessão, mas a renovação falhou: é preciso entrar de novo. */
export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired");
    this.name = "SessionExpiredError";
  }
}

export type RefreshFn = (refreshToken: string) => Promise<Tokens>;

// O refresh token da API vale uma vez só. Duas requisições do mesmo navegador ao mesmo
// tempo, cada uma com o mesmo refresh no cookie, brigariam: uma gastaria o token e a outra
// receberia 401 e deslogaria o usuário à toa. Por isso as renovações são compartilhadas:
// quem chega durante uma renovação espera por ela, e quem chega logo depois (com o cookie
// antigo, que o navegador ainda não trocou) reaproveita o resultado por alguns segundos.
// O limite: isso vale por instância do servidor; com várias instâncias, seria preciso um
// cache compartilhado.
const RECENT_MS = 30_000;
const inflight = new Map<string, Promise<Tokens>>();
const recent = new Map<string, { tokens: Tokens; at: number }>();

/** Para os testes: esquece renovações em andamento e recentes. */
export function resetRenewals(): void {
  inflight.clear();
  recent.clear();
}

export function renewTokens(
  refreshToken: string,
  refresh: RefreshFn = refreshTokens,
  now: () => number = Date.now,
): Promise<Tokens> {
  for (const [token, entry] of recent) {
    if (now() - entry.at > RECENT_MS) recent.delete(token);
  }
  const done = recent.get(refreshToken);
  if (done) return Promise.resolve(done.tokens);

  const running = inflight.get(refreshToken);
  if (running) return running;

  const promise = refresh(refreshToken)
    .then((tokens) => {
      recent.set(refreshToken, { tokens, at: now() });
      return tokens;
    })
    .finally(() => inflight.delete(refreshToken));
  inflight.set(refreshToken, promise);
  return promise;
}

/**
 * A sessão de uma requisição: guarda os tokens dos cookies, renova quando preciso e diz ao
 * middleware o que gravar de volta (`changed`) ou apagar (`cleared`).
 */
export class SessionManager {
  session?: string;
  refresh?: string;
  /** Os tokens mudaram (login ou renovação): o middleware grava os cookies novos. */
  changed = false;
  /** Os cookies devem ser apagados (logout ou sessão perdida). */
  cleared = false;
  /** A sessão acabou e não deu para renovar. */
  expired = false;

  constructor(
    cookies: SessionCookies,
    private readonly renew: (refreshToken: string) => Promise<Tokens> =
      renewTokens,
  ) {
    this.session = cookies.session;
    this.refresh = cookies.refresh;
  }

  get hasCredentials(): boolean {
    return Boolean(this.session || this.refresh);
  }

  setTokens(tokens: Tokens): void {
    this.session = tokens.session_token;
    this.refresh = tokens.refresh_token;
    this.changed = true;
    this.cleared = false;
    this.expired = false;
  }

  clear(): void {
    this.session = undefined;
    this.refresh = undefined;
    this.changed = false;
    this.cleared = true;
  }

  private expire(): never {
    this.clear();
    this.expired = true;
    throw new SessionExpiredError();
  }

  private async renewNow(): Promise<void> {
    if (!this.refresh) this.expire();
    try {
      this.setTokens(await this.renew(this.refresh));
    } catch (error) {
      // 4xx: o refresh não vale mais. Falha de rede ou 5xx não desloga: o erro segue.
      if (error instanceof ApiError) this.expire();
      throw error;
    }
  }

  /**
   * Roda `fn` com o session token. Sem sessão, tenta renovar pelo refresh; se a API
   * responder 401, renova uma vez e repete.
   */
  async call<T>(fn: (token: string) => Promise<T>): Promise<T> {
    if (!this.session) {
      if (!this.refresh) throw new NotSignedInError();
      await this.renewNow();
    }
    try {
      return await fn(this.session!);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
    }
    await this.renewNow();
    try {
      return await fn(this.session!);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) this.expire();
      throw error;
    }
  }
}

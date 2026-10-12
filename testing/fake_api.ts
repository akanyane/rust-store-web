import type {
  AdminCustomer,
  AdminCustomerListItem,
  AdminOrder,
  AdminStats,
  Cart,
  Customer,
  Session,
  Tokens,
} from "../lib/types.ts";

/** O que um handler da API simulada recebe. */
export interface FakeRequest {
  method: string;
  url: URL;
  /** Session token do `Authorization: Bearer`, se veio. */
  token?: string;
  body: unknown;
  params: Record<string, string>;
}

export type FakeHandler = (
  request: FakeRequest,
) => Response | Promise<Response>;

export interface Call {
  method: string;
  path: string;
  /** A query string, com o `?` (ou vazia). */
  search: string;
  body: unknown;
}

export function jsonResponse(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export function apiError(status: number, message: string): Response {
  return jsonResponse({ error: message }, status);
}

export const ANA: Session = { id: "cust1", username: "ana", role: "customer" };
export const BOSS: Session = { id: "adm1", username: "boss", role: "admin" };

export const ANA_PROFILE: Customer = {
  id: "cust1",
  username: "ana",
  first_name: "Ana",
  last_name: "Lima",
  birthday: "1990-01-01",
};

export const EMPTY_CART: Cart = { items: [], total: 0, can_checkout: false };

export function emptyStats(): AdminStats {
  return {
    orders: {
      total: 0,
      pending: 0,
      paid: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    },
    revenue: 0,
    products: { active: 0, inactive: 0 },
    low_stock: [],
  };
}

export function customerItem(
  overrides: Partial<AdminCustomerListItem> = {},
): AdminCustomerListItem {
  return {
    id: "cust1",
    username: "ana",
    created_at: "2026-03-02T10:00:00Z",
    orders: 6,
    spent: 1240,
    last_order_at: "2026-10-11T22:10:00Z",
    ...overrides,
  };
}

export function customer(
  overrides: Partial<AdminCustomer> = {},
): AdminCustomer {
  return {
    id: "cust1",
    username: "ana",
    created_at: "2026-03-02T10:00:00Z",
    orders: {
      total: 6,
      pending: 1,
      paid: 2,
      shipped: 0,
      delivered: 2,
      cancelled: 1,
    },
    spent: 1240,
    last_order_at: "2026-10-11T22:10:00Z",
    ...overrides,
  };
}

export function order(overrides: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: "ord1abcdefgh",
    status: "pending",
    total: 50,
    created_at: "2026-10-11T16:57:00Z",
    paid_at: null,
    customer_id: "cust1",
    items: [{
      variant_id: "var1",
      name: "Default",
      product_name: "Ceramic mug",
      sku: "MUG-1",
      unit_price: 25,
      quantity: 2,
      line_total: 50,
    }],
    ...overrides,
  };
}

interface Account {
  password: string;
  session: Session;
}

const ACCOUNTS: Record<string, Account> = {
  ana: { password: "ana-pass", session: ANA },
  boss: { password: "boss-pass", session: BOSS },
};

function tokensFor(username: string): Tokens {
  return {
    session_token: `session-${username}`,
    refresh_token: `refresh-${username}`,
  };
}

/**
 * Uma API simulada: troca o `fetch` global e responde a partir de uma tabela de rotas
 * (`"GET /path/:param"`). Já traz contas (`ana`/`ana-pass`, cliente; `boss`/`boss-pass`,
 * admin) e os endpoints de sessão; cada teste acrescenta o que precisa com `on`.
 */
export class FakeApi {
  readonly calls: Call[] = [];
  /** Os pedidos que `GET /admin/orders/:id` e `PUT /admin/orders/:id/status` enxergam. */
  readonly orders = new Map<string, AdminOrder>();
  /** Os clientes que `GET /admin/customers/:id` conhece. */
  readonly customers = new Map<string, AdminCustomer>();
  /** O que `GET /admin/customers` devolve; o teste troca o que precisar. */
  customerList: AdminCustomerListItem[] = [];
  /** O que `GET /admin/stats` devolve; o teste troca o que precisar. */
  stats: AdminStats = emptyStats();
  private readonly routes: {
    method: string;
    parts: string[];
    fn: FakeHandler;
  }[] = [];
  private original?: typeof fetch;
  private offline = false;

  constructor() {
    this.on("POST /auth/sign-in", ({ body }) => {
      const { username, password } = body as {
        username: string;
        password: string;
      };
      const account = ACCOUNTS[String(username).toLowerCase()];
      return account && account.password === password
        ? jsonResponse(tokensFor(account.session.username))
        : apiError(401, "invalid username or password");
    });
    this.on("GET /auth/session", ({ token }) => {
      const session = Object.values(ACCOUNTS).map((a) => a.session).find((s) =>
        `session-${s.username}` === token
      );
      return session ? jsonResponse(session) : apiError(401, "unauthorized");
    });
    this.on("POST /auth/refresh", ({ body }) => {
      const { refresh_token } = body as { refresh_token: string };
      const username = Object.keys(ACCOUNTS).find((name) =>
        `refresh-${name}` === refresh_token
      );
      return username
        ? jsonResponse(tokensFor(username))
        : apiError(401, "invalid refresh token");
    });
    this.on("POST /auth/sign-out", () => new Response(null, { status: 204 }));
    this.on(
      "GET /me",
      ({ token }) =>
        token === "session-ana"
          ? jsonResponse(ANA_PROFILE)
          : apiError(token ? 404 : 401, "not found"),
    );
    this.on("GET /cart", () => jsonResponse(EMPTY_CART));
    this.on(
      "GET /admin/customers",
      ({ token }) =>
        token === "session-boss"
          ? jsonResponse(this.customerList, 200, {
            "x-total-count": String(this.customerList.length),
          })
          : apiError(403, "forbidden"),
    );
    this.on("GET /admin/customers/:id", ({ token, params }) => {
      if (token !== "session-boss") return apiError(403, "forbidden");
      const found = this.customers.get(params.id);
      return found ? jsonResponse(found) : apiError(404, "not found");
    });
    this.on(
      "GET /admin/stats",
      ({ token }) =>
        token === "session-boss"
          ? jsonResponse(this.stats)
          : apiError(403, "forbidden"),
    );
    this.on("GET /admin/orders", ({ token }) => {
      if (token !== "session-boss") return apiError(403, "forbidden");
      const all = [...this.orders.values()];
      return jsonResponse(all, 200, { "x-total-count": String(all.length) });
    });
    this.on("GET /admin/orders/:id", ({ token, params }) => {
      if (token !== "session-boss") return apiError(403, "forbidden");
      const found = this.orders.get(params.id);
      return found ? jsonResponse(found) : apiError(404, "not found");
    });
    this.on("PUT /admin/orders/:id/status", ({ token, params, body }) => {
      if (token !== "session-boss") return apiError(403, "forbidden");
      const found = this.orders.get(params.id);
      if (!found) return apiError(404, "not found");
      found.status = (body as { status: AdminOrder["status"] }).status;
      return jsonResponse(found);
    });
  }

  /** Acrescenta ou troca a resposta de uma rota: `on("POST /orders", () => …)`. */
  on(route: string, fn: FakeHandler): this {
    const [method, path] = route.split(" ");
    const parts = path.split("/").filter(Boolean);
    const at = this.routes.findIndex((r) =>
      r.method === method && r.parts.join("/") === parts.join("/")
    );
    const entry = { method, parts, fn };
    if (at >= 0) this.routes[at] = entry;
    else this.routes.push(entry);
    return this;
  }

  /** Daqui em diante, toda chamada à API falha como se ela estivesse fora do ar. */
  goOffline(): void {
    this.offline = true;
  }

  /** As chamadas feitas, como `"METHOD /path"`. */
  get made(): string[] {
    return this.calls.map((c) => `${c.method} ${c.path}`);
  }

  install(): void {
    Deno.env.set("API_URL", "http://api.test");
    this.original = globalThis.fetch;
    globalThis.fetch = (input, init) => this.handle(input, init);
  }

  restore(): void {
    if (this.original) globalThis.fetch = this.original;
    Deno.env.delete("API_URL");
  }

  private async handle(
    input: Request | URL | string,
    init?: RequestInit,
  ): Promise<Response> {
    if (this.offline) throw new TypeError("connection refused");
    const request = new Request(input, init);
    const url = new URL(request.url);
    const text = await request.text();
    const body = text ? JSON.parse(text) : undefined;
    this.calls.push({
      method: request.method,
      path: url.pathname,
      search: url.search,
      body,
    });

    const segments = url.pathname.split("/").filter(Boolean);
    for (const route of this.routes) {
      if (route.method !== request.method) continue;
      if (route.parts.length !== segments.length) continue;
      const params: Record<string, string> = {};
      const matches = route.parts.every((part, i) => {
        if (part.startsWith(":")) {
          params[part.slice(1)] = decodeURIComponent(segments[i]);
          return true;
        }
        return part === segments[i];
      });
      if (!matches) continue;
      const bearer = request.headers.get("authorization");
      return await route.fn({
        method: request.method,
        url,
        token: bearer?.replace(/^Bearer /, ""),
        body,
        params,
      });
    }
    return apiError(
      404,
      `fake api: no route for ${request.method} ${url.pathname}`,
    );
  }
}

/** Roda `fn` com a API simulada instalada e restaura o `fetch` ao fim, passe ou falhe. */
export async function withFakeApi(
  fn: (api: FakeApi) => Promise<void>,
): Promise<void> {
  const api = new FakeApi();
  api.install();
  try {
    await fn(api);
  } finally {
    api.restore();
  }
}

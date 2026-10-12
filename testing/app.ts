import { App } from "fresh";
import { getSetCookies } from "@std/http";
import type { State } from "../utils.ts";
import middleware from "../routes/_middleware.ts";
import * as signin from "../routes/signin.tsx";
import * as signout from "../routes/signout.tsx";
import * as cart from "../routes/cart.tsx";
import * as account from "../routes/account.tsx";
import appWrapper from "../routes/_app.tsx";
import * as orders from "../routes/orders/index.tsx";
import adminLayout from "../routes/admin/_layout.tsx";
import * as adminHome from "../routes/admin/index.tsx";
import * as adminProduct from "../routes/admin/products/[id].tsx";
import * as adminCustomers from "../routes/admin/customers/index.tsx";
import * as adminCustomer from "../routes/admin/customers/[id].tsx";
import * as adminOrdersExport from "../routes/admin/orders/export.tsx";
import * as adminOrders from "../routes/admin/orders/index.tsx";
import * as adminOrder from "../routes/admin/orders/[id].tsx";

type RouteArg = Exclude<
  Parameters<App<State>["route"]>[1],
  (...args: never[]) => unknown
>;
type Component = NonNullable<RouteArg["component"]>;

/** Uma rota real (o `handler` e a página exportados pelo arquivo de `routes/`). */
interface RouteModule {
  handler?: RouteArg["handler"];
  default?: unknown;
}

/** O app das rotas reais com o middleware real, sem servidor e sem build. */
export function buildApp(options: { chrome?: boolean } = {}) {
  const app = new App<State>().use(middleware);
  // Com `chrome`, as páginas saem dentro do layout real (cabeçalho, rodapé), como no navegador.
  if (options.chrome) app.appWrapper(appWrapper as never);
  const mount = (path: string, route: RouteModule) =>
    app.route(path, {
      handler: route.handler,
      // O componente de cada rota tem o tipo dos próprios dados; aqui só passa adiante.
      component: route.default as Component | undefined,
    });
  mount("/signin", signin);
  mount("/signout", signout);
  mount("/cart", cart);
  mount("/orders", orders);
  app.layout("/admin", adminLayout as never);
  app.layout("/admin/*", adminLayout as never);
  mount("/admin", adminHome);
  mount("/admin/customers", adminCustomers);
  mount("/admin/customers/:id", adminCustomer);
  mount("/admin/products/:id", adminProduct);
  mount("/account", account);
  mount("/admin/orders", adminOrders);
  mount("/admin/orders/export", adminOrdersExport);
  mount("/admin/orders/:id", adminOrder);
  return app.handler();
}

/** A resposta já lida: o corpo sempre é consumido, para o teste não vazar conexões. */
export interface Reply {
  status: number;
  location: string | null;
  headers: Headers;
  body: string;
}

/** Guarda os cookies que o servidor manda, como um navegador (e apaga os que expiram). */
export class Browser {
  private readonly cookies = new Map<string, string>();

  constructor(
    private readonly handler: (request: Request) => Promise<Response>,
    initial: Record<string, string> = {},
  ) {
    for (const [name, value] of Object.entries(initial)) {
      this.cookies.set(name, value);
    }
  }

  cookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  async get(path: string): Promise<Reply> {
    return await this.send(path, { method: "GET" });
  }

  async post(path: string, form: Record<string, string>): Promise<Reply> {
    return await this.send(path, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
    });
  }

  private async send(path: string, init: RequestInit): Promise<Reply> {
    const headers = new Headers(init.headers);
    if (this.cookies.size > 0) {
      headers.set(
        "cookie",
        [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; "),
      );
    }
    const response = await this.handler(
      new Request(`http://localhost${path}`, { ...init, headers }),
    );
    for (const set of getSetCookies(response.headers)) {
      const gone = set.maxAge === 0 ||
        (set.expires !== undefined && Number(set.expires) < Date.now()) ||
        set.value === "";
      if (gone) this.cookies.delete(set.name);
      else this.cookies.set(set.name, set.value);
    }
    return {
      status: response.status,
      location: response.headers.get("location"),
      headers: response.headers,
      body: await response.text(),
    };
  }
}

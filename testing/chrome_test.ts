import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { Browser, buildApp } from "./app.ts";
import { apiError, withFakeApi } from "./fake_api.ts";
import type { ProductDetail } from "../lib/types.ts";

const ADMIN = { rs_session: "session-boss", rs_refresh: "refresh-boss" };

/** O console tem o próprio layout: nunca o cabeçalho e o rodapé da loja por cima. */
function assertConsoleChrome(body: string, label: string) {
  assertStringIncludes(
    body,
    "rs-adminnav",
    `${label}: the admin menu is missing`,
  );
  assert(
    !body.includes('class="rs-header"'),
    `${label}: storefront header inside the console`,
  );
  assert(
    !body.includes("Demo store: payments are simulated"),
    `${label}: storefront footer inside the console`,
  );
}

const PRODUCT: ProductDetail = {
  id: "prod1",
  name: "Oolong Tea",
  description: "Roasted",
  active: true,
  created_at: "2026-03-02T10:00:00Z",
  variants: [
    {
      id: "v1",
      product_id: "prod1",
      name: "50 g tin",
      sku: "TEA-050",
      price: 12,
      stock: 24,
      active: true,
    },
  ],
};

Deno.test("admin chrome: a page reached by GET has the console layout and nothing of the storefront", async () => {
  await withFakeApi(async (api) => {
    api.adminProducts.set("prod1", PRODUCT);
    const browser = new Browser(buildApp({ chrome: true }), ADMIN);
    for (const path of ["/admin/products/new", "/admin/products/prod1"]) {
      assertConsoleChrome((await browser.get(path)).body, `GET ${path}`);
    }
  });
});

Deno.test("admin chrome: a new-product form with errors, answered to a POST, keeps the console layout", async () => {
  await withFakeApi(async () => {
    const reply = await new Browser(buildApp({ chrome: true }), ADMIN).post(
      "/admin/products/new",
      { name: "", description: "", price: "abc", stock: "-1" },
    );
    assertEquals(reply.status, 422);
    assertStringIncludes(reply.body, "Please fix");
    assertConsoleChrome(reply.body, "POST /admin/products/new");
  });
});

Deno.test("admin chrome: a variant refused with 409 (repeated SKU) keeps the console layout", async () => {
  await withFakeApi(async (api) => {
    api.adminProducts.set("prod1", PRODUCT);
    api.on(
      "POST /products/:id/variants",
      () => apiError(409, 'sku already used by "50 g tin"'),
    );
    const reply = await new Browser(buildApp({ chrome: true }), ADMIN).post(
      "/admin/products/prod1",
      {
        intent: "add-variant",
        name: "Big",
        sku: "TEA-050",
        price: "20",
        stock: "5",
      },
    );
    assertEquals(reply.status, 409);
    assertConsoleChrome(reply.body, "POST add-variant");
  });
});

Deno.test("admin chrome: the storefront keeps its own header and footer, also after a POST", async () => {
  await withFakeApi(async () => {
    const browser = new Browser(buildApp({ chrome: true }), {
      rs_session: "session-ana",
      rs_refresh: "refresh-ana",
    });
    const reply = await browser.get("/cart");
    assertStringIncludes(reply.body, 'class="rs-header"');
    assertStringIncludes(reply.body, "Demo store: payments are simulated");
    assert(!reply.body.includes("rs-adminnav"));
  });
});

Deno.test("admin chrome: a POST under /admin by a customer never gets the console layout", async () => {
  await withFakeApi(async () => {
    const reply = await new Browser(buildApp({ chrome: true }), {
      rs_session: "session-ana",
      rs_refresh: "refresh-ana",
    }).post("/admin/products/new", {
      name: "",
      description: "",
      price: "abc",
      stock: "-1",
    });
    assert(!reply.body.includes("rs-adminnav"));
  });
});

/** Chamadas de dados do admin (tirando as do cabeçalho: sessão, perfil e carrinho). */
function adminDataCalls(calls: { method: string; path: string }[]) {
  return calls.filter((call) =>
    call.path.startsWith("/admin/") || call.path.startsWith("/products")
  );
}

const CUSTOMER = { rs_session: "session-ana", rs_refresh: "refresh-ana" };

const ADMIN_POSTS: [string, Record<string, string>][] = [
  ["/admin/products/new", {
    name: "x",
    description: "",
    price: "5",
    stock: "1",
  }],
  ["/admin/products/prod1", { intent: "toggle-product", active: "false" }],
  ["/admin/products/prod1", {
    intent: "add-variant",
    name: "B",
    sku: "B-1",
    price: "5",
    stock: "1",
  }],
  ["/admin/products", { intent: "deactivate", id: "prod1" }],
  ["/admin/orders/ord1abcdefgh", { status: "paid" }],
];

Deno.test("admin POST guard: a customer is stopped with 403 before any admin data is touched", async () => {
  for (const [path, form] of ADMIN_POSTS) {
    await withFakeApi(async (api) => {
      api.adminProducts.set("prod1", PRODUCT);
      const reply = await new Browser(buildApp(), CUSTOMER).post(path, form);
      assertEquals(reply.status, 403, path);
      assertEquals(adminDataCalls(api.calls), [], `${path} reached the API`);
    });
  }
});

Deno.test("admin POST guard: a visitor is sent to sign in, and nothing is called", async () => {
  for (const [path, form] of ADMIN_POSTS) {
    await withFakeApi(async (api) => {
      const reply = await new Browser(buildApp()).post(path, form);
      assertEquals(reply.status, 303, path);
      assertStringIncludes(reply.location ?? "", "/signin?next=", path);
      assertEquals(api.calls.length, 0, `${path} called the API`);
    });
  }
});

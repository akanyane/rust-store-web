import {
  assert,
  assertEquals,
  assertMatch,
  assertStringIncludes,
} from "@std/assert";
import { Browser, buildApp } from "./app.ts";
import {
  customer,
  type FakeApi,
  jsonResponse,
  order,
  withFakeApi,
} from "./fake_api.ts";

const ADMIN = { rs_session: "session-boss", rs_refresh: "refresh-boss" };
const CUSTOMER = { rs_session: "session-ana", rs_refresh: "refresh-ana" };
const PAGE = "/admin/customers/cust1";

/** A API devolve esses pedidos para qualquer listagem de `GET /admin/orders`. */
function listing(api: FakeApi, orders: ReturnType<typeof order>[]) {
  api.on(
    "GET /admin/orders",
    () => jsonResponse(orders, 200, { "x-total-count": String(orders.length) }),
  );
}

Deno.test("customer page: a visitor is sent to sign in, a customer gets 403", async () => {
  await withFakeApi(async (api) => {
    api.customers.set("cust1", customer());
    const visitor = await new Browser(buildApp()).get(PAGE);
    assertEquals(visitor.status, 302);
    assertEquals(visitor.location, "/signin?next=%2Fadmin%2Fcustomers%2Fcust1");

    const other = await new Browser(buildApp(), CUSTOMER).get(PAGE);
    assertEquals(other.status, 403);
    assert(!api.calls.some((c) => c.path.startsWith("/admin/customers")));
  });
});

Deno.test("customer page: with the API down it is a 503", async () => {
  await withFakeApi(async (api) => {
    api.goOffline();
    assertEquals((await new Browser(buildApp(), ADMIN).get(PAGE)).status, 503);
  });
});

Deno.test("customer page: an unknown customer, or the admin, is a 404", async () => {
  await withFakeApi(async () => {
    const browser = new Browser(buildApp(), ADMIN);
    assertEquals((await browser.get("/admin/customers/nope")).status, 404);
    assertEquals((await browser.get("/admin/customers/adm1")).status, 404);
  });
});

Deno.test("customer page: shows who they are and the numbers", async () => {
  await withFakeApi(async (api) => {
    api.customers.set("cust1", customer());
    listing(api, [order()]);
    const reply = await new Browser(buildApp(), ADMIN).get(PAGE);
    assertEquals(reply.status, 200);
    assertStringIncludes(reply.body, "<title>ana · Customer");
    assertStringIncludes(reply.body, '<h1 class="rs-h1">ana</h1>');
    assertStringIncludes(reply.body, "cust1");
    assertStringIncludes(reply.body, "1,240 unidades");
    assertStringIncludes(reply.body, "Mar 2, 2026");
    assertStringIncludes(reply.body, "Oct 11, 2026");
    assertStringIncludes(reply.body, "1 pending");
    assertStringIncludes(reply.body, 'href="/admin/orders?q=cust1"');
  });
});

Deno.test("customer page: status links only for statuses with orders, each filtered to this customer", async () => {
  await withFakeApi(async (api) => {
    api.customers.set("cust1", customer());
    listing(api, [order()]);
    const reply = await new Browser(buildApp(), ADMIN).get(PAGE);
    for (const status of ["pending", "paid", "delivered", "cancelled"]) {
      assertStringIncludes(
        reply.body,
        `href="/admin/orders?status=${status}&amp;q=cust1"`,
      );
    }
    assert(!reply.body.includes("status=shipped"));
  });
});

Deno.test("customer page: asks the API for this customer's ten latest orders and shows them", async () => {
  await withFakeApi(async (api) => {
    api.customers.set("cust1", customer());
    listing(api, [order({ id: "ordAAAAAAAA" })]);
    const reply = await new Browser(buildApp(), ADMIN).get(PAGE);
    const call = api.calls.findLast((c) => c.path === "/admin/orders");
    assert(call);
    const asked = new URLSearchParams(call.search);
    assertEquals(asked.get("q"), "cust1");
    assertEquals(asked.get("limit"), "10");
    assertEquals(asked.get("offset"), "0");
    assertStringIncludes(reply.body, "#ORDAAAAA");
    assertStringIncludes(reply.body, 'href="/admin/orders/ordAAAAAAAA"');
  });
});

Deno.test("customer page: an order of another customer that the prefix search also returns is not shown", async () => {
  await withFakeApi(async (api) => {
    api.customers.set("cust1", customer());
    listing(api, [
      order({ id: "ordMINE0000", customer_id: "cust1" }),
      order({ id: "ordOTHER000", customer_id: "cust10" }),
    ]);
    const reply = await new Browser(buildApp(), ADMIN).get(PAGE);
    assertStringIncludes(reply.body, "#ORDMINE0");
    assert(!reply.body.includes("#ORDOTHER"));
  });
});

Deno.test("customer page: someone who never bought has an empty state and nothing to filter", async () => {
  await withFakeApi(async (api) => {
    api.customers.set(
      "cust1",
      customer({
        orders: {
          total: 0,
          pending: 0,
          paid: 0,
          shipped: 0,
          delivered: 0,
          cancelled: 0,
        },
        spent: 0,
        last_order_at: null,
      }),
    );
    listing(api, []);
    const reply = await new Browser(buildApp(), ADMIN).get(PAGE);
    assertEquals(reply.status, 200);
    assertStringIncludes(reply.body, "This customer has not placed an order");
    assertStringIncludes(reply.body, "None yet");
    assert(!reply.body.includes("View all orders"));
    assert(!reply.body.includes("Orders by status"));
  });
});

Deno.test("customer page: personal data is never shown, even if the API sent it", async () => {
  await withFakeApi(async (api) => {
    api.customers.set(
      "cust1",
      {
        ...customer(),
        first_name: "Ana",
        last_name: "Lima",
        birthday: "1990-01-01",
      } as never,
    );
    listing(api, [order()]);
    const reply = await new Browser(buildApp(), ADMIN).get(PAGE);
    for (const secret of ["Lima", "1990", "birthday", "first_name"]) {
      assert(!reply.body.includes(secret), `${secret} rendered`);
    }
  });
});

Deno.test("customer page: the username is escaped", async () => {
  await withFakeApi(async (api) => {
    api.customers.set("cust1", customer({ username: "<script>x</script>" }));
    listing(api, []);
    const reply = await new Browser(buildApp(), ADMIN).get(PAGE);
    assert(!reply.body.includes("<script"));
    assertStringIncludes(reply.body, "&lt;script>x&lt;/script>");
  });
});

Deno.test("customer id links: the order list and the order page open the customer", async () => {
  await withFakeApi(async (api) => {
    api.orders.set("ord1abcdefgh", order());
    const browser = new Browser(buildApp(), ADMIN);
    const list = await browser.get("/admin/orders");
    assertMatch(
      list.body,
      /<a href="\/admin\/customers\/cust1" class="rs-mono-link"[^>]*>cust1<\/a>/,
    );
    const detail = await browser.get("/admin/orders/ord1abcdefgh");
    assertMatch(
      detail.body,
      /<a href="\/admin\/customers\/cust1" class="rs-mono-link"[^>]*>cust1<\/a>/,
    );
  });
});

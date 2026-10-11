import {
  assert,
  assertEquals,
  assertMatch,
  assertStringIncludes,
} from "@std/assert";
import { Browser, buildApp } from "./app.ts";
import { emptyStats, order, withFakeApi } from "./fake_api.ts";

const ADMIN = { rs_session: "session-boss", rs_refresh: "refresh-boss" };
const CUSTOMER = { rs_session: "session-ana", rs_refresh: "refresh-ana" };

Deno.test("dashboard: a visitor is sent to sign in, a customer gets 403", async () => {
  await withFakeApi(async (api) => {
    const visitor = await new Browser(buildApp()).get("/admin");
    assertEquals(visitor.status, 302);
    assertEquals(visitor.location, "/signin?next=%2Fadmin");

    const customer = await new Browser(buildApp(), CUSTOMER).get("/admin");
    assertEquals(customer.status, 403);
    assert(!api.made.includes("GET /admin/stats"));
  });
});

Deno.test("dashboard: with the API down it is a 503", async () => {
  await withFakeApi(async (api) => {
    api.goOffline();
    const reply = await new Browser(buildApp(), ADMIN).get("/admin");
    assertEquals(reply.status, 503);
  });
});

Deno.test("dashboard: shows the numbers, linking to where they live", async () => {
  await withFakeApi(async (api) => {
    api.stats = {
      ...emptyStats(),
      orders: {
        total: 12,
        pending: 3,
        paid: 2,
        shipped: 1,
        delivered: 5,
        cancelled: 1,
      },
      revenue: 1240,
      products: { active: 7, inactive: 2 },
    };
    const reply = await new Browser(buildApp(), ADMIN).get("/admin");
    assertEquals(reply.status, 200);
    assertStringIncludes(reply.body, "12 orders in total");
    assertStringIncludes(reply.body, "Pending orders");
    assertStringIncludes(reply.body, 'href="/admin/orders?status=pending"');
    assertStringIncludes(reply.body, 'href="/admin/orders?status=paid"');
    assertStringIncludes(reply.body, "1,240 unidades");
    assertStringIncludes(reply.body, "7 active");
    assertStringIncludes(reply.body, "2 inactive");
  });
});

Deno.test("dashboard: cards that need an action are highlighted, quiet ones are not", async () => {
  await withFakeApi(async (api) => {
    const browser = new Browser(buildApp(), ADMIN);
    api.stats = {
      ...emptyStats(),
      orders: { ...emptyStats().orders, pending: 2 },
    };
    const busy = await browser.get("/admin");
    assertEquals(busy.body.match(/rs-stat--attention/g)?.length, 1);

    api.stats = emptyStats();
    const quiet = await browser.get("/admin");
    assert(!quiet.body.includes("rs-stat--attention"));
  });
});

Deno.test("dashboard: lists recent orders (asking the API for five) or says there are none", async () => {
  await withFakeApi(async (api) => {
    const browser = new Browser(buildApp(), ADMIN);
    const none = await browser.get("/admin");
    assertStringIncludes(none.body, "No orders yet");

    api.orders.set("ord1abcdefgh", order({ id: "ord1abcdefgh" }));
    const some = await browser.get("/admin");
    assert(!some.body.includes("No orders yet"));
    assertStringIncludes(some.body, "#ORD1ABCD");
    assertStringIncludes(some.body, 'href="/admin/orders/ord1abcdefgh"');
    assert(api.calls.some((call) => call.path === "/admin/orders"));
  });
});

Deno.test("dashboard: the recent orders request is limited to five", async () => {
  await withFakeApi(async (api) => {
    let asked = "";
    api.on("GET /admin/orders", ({ url }) => {
      asked = url.search;
      return new Response("[]", {
        headers: {
          "content-type": "application/json",
          "x-total-count": "0",
        },
      });
    });
    await new Browser(buildApp(), ADMIN).get("/admin");
    assertMatch(asked, /limit=5/);
    assertMatch(asked, /offset=0/);
  });
});

Deno.test("dashboard: low stock rows link to the product and say how many are left", async () => {
  await withFakeApi(async (api) => {
    const browser = new Browser(buildApp(), ADMIN);
    const empty = await browser.get("/admin");
    assertStringIncludes(empty.body, "Nothing is running low");

    api.stats = {
      ...emptyStats(),
      low_stock: [
        {
          product_id: "prodA",
          product_name: "Desk lamp",
          variant_id: "varA",
          variant_name: "Default",
          sku: "LAMP-1",
          stock: 0,
        },
        {
          product_id: "prodB",
          product_name: "Canvas tote",
          variant_id: "varB",
          variant_name: "Large",
          sku: "TOTE-L",
          stock: 2,
        },
      ],
    };
    const reply = await browser.get("/admin");
    assert(!reply.body.includes("Nothing is running low"));
    assertStringIncludes(reply.body, 'href="/admin/products/prodA"');
    assertStringIncludes(reply.body, "Desk lamp");
    assertStringIncludes(reply.body, "Out of stock");
    assertStringIncludes(reply.body, "Only 2 left");
    assertStringIncludes(reply.body, "TOTE-L");
    // A classe de cada cor vai na linha certa: vazio em vermelho, pouco em aviso.
    assertMatch(reply.body, /rs-stock-cell--out">Out of stock/);
    assertMatch(reply.body, /rs-stock-cell--low">Only 2 left/);
  });
});

/** O link de navegação do console cujo texto é `label`, com o `aria-current` dele. */
function navCurrent(body: string, label: string): string | undefined {
  const link = body.match(
    new RegExp(
      `<a[^>]*class="rs-adminnav__link"[^>]*>(?:(?!</a>).)*${label}</a>`,
    ),
  );
  return link?.[0].match(/aria-current="([^"]+)"/)?.[1];
}

Deno.test("dashboard: the nav marks Dashboard as current only on /admin", async () => {
  await withFakeApi(async () => {
    const browser = new Browser(buildApp(), ADMIN);
    const home = await browser.get("/admin");
    assertEquals(navCurrent(home.body, "Dashboard"), "page");
    assertEquals(navCurrent(home.body, "Orders"), "false");
    assertEquals(navCurrent(home.body, "Products"), "false");

    const orders = await browser.get("/admin/orders");
    assertEquals(navCurrent(orders.body, "Dashboard"), "false");
    assertEquals(navCurrent(orders.body, "Orders"), "page");
  });
});

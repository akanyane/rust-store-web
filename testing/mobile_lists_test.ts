import {
  assert,
  assertEquals,
  assertMatch,
  assertStringIncludes,
} from "@std/assert";
import { Browser, buildApp } from "./app.ts";
import {
  customerItem,
  type FakeApi,
  jsonResponse,
  order,
  withFakeApi,
} from "./fake_api.ts";

const ADMIN = { rs_session: "session-boss", rs_refresh: "refresh-boss" };

function orders(api: FakeApi, count = 3) {
  api.on("GET /admin/orders", () =>
    jsonResponse(
      Array.from({ length: count }, (_, i) =>
        order({
          id: `ord${i}abcdefgh`,
          customer_id: `cust${i}xxxxxxxxxxxx`,
          status: i === 0 ? "pending" : "paid",
          total: 123 + i,
        })),
      200,
      { "x-total-count": String(count) },
    ));
}

Deno.test("mobile orders: a card per order with the number, status, customer, day and total", async () => {
  await withFakeApi(async (api) => {
    orders(api);
    const reply = await new Browser(buildApp(), ADMIN).get("/admin/orders");
    const cards = reply.body.match(
      /<a href="\/admin\/orders\/ord\dabcdefgh" class="rs-itemcard"/g,
    );
    assertEquals(cards?.length, 3);
    assertStringIncludes(reply.body, "#ORD0ABCD");
    assertStringIncludes(reply.body, "Customer");
    assertStringIncludes(reply.body, "cust0xxx");
    assertStringIncludes(reply.body, "Oct 11");
    assertStringIncludes(reply.body, "123");
  });
});

Deno.test("mobile orders: the cards and the table are both in the page, and each is hidden at the other size", async () => {
  await withFakeApi(async (api) => {
    orders(api);
    const reply = await new Browser(buildApp(), ADMIN).get("/admin/orders");
    assertMatch(reply.body, /<ul class="rs-cardlist rs-mob-only">/);
    assertMatch(reply.body, /<div class="rs-tablewrap rs-desk-only">/);
  });
});

Deno.test("mobile orders: the status filter is a select, with the current status chosen and the search kept", async () => {
  await withFakeApi(async (api) => {
    orders(api);
    const reply = await new Browser(buildApp(), ADMIN).get(
      "/admin/orders?status=paid&q=ana",
    );
    assertMatch(
      reply.body,
      /<form method="get" action="\/admin\/orders" class="rs-filterselect">/,
    );
    assertMatch(reply.body, /<input[^>]*type="hidden" name="q" value="ana">/);
    assertMatch(reply.body, /<select id="filter-status" name="status"/);
    assertMatch(
      reply.body,
      /<option[^>]*value="paid" selected[^>]*>Paid<\/option>/,
    );
    for (
      const label of [
        "All",
        "Pending",
        "Paid",
        "Shipped",
        "Delivered",
        "Cancelled",
      ]
    ) {
      assertStringIncludes(reply.body, `>${label}</option>`);
    }
    assertEquals(reply.body.match(/ selected/g)?.length, 1);
  });
});

Deno.test("mobile orders: without a search the select form has no hidden fields, and All is chosen", async () => {
  await withFakeApi(async (api) => {
    orders(api);
    const reply = await new Browser(buildApp(), ADMIN).get("/admin/orders");
    const form = reply.body.match(
      /<form method="get" action="\/admin\/orders" class="rs-filterselect">.*?<\/form>/s,
    )?.[0] ?? "";
    assert(form, "no select form");
    assert(!form.includes('type="hidden"'));
    assertMatch(form, /<option[^>]*value="all" selected[^>]*>All<\/option>/);
    assertStringIncludes(form, "<noscript>");
  });
});

Deno.test("mobile orders: no cards when there are no orders, only the empty state", async () => {
  await withFakeApi(async (api) => {
    orders(api, 0);
    const reply = await new Browser(buildApp(), ADMIN).get("/admin/orders");
    assert(!reply.body.includes("rs-itemcard"));
    assertStringIncludes(reply.body, "Orders will show up here");
  });
});

Deno.test("mobile products: a card per product that opens it, with the inactive ones dimmed and marked", async () => {
  await withFakeApi(async (api) => {
    api.on("GET /admin/products", () =>
      jsonResponse(
        [
          {
            id: "prodAAAAAAAA",
            name: "Oolong Tea",
            description: "x",
            active: true,
            created_at: "2026-03-02T10:00:00Z",
          },
          {
            id: "prodBBBBBBBB",
            name: "Old Mug",
            description: "x",
            active: false,
            created_at: null,
          },
        ],
        200,
        { "x-total-count": "2" },
      ));
    const reply = await new Browser(buildApp(), ADMIN).get("/admin/products");
    assertEquals(reply.status, 200);
    assertMatch(
      reply.body,
      /<a href="\/admin\/products\/prodAAAAAAAA" class="rs-itemcard rs-itemcard--row"/,
    );
    assertMatch(
      reply.body,
      /<a href="\/admin\/products\/prodBBBBBBBB" class="rs-itemcard rs-itemcard--row rs-itemcard--off"/,
    );
    assertStringIncludes(reply.body, "Mar 2, 2026");
    assertStringIncludes(reply.body, "Inactive");
    assertMatch(reply.body, /<div class="rs-tablewrap rs-desk-only">/);
  });
});

Deno.test("mobile customers: a card per customer with the username, orders and amount spent", async () => {
  await withFakeApi(async (api) => {
    api.customerList = [
      customerItem(),
      customerItem({ id: "cust2", username: "newbie", orders: 1, spent: 25 }),
    ];
    const reply = await new Browser(buildApp(), ADMIN).get("/admin/customers");
    assertMatch(
      reply.body,
      /<a href="\/admin\/customers\/cust1" class="rs-itemcard rs-itemcard--row"/,
    );
    assertStringIncludes(reply.body, "6 orders");
    assertStringIncludes(reply.body, "1,240 unidades");
    assertStringIncludes(reply.body, "1 order ·");
    assertStringIncludes(reply.body, "25 unidades");
    assertMatch(reply.body, /<div class="rs-tablewrap rs-desk-only">/);
  });
});

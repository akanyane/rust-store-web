import {
  assert,
  assertEquals,
  assertMatch,
  assertStringIncludes,
} from "@std/assert";
import { Browser, buildApp } from "./app.ts";
import { type FakeApi, jsonResponse, order, withFakeApi } from "./fake_api.ts";

const ADMIN = { rs_session: "session-boss", rs_refresh: "refresh-boss" };
const CUSTOMER = { rs_session: "session-ana", rs_refresh: "refresh-ana" };
const EXPORT = "/admin/orders/export";

/** O que o web pediu a `GET /admin/orders/export.csv` na última chamada. */
function asked(api: FakeApi): URLSearchParams {
  const call = api.calls.findLast((c) => c.path === "/admin/orders/export.csv");
  assert(call, "the page never asked the API for the file");
  return new URLSearchParams(call.search);
}

Deno.test("export: a visitor is sent to sign in, a customer gets 403, and neither gets a file", async () => {
  await withFakeApi(async (api) => {
    const visitor = await new Browser(buildApp()).get(`${EXPORT}?status=paid`);
    assertEquals(visitor.status, 302);
    assertEquals(
      visitor.location,
      "/signin?next=%2Fadmin%2Forders%2Fexport%3Fstatus%3Dpaid",
    );
    const other = await new Browser(buildApp(), CUSTOMER).get(EXPORT);
    assertEquals(other.status, 403);
    assert(!api.calls.some((c) => c.path === "/admin/orders/export.csv"));
  });
});

Deno.test("export: with the API down it is a 503", async () => {
  await withFakeApi(async (api) => {
    api.goOffline();
    assertEquals(
      (await new Browser(buildApp(), ADMIN).get(EXPORT)).status,
      503,
    );
  });
});

Deno.test("export: an error from the API is not shown as if it were a file", async () => {
  await withFakeApi(async (api) => {
    api.on(
      "GET /admin/orders/export.csv",
      () => new Response("{}", { status: 500 }),
    );
    const reply = await new Browser(buildApp(), ADMIN).get(EXPORT);
    assertEquals(reply.status, 503);
    assert(!reply.headers.get("content-disposition"));
  });
});

Deno.test("export: the file is passed through untouched, as a download", async () => {
  await withFakeApi(async (api) => {
    api.csv = "order_id,total\r\nabc,50\r\ndef,25\r\n";
    api.csvTotal = 2;
    const reply = await new Browser(buildApp(), ADMIN).get(EXPORT);
    assertEquals(reply.status, 200);
    assertEquals(reply.body, "order_id,total\r\nabc,50\r\ndef,25\r\n");
    assertEquals(reply.headers.get("content-type"), "text/csv; charset=utf-8");
    assertEquals(
      reply.headers.get("content-disposition"),
      'attachment; filename="orders-2026-10-12.csv"',
    );
    assertEquals(reply.headers.get("x-total-count"), "2");
    assertEquals(reply.headers.get("cache-control"), "private, no-store");
    assertEquals(reply.headers.get("x-export-truncated"), null);
  });
});

Deno.test("export: the truncation warning reaches the browser only when the API sent it", async () => {
  await withFakeApi(async (api) => {
    const browser = new Browser(buildApp(), ADMIN);
    api.csvTruncated = true;
    api.csvTotal = 12_000;
    const cut = await browser.get(EXPORT);
    assertEquals(cut.headers.get("x-export-truncated"), "true");
    assertEquals(cut.headers.get("x-total-count"), "12000");
    api.csvTruncated = false;
    const whole = await browser.get(EXPORT);
    assertEquals(whole.headers.get("x-export-truncated"), null);
  });
});

Deno.test("export: the status filter and the search reach the API", async () => {
  await withFakeApi(async (api) => {
    const browser = new Browser(buildApp(), ADMIN);
    await browser.get(`${EXPORT}?status=paid&q=%20ana%20`);
    assertEquals(asked(api).get("status"), "paid");
    assertEquals(asked(api).get("q"), "ana");

    await browser.get(`${EXPORT}?q=%239FST3BCC`);
    assertEquals(asked(api).get("q"), "#9FST3BCC");
    assert(!asked(api).has("status"));
  });
});

Deno.test("export: no filter, a blank search or an unknown status is the whole list", async () => {
  await withFakeApi(async (api) => {
    const browser = new Browser(buildApp(), ADMIN);
    for (
      const query of ["", "?q=", "?q=%20%20", "?status=all", "?status=bogus"]
    ) {
      await browser.get(`${EXPORT}${query}`);
      assertEquals(asked(api).size, 0, query);
    }
  });
});

Deno.test("export: a search longer than the API takes is cut instead of refused", async () => {
  await withFakeApi(async (api) => {
    const reply = await new Browser(buildApp(), ADMIN).get(
      `${EXPORT}?q=${"x".repeat(200)}`,
    );
    assertEquals(reply.status, 200);
    assertEquals(asked(api).get("q"), "x".repeat(64));
  });
});

Deno.test("export: pagination parameters in the link are not forwarded", async () => {
  await withFakeApi(async (api) => {
    await new Browser(buildApp(), ADMIN).get(
      `${EXPORT}?page=3&limit=1&offset=9`,
    );
    assertEquals(asked(api).size, 0);
  });
});

Deno.test("export: the route is not taken for an order id", async () => {
  await withFakeApi(async (api) => {
    api.orders.set("export", order({ id: "export" }));
    const reply = await new Browser(buildApp(), ADMIN).get(EXPORT);
    assertEquals(reply.headers.get("content-type"), "text/csv; charset=utf-8");
  });
});

/** As listagens de pedidos da API para a tela: `count` pedidos e o total dado. */
function listing(api: FakeApi, count: number, total = count) {
  api.on("GET /admin/orders", () =>
    jsonResponse(
      Array.from({ length: count }, (_, i) => order({ id: `ord${i}xxxxxxxx` })),
      200,
      { "x-total-count": String(total) },
    ));
}

Deno.test("export button: it carries the current filter and search, and says how many orders", async () => {
  await withFakeApi(async (api) => {
    listing(api, 3, 3);
    const browser = new Browser(buildApp(), ADMIN);

    const plain = await browser.get("/admin/orders");
    assertMatch(
      plain.body,
      /<a href="\/admin\/orders\/export" class="rs-btn" download[^>]*>\s*Export CSV/,
    );
    assertStringIncludes(plain.body, "3 orders");
    assert(!plain.body.includes("matching the filter"));

    const narrowed = await browser.get("/admin/orders?status=paid&q=ana");
    assertStringIncludes(
      narrowed.body,
      'href="/admin/orders/export?status=paid&amp;q=ana"',
    );
    assertStringIncludes(narrowed.body, "matching the filter and search");
  });
});

Deno.test("export button: the page number is not in the link, the file is the whole list", async () => {
  await withFakeApi(async (api) => {
    listing(api, 10, 25);
    const reply = await new Browser(buildApp(), ADMIN).get(
      "/admin/orders?page=2",
    );
    assertStringIncludes(reply.body, 'href="/admin/orders/export"');
    assert(!reply.body.includes("export?page"));
    assertStringIncludes(reply.body, "25 orders");
  });
});

Deno.test("export button: a single order is not called 'orders', and with none there is no button", async () => {
  await withFakeApi(async (api) => {
    const browser = new Browser(buildApp(), ADMIN);
    listing(api, 1, 1);
    assertStringIncludes((await browser.get("/admin/orders")).body, "1 order<");

    listing(api, 0);
    const empty = await browser.get("/admin/orders");
    assert(!empty.body.includes("Export CSV"));
  });
});

Deno.test("export button: past the cap it says the file holds only the newest", async () => {
  await withFakeApi(async (api) => {
    listing(api, 10, 12_000);
    const reply = await new Browser(buildApp(), ADMIN).get("/admin/orders");
    assertStringIncludes(reply.body, "The 10,000 newest of 12,000 orders");
    listing(api, 10, 10_000);
    const exact = await new Browser(buildApp(), ADMIN).get("/admin/orders");
    assert(!exact.body.includes("newest of"));
    assertStringIncludes(exact.body, "10,000 orders");
  });
});

Deno.test("export: without a file name from the API the download still gets one", async () => {
  await withFakeApi(async (api) => {
    api.on(
      "GET /admin/orders/export.csv",
      () =>
        new Response(new TextEncoder().encode("a,b\r\n"), {
          headers: { "x-total-count": "1" },
        }),
    );
    const reply = await new Browser(buildApp(), ADMIN).get(EXPORT);
    assertEquals(reply.status, 200);
    assertEquals(
      reply.headers.get("content-disposition"),
      'attachment; filename="orders.csv"',
    );
    assertStringIncludes(reply.headers.get("content-type") ?? "", "text/csv");
  });
});

Deno.test("export: only the exact value 'true' marks the file as cut", async () => {
  await withFakeApi(async (api) => {
    api.on(
      "GET /admin/orders/export.csv",
      () =>
        new Response("a\r\n", {
          headers: { "x-export-truncated": "false", "x-total-count": "1" },
        }),
    );
    const reply = await new Browser(buildApp(), ADMIN).get(EXPORT);
    assertEquals(reply.headers.get("x-export-truncated"), null);
  });
});

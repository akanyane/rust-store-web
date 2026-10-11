import {
  assert,
  assertEquals,
  assertMatch,
  assertStringIncludes,
} from "@std/assert";
import { Browser, buildApp } from "./app.ts";
import { type FakeApi, jsonResponse, order, withFakeApi } from "./fake_api.ts";

const ADMIN = { rs_session: "session-boss", rs_refresh: "refresh-boss" };

/** O que o web pediu a `GET /admin/orders` na última chamada. */
function asked(api: FakeApi): URLSearchParams {
  const call = api.calls.findLast((c) => c.path === "/admin/orders");
  assert(call, "the page never asked the API for orders");
  return new URLSearchParams(call.search);
}

/** Faz a API responder com `count` pedidos e o total dado. */
function listing(api: FakeApi, count: number, total = count) {
  api.on("GET /admin/orders", () =>
    jsonResponse(
      Array.from(
        { length: count },
        (_, i) => order({ id: `ord${i}xxxxxxxx`, customer_id: `cust${i}` }),
      ),
      200,
      { "x-total-count": String(total) },
    ));
}

Deno.test("order search: the term typed reaches the API, as typed", async () => {
  await withFakeApi(async (api) => {
    listing(api, 1);
    const browser = new Browser(buildApp(), ADMIN);
    await browser.get("/admin/orders?q=%239FST3BCC");
    assertEquals(asked(api).get("q"), "#9FST3BCC");
    await browser.get("/admin/orders?q=cust1");
    assertEquals(asked(api).get("q"), "cust1");
  });
});

Deno.test("order search: it travels together with the status filter", async () => {
  await withFakeApi(async (api) => {
    listing(api, 1);
    await new Browser(buildApp(), ADMIN).get("/admin/orders?status=paid&q=ana");
    assertEquals(asked(api).get("status"), "paid");
    assertEquals(asked(api).get("q"), "ana");
  });
});

Deno.test("order search: a blank term is no search, and spaces are trimmed", async () => {
  await withFakeApi(async (api) => {
    listing(api, 1);
    const browser = new Browser(buildApp(), ADMIN);
    for (const q of ["", "%20%20", "+"]) {
      await browser.get(`/admin/orders?q=${q}`);
      assert(!asked(api).has("q"), `q=${q}`);
    }
    await browser.get("/admin/orders?q=%20%20abc%20");
    assertEquals(asked(api).get("q"), "abc");
  });
});

Deno.test("order search: a term longer than the API accepts is cut, not refused", async () => {
  await withFakeApi(async (api) => {
    listing(api, 1);
    const reply = await new Browser(buildApp(), ADMIN).get(
      `/admin/orders?q=${"x".repeat(200)}`,
    );
    assertEquals(reply.status, 200);
    assertEquals(asked(api).get("q"), "x".repeat(64));
  });
});

Deno.test("order search: the box shows the term, and offers Clear only when there is one", async () => {
  await withFakeApi(async (api) => {
    listing(api, 1);
    const browser = new Browser(buildApp(), ADMIN);
    const searched = await browser.get("/admin/orders?q=ana");
    assertMatch(searched.body, /<input[^>]*name="q"[^>]*value="ana"/);
    assertStringIncludes(searched.body, "Clear");
    assertStringIncludes(searched.body, 'role="search"');

    const plain = await browser.get("/admin/orders");
    assert(!plain.body.includes("rs-search__clear"));
    assertMatch(plain.body, /<input[^>]*name="q"/);
  });
});

Deno.test("order search: the form keeps the status filter when a search is submitted", async () => {
  await withFakeApi(async (api) => {
    listing(api, 1);
    const browser = new Browser(buildApp(), ADMIN);
    const filtered = await browser.get("/admin/orders?status=paid");
    assertMatch(
      filtered.body,
      /<input type="hidden" name="status" value="paid"/,
    );
    const all = await browser.get("/admin/orders");
    assert(!all.body.includes('name="status"'));
  });
});

Deno.test("order search: a term with markup is shown as text and never runs", async () => {
  await withFakeApi(async (api) => {
    listing(api, 0);
    const evil = `"><script>alert(1)</script>`;
    const reply = await new Browser(buildApp(), ADMIN).get(
      `/admin/orders?q=${encodeURIComponent(evil)}`,
    );
    assertEquals(reply.status, 200);
    assert(!reply.body.includes("<script>alert(1)"));
    // O `<` sempre sai como `&lt;`: nenhuma tag nova nasce do termo, no campo nem no texto.
    assertStringIncludes(reply.body, "&lt;script>alert(1)&lt;/script>");
    assert(!reply.body.includes("<script"));
  });
});

Deno.test("order search: no match says so, with a way back that keeps the status filter", async () => {
  await withFakeApi(async (api) => {
    listing(api, 0);
    const browser = new Browser(buildApp(), ADMIN);
    const reply = await browser.get("/admin/orders?status=shipped&q=zzz");
    assertEquals(reply.status, 200);
    assertStringIncludes(reply.body, "No orders match");
    assertStringIncludes(reply.body, "zzz");
    assertStringIncludes(reply.body, "Clear search");
    assertStringIncludes(reply.body, 'href="/admin/orders?status=shipped"');
    assert(!reply.body.includes("Orders will show up here"));
  });
});

Deno.test("order search: with no search and no orders the old empty state stays", async () => {
  await withFakeApi(async (api) => {
    listing(api, 0);
    const reply = await new Browser(buildApp(), ADMIN).get("/admin/orders");
    assertStringIncludes(reply.body, "Orders will show up here");
    assert(!reply.body.includes("No orders match"));
  });
});

Deno.test("order search: status filter links and page links keep the term", async () => {
  await withFakeApi(async (api) => {
    listing(api, 10, 25);
    const reply = await new Browser(buildApp(), ADMIN).get(
      "/admin/orders?q=cust&status=pending",
    );
    assertEquals(reply.status, 200);
    // O filtro "Paid" mantém a busca; a página 2 mantém busca e filtro.
    assertStringIncludes(
      reply.body,
      'href="/admin/orders?status=paid&amp;q=cust"',
    );
    assertStringIncludes(
      reply.body,
      'href="/admin/orders?status=pending&amp;q=cust&amp;page=2"',
    );
    assertStringIncludes(reply.body, "matching");
    assertStringIncludes(reply.body, "of <b>25</b>");
  });
});

Deno.test("order search: asking for a page past the end goes to the last one, keeping the term", async () => {
  await withFakeApi(async (api) => {
    listing(api, 3, 3);
    const reply = await new Browser(buildApp(), ADMIN).get(
      "/admin/orders?q=cust&page=9",
    );
    assertEquals(reply.status, 302);
    assertEquals(reply.location, "/admin/orders?q=cust");
  });
});

Deno.test("order search: page 2 asks the API for the second page of the same search", async () => {
  await withFakeApi(async (api) => {
    listing(api, 10, 25);
    await new Browser(buildApp(), ADMIN).get("/admin/orders?q=cust&page=2");
    assertEquals(asked(api).get("q"), "cust");
    assertEquals(asked(api).get("offset"), "10");
    assertEquals(asked(api).get("limit"), "10");
  });
});

Deno.test("order search: only an admin can search", async () => {
  await withFakeApi(async (api) => {
    listing(api, 1);
    const visitor = await new Browser(buildApp()).get("/admin/orders?q=ana");
    assertEquals(visitor.status, 302);
    assertEquals(visitor.location, "/signin?next=%2Fadmin%2Forders%3Fq%3Dana");
    const customer = await new Browser(buildApp(), {
      rs_session: "session-ana",
      rs_refresh: "refresh-ana",
    }).get("/admin/orders?q=ana");
    assertEquals(customer.status, 403);
    assert(!api.calls.some((c) => c.path === "/admin/orders"));
  });
});

Deno.test("order search: Clear drops the term but keeps the status filter", async () => {
  await withFakeApi(async (api) => {
    listing(api, 1);
    const browser = new Browser(buildApp(), ADMIN);
    const filtered = await browser.get("/admin/orders?status=paid&q=ana");
    assertMatch(
      filtered.body,
      /<a href="\/admin\/orders\?status=paid" class="rs-search__clear"/,
    );
    const all = await browser.get("/admin/orders?q=ana");
    assertMatch(
      all.body,
      /<a href="\/admin\/orders" class="rs-search__clear"/,
    );
  });
});

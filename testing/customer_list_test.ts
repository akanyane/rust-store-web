import {
  assert,
  assertEquals,
  assertMatch,
  assertStringIncludes,
} from "@std/assert";
import { Browser, buildApp } from "./app.ts";
import {
  customer,
  customerItem,
  type FakeApi,
  jsonResponse,
  withFakeApi,
} from "./fake_api.ts";

const ADMIN = { rs_session: "session-boss", rs_refresh: "refresh-boss" };
const CUSTOMER = { rs_session: "session-ana", rs_refresh: "refresh-ana" };
const PAGE = "/admin/customers";

/** O que o web pediu a `GET /admin/customers` na última chamada. */
function asked(api: FakeApi): URLSearchParams {
  const call = api.calls.findLast((c) => c.path === "/admin/customers");
  assert(call, "the page never asked the API for customers");
  return new URLSearchParams(call.search);
}

/** A API responde com `count` clientes e o total dado. */
function listing(api: FakeApi, count: number, total = count) {
  api.on("GET /admin/customers", () =>
    jsonResponse(
      Array.from(
        { length: count },
        (_, i) => customerItem({ id: `cust${i}`, username: `user${i}` }),
      ),
      200,
      { "x-total-count": String(total) },
    ));
}

/** O `aria-current` do link de navegação do console cujo texto é `label`. */
function navCurrent(body: string, label: string): string | undefined {
  const link = body.match(
    new RegExp(
      `<a[^>]*class="rs-adminnav__link"[^>]*>(?:(?!</a>).)*${label}</a>`,
    ),
  );
  return link?.[0].match(/aria-current="([^"]+)"/)?.[1];
}

Deno.test("customer list: a visitor is sent to sign in, a customer gets 403", async () => {
  await withFakeApi(async (api) => {
    const visitor = await new Browser(buildApp()).get(PAGE);
    assertEquals(visitor.status, 302);
    assertEquals(visitor.location, "/signin?next=%2Fadmin%2Fcustomers");
    const other = await new Browser(buildApp(), CUSTOMER).get(PAGE);
    assertEquals(other.status, 403);
    assert(!api.calls.some((c) => c.path === "/admin/customers"));
  });
});

Deno.test("customer list: with the API down it is a 503", async () => {
  await withFakeApi(async (api) => {
    api.goOffline();
    assertEquals((await new Browser(buildApp(), ADMIN).get(PAGE)).status, 503);
  });
});

Deno.test("customer list: each row shows the username, the activity and a way in", async () => {
  await withFakeApi(async (api) => {
    api.customerList = [
      customerItem(),
      customerItem({
        id: "cust2",
        username: "newbie",
        orders: 0,
        spent: 0,
        last_order_at: null,
      }),
    ];
    const reply = await new Browser(buildApp(), ADMIN).get(PAGE);
    assertEquals(reply.status, 200);
    assertStringIncludes(reply.body, 'href="/admin/customers/cust1"');
    assertStringIncludes(reply.body, ">ana<");
    assertStringIncludes(reply.body, "1,240");
    assertStringIncludes(reply.body, "Mar 2, 2026");
    assertStringIncludes(reply.body, "Oct 11, 2026");
    assertStringIncludes(reply.body, 'href="/admin/customers/cust2"');
    assertStringIncludes(reply.body, ">newbie<");
    assertStringIncludes(reply.body, ">—<");
    assertStringIncludes(reply.body, "Newest first");
  });
});

Deno.test("customer list: the search, the sort and the page reach the API", async () => {
  await withFakeApi(async (api) => {
    listing(api, 1);
    const browser = new Browser(buildApp(), ADMIN);
    await browser.get(`${PAGE}?q=%20%20An%20&sort=username&page=3`);
    assertEquals(asked(api).get("q"), "An");
    assertEquals(asked(api).get("sort"), "username");
    assertEquals(asked(api).get("limit"), "10");
    assertEquals(asked(api).get("offset"), "20");
  });
});

Deno.test("customer list: a blank term is no search, an unknown sort is newest, a long term is cut", async () => {
  await withFakeApi(async (api) => {
    listing(api, 1);
    const browser = new Browser(buildApp(), ADMIN);
    for (const q of ["", "%20%20", "+"]) {
      await browser.get(`${PAGE}?q=${q}`);
      assert(!asked(api).has("q"), `q=${q}`);
    }
    await browser.get(`${PAGE}?sort=spent`);
    assertEquals(asked(api).get("sort"), "newest");
    await browser.get(`${PAGE}?q=${"x".repeat(200)}`);
    assertEquals(asked(api).get("q"), "x".repeat(64));
  });
});

Deno.test("customer list: the box shows the term, Clear keeps the sort, and the form keeps it too", async () => {
  await withFakeApi(async (api) => {
    listing(api, 1);
    const browser = new Browser(buildApp(), ADMIN);
    const searched = await browser.get(`${PAGE}?q=ana&sort=username`);
    assertMatch(searched.body, /<input[^>]*name="q"[^>]*value="ana"/);
    assertMatch(
      searched.body,
      /<a href="\/admin\/customers\?sort=username" class="rs-search__clear"/,
    );
    assertMatch(
      searched.body,
      /<input type="hidden" name="sort" value="username"/,
    );

    const plain = await browser.get(PAGE);
    assert(!plain.body.includes("rs-search__clear"));
    assert(!plain.body.includes('name="sort"'));
    assertStringIncludes(plain.body, 'role="search"');
  });
});

Deno.test("customer list: sort links keep the term, page links keep the term and the sort", async () => {
  await withFakeApi(async (api) => {
    listing(api, 10, 25);
    const reply = await new Browser(buildApp(), ADMIN).get(
      `${PAGE}?q=user&sort=username`,
    );
    assertEquals(reply.status, 200);
    assertStringIncludes(reply.body, 'href="/admin/customers?q=user"');
    assertStringIncludes(
      reply.body,
      'href="/admin/customers?q=user&amp;sort=username"',
    );
    assertStringIncludes(
      reply.body,
      'href="/admin/customers?q=user&amp;sort=username&amp;page=2"',
    );
    assertStringIncludes(reply.body, "matching");
    assertStringIncludes(reply.body, "of <b>25</b>");
    assertStringIncludes(reply.body, "By username");
  });
});

Deno.test("customer list: no match says so with a way back, and no customers has its own message", async () => {
  await withFakeApi(async (api) => {
    listing(api, 0);
    const browser = new Browser(buildApp(), ADMIN);
    const none = await browser.get(`${PAGE}?q=zzz&sort=username`);
    assertEquals(none.status, 200);
    assertStringIncludes(none.body, "No customers match");
    assertStringIncludes(none.body, "zzz");
    assertStringIncludes(none.body, "Clear search");
    assertStringIncludes(none.body, 'href="/admin/customers?sort=username"');

    const empty = await browser.get(PAGE);
    assertStringIncludes(empty.body, "No customers yet");
    assert(!empty.body.includes("No customers match"));
  });
});

Deno.test("customer list: a page past the end goes to the last one, keeping the term and the sort", async () => {
  await withFakeApi(async (api) => {
    listing(api, 3, 3);
    const reply = await new Browser(buildApp(), ADMIN).get(
      `${PAGE}?q=user&sort=username&page=9`,
    );
    assertEquals(reply.status, 302);
    assertEquals(reply.location, "/admin/customers?q=user&sort=username");
  });
});

Deno.test("customer list: usernames and the term are escaped", async () => {
  await withFakeApi(async (api) => {
    api.customerList = [customerItem({ username: "<script>x</script>" })];
    const reply = await new Browser(buildApp(), ADMIN).get(
      `${PAGE}?q=${encodeURIComponent('"><script>y</script>')}`,
    );
    assert(!reply.body.includes("<script"));
    assertStringIncludes(reply.body, "&lt;script>x&lt;/script>");
  });
});

Deno.test("customer list: personal data is never shown, even if the API sent it", async () => {
  await withFakeApi(async (api) => {
    api.customerList = [{
      ...customerItem(),
      first_name: "Ana",
      last_name: "Lima",
      birthday: "1990-01-01",
    } as never];
    const reply = await new Browser(buildApp(), ADMIN).get(PAGE);
    for (const secret of ["Lima", "1990", "birthday", "first_name"]) {
      assert(!reply.body.includes(secret), `${secret} rendered`);
    }
  });
});

Deno.test("customer list: the nav marks Customers as current here and on a customer's page", async () => {
  await withFakeApi(async (api) => {
    api.customerList = [customerItem()];
    api.customers.set("cust1", customer());
    const browser = new Browser(buildApp(), ADMIN);
    for (const path of [PAGE, "/admin/customers/cust1"]) {
      const reply = await browser.get(path);
      assertEquals(navCurrent(reply.body, "Customers"), "page", path);
      assertEquals(navCurrent(reply.body, "Dashboard"), "false", path);
      assertEquals(navCurrent(reply.body, "Orders"), "false", path);
    }
  });
});

Deno.test("customer page: the way back goes to the customer list", async () => {
  await withFakeApi(async (api) => {
    api.customers.set("cust1", customer());
    const reply = await new Browser(buildApp(), ADMIN).get(
      "/admin/customers/cust1",
    );
    assertMatch(
      reply.body,
      /<a href="\/admin\/customers" class="rs-back"[^>]*>\s*← Customers\s*<\/a>/,
    );
  });
});

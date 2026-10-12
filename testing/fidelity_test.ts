import {
  assert,
  assertEquals,
  assertMatch,
  assertStringIncludes,
} from "@std/assert";
import { Browser, buildApp } from "./app.ts";
import { order, withFakeApi } from "./fake_api.ts";
import type { ProductDetail } from "../lib/types.ts";

const ADMIN = { rs_session: "session-boss", rs_refresh: "refresh-boss" };
const ANA = { rs_session: "session-ana", rs_refresh: "refresh-ana" };

/** Os `href` do painel do menu do celular, na ordem em que aparecem. */
function menuLinks(body: string): string[] {
  const panel = body.match(
    /<details class="rs-menu">.*?<div class="rs-menu__panel">(.*?)<\/div><\/details>/s,
  );
  assert(panel, "the header has no menu");
  return [...panel[1].matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
}

Deno.test("header menu: a signed-in customer reaches Catalog, Orders, the account and Sign out", async () => {
  await withFakeApi(async () => {
    const reply = await new Browser(buildApp({ chrome: true }), ANA).get(
      "/cart",
    );
    assertEquals(menuLinks(reply.body), ["/", "/orders", "/account"]);
    assertMatch(
      reply.body,
      /<div class="rs-menu__panel">.*<form method="post" action="\/signout"><button type="submit">Sign out<\/button><\/form>/s,
    );
    assertMatch(
      reply.body,
      /<summary class="rs-menu__button" aria-label="Menu">/,
    );
  });
});

Deno.test("header menu: a visitor reaches Catalog, Sign in and Create an account, and there is no Sign out", async () => {
  await withFakeApi(async () => {
    const reply = await new Browser(buildApp({ chrome: true })).get("/signin");
    assertEquals(menuLinks(reply.body), ["/", "/signin", "/signup"]);
    assert(!/<div class="rs-menu__panel">.*Sign out/s.test(reply.body));
  });
});

Deno.test("header menu: the bar keeps the cart, and the items the menu replaces on phones carry the class that hides them", async () => {
  await withFakeApi(async () => {
    const customer = await new Browser(buildApp({ chrome: true }), ANA).get(
      "/cart",
    );
    assertStringIncludes(customer.body, 'class="rs-header__cart"');
    assertStringIncludes(customer.body, 'class="rs-header__orders"');
    assertStringIncludes(customer.body, 'class="rs-header__account"');
    const visitor = await new Browser(buildApp({ chrome: true })).get(
      "/signin",
    );
    assertStringIncludes(
      visitor.body,
      "rs-header__signin rs-header__signin--guest",
    );
  });
});

Deno.test("header menu: the current page is marked", async () => {
  await withFakeApi(async () => {
    const reply = await new Browser(buildApp({ chrome: true }), ANA).get(
      "/account",
    );
    assertMatch(
      reply.body,
      /<div class="rs-menu__panel">.*<a href="\/account" aria-current="page">My account<\/a>/s,
    );
    assertMatch(
      reply.body,
      /<div class="rs-menu__panel"><a href="\/" aria-current="false">Catalog<\/a>/,
    );
  });
});

Deno.test("session expired: the remembered username is shown read-only, with the icon, the copy and one link", async () => {
  await withFakeApi(async () => {
    const reply = await new Browser(buildApp(), { rs_last_user: "ana" }).get(
      "/signin?next=%2Fcart&expired=1",
    );
    assertMatch(
      reply.body,
      /<input id="username"[^>]*value="ana"[^>]*readonly/,
    );
    assertStringIncludes(reply.body, "rs-session__icon");
    assertStringIncludes(
      reply.body,
      "You were signed in for a while and we couldn&#39;t renew it. Sign in to pick up right where you were.",
    );
    assertMatch(
      reply.body,
      /<a href="\/signin\?next=%2Fcart&amp;switch=1" class="rs-session__other"[^>]*>Not you\? Sign in with another account<\/a>/,
    );
    assert(!reply.body.includes("rs-auth__foot"));
  });
});

Deno.test("session expired: without a remembered username the field is editable", async () => {
  await withFakeApi(async () => {
    const reply = await new Browser(buildApp()).get("/signin?expired=1");
    const input = reply.body.match(/<input id="username"[^>]*>/)?.[0] ?? "";
    assert(input, "no username input");
    assert(!/readonly/i.test(input), input);
  });
});

Deno.test("sign in: the plain form never makes the username read-only", async () => {
  await withFakeApi(async () => {
    const reply = await new Browser(buildApp(), { rs_last_user: "ana" }).get(
      "/signin",
    );
    const input = reply.body.match(/<input id="username"[^>]*>/)?.[0] ?? "";
    assert(!/readonly/i.test(input), input);
  });
});

Deno.test("session expired: a wrong password keeps the username read-only", async () => {
  await withFakeApi(async () => {
    const reply = await new Browser(buildApp()).post("/signin", {
      username: "ana",
      password: "nope",
      next: "/",
      expired: "1",
    });
    assertEquals(reply.status, 401);
    assertMatch(
      reply.body,
      /<input id="username"[^>]*value="ana"[^>]*readonly/,
    );
  });
});

Deno.test("account: when deleting is refused the panel is a note, with the button and the link outside it", async () => {
  await withFakeApi(async (api) => {
    api.orderIds = Array.from({ length: 5 }, (_, i) => ({ id: `o${i}` }));
    const reply = await new Browser(buildApp(), ANA).get("/account");
    assertStringIncludes(reply.body, "This account can&#39;t be deleted");
    assertStringIncludes(
      reply.body,
      "You have 5 orders, including cancelled ones.",
    );
    // O botão e o link ficam fora do painel `rs-locked`, como no design.
    assertMatch(
      reply.body,
      /<div class="rs-locked" role="note">(?:(?!<button).)*<\/div><\/div><button type="button" class="rs-btn rs-btn--block" disabled>Delete account<\/button><a href="\/orders" class="rs-locked__link"/s,
    );
  });
});

Deno.test("account: one order is not called 'orders'", async () => {
  await withFakeApi(async (api) => {
    api.orderIds = [{ id: "o1" }];
    const reply = await new Browser(buildApp(), ANA).get("/account");
    assertStringIncludes(
      reply.body,
      "You have 1 order, including cancelled ones.",
    );
  });
});

function product(overrides: Partial<ProductDetail> = {}): ProductDetail {
  return {
    id: "prod1",
    name: "Oolong Tea",
    description: "Roasted, honeyed leaves",
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
      {
        id: "v2",
        product_id: "prod1",
        name: "250 g bag",
        sku: "TEA-250",
        price: 45,
        stock: 2,
        active: true,
      },
      {
        id: "v3",
        product_id: "prod1",
        name: "Sampler",
        sku: "TEA-010",
        price: 3,
        stock: 40,
        active: false,
      },
    ],
    ...overrides,
  };
}

Deno.test("admin product: name, description, the switch and Save sit in one row of the form", async () => {
  await withFakeApi(async (api) => {
    api.adminProducts.set("prod1", product());
    const reply = await new Browser(buildApp(), ADMIN).get(
      "/admin/products/prod1",
    );
    assertEquals(reply.status, 200);
    assertMatch(
      reply.body,
      /<div class="rs-prodform__row">.*name="name".*name="description".*rs-prodform__switch.*name="active".*Save/s,
    );
    // A descrição é uma linha só, como no design (não uma área de texto).
    assert(!/<textarea[^>]*name="description"/.test(reply.body));
  });
});

Deno.test("admin product: the variant being edited opens as a row of the table, right under it", async () => {
  await withFakeApi(async (api) => {
    api.adminProducts.set("prod1", product());
    const reply = await new Browser(buildApp(), ADMIN).get(
      "/admin/products/prod1?edit=v2",
    );
    // Linha de "250 g bag", depois a linha de edição, depois a de "Sampler".
    assertMatch(
      reply.body,
      /250 g bag<\/td>.*?<tr class="rs-table__edit"><td colSpan="6"|250 g bag<\/td>.*?<tr class="rs-table__edit"><td colspan="6"/s,
    );
    const order = [
      reply.body.indexOf("TEA-250"),
      reply.body.indexOf("rs-table__edit"),
      reply.body.indexOf("TEA-010"),
    ];
    assert(order[0] < order[1] && order[1] < order[2], order.join(","));
    assertStringIncludes(reply.body, "rs-variantform--inline");
    assertStringIncludes(reply.body, "Editing &quot;250 g bag&quot;");
    assertEquals(reply.body.match(/rs-table__edit/g)?.length, 1);
  });
});

Deno.test("admin product: without ?edit there is no edit row, and the new-variant form stays below the table", async () => {
  await withFakeApi(async (api) => {
    api.adminProducts.set("prod1", product());
    const browser = new Browser(buildApp(), ADMIN);
    const plain = await browser.get("/admin/products/prod1");
    assert(!plain.body.includes("rs-table__edit"));
    const adding = await browser.get("/admin/products/prod1?add=1");
    assertStringIncludes(adding.body, "New variant");
    assert(!adding.body.includes("rs-table__edit"));
    assertMatch(adding.body, /<\/table>.*New variant/s);
  });
});

Deno.test("admin product: says how many variants are inactive and that nothing is deleted", async () => {
  await withFakeApi(async (api) => {
    api.adminProducts.set("prod1", product());
    const reply = await new Browser(buildApp(), ADMIN).get(
      "/admin/products/prod1",
    );
    assertStringIncludes(reply.body, "3, including 1 inactive");
    assertStringIncludes(
      reply.body,
      "Inactive variants stay listed here (dimmed) and are hidden from the catalog and carts. Nothing is ever deleted.",
    );
  });
});

Deno.test("admin order: an unpaid order shows a dash for Paid, like the list", async () => {
  await withFakeApi(async (api) => {
    api.orders.set("ord1abcdefgh", order({ status: "pending", paid_at: null }));
    const reply = await new Browser(buildApp(), ADMIN).get(
      "/admin/orders/ord1abcdefgh",
    );
    assertMatch(reply.body, /<dt>Paid<\/dt><dd>—<\/dd>/);
    assert(!reply.body.includes("Not yet"));
  });
});

Deno.test("sign in: after a wrong password on the plain form the username stays editable", async () => {
  await withFakeApi(async () => {
    const reply = await new Browser(buildApp()).post("/signin", {
      username: "ana",
      password: "nope",
      next: "/",
    });
    assertEquals(reply.status, 401);
    const input = reply.body.match(/<input id="username"[^>]*>/)?.[0] ?? "";
    assertStringIncludes(input, 'value="ana"');
    assert(!/readonly/i.test(input), input);
  });
});

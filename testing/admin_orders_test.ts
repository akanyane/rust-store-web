import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { Browser, buildApp } from "./app.ts";
import { apiError, order, withFakeApi } from "./fake_api.ts";

const ADMIN = { rs_session: "session-boss", rs_refresh: "refresh-boss" };
const CUSTOMER = { rs_session: "session-ana", rs_refresh: "refresh-ana" };
const ORDER = "/admin/orders/ord1abcdefgh";

Deno.test("admin order: a valid next step reaches the API", async () => {
  await withFakeApi(async (api) => {
    api.orders.set("ord1abcdefgh", order({ status: "pending" }));
    const reply = await new Browser(buildApp(), ADMIN).post(ORDER, {
      status: "paid",
    });
    assertEquals(reply.status, 303);
    assertEquals(reply.location, ORDER);
    assertEquals(api.orders.get("ord1abcdefgh")?.status, "paid");
    assert(api.made.includes("PUT /admin/orders/ord1abcdefgh/status"));
  });
});

Deno.test("admin order: a forged status that skips the cycle never reaches the API", async () => {
  await withFakeApi(async (api) => {
    api.orders.set("ord1abcdefgh", order({ status: "pending" }));
    const browser = new Browser(buildApp(), ADMIN);
    for (const status of ["delivered", "shipped", "pending", "bogus", ""]) {
      const reply = await browser.post(ORDER, { status });
      assertEquals(reply.status, 303, status);
    }
    assertEquals(api.orders.get("ord1abcdefgh")?.status, "pending");
    assert(!api.made.some((call) => call.startsWith("PUT ")));
  });
});

Deno.test("admin order: a final order cannot be changed, even by a forged request", async () => {
  await withFakeApi(async (api) => {
    for (const status of ["delivered", "cancelled"] as const) {
      api.orders.set("ord1abcdefgh", order({ status }));
      for (const to of ["paid", "cancelled", "pending", "shipped"]) {
        await new Browser(buildApp(), ADMIN).post(ORDER, { status: to });
      }
      assertEquals(api.orders.get("ord1abcdefgh")?.status, status);
    }
    assert(!api.made.some((call) => call.startsWith("PUT ")));
  });
});

Deno.test("admin order: the page offers only the next steps, and says when it is final", async () => {
  await withFakeApi(async (api) => {
    const browser = new Browser(buildApp(), ADMIN);
    api.orders.set("ord1abcdefgh", order({ status: "pending" }));
    let page = await browser.get(ORDER);
    assertStringIncludes(page.body, "Mark as paid");
    assertStringIncludes(page.body, "Cancel order");
    assert(!page.body.includes("Mark as shipped"));

    api.orders.set("ord1abcdefgh", order({ status: "paid" }));
    page = await browser.get(ORDER);
    assertStringIncludes(page.body, "Mark as shipped");
    assert(!page.body.includes("Cancel order"));

    api.orders.set("ord1abcdefgh", order({ status: "delivered" }));
    page = await browser.get(ORDER);
    assertStringIncludes(page.body, "Final status. No further changes.");
    assert(!page.body.includes("Mark as"));
  });
});

Deno.test("admin order: a conflict from the API is shown on the order, not as an error page", async () => {
  await withFakeApi(async (api) => {
    api.orders.set("ord1abcdefgh", order({ status: "pending" }));
    api.on(
      "PUT /admin/orders/:id/status",
      () => apiError(409, "order was cancelled meanwhile"),
    );
    const browser = new Browser(buildApp(), ADMIN);
    const reply = await browser.post(ORDER, { status: "paid" });
    assertEquals(reply.status, 303);
    const page = await browser.get(ORDER);
    assertEquals(page.status, 200);
    assertStringIncludes(page.body, "Not changed (409)");
    assertStringIncludes(page.body, "order was cancelled meanwhile");
  });
});

Deno.test("admin order: a missing order is a 404", async () => {
  await withFakeApi(async () => {
    const browser = new Browser(buildApp(), ADMIN);
    assertEquals((await browser.get("/admin/orders/nope")).status, 404);
    assertEquals(
      (await browser.post("/admin/orders/nope", { status: "paid" })).status,
      404,
    );
  });
});

Deno.test("admin order: a customer forging the POST gets 403 and changes nothing", async () => {
  await withFakeApi(async (api) => {
    api.orders.set("ord1abcdefgh", order({ status: "pending" }));
    const reply = await new Browser(buildApp(), CUSTOMER).post(ORDER, {
      status: "paid",
    });
    assertEquals(reply.status, 403);
    assertEquals(api.orders.get("ord1abcdefgh")?.status, "pending");
  });
});

Deno.test("admin order: a visitor forging the POST is sent to sign in", async () => {
  await withFakeApi(async (api) => {
    api.orders.set("ord1abcdefgh", order({ status: "pending" }));
    const reply = await new Browser(buildApp()).post(ORDER, { status: "paid" });
    assertEquals(reply.status, 303);
    assertEquals(reply.location, `/signin?next=${encodeURIComponent(ORDER)}`);
    assertEquals(api.orders.get("ord1abcdefgh")?.status, "pending");
  });
});

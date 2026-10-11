import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { Browser, buildApp } from "./app.ts";
import { withFakeApi } from "./fake_api.ts";

const ADMIN = { rs_session: "session-boss", rs_refresh: "refresh-boss" };
const CUSTOMER = { rs_session: "session-ana", rs_refresh: "refresh-ana" };

Deno.test("admin guard: a visitor is sent to sign in, with the page to come back to", async () => {
  await withFakeApi(async () => {
    const reply = await new Browser(buildApp()).get("/admin/orders");
    assertEquals(reply.status, 302);
    assertEquals(reply.location, "/signin?next=%2Fadmin%2Forders");
  });
});

Deno.test("admin guard: a customer gets 403 and the page never asks for admin data", async () => {
  await withFakeApi(async (api) => {
    const reply = await new Browser(buildApp(), CUSTOMER).get("/admin/orders");
    assertEquals(reply.status, 403);
    assert(!api.made.includes("GET /admin/orders"));
  });
});

Deno.test("admin guard: an admin sees the console", async () => {
  await withFakeApi(async () => {
    const reply = await new Browser(buildApp(), ADMIN).get("/admin/orders");
    assertEquals(reply.status, 200);
    assertStringIncludes(reply.body, "Orders");
  });
});

Deno.test("admin guard: with the API down it is a 503, not a redirect to sign in", async () => {
  await withFakeApi(async (api) => {
    api.goOffline();
    const reply = await new Browser(buildApp(), ADMIN).get("/admin/orders");
    assertEquals(reply.status, 503);
  });
});

Deno.test("admin guard: an expired session that cannot be renewed asks to sign in again", async () => {
  await withFakeApi(async () => {
    const browser = new Browser(buildApp(), { rs_refresh: "refresh-revoked" });
    const reply = await browser.get("/admin/orders");
    assertEquals(reply.status, 302);
    assertEquals(
      reply.location,
      "/signin?next=%2Fadmin%2Forders&expired=1",
    );
    // A sessão perdida apaga o que sobrou dos cookies.
    assertEquals(browser.cookie("rs_refresh"), undefined);
  });
});

Deno.test("admin guard: a lost session token is renewed silently from the refresh token", async () => {
  await withFakeApi(async (api) => {
    const browser = new Browser(buildApp(), { rs_refresh: "refresh-boss" });
    const reply = await browser.get("/admin/orders");
    assertEquals(reply.status, 200);
    assert(api.made.includes("POST /auth/refresh"));
    assertEquals(browser.cookie("rs_session"), "session-boss");
  });
});

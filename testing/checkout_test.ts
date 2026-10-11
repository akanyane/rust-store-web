import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { Browser, buildApp } from "./app.ts";
import { apiError, jsonResponse, order, withFakeApi } from "./fake_api.ts";

const ANA = { rs_session: "session-ana", rs_refresh: "refresh-ana" };

Deno.test("checkout: a placed order opens its page", async () => {
  await withFakeApi(async (api) => {
    api.on("POST /orders", () => jsonResponse(order({ id: "ordNEW123" }), 201));
    const reply = await new Browser(buildApp(), ANA).post("/orders", {});
    assertEquals(reply.status, 303);
    assertEquals(reply.location, "/orders/ordNEW123");
    assert(api.made.includes("POST /orders"));
  });
});

Deno.test("checkout: a refusal from the API is shown in the cart, with the API's words", async () => {
  await withFakeApi(async (api) => {
    api.on("POST /orders", () => apiError(409, "not enough stock for MUG-1"));
    const browser = new Browser(buildApp(), ANA);
    const reply = await browser.post("/orders", {});
    assertEquals(reply.status, 303);
    assertEquals(reply.location, "/cart");
    const cart = await browser.get("/cart");
    assertEquals(cart.status, 200);
    assertStringIncludes(
      cart.body,
      "Order not placed: not enough stock for MUG-1",
    );
  });
});

Deno.test("checkout: the refusal message is shown once", async () => {
  await withFakeApi(async (api) => {
    api.on("POST /orders", () => apiError(409, "cart is empty"));
    const browser = new Browser(buildApp(), ANA);
    await browser.post("/orders", {});
    assertStringIncludes((await browser.get("/cart")).body, "cart is empty");
    assert(!(await browser.get("/cart")).body.includes("Order not placed"));
  });
});

Deno.test("checkout: a visitor is sent to sign in and nothing is created", async () => {
  await withFakeApi(async (api) => {
    const reply = await new Browser(buildApp()).post("/orders", {});
    assertEquals(reply.status, 303);
    assertEquals(reply.location, "/signin?next=%2Fcart");
    assert(!api.made.includes("POST /orders"));
  });
});

Deno.test("checkout: with the API down it is a 503", async () => {
  await withFakeApi(async (api) => {
    api.goOffline();
    const reply = await new Browser(buildApp(), ANA).post("/orders", {});
    assertEquals(reply.status, 503);
  });
});

Deno.test("cart: a signed-in customer sees the cart; a visitor is sent to sign in", async () => {
  await withFakeApi(async () => {
    const mine = await new Browser(buildApp(), ANA).get("/cart");
    assertEquals(mine.status, 200);
    assertStringIncludes(mine.body, "Your cart");
    const visitor = await new Browser(buildApp()).get("/cart");
    assertEquals(visitor.status, 302);
    assertEquals(visitor.location, "/signin?next=%2Fcart");
  });
});

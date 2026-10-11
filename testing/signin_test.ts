import {
  assert,
  assertEquals,
  assertNotMatch,
  assertStringIncludes,
} from "@std/assert";
import { Browser, buildApp } from "./app.ts";
import { withFakeApi } from "./fake_api.ts";

/** O `<input>` do username, para olhar o valor preenchido. */
function usernameInput(body: string): string {
  const tag = body.match(/<input id="username"[^>]*>/);
  assert(tag, "username input not found");
  return tag[0];
}

function form(username: string, password: string, extra = {}) {
  return { username, password, next: "/", ...extra };
}

Deno.test("sign in: a customer is signed in and the last username is remembered", async () => {
  await withFakeApi(async () => {
    const browser = new Browser(buildApp());
    const reply = await browser.post("/signin", form("ana", "ana-pass"));
    assertEquals(reply.status, 303);
    assertEquals(reply.location, "/");
    assertEquals(browser.cookie("rs_session"), "session-ana");
    assertEquals(browser.cookie("rs_refresh"), "refresh-ana");
    assertEquals(browser.cookie("rs_last_user"), "ana");
  });
});

Deno.test("sign in: an admin with no destination lands in the console", async () => {
  await withFakeApi(async () => {
    const reply = await new Browser(buildApp()).post(
      "/signin",
      form("boss", "boss-pass"),
    );
    assertEquals(reply.status, 303);
    assertEquals(reply.location, "/admin/orders");
  });
});

Deno.test("sign in: an admin with a destination of their own goes there", async () => {
  await withFakeApi(async () => {
    const reply = await new Browser(buildApp()).post(
      "/signin",
      form("boss", "boss-pass", { next: "/admin/products" }),
    );
    assertEquals(reply.location, "/admin/products");
  });
});

Deno.test("sign in: a wrong password is a 401 with the same message, and no cookies", async () => {
  await withFakeApi(async () => {
    const browser = new Browser(buildApp());
    const reply = await browser.post("/signin", form("ana", "nope"));
    assertEquals(reply.status, 401);
    assertStringIncludes(reply.body, "Username or password is incorrect");
    assertEquals(browser.cookie("rs_session"), undefined);
    assertEquals(browser.cookie("rs_last_user"), undefined);
  });
});

Deno.test("sign in: with the API down it says so, with a 503", async () => {
  await withFakeApi(async (api) => {
    api.goOffline();
    const reply = await new Browser(buildApp()).post(
      "/signin",
      form("ana", "ana-pass"),
    );
    assertEquals(reply.status, 503);
    assertStringIncludes(reply.body, "couldn't reach the store");
  });
});

Deno.test("sign in: next never leaves the site", async () => {
  await withFakeApi(async () => {
    for (const next of ["//evil.com", "https://evil.com", "/\\evil.com"]) {
      const reply = await new Browser(buildApp()).post(
        "/signin",
        form("ana", "ana-pass", { next }),
      );
      assertEquals(reply.location, "/", next);
    }
    const ok = await new Browser(buildApp()).post(
      "/signin",
      form("ana", "ana-pass", { next: "/cart" }),
    );
    assertEquals(ok.location, "/cart");
  });
});

Deno.test("sign in: someone already signed in is sent on, not shown the form", async () => {
  await withFakeApi(async () => {
    const browser = new Browser(buildApp(), { rs_session: "session-ana" });
    const reply = await browser.get("/signin?next=%2Fcart");
    assertEquals(reply.status, 302);
    assertEquals(reply.location, "/cart");
  });
});

Deno.test("session expired: a dialog with the remembered username filled in", async () => {
  await withFakeApi(async () => {
    const browser = new Browser(buildApp(), { rs_last_user: "ana" });
    const reply = await browser.get("/signin?next=%2Fcart&expired=1");
    assertEquals(reply.status, 200);
    assertStringIncludes(reply.body, 'role="dialog"');
    assertStringIncludes(reply.body, "Your session expired, sign in again");
    assertStringIncludes(usernameInput(reply.body), 'value="ana"');
    assertStringIncludes(reply.body, "Sign in again");
    assertStringIncludes(reply.body, "Not you?");
  });
});

Deno.test("session expired: a remembered value that is not a username is ignored", async () => {
  await withFakeApi(async () => {
    const browser = new Browser(buildApp(), { rs_last_user: "<b>x</b>" });
    const reply = await browser.get("/signin?expired=1");
    assertStringIncludes(reply.body, 'role="dialog"');
    assertNotMatch(reply.body, /<b>x/);
    assert(!usernameInput(reply.body).includes('value="'));
  });
});

Deno.test("session expired: a wrong password keeps the dialog and its message", async () => {
  await withFakeApi(async () => {
    const reply = await new Browser(buildApp()).post(
      "/signin",
      form("ana", "nope", { expired: "1" }),
    );
    assertEquals(reply.status, 401);
    assertStringIncludes(reply.body, 'role="dialog"');
    assertStringIncludes(reply.body, "Username or password is incorrect");
  });
});

Deno.test("session expired: without the flag the plain form is shown", async () => {
  await withFakeApi(async () => {
    const browser = new Browser(buildApp(), { rs_last_user: "ana" });
    const reply = await browser.get("/signin");
    assertNotMatch(reply.body, /role="dialog"/);
    assertStringIncludes(reply.body, "Create an account");
    assert(!usernameInput(reply.body).includes('value="'));
  });
});

Deno.test('"Not you?" shows the plain form and forgets the username', async () => {
  await withFakeApi(async () => {
    const browser = new Browser(buildApp(), { rs_last_user: "ana" });
    const reply = await browser.get("/signin?next=%2Fcart&switch=1");
    assertEquals(reply.status, 200);
    assertNotMatch(reply.body, /role="dialog"/);
    assertEquals(browser.cookie("rs_last_user"), undefined);
  });
});

Deno.test("sign out: clears the session and the remembered username, and tells the API", async () => {
  await withFakeApi(async (api) => {
    const browser = new Browser(buildApp(), {
      rs_session: "session-ana",
      rs_refresh: "refresh-ana",
      rs_last_user: "ana",
    });
    const reply = await browser.post("/signout", {});
    assertEquals(reply.status, 303);
    assertEquals(browser.cookie("rs_session"), undefined);
    assertEquals(browser.cookie("rs_refresh"), undefined);
    assertEquals(browser.cookie("rs_last_user"), undefined);
    assert(api.made.includes("POST /auth/sign-out"));
  });
});

Deno.test("sign out: only POST signs out", async () => {
  await withFakeApi(async (api) => {
    const browser = new Browser(buildApp(), { rs_refresh: "refresh-ana" });
    const reply = await browser.get("/signout");
    assertEquals(reply.status, 302);
    assertEquals(browser.cookie("rs_refresh"), "refresh-ana");
    assert(!api.made.includes("POST /auth/sign-out"));
  });
});

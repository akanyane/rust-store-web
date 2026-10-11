import { assert, assertEquals, assertRejects } from "@std/assert";
import { ApiError, ApiUnavailableError } from "./api.ts";
import {
  NotSignedInError,
  renewTokens,
  resetRenewals,
  SessionExpiredError,
  SessionManager,
} from "./session.ts";
import type { Tokens } from "./types.ts";

const fresh: Tokens = {
  session_token: "new-session",
  refresh_token: "new-refresh",
};

/** Uma renovação falsa que conta quantas vezes foi chamada. */
function fakeRenew(result: Tokens | Error = fresh, delay = 0) {
  const calls: string[] = [];
  const fn = async (refreshToken: string) => {
    calls.push(refreshToken);
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    if (result instanceof Error) throw result;
    return result;
  };
  return { fn, calls };
}

Deno.test("SessionManager: no cookies means not signed in", async () => {
  resetRenewals();
  const renew = fakeRenew();
  const session = new SessionManager({}, renew.fn);
  assertEquals(session.hasCredentials, false);
  await assertRejects(
    () => session.call(() => Promise.resolve(1)),
    NotSignedInError,
  );
  assertEquals(renew.calls, []);
});

Deno.test("SessionManager: a valid session token never touches the refresh", async () => {
  resetRenewals();
  const renew = fakeRenew();
  const session = new SessionManager({ session: "s", refresh: "r" }, renew.fn);
  assertEquals(
    await session.call((token) => Promise.resolve(`ok:${token}`)),
    "ok:s",
  );
  assertEquals(renew.calls, []);
  assertEquals(session.changed, false);
});

Deno.test("SessionManager: only a refresh cookie renews first, then runs", async () => {
  resetRenewals();
  const renew = fakeRenew();
  const session = new SessionManager({ refresh: "old-refresh" }, renew.fn);
  const used: string[] = [];
  await session.call((token) => {
    used.push(token);
    return Promise.resolve();
  });
  assertEquals(renew.calls, ["old-refresh"]);
  assertEquals(used, ["new-session"]);
  assertEquals(session.changed, true);
  assertEquals(session.refresh, "new-refresh");
});

Deno.test("SessionManager: a 401 renews once and retries with the new token", async () => {
  resetRenewals();
  const renew = fakeRenew();
  const session = new SessionManager(
    { session: "stale", refresh: "r" },
    renew.fn,
  );
  const tokens: string[] = [];
  const result = await session.call((token) => {
    tokens.push(token);
    if (token === "stale") {
      return Promise.reject(new ApiError(401, "Invalid credentials"));
    }
    return Promise.resolve("done");
  });
  assertEquals(result, "done");
  assertEquals(tokens, ["stale", "new-session"]);
  assertEquals(renew.calls, ["r"]);
  assertEquals(session.changed, true);
});

Deno.test("SessionManager: other API errors pass through without renewing", async () => {
  resetRenewals();
  const renew = fakeRenew();
  const session = new SessionManager({ session: "s", refresh: "r" }, renew.fn);
  await assertRejects(
    () =>
      session.call(() =>
        Promise.reject(new ApiError(409, "Insufficient stock"))
      ),
    ApiError,
    "Insufficient stock",
  );
  assertEquals(renew.calls, []);
});

Deno.test("SessionManager: a refresh the API refuses expires the session and clears cookies", async () => {
  resetRenewals();
  const renew = fakeRenew(new ApiError(401, "Invalid credentials"));
  const session = new SessionManager(
    { session: "stale", refresh: "dead" },
    renew.fn,
  );
  await assertRejects(
    () =>
      session.call(() =>
        Promise.reject(new ApiError(401, "Invalid credentials"))
      ),
    SessionExpiredError,
  );
  assertEquals(session.expired, true);
  assertEquals(session.cleared, true);
  assertEquals(session.hasCredentials, false);
});

Deno.test("SessionManager: a missing refresh after a 401 expires too", async () => {
  resetRenewals();
  const session = new SessionManager({ session: "stale" }, fakeRenew().fn);
  await assertRejects(
    () =>
      session.call(() =>
        Promise.reject(new ApiError(401, "Invalid credentials"))
      ),
    SessionExpiredError,
  );
  assertEquals(session.cleared, true);
});

Deno.test("SessionManager: a 401 even after renewing expires instead of looping", async () => {
  resetRenewals();
  const renew = fakeRenew();
  const session = new SessionManager(
    { session: "stale", refresh: "r" },
    renew.fn,
  );
  await assertRejects(
    () =>
      session.call(() =>
        Promise.reject(new ApiError(401, "Invalid credentials"))
      ),
    SessionExpiredError,
  );
  assertEquals(renew.calls.length, 1);
});

Deno.test("SessionManager: a network failure during renewal does not log the user out", async () => {
  resetRenewals();
  const renew = fakeRenew(new ApiUnavailableError("down"));
  const session = new SessionManager({ refresh: "r" }, renew.fn);
  await assertRejects(
    () => session.call(() => Promise.resolve(1)),
    ApiUnavailableError,
  );
  assertEquals(session.expired, false);
  assertEquals(session.cleared, false);
  assertEquals(session.refresh, "r");
});

Deno.test("SessionManager: setTokens and clear update the flags", () => {
  resetRenewals();
  const session = new SessionManager({});
  session.setTokens(fresh);
  assertEquals([session.session, session.refresh, session.changed], [
    "new-session",
    "new-refresh",
    true,
  ]);
  session.clear();
  assertEquals([session.session, session.changed, session.cleared], [
    undefined,
    false,
    true,
  ]);
});

Deno.test("renewTokens: concurrent renewals with the same refresh token share ONE API call", async () => {
  resetRenewals();
  const renew = fakeRenew(fresh, 20);
  const results = await Promise.all(
    Array.from({ length: 8 }, () => renewTokens("shared", renew.fn)),
  );
  assertEquals(renew.calls, ["shared"]);
  for (const tokens of results) assertEquals(tokens, fresh);
});

Deno.test("renewTokens: a request arriving right after (still holding the old cookie) reuses the result", async () => {
  resetRenewals();
  const renew = fakeRenew();
  await renewTokens("old", renew.fn, () => 1_000);
  const again = await renewTokens("old", renew.fn, () => 1_000 + 29_000);
  assertEquals(again, fresh);
  assertEquals(renew.calls, ["old"]);
});

Deno.test("renewTokens: after the grace period the old refresh is no longer reused", async () => {
  resetRenewals();
  const renew = fakeRenew();
  await renewTokens("old", renew.fn, () => 1_000);
  await renewTokens("old", renew.fn, () => 1_000 + 31_000);
  assertEquals(renew.calls, ["old", "old"]);
});

Deno.test("renewTokens: a failure is not cached, so the next try can succeed", async () => {
  resetRenewals();
  const failing = fakeRenew(new ApiUnavailableError("down"));
  await assertRejects(() => renewTokens("r", failing.fn), ApiUnavailableError);
  const working = fakeRenew();
  assertEquals(await renewTokens("r", working.fn), fresh);
  assert(working.calls.length === 1);
});

Deno.test("SessionManager: parallel requests holding only the refresh cookie all succeed", async () => {
  resetRenewals();
  const renew = fakeRenew(fresh, 15);
  const sessions = Array.from(
    { length: 6 },
    () => new SessionManager({ refresh: "r" }, (r) => renewTokens(r, renew.fn)),
  );
  const results = await Promise.all(
    sessions.map((s) => s.call((token) => Promise.resolve(token))),
  );
  assertEquals(results, Array(6).fill("new-session"));
  assertEquals(renew.calls.length, 1);
  for (const session of sessions) assertEquals(session.expired, false);
});

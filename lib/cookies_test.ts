import { assertEquals } from "@std/assert";
import {
  clearLastUserCookie,
  isUsernameShape,
  readLastUser,
  writeLastUserCookie,
} from "./cookies.ts";

function withCookie(value: string): Headers {
  return new Headers({ cookie: `rs_last_user=${value}` });
}

Deno.test("readLastUser: only values shaped like a username", () => {
  assertEquals(readLastUser(withCookie("ana")), "ana");
  assertEquals(readLastUser(withCookie("a.b-c_9")), "a.b-c_9");
  assertEquals(readLastUser(new Headers()), undefined);
  for (const bad of ["ab", "UPPER", "a b", "x".repeat(33), "a;b", "<b>"]) {
    assertEquals(readLastUser(withCookie(bad)), undefined, bad);
  }
});

Deno.test("isUsernameShape: 3 to 32 of a-z 0-9 . _ -", () => {
  assertEquals(isUsernameShape("abc"), true);
  assertEquals(isUsernameShape("x".repeat(32)), true);
  assertEquals(isUsernameShape("x".repeat(33)), false);
  assertEquals(isUsernameShape("ab"), false);
});

Deno.test("writeLastUserCookie: httpOnly, Lax, 15 days, Secure only on HTTPS", () => {
  const plain = new Headers();
  writeLastUserCookie(plain, "ana", false);
  const text = plain.get("set-cookie")!;
  assertEquals(text.startsWith("rs_last_user=ana"), true);
  assertEquals(text.includes("HttpOnly"), true);
  assertEquals(text.includes("SameSite=Lax"), true);
  assertEquals(text.includes("Max-Age=1296000"), true);
  assertEquals(text.includes("Secure"), false);

  const secure = new Headers();
  writeLastUserCookie(secure, "ana", true);
  assertEquals(secure.get("set-cookie")!.includes("Secure"), true);
});

Deno.test("clearLastUserCookie: expires the cookie", () => {
  const headers = new Headers();
  clearLastUserCookie(headers);
  const text = headers.get("set-cookie")!;
  assertEquals(text.startsWith("rs_last_user="), true);
  assertEquals(/Max-Age=0|Expires=Thu, 01 Jan 1970/.test(text), true);
});

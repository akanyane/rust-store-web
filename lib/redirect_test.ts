import { assertEquals } from "@std/assert";
import { safeNext, signInHref } from "./redirect.ts";

Deno.test("safeNext: only same-site relative paths", () => {
  for (const ok of ["/", "/cart", "/products/abc?x=1", "/account#top"]) {
    assertEquals(safeNext(ok), ok);
  }
});

Deno.test("safeNext: everything that could leave the site falls back", () => {
  const bad = [
    "//evil.com",
    "//evil.com/x",
    "/\\evil.com",
    "https://evil.com",
    "http://evil.com",
    "javascript:alert(1)",
    "evil.com",
    "",
    "/ok\r\nSet-Cookie: x=1",
    "/a\\b",
    "/\u0000",
  ];
  for (const value of bad) assertEquals(safeNext(value), "/", value);
  assertEquals(safeNext(null), "/");
  assertEquals(safeNext(undefined, "/cart"), "/cart");
});

Deno.test("signInHref: encodes next and flags expired sessions", () => {
  assertEquals(signInHref("/cart"), "/signin?next=%2Fcart");
  assertEquals(
    signInHref("/products/a b", true),
    "/signin?next=%2Fproducts%2Fa+b&expired=1",
  );
  assertEquals(signInHref("//evil.com"), "/signin?next=%2F");
});

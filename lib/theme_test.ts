import { assertEquals } from "@std/assert";
import { themeFromCookie } from "./theme.ts";

Deno.test("themeFromCookie: only light and dark are accepted", () => {
  assertEquals(themeFromCookie("theme=dark"), "dark");
  assertEquals(themeFromCookie("a=1; theme=light; b=2"), "light");
  assertEquals(themeFromCookie("theme=purple"), undefined);
  assertEquals(themeFromCookie("themes=dark"), undefined);
  assertEquals(themeFromCookie(""), undefined);
  assertEquals(themeFromCookie(null), undefined);
});

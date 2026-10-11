import { assertEquals } from "@std/assert";
import { type Flash, parseFlash, serializeFlash } from "./flash.ts";

Deno.test("flash: round trip, including characters that need encoding", () => {
  const flash: Flash = {
    scope: "add:v1",
    tone: "success",
    message: "Added; 2 × tin = ok",
    quantity: 2,
  };
  assertEquals(parseFlash(serializeFlash(flash)), flash);
});

Deno.test("flash: anything malformed is discarded", () => {
  for (
    const bad of [
      undefined,
      "",
      "%",
      "not json",
      encodeURIComponent("{}"),
      encodeURIComponent('{"scope":1}'),
    ]
  ) {
    assertEquals(parseFlash(bad), undefined, String(bad));
  }
  assertEquals(
    parseFlash(
      encodeURIComponent('{"scope":"cart","tone":"loud","message":"x"}'),
    ),
    undefined,
  );
  assertEquals(
    parseFlash(
      encodeURIComponent(
        '{"scope":"cart","tone":"error","message":"x","quantity":1.5}',
      ),
    ),
    undefined,
  );
});

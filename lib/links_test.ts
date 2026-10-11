import { assertEquals } from "@std/assert";
import { catalogHref, parseSort } from "./links.ts";

Deno.test("parseSort: only 'newest' is special, anything else is 'name'", () => {
  assertEquals(parseSort("newest"), "newest");
  for (const other of ["name", "NEWEST", "oldest", "", null]) {
    assertEquals(parseSort(other), "name");
  }
});

Deno.test("catalogHref: defaults are left out of the URL", () => {
  assertEquals(catalogHref(), "/");
  assertEquals(catalogHref({ sort: "name", page: 1 }), "/");
  assertEquals(catalogHref({ sort: "newest" }), "/?sort=newest");
  assertEquals(catalogHref({ page: 3 }), "/?page=3");
  assertEquals(
    catalogHref({ sort: "newest", page: 2 }),
    "/?sort=newest&page=2",
  );
});

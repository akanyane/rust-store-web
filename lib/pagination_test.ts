import { assertEquals } from "@std/assert";
import { pageInfo, pageItems, parsePage, PER_PAGE } from "./pagination.ts";

Deno.test("parsePage: positive integers only", () => {
  assertEquals(parsePage("3"), 3);
  assertEquals(parsePage(null), 1);
  for (const bad of ["", "0", "-2", "abc", "1.5", "NaN"]) {
    assertEquals(parsePage(bad), 1);
  }
});

Deno.test("pageInfo: 57 items, 12 per page", () => {
  assertEquals(PER_PAGE, 12);
  assertEquals(pageInfo(57, 1), {
    page: 1,
    pages: 5,
    total: 57,
    from: 1,
    to: 12,
    hasPrev: false,
    hasNext: true,
  });
  assertEquals(pageInfo(57, 5), {
    page: 5,
    pages: 5,
    total: 57,
    from: 49,
    to: 57,
    hasPrev: true,
    hasNext: false,
  });
});

Deno.test("pageInfo: empty catalog and a single partial page", () => {
  assertEquals(pageInfo(0, 1), {
    page: 1,
    pages: 1,
    total: 0,
    from: 0,
    to: 0,
    hasPrev: false,
    hasNext: false,
  });
  assertEquals(pageInfo(5, 1).to, 5);
  assertEquals(pageInfo(12, 1).pages, 1);
  assertEquals(pageInfo(13, 1).pages, 2);
});

Deno.test("pageInfo: out-of-range pages are clamped", () => {
  assertEquals(pageInfo(57, 99).page, 5);
  assertEquals(pageInfo(57, 0).page, 1);
  assertEquals(pageInfo(0, 7).page, 1);
});

Deno.test("pageItems: first, last and a window of three, with gaps", () => {
  assertEquals(pageItems(1, 1), [1]);
  assertEquals(pageItems(1, 2), [1, 2]);
  assertEquals(pageItems(1, 5), [1, 2, 3, "gap", 5]);
  assertEquals(pageItems(2, 5), [1, 2, 3, "gap", 5]);
  assertEquals(pageItems(3, 5), [1, 2, 3, 4, 5]);
  assertEquals(pageItems(5, 5), [1, "gap", 3, 4, 5]);
  assertEquals(pageItems(10, 20), [1, "gap", 9, 10, 11, "gap", 20]);
  assertEquals(pageItems(1, 20), [1, 2, 3, "gap", 20]);
  assertEquals(pageItems(20, 20), [1, "gap", 18, 19, 20]);
});

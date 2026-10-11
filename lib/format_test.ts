import { assertEquals } from "@std/assert";
import {
  formatNumber,
  formatUnits,
  initials,
  placeholderIndex,
  priceLabel,
  stockStatus,
  unitLabel,
  variantsSummary,
} from "./format.ts";

Deno.test("unitLabel: singular only for exactly 1", () => {
  assertEquals(unitLabel(1), "unidade");
  assertEquals(unitLabel(0), "unidades");
  assertEquals(unitLabel(2), "unidades");
  assertEquals(unitLabel(25), "unidades");
});

Deno.test("formatUnits: thousands separator, no decimals, never a currency symbol", () => {
  assertEquals(formatUnits(1), "1 unidade");
  assertEquals(formatUnits(25), "25 unidades");
  assertEquals(formatUnits(1240), "1,240 unidades");
  assertEquals(formatUnits(0), "0 unidades");
  assertEquals(formatNumber(1234567), "1,234,567");
});

Deno.test("priceLabel: 'from' only when the variants differ", () => {
  assertEquals(priceLabel({ price_from: null, price_to: null }), {
    kind: "none",
  });
  assertEquals(priceLabel({ price_from: 25, price_to: 25 }), {
    kind: "single",
    price: 25,
  });
  assertEquals(priceLabel({ price_from: 12, price_to: 55 }), {
    kind: "range",
    from: 12,
  });
  // Meio nulo não deveria existir, mas não pode virar um preço falso.
  assertEquals(priceLabel({ price_from: 12, price_to: null }), {
    kind: "none",
  });
});

Deno.test("initials: first letters of the first two words", () => {
  assertEquals(initials("Oolong Tea"), "OT");
  assertEquals(initials("enamel pin kit"), "EP");
  assertEquals(initials("  Honey   Jar  "), "HJ");
  assertEquals(initials("Mug"), "Mu");
  assertEquals(initials("a"), "A");
  assertEquals(initials("   "), "?");
});

Deno.test("placeholderIndex: deterministic, 1 to 5, and spread over the five colors", () => {
  const ids = Array.from({ length: 200 }, (_, n) => `id${n}abc${n * 7}`);
  const seen = new Set<number>();
  for (const id of ids) {
    const index = placeholderIndex(id);
    assertEquals(placeholderIndex(id), index);
    if (index < 1 || index > 5) throw new Error(`out of range: ${index}`);
    seen.add(index);
  }
  assertEquals(seen.size, 5);
});

Deno.test("stockStatus: thresholds 0, 1-5 and more", () => {
  assertEquals(stockStatus(0), {
    available: false,
    tone: "muted",
    icon: "x",
    label: "Out of stock",
  });
  assertEquals(stockStatus(1).label, "Only 1 left");
  assertEquals(stockStatus(5).label, "Only 5 left");
  assertEquals(stockStatus(5).tone, "warning");
  assertEquals(stockStatus(6), {
    available: true,
    tone: "success",
    icon: "check",
    label: "In stock",
  });
  assertEquals(stockStatus(24).available, true);
});

Deno.test("variantsSummary", () => {
  assertEquals(variantsSummary([]), "No variants available");
  assertEquals(variantsSummary([{ price: 1 }]), "1 variant · 1 unidade");
  assertEquals(
    variantsSummary([{ price: 25 }, { price: 25 }]),
    "2 variants · 25 unidades",
  );
  assertEquals(
    variantsSummary([{ price: 45 }, { price: 12 }, { price: 160 }]),
    "3 variants · from 12 unidades",
  );
});

import { assertEquals } from "@std/assert";
import {
  canDecrease,
  canIncrease,
  cartCount,
  cartSummaryLine,
  flagInfo,
  splitTotals,
} from "./cart.ts";
import type { CartItem } from "./types.ts";

const item = (over: Partial<CartItem>): CartItem => ({
  variant_id: "v",
  product_id: "p",
  name: "n",
  sku: "s",
  unit_price: 10,
  quantity: 1,
  line_total: 10,
  available: true,
  unavailable_reason: null,
  ...over,
});

// O exemplo do design: 4 linhas, 8 itens, duas sinalizadas.
const cart = {
  items: [
    item({ quantity: 2, line_total: 90, unit_price: 45 }),
    item({ quantity: 1, line_total: 18, unit_price: 18 }),
    item({
      quantity: 3,
      line_total: 45,
      unit_price: 15,
      available: false,
      unavailable_reason: "insufficient_stock",
    }),
    item({
      quantity: 2,
      line_total: 10,
      unit_price: 5,
      available: false,
      unavailable_reason: "inactive",
    }),
  ],
};

Deno.test("cartCount sums quantities, not lines", () => {
  assertEquals(cartCount(cart), 8);
  assertEquals(cartCount({ items: [] }), 0);
});

Deno.test("splitTotals: available vs flagged lines", () => {
  assertEquals(splitTotals(cart), {
    available: { lines: 2, total: 108 },
    flagged: { lines: 2, total: 55 },
  });
  assertEquals(splitTotals({ items: [] }), {
    available: { lines: 0, total: 0 },
    flagged: { lines: 0, total: 0 },
  });
});

Deno.test("cartSummaryLine", () => {
  assertEquals(cartSummaryLine(cart), "4 lines · 8 items");
  assertEquals(cartSummaryLine({ items: [item({})] }), "1 line · 1 item");
});

Deno.test("flagInfo texts follow the design", () => {
  assertEquals(flagInfo("inactive"), {
    label: "No longer sold",
    help: "Remove it to place your order.",
    tone: "neutral",
    icon: "x",
  });
  assertEquals(flagInfo("insufficient_stock").label, "Not enough stock");
  assertEquals(
    flagInfo("insufficient_stock").help,
    "Lower the quantity or remove it.",
  );
});

Deno.test("canIncrease / canDecrease per line state", () => {
  const ok = item({ quantity: 2 });
  const one = item({ quantity: 1 });
  const lowStock = item({
    quantity: 3,
    available: false,
    unavailable_reason: "insufficient_stock",
  });
  const inactive = item({
    quantity: 3,
    available: false,
    unavailable_reason: "inactive",
  });

  assertEquals([canIncrease(ok), canDecrease(ok)], [true, true]);
  assertEquals([canIncrease(one), canDecrease(one)], [true, false]);
  // Sem estoque suficiente: dá para baixar a quantidade, não para subir.
  assertEquals([canIncrease(lowStock), canDecrease(lowStock)], [false, true]);
  // Inativa: travada, só remover.
  assertEquals([canIncrease(inactive), canDecrease(inactive)], [false, false]);
});

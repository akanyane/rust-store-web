import { assertEquals } from "@std/assert";
import {
  canCancel,
  canPay,
  formatDateTime,
  formatShortDate,
  formatShortDateTime,
  isPaidOrBeyond,
  itemsLabel,
  orderItemTitle,
  paidLabel,
  shortOrderId,
  statusInfo,
  timelineSteps,
} from "./orders.ts";
import type { OrderStatus } from "./types.ts";

const CREATED = "2026-10-09T15:42:10.123456789Z";
const PAID = "2026-10-09T15:45:00Z";

Deno.test("shortOrderId: first 8 characters, uppercase, with a #", () => {
  assertEquals(shortOrderId("9fst3bccebiatya6ckfv"), "#9FST3BCC");
  assertEquals(shortOrderId("abc"), "#ABC");
});

Deno.test("dates are formatted in UTC, 24-hour, and never show 24:00", () => {
  assertEquals(formatDateTime(CREATED), "Oct 9, 2026, 15:42 UTC");
  assertEquals(formatShortDateTime(CREATED), "Oct 9, 15:42");
  assertEquals(formatShortDate(CREATED), "Oct 9");
  // Meia-noite e hora de um dígito: 00:05, e não "24:05" nem "0:05".
  assertEquals(
    formatDateTime("2026-01-02T00:05:00Z"),
    "Jan 2, 2026, 00:05 UTC",
  );
  assertEquals(formatShortDateTime("2026-01-02T09:07:00Z"), "Jan 2, 09:07");
  // O fuso do servidor não pode vazar: 23:30 UTC continua no mesmo dia.
  assertEquals(formatShortDate("2026-03-31T23:30:00Z"), "Mar 31");
});

Deno.test("itemsLabel sums quantities", () => {
  const item = (quantity: number) => ({ quantity }) as never;
  assertEquals(itemsLabel({ items: [item(2), item(1)] }), "3 items");
  assertEquals(itemsLabel({ items: [item(1)] }), "1 item");
  assertEquals(itemsLabel({ items: [] }), "0 items");
});

Deno.test("statusInfo: label, tone and icon per status", () => {
  assertEquals(statusInfo("pending"), {
    label: "Pending",
    tone: "warning",
    icon: "clock",
  });
  assertEquals(statusInfo("paid"), {
    label: "Paid",
    tone: "info",
    icon: "coin",
  });
  assertEquals(statusInfo("shipped"), {
    label: "Shipped",
    tone: "accent",
    icon: "box",
  });
  assertEquals(statusInfo("delivered"), {
    label: "Delivered",
    tone: "success",
    icon: "check",
  });
  assertEquals(statusInfo("cancelled"), {
    label: "Cancelled",
    tone: "neutral",
    icon: "x",
  });
});

Deno.test("only a pending order can be paid or cancelled; paid and beyond are final for the customer", () => {
  const all: OrderStatus[] = [
    "pending",
    "paid",
    "shipped",
    "delivered",
    "cancelled",
  ];
  for (const status of all) {
    assertEquals(canPay({ status }), status === "pending", status);
    assertEquals(canCancel({ status }), status === "pending", status);
    assertEquals(
      isPaidOrBeyond(status),
      ["paid", "shipped", "delivered"].includes(status),
      status,
    );
  }
});

Deno.test("paidLabel: date, 'Not yet', 'Never paid', or 'Date not recorded' for old paid orders", () => {
  assertEquals(
    paidLabel({ status: "paid", paid_at: PAID }),
    "Oct 9, 2026, 15:45 UTC",
  );
  assertEquals(paidLabel({ status: "pending", paid_at: null }), "Not yet");
  assertEquals(paidLabel({ status: "cancelled", paid_at: null }), "Never paid");
  assertEquals(
    paidLabel({ status: "shipped", paid_at: null }),
    "Date not recorded",
  );
  assertEquals(
    paidLabel({ status: "delivered", paid_at: null }),
    "Date not recorded",
  );
});

Deno.test("timelineSteps: pending", () => {
  const steps = timelineSteps({
    status: "pending",
    created_at: CREATED,
    paid_at: null,
  })!;
  assertEquals(steps.map((s) => [s.key, s.state]), [
    ["placed", "done"],
    ["paid", "current"],
    ["shipped", "todo"],
    ["delivered", "todo"],
  ]);
  assertEquals(steps[0].meta, "Oct 9, 15:42");
  assertEquals(steps[1].meta, "Waiting for payment");
  assertEquals(steps[2].meta, "");
});

Deno.test("timelineSteps: paid, shipped and delivered advance one step each", () => {
  const states = (status: OrderStatus) =>
    timelineSteps({ status, created_at: CREATED, paid_at: PAID })!.map((s) =>
      s.state
    );
  assertEquals(states("paid"), ["done", "done", "current", "todo"]);
  assertEquals(states("shipped"), ["done", "done", "done", "current"]);
  assertEquals(states("delivered"), ["done", "done", "done", "done"]);

  const paid = timelineSteps({
    status: "paid",
    created_at: CREATED,
    paid_at: PAID,
  })!;
  assertEquals(paid[1].meta, "Oct 9, 15:45");
  // Sem data de envio na API: o passo da vez diz "Up next", e os concluídos ficam sem texto.
  assertEquals(paid[2].meta, "Up next");
  const shipped = timelineSteps({
    status: "shipped",
    created_at: CREATED,
    paid_at: PAID,
  })!;
  assertEquals([shipped[2].meta, shipped[3].meta], ["", "Up next"]);
});

Deno.test("timelineSteps: a cancelled order has none, and an old paid order has no paid date", () => {
  assertEquals(
    timelineSteps({ status: "cancelled", created_at: CREATED, paid_at: null }),
    null,
  );
  const old = timelineSteps({
    status: "paid",
    created_at: CREATED,
    paid_at: null,
  })!;
  assertEquals(old[1].state, "done");
  assertEquals(old[1].meta, "");
});

Deno.test("orderItemTitle: product and variant, and old orders fall back to the variant", () => {
  assertEquals(
    orderItemTitle({ product_name: "Oolong Tea", name: "250 g bag" }),
    "Oolong Tea · 250 g bag",
  );
  assertEquals(
    orderItemTitle({ product_name: "Ceramic Mug", name: "Default" }),
    "Ceramic Mug",
  );
  assertEquals(
    orderItemTitle({ product_name: null, name: "250 g bag" }),
    "250 g bag",
  );
  assertEquals(
    orderItemTitle({ product_name: null, name: "Default" }),
    "Default",
  );
});

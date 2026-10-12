import { assertEquals } from "@std/assert";
import {
  adminCustomersHref,
  adminOrdersHref,
  adminProductsHref,
  allowedTransitions,
  CUSTOMER_SORTS,
  customerCards,
  customerHref,
  customerStatusLinks,
  dashboardCards,
  formatCreated,
  isOfferedTransition,
  isOrderStatus,
  lowStockHref,
  MAX_SEARCH_LENGTH,
  ORDER_FILTERS,
  parseCustomerSort,
  parseOrderFilter,
  parseProductSort,
  parseSearch,
  parseShow,
  parseWholeNumber,
  showToActive,
  stockBreakdown,
  validateNewProduct,
  validateProductEdit,
  validateVariant,
} from "./admin.ts";
import type { AdminCustomer, AdminStats, OrderStatus } from "./types.ts";

Deno.test("allowedTransitions mirrors the API lifecycle", () => {
  const next = (status: OrderStatus) =>
    allowedTransitions(status).map((t) => t.to);
  assertEquals(next("pending"), ["paid", "cancelled"]);
  assertEquals(next("paid"), ["shipped"]);
  assertEquals(next("shipped"), ["delivered"]);
  assertEquals(next("delivered"), []);
  assertEquals(next("cancelled"), []);
});

Deno.test("a paid order can never be offered 'cancelled' (the store has no refunds)", () => {
  for (const status of ["paid", "shipped", "delivered"] as OrderStatus[]) {
    assertEquals(isOfferedTransition(status, "cancelled"), false, status);
  }
});

Deno.test("allowedTransitions: button texts, hint and tone follow the design", () => {
  const [paid, cancel] = allowedTransitions("pending");
  assertEquals([paid.label, paid.tone, paid.hint], [
    "Mark as paid",
    "primary",
    undefined,
  ]);
  assertEquals([cancel.label, cancel.tone, cancel.hint], [
    "Cancel order",
    "danger",
    "returns stock",
  ]);
  assertEquals(allowedTransitions("paid")[0].label, "Mark as shipped");
  assertEquals(allowedTransitions("shipped")[0].label, "Mark as delivered");
});

Deno.test("isOfferedTransition only accepts the offered next steps", () => {
  assertEquals(isOfferedTransition("pending", "paid"), true);
  assertEquals(isOfferedTransition("pending", "cancelled"), true);
  assertEquals(isOfferedTransition("pending", "shipped"), false);
  assertEquals(isOfferedTransition("pending", "pending"), false);
  assertEquals(isOfferedTransition("delivered", "shipped"), false);
  assertEquals(isOfferedTransition("paid", "explode"), false);
});

Deno.test("isOrderStatus", () => {
  for (const ok of ["pending", "paid", "shipped", "delivered", "cancelled"]) {
    assertEquals(isOrderStatus(ok), true);
  }
  for (const bad of ["", "PAID", "refunded", "all"]) {
    assertEquals(isOrderStatus(bad), false);
  }
});

Deno.test("order filters and links leave the defaults out of the URL", () => {
  assertEquals(ORDER_FILTERS.map((f) => f.label), [
    "All",
    "Pending",
    "Paid",
    "Shipped",
    "Delivered",
    "Cancelled",
  ]);
  assertEquals(parseOrderFilter("shipped"), "shipped");
  for (const bad of [null, "", "nope", "SHIPPED"]) {
    assertEquals(parseOrderFilter(bad), "all");
  }
  assertEquals(adminOrdersHref(), "/admin/orders");
  assertEquals(
    adminOrdersHref({ status: "paid" }),
    "/admin/orders?status=paid",
  );
  assertEquals(
    adminOrdersHref({ status: "paid", page: 3 }),
    "/admin/orders?status=paid&page=3",
  );
  assertEquals(adminOrdersHref({ page: 2 }), "/admin/orders?page=2");
});

Deno.test("product show/sort parsing and links", () => {
  assertEquals(parseShow("active"), "active");
  assertEquals(parseShow("inactive"), "inactive");
  for (const other of [null, "all", "", "ACTIVE", "x"]) {
    assertEquals(parseShow(other), "all");
  }
  assertEquals(parseProductSort("newest"), "newest");
  for (const other of [null, "name", "oldest", ""]) {
    assertEquals(parseProductSort(other), "name");
  }
  assertEquals(showToActive("all"), undefined);
  assertEquals(showToActive("active"), true);
  assertEquals(showToActive("inactive"), false);

  assertEquals(adminProductsHref(), "/admin/products");
  assertEquals(
    adminProductsHref({ show: "inactive", sort: "newest", page: 2 }),
    "/admin/products?show=inactive&sort=newest&page=2",
  );
  assertEquals(
    adminProductsHref({ confirm: "abc" }),
    "/admin/products?confirm=abc",
  );
});

Deno.test("stockBreakdown and formatCreated", () => {
  assertEquals(stockBreakdown(57, 4), "57 active, 4 inactive");
  assertEquals(formatCreated("2026-03-02T09:00:00Z"), "Mar 2, 2026");
  assertEquals(formatCreated("2026-03-31T23:30:00Z"), "Mar 31, 2026");
  assertEquals(formatCreated(null), "—");
});

Deno.test("parseWholeNumber: digits only", () => {
  assertEquals(parseWholeNumber("12"), 12);
  assertEquals(parseWholeNumber(" 7 "), 7);
  assertEquals(parseWholeNumber("0"), 0);
  assertEquals(parseWholeNumber("-4"), -4);
  for (
    const bad of [
      "12.5",
      "1e3",
      "",
      " ",
      "abc",
      "1,000",
      "+5",
      "9999999999",
      "0x10",
    ]
  ) {
    assertEquals(parseWholeNumber(bad), null, bad);
  }
});

Deno.test("validateNewProduct: the design's example (12.5 and -4) fails both fields", () => {
  assertEquals(
    validateNewProduct({
      name: "Pour-over Kit",
      description: "d",
      price: "12.5",
      stock: "-4",
    }),
    {
      price: "Whole number ≥ 1, no decimals",
      stock: "Whole number ≥ 0",
    },
  );
  assertEquals(
    validateNewProduct({
      name: "Kit",
      description: "",
      price: "12",
      stock: "0",
    }),
    {},
  );
  assertEquals(
    validateNewProduct({
      name: "Kit",
      description: "",
      price: "0",
      stock: "1",
    }),
    {
      price: "Whole number ≥ 1, no decimals",
    },
  );
  assertEquals(
    validateNewProduct({
      name: "  ",
      description: "x".repeat(2001),
      price: "",
      stock: "",
    }),
    {
      name: "Required",
      description: "At most 2000 characters",
      price: "Whole number ≥ 1, no decimals",
      stock: "Whole number ≥ 0",
    },
  );
  assertEquals(
    validateNewProduct({
      name: "x".repeat(201),
      description: "",
      price: "1",
      stock: "0",
    }),
    {
      name: "At most 200 characters",
    },
  );
});

Deno.test("validateProductEdit and validateVariant", () => {
  assertEquals(validateProductEdit({ name: "Tea", description: "ok" }), {});
  assertEquals(validateProductEdit({ name: "", description: "" }), {
    name: "Required",
  });
  assertEquals(
    validateVariant({
      name: "250 g bag",
      sku: "TEA-250",
      price: "45",
      stock: "2",
    }),
    {},
  );
  assertEquals(
    validateVariant({ name: "", sku: "", price: "0", stock: "-1" }),
    {
      name: "Required",
      sku: "Required",
      price: "Whole number ≥ 1, no decimals",
      stock: "Whole number ≥ 0",
    },
  );
  assertEquals(
    validateVariant({ name: "a", sku: "x".repeat(65), price: "1", stock: "0" }),
    {
      sku: "At most 64 characters",
    },
  );
});

const STATS: AdminStats = {
  orders: {
    total: 12,
    pending: 3,
    paid: 2,
    shipped: 1,
    delivered: 5,
    cancelled: 1,
  },
  revenue: 1240,
  products: { active: 7, inactive: 2 },
  low_stock: [],
};

Deno.test("dashboardCards: four cards, each linking to where the number lives", () => {
  const cards = dashboardCards(STATS);
  assertEquals(cards.map((c) => c.key), [
    "pending",
    "to-ship",
    "revenue",
    "products",
  ]);
  assertEquals(cards.map((c) => c.href), [
    "/admin/orders?status=pending",
    "/admin/orders?status=paid",
    "/admin/orders",
    "/admin/products",
  ]);
});

Deno.test("dashboardCards: values are formatted for people", () => {
  const [pending, toShip, revenue, products] = dashboardCards(STATS);
  assertEquals(pending.value, "3");
  assertEquals(toShip.value, "2");
  assertEquals(revenue.value, "1,240 unidades");
  assertEquals(products.value, "7 active");
  assertEquals(products.hint, "2 inactive");
  assertEquals(
    dashboardCards({ ...STATS, revenue: 1 })[2].value,
    "1 unidade",
  );
});

Deno.test("dashboardCards: only orders waiting for an action ask for attention", () => {
  const attention = (stats: AdminStats) =>
    dashboardCards(stats).filter((c) => c.attention).map((c) => c.key);
  assertEquals(attention(STATS), ["pending", "to-ship"]);
  assertEquals(
    attention({ ...STATS, orders: { ...STATS.orders, pending: 0 } }),
    ["to-ship"],
  );
  assertEquals(
    attention({
      ...STATS,
      orders: { ...STATS.orders, pending: 0, paid: 0 },
    }),
    [],
  );
});

Deno.test("lowStockHref: opens the product, with the id encoded", () => {
  assertEquals(
    lowStockHref({ product_id: "abc123" }),
    "/admin/products/abc123",
  );
  assertEquals(
    lowStockHref({ product_id: "a/b c" }),
    "/admin/products/a%2Fb%20c",
  );
});

Deno.test("parseSearch: trims, treats empty as no search, and never exceeds what the API accepts", () => {
  assertEquals(parseSearch(null), "");
  assertEquals(parseSearch(""), "");
  assertEquals(parseSearch("   "), "");
  assertEquals(parseSearch("  #9FST3BCC  "), "#9FST3BCC");
  assertEquals(parseSearch("a b"), "a b");
  assertEquals(MAX_SEARCH_LENGTH, 64);
  assertEquals(parseSearch("x".repeat(64)).length, 64);
  assertEquals(parseSearch("x".repeat(65)).length, 64);
  assertEquals(parseSearch("x".repeat(500)).length, 64);
  // O corte não deixa espaço sobrando na ponta.
  assertEquals(parseSearch(`${"x".repeat(63)} yyy`), "x".repeat(63));
});

Deno.test("adminOrdersHref: the search travels with the filter and the page", () => {
  assertEquals(adminOrdersHref({ q: "9FST" }), "/admin/orders?q=9FST");
  assertEquals(
    adminOrdersHref({ status: "paid", q: "ana", page: 2 }),
    "/admin/orders?status=paid&q=ana&page=2",
  );
  assertEquals(adminOrdersHref({ q: "" }), "/admin/orders");
});

Deno.test("adminOrdersHref: the term is encoded, so it cannot add parameters or break the page", () => {
  assertEquals(
    adminOrdersHref({ q: "#a b&status=paid" }),
    "/admin/orders?q=%23a+b%26status%3Dpaid",
  );
  assertEquals(
    new URL(adminOrdersHref({ q: "a&page=9" }), "http://x").searchParams.get(
      "q",
    ),
    "a&page=9",
  );
});

const CUSTOMER: AdminCustomer = {
  id: "cust1",
  username: "ana",
  created_at: "2026-03-02T10:00:00Z",
  orders: {
    total: 6,
    pending: 1,
    paid: 2,
    shipped: 0,
    delivered: 2,
    cancelled: 1,
  },
  spent: 1240,
  last_order_at: "2026-10-11T22:10:00Z",
};

Deno.test("customerHref: encodes the id", () => {
  assertEquals(customerHref("abc123"), "/admin/customers/abc123");
  assertEquals(customerHref("a/b c"), "/admin/customers/a%2Fb%20c");
});

Deno.test("customerCards: four cards with numbers formatted for people", () => {
  const cards = customerCards(CUSTOMER);
  assertEquals(cards.map((c) => c.key), ["orders", "spent", "since", "last"]);
  assertEquals(cards.map((c) => c.value), [
    "6",
    "1,240 unidades",
    "Mar 2, 2026",
    "Oct 11, 2026",
  ]);
  assertEquals(cards[0].hint, "1 pending");
});

Deno.test("customerCards: someone who never bought says so, instead of inventing a date", () => {
  const cards = customerCards({
    ...CUSTOMER,
    orders: {
      total: 0,
      pending: 0,
      paid: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    },
    spent: 0,
    last_order_at: null,
  });
  assertEquals(cards[0].value, "0");
  assertEquals(cards[0].hint, "Nothing bought yet");
  assertEquals(cards[1].value, "0 unidades");
  assertEquals(cards[3].value, "None yet");
  assertEquals(cards[3].hint, "Has not placed an order");
});

Deno.test("customerStatusLinks: only statuses with orders, in lifecycle order, each filtered to this customer", () => {
  const links = customerStatusLinks(CUSTOMER);
  assertEquals(links.map((l) => [l.status, l.count]), [
    ["pending", 1],
    ["paid", 2],
    ["delivered", 2],
    ["cancelled", 1],
  ]);
  assertEquals(links[1].href, "/admin/orders?status=paid&q=cust1");
  assertEquals(
    customerStatusLinks({
      ...CUSTOMER,
      orders: {
        total: 0,
        pending: 0,
        paid: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
      },
    }),
    [],
  );
});

Deno.test("parseCustomerSort: username or newest, anything else is newest", () => {
  assertEquals(parseCustomerSort("username"), "username");
  assertEquals(parseCustomerSort("newest"), "newest");
  for (const odd of [null, "", "spent", "USERNAME", "name"]) {
    assertEquals(parseCustomerSort(odd), "newest", String(odd));
  }
  assertEquals(CUSTOMER_SORTS.map((s) => s.key), ["newest", "username"]);
});

Deno.test("adminCustomersHref: only what is not the default, and the term is encoded", () => {
  assertEquals(adminCustomersHref(), "/admin/customers");
  assertEquals(adminCustomersHref({ q: "ana" }), "/admin/customers?q=ana");
  assertEquals(
    adminCustomersHref({ sort: "username" }),
    "/admin/customers?sort=username",
  );
  assertEquals(
    adminCustomersHref({ q: "an", sort: "username", page: 3 }),
    "/admin/customers?q=an&sort=username&page=3",
  );
  assertEquals(adminCustomersHref({ page: 1 }), "/admin/customers");
  assertEquals(
    adminCustomersHref({ q: "a&sort=x" }),
    "/admin/customers?q=a%26sort%3Dx",
  );
});

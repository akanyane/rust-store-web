import type { FormErrors } from "./validation.ts";
import type { OrderStatus } from "./types.ts";

/** Itens por página nas listas do console (o design mostra "1–10 of 312"). */
export const ADMIN_PAGE_SIZE = 10;

// ---------- Pedidos ----------

export type OrderFilter = "all" | OrderStatus;

export const ORDER_FILTERS: { key: OrderFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "paid", label: "Paid" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

/** `?status=` da lista de pedidos; qualquer valor desconhecido vira "all". */
export function parseOrderFilter(value: string | null): OrderFilter {
  return ORDER_FILTERS.some((filter) => filter.key === value)
    ? (value as OrderFilter)
    : "all";
}

export function adminOrdersHref(
  { status = "all", page = 1 }: { status?: OrderFilter; page?: number } = {},
): string {
  const query = new URLSearchParams();
  if (status !== "all") query.set("status", status);
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `/admin/orders?${text}` : "/admin/orders";
}

export interface Transition {
  to: OrderStatus;
  /** Texto do botão: "Mark as paid". */
  label: string;
  /** Complemento ao lado do botão: "returns stock". */
  hint?: string;
  tone: "primary" | "danger";
}

/**
 * Os próximos passos que o console oferece, espelhando o ciclo da API: `pending` vai para
 * `paid` ou `cancelled`; `paid` para `shipped`; `shipped` para `delivered`. Pedido pago não
 * volta para cancelado (não há reembolso). `cancelled` e `delivered` são finais.
 */
export function allowedTransitions(status: OrderStatus): Transition[] {
  switch (status) {
    case "pending":
      return [
        { to: "paid", label: "Mark as paid", tone: "primary" },
        {
          to: "cancelled",
          label: "Cancel order",
          hint: "returns stock",
          tone: "danger",
        },
      ];
    case "paid":
      return [{ to: "shipped", label: "Mark as shipped", tone: "primary" }];
    case "shipped":
      return [{ to: "delivered", label: "Mark as delivered", tone: "primary" }];
    case "delivered":
    case "cancelled":
      return [];
  }
}

export const FINAL_TEXT = "Final status. No further changes.";

/** O `status` que veio do formulário só vale se for um dos próximos passos oferecidos. */
export function isOfferedTransition(
  from: OrderStatus,
  to: string,
): to is OrderStatus {
  return allowedTransitions(from).some((transition) => transition.to === to);
}

export const STATUS_VALUES: OrderStatus[] = [
  "pending",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
];

export function isOrderStatus(value: string): value is OrderStatus {
  return (STATUS_VALUES as string[]).includes(value);
}

// ---------- Produtos ----------

export type ProductShow = "active" | "inactive" | "all";
export type ProductSortKey = "name" | "newest";

export function parseShow(value: string | null): ProductShow {
  return value === "active" || value === "inactive" ? value : "all";
}

export function parseProductSort(value: string | null): ProductSortKey {
  return value === "newest" ? "newest" : "name";
}

/** `?active=` da API: "all" é a ausência do filtro. */
export function showToActive(show: ProductShow): boolean | undefined {
  return show === "all" ? undefined : show === "active";
}

export function adminProductsHref(
  { show = "all", sort = "name", page = 1, confirm }: {
    show?: ProductShow;
    sort?: ProductSortKey;
    page?: number;
    confirm?: string;
  } = {},
): string {
  const query = new URLSearchParams();
  if (show !== "all") query.set("show", show);
  if (sort !== "name") query.set("sort", sort);
  if (page > 1) query.set("page", String(page));
  if (confirm) query.set("confirm", confirm);
  const text = query.toString();
  return text ? `/admin/products?${text}` : "/admin/products";
}

/** "57 active, 4 inactive": o complemento do "Showing 1–10 of 61". */
export function stockBreakdown(active: number, inactive: number): string {
  return `${active} active, ${inactive} inactive`;
}

/** `Mar 2, 2026`, ou "—" quando o produto é antigo e não tem data de criação. */
export function formatCreated(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

// ---------- Validação dos formulários ----------

/** Inteiro escrito só com dígitos (e um `-` opcional): "12.5", "1e3" e "" não valem. */
export function parseWholeNumber(text: string): number | null {
  const trimmed = text.trim();
  if (!/^-?\d{1,9}$/.test(trimmed)) return null;
  return Number(trimmed);
}

function nameError(value: string, max: number): string | undefined {
  if (value.trim() === "") return "Required";
  if ([...value].length > max) return `At most ${max} characters`;
}

function descriptionError(value: string): string | undefined {
  if ([...value].length > 2000) return "At most 2000 characters";
}

function priceError(text: string): string | undefined {
  const price = parseWholeNumber(text);
  if (price === null || price < 1) return "Whole number ≥ 1, no decimals";
}

function stockError(text: string): string | undefined {
  const stock = parseWholeNumber(text);
  if (stock === null || stock < 0) return "Whole number ≥ 0";
}

function collect(entries: [string, string | undefined][]): FormErrors {
  return Object.fromEntries(
    entries.filter((entry): entry is [string, string] =>
      entry[1] !== undefined
    ),
  );
}

export interface NewProductFields {
  name: string;
  description: string;
  price: string;
  stock: string;
}

export function validateNewProduct(fields: NewProductFields): FormErrors {
  return collect([
    ["name", nameError(fields.name, 200)],
    ["description", descriptionError(fields.description)],
    ["price", priceError(fields.price)],
    ["stock", stockError(fields.stock)],
  ]);
}

export function validateProductEdit(
  fields: { name: string; description: string },
): FormErrors {
  return collect([
    ["name", nameError(fields.name, 200)],
    ["description", descriptionError(fields.description)],
  ]);
}

export interface VariantFields {
  name: string;
  sku: string;
  price: string;
  stock: string;
}

export function validateVariant(fields: VariantFields): FormErrors {
  return collect([
    ["name", nameError(fields.name, 200)],
    ["sku", nameError(fields.sku, 64)],
    ["price", priceError(fields.price)],
    ["stock", stockError(fields.stock)],
  ]);
}

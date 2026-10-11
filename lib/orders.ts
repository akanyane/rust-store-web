import type { IconName } from "../components/Icon.tsx";
import { lineTitle } from "./cart.ts";
import type { Order, OrderItem, OrderStatus } from "./types.ts";

/**
 * Número do pedido na tela: os 8 primeiros caracteres do id, em maiúsculas (`#9FST3BCC`).
 * Os ids da API são textos aleatórios; o id completo continua sendo o da URL.
 */
export function shortOrderId(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

const DATE_TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const SHORT_DATE_TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** `Oct 9, 2026, 15:42 UTC`. O servidor não sabe o fuso do navegador, então a hora é UTC. */
export function formatDateTime(iso: string): string {
  return `${DATE_TIME.format(new Date(iso))} UTC`;
}

/** `Oct 9, 15:42`: para a linha do tempo, onde o ano é desnecessário. */
export function formatShortDateTime(iso: string): string {
  return SHORT_DATE_TIME.format(new Date(iso));
}

/** `Oct 9`: para os cartões da lista no celular. */
export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  })
    .format(new Date(iso));
}

/** "3 items": a soma das quantidades, não o número de linhas. */
export function itemsLabel(order: Pick<Order, "items">): string {
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return `${count} ${count === 1 ? "item" : "items"}`;
}

export interface StatusInfo {
  label: string;
  tone: "warning" | "info" | "accent" | "success" | "neutral";
  icon: IconName;
}

/** Selo do status: sempre ícone mais palavra; a cor nunca é o único sinal. */
export function statusInfo(status: OrderStatus): StatusInfo {
  switch (status) {
    case "pending":
      return { label: "Pending", tone: "warning", icon: "clock" };
    case "paid":
      return { label: "Paid", tone: "info", icon: "coin" };
    case "shipped":
      return { label: "Shipped", tone: "accent", icon: "box" };
    case "delivered":
      return { label: "Delivered", tone: "success", icon: "check" };
    case "cancelled":
      return { label: "Cancelled", tone: "neutral", icon: "x" };
  }
}

export const canPay = (order: Pick<Order, "status">): boolean =>
  order.status === "pending";
export const canCancel = (order: Pick<Order, "status">): boolean =>
  order.status === "pending";

/** Pago e além: a loja não tem reembolso, então o pedido não pode mais ser cancelado. */
export function isPaidOrBeyond(status: OrderStatus): boolean {
  return status === "paid" || status === "shipped" || status === "delivered";
}

/** "Paid" do topo do detalhe: a data, "Not yet" (pendente) ou "Never paid" (cancelado). */
export function paidLabel(order: Pick<Order, "status" | "paid_at">): string {
  if (order.paid_at) return formatDateTime(order.paid_at);
  if (order.status === "pending") return "Not yet";
  if (order.status === "cancelled") return "Never paid";
  // Pago antes de a API guardar a data: o pedido foi pago, mas não há quando.
  return "Date not recorded";
}

export interface TimelineStep {
  key: "placed" | "paid" | "shipped" | "delivered";
  label: string;
  state: "done" | "current" | "todo";
  meta: string;
}

const STEPS = ["placed", "paid", "shipped", "delivered"] as const;
const LABELS = {
  placed: "Placed",
  paid: "Paid",
  shipped: "Shipped",
  delivered: "Delivered",
};

/**
 * Linha do tempo Placed → Paid → Shipped → Delivered. Pedido cancelado não tem linha do
 * tempo (`null`). A API só guarda a data do pedido e a do pagamento, então Shipped e
 * Delivered não têm data: o passo da vez diz "Up next" e os outros ficam sem texto.
 */
export function timelineSteps(
  order: Pick<Order, "status" | "created_at" | "paid_at">,
): TimelineStep[] | null {
  if (order.status === "cancelled") return null;
  // Quantos passos já foram cumpridos: o pedido sempre foi feito (1), e assim por diante.
  const done = { pending: 1, paid: 2, shipped: 3, delivered: 4 }[order.status];

  return STEPS.map((key, index) => {
    const state = index < done ? "done" : index === done ? "current" : "todo";
    let meta = "";
    if (key === "placed") meta = formatShortDateTime(order.created_at);
    else if (key === "paid" && order.paid_at && state === "done") {
      meta = formatShortDateTime(order.paid_at);
    } else if (key === "paid" && state === "current") {
      meta = "Waiting for payment";
    } else if (state === "current") meta = "Up next";
    return { key, label: LABELS[key], state, meta };
  });
}

/** Título do item: "Produto · Variante"; pedidos antigos (sem `product_name`) só têm a variante. */
export const orderItemTitle: (
  item: Pick<OrderItem, "product_name" | "name">,
) => string = lineTitle;

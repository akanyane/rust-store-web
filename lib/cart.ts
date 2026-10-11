import type { Cart, CartItem, UnavailableReason } from "./types.ts";

/** Número do selo do cabeçalho: soma das quantidades (8 itens em 4 linhas = 8). */
export function cartCount(cart: Pick<Cart, "items">): number {
  return cart.items.reduce((sum, item) => sum + item.quantity, 0);
}

export interface Group {
  lines: number;
  total: number;
}

/** "Available lines (2) 108" e "Flagged lines (2) 55" do resumo. */
export function splitTotals(
  cart: Pick<Cart, "items">,
): { available: Group; flagged: Group } {
  const available: Group = { lines: 0, total: 0 };
  const flagged: Group = { lines: 0, total: 0 };
  for (const item of cart.items) {
    const group = item.available ? available : flagged;
    group.lines += 1;
    group.total += item.line_total;
  }
  return { available, flagged };
}

export interface FlagInfo {
  label: string;
  help: string;
  tone: "neutral" | "warning";
  icon: "x" | "alert";
}

/** Texto de cada sinalização, como no design. */
export function flagInfo(reason: UnavailableReason): FlagInfo {
  return reason === "inactive"
    ? {
      label: "No longer sold",
      help: "Remove it to place your order.",
      tone: "neutral",
      icon: "x",
    }
    : {
      label: "Not enough stock",
      help: "Lower the quantity or remove it.",
      tone: "warning",
      icon: "alert",
    };
}

/** Pode aumentar? Nunca se a linha está sinalizada (inativa ou sem estoque suficiente). */
export function canIncrease(item: CartItem): boolean {
  return item.available;
}

/** Pode diminuir? Não abaixo de 1, e linha inativa fica travada (só dá para remover). */
export function canDecrease(item: CartItem): boolean {
  return item.quantity > 1 && item.unavailable_reason !== "inactive";
}

/** "4 lines · 8 items" do topo do carrinho. */
export function cartSummaryLine(cart: Pick<Cart, "items">): string {
  const lines = cart.items.length;
  const items = cartCount(cart);
  return `${lines} ${lines === 1 ? "line" : "lines"} · ${items} ${
    items === 1 ? "item" : "items"
  }`;
}

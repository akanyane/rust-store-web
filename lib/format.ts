import type { ProductListItem, Variant } from "./types.ts";

/** `1,240` (separador de milhar, sem casas decimais: a moeda não tem subunidade). */
export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/** A moeda da loja: "unidade" no singular, "unidades" no resto (inclusive 0). */
export function unitLabel(n: number): string {
  return n === 1 ? "unidade" : "unidades";
}

/** `1 unidade`, `25 unidades`, `1,240 unidades`. */
export function formatUnits(n: number): string {
  return `${formatNumber(n)} ${unitLabel(n)}`;
}

export type PriceLabel =
  | { kind: "none" }
  | { kind: "single"; price: number }
  | { kind: "range"; from: number };

/**
 * Como o card mostra o preço: o prefixo "from" só aparece quando as variantes têm preços
 * diferentes (`price_from != price_to`). Sem variante ativa, não há preço.
 */
export function priceLabel(
  item: Pick<ProductListItem, "price_from" | "price_to">,
): PriceLabel {
  if (item.price_from === null || item.price_to === null) {
    return { kind: "none" };
  }
  if (item.price_from === item.price_to) {
    return { kind: "single", price: item.price_from };
  }
  return { kind: "range", from: item.price_from };
}

/** Iniciais do placeholder: duas ou mais palavras dão a inicial das duas primeiras. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) {
    const [first] = words;
    return first.slice(0, 2).charAt(0).toUpperCase() +
      first.slice(1, 2).toLowerCase();
  }
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

/**
 * Cor do placeholder (1 a 5). O design usa `id % 5 + 1`, mas os ids da API são textos
 * aleatórios; um hash FNV-1a dos caracteres dá o mesmo efeito, de forma determinística.
 */
export function placeholderIndex(id: string): 1 | 2 | 3 | 4 | 5 {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return ((hash % 5) + 1) as 1 | 2 | 3 | 4 | 5;
}

export interface StockStatus {
  available: boolean;
  tone: "success" | "warning" | "muted";
  icon: "check" | "alert" | "x";
  label: string;
}

/** `> 5` "In stock"; `1 a 5` "Only N left"; `0` "Out of stock". */
export function stockStatus(stock: number): StockStatus {
  if (stock <= 0) {
    return {
      available: false,
      tone: "muted",
      icon: "x",
      label: "Out of stock",
    };
  }
  if (stock <= 5) {
    return {
      available: true,
      tone: "warning",
      icon: "alert",
      label: `Only ${stock} left`,
    };
  }
  return { available: true, tone: "success", icon: "check", label: "In stock" };
}

/** `3 variants · from 12 unidades` (ou só o preço quando todas custam o mesmo). */
export function variantsSummary(variants: Pick<Variant, "price">[]): string {
  if (variants.length === 0) return "No variants available";
  const count = `${variants.length} ${
    variants.length === 1 ? "variant" : "variants"
  }`;
  const prices = variants.map((variant) => variant.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return low === high
    ? `${count} · ${formatUnits(low)}`
    : `${count} · from ${formatUnits(low)}`;
}

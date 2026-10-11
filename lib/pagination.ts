/** Produtos por página do catálogo (o design mostra "1–12 of 57"). */
export const PER_PAGE = 12;

/** Número da página a partir do `?page=`: inteiro positivo, senão 1. */
export function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export interface PageInfo {
  page: number;
  pages: number;
  total: number;
  /** Posição do primeiro e do último item da página, base 1 (0 e 0 se não há itens). */
  from: number;
  to: number;
  hasPrev: boolean;
  hasNext: boolean;
}

/** Conta de "Showing 1–12 of 57" e dos botões. `page` fora do intervalo é ajustada. */
export function pageInfo(
  total: number,
  page: number,
  perPage = PER_PAGE,
): PageInfo {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, page), pages);
  const offset = (current - 1) * perPage;
  return {
    page: current,
    pages,
    total,
    from: total === 0 ? 0 : offset + 1,
    to: Math.min(total, offset + perPage),
    hasPrev: current > 1,
    hasNext: current < pages,
  };
}

export type PageItem = number | "gap";

/**
 * Botões numerados: sempre a primeira e a última, mais uma janela de 3 em volta da atual
 * (`1 2 3 … 5`, `1 … 3 4 5`), com "gap" onde há buraco.
 */
export function pageItems(page: number, pages: number): PageItem[] {
  if (pages <= 1) return [1];
  const start = Math.max(1, Math.min(page - 1, pages - 2));
  const end = Math.min(pages, start + 2);
  const numbers = new Set<number>([1, pages]);
  for (let n = start; n <= end; n++) numbers.add(n);

  const items: PageItem[] = [];
  let previous = 0;
  for (const n of [...numbers].sort((a, b) => a - b)) {
    if (previous && n - previous > 1) items.push("gap");
    items.push(n);
    previous = n;
  }
  return items;
}

export type Sort = "name" | "newest";

/** `?sort=` do catálogo: só `newest` muda o padrão (`name`). */
export function parseSort(value: string | null): Sort {
  return value === "newest" ? "newest" : "name";
}

/** Link do catálogo sem repetir os padrões (`sort=name`, `page=1`). */
export function catalogHref(
  { sort = "name", page = 1 }: { sort?: Sort; page?: number } = {},
): string {
  const query = new URLSearchParams();
  if (sort !== "name") query.set("sort", sort);
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `/?${text}` : "/";
}

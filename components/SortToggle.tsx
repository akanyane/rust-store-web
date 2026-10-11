import { catalogHref, type Sort } from "../lib/links.ts";

// O Fresh marca sozinho `aria-current` nos links que casam com a URL; um valor definido aqui
// ("true" ou "false") é respeitado. Sem o "false", os dois botões apareceriam como atuais.
/** "Name" | "Newest": links GET, funcionam sem JavaScript. Trocar a ordem volta à página 1. */
export function SortToggle({ sort }: { sort: Sort }) {
  return (
    <div class="rs-sort">
      <span id="sort-label" class="rs-sort__label">Sort by</span>
      <div role="group" aria-labelledby="sort-label" class="rs-segmented">
        <a
          href={catalogHref({ sort: "name" })}
          aria-current={sort === "name" ? "true" : "false"}
        >
          Name
        </a>
        <a
          href={catalogHref({ sort: "newest" })}
          aria-current={sort === "newest" ? "true" : "false"}
        >
          Newest
        </a>
      </div>
    </div>
  );
}

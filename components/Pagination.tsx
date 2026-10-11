import { type PageInfo, pageItems } from "../lib/pagination.ts";

/**
 * "Showing 1–12 of 57" mais os botões. Os botões só aparecem com mais de uma página.
 * `href` monta o link de cada página (cada lista tem os seus filtros) e `extra` é um
 * complemento do resumo, como "57 active, 4 inactive".
 */
export function Pagination(
  { info, href, extra }: {
    info: PageInfo;
    href: (page: number) => string;
    extra?: string;
  },
) {
  const multiple = info.pages > 1;
  return (
    <nav aria-label="Pagination" class="rs-pagination">
      <span class="rs-pagination__summary">
        Showing <b>{info.from}–{info.to}</b> of <b>{info.total}</b>
        {extra && <span class="rs-pagination__extra">· {extra}</span>}
        {multiple && (
          <span class="rs-pagination__pages-of">
            · Page {info.page} of {info.pages}
          </span>
        )}
      </span>
      {multiple && (
        <>
          <div class="rs-pagination__mobile">
            {info.hasPrev
              ? (
                <a
                  class="rs-pagebtn"
                  href={href(info.page - 1)}
                  aria-current="false"
                >
                  ← Previous
                </a>
              )
              : <span class="rs-pagebtn" aria-disabled="true">← Previous</span>}
            {info.hasNext
              ? (
                <a
                  class="rs-pagebtn"
                  href={href(info.page + 1)}
                  aria-current="false"
                >
                  Next →
                </a>
              )
              : <span class="rs-pagebtn" aria-disabled="true">Next →</span>}
          </div>
          <div class="rs-pagination__numbers">
            {info.hasPrev
              ? (
                <a
                  class="rs-pagebtn"
                  href={href(info.page - 1)}
                  aria-current="false"
                >
                  ← Previous
                </a>
              )
              : <span class="rs-pagebtn" aria-disabled="true">← Previous</span>}
            {pageItems(info.page, info.pages).map((item, index) =>
              item === "gap"
                ? <span key={`gap-${index}`} class="rs-pagenum--gap">…</span>
                : (
                  <a
                    key={item}
                    class="rs-pagenum"
                    href={href(item)}
                    aria-current={item === info.page ? "page" : "false"}
                    aria-label={`Page ${item}`}
                  >
                    {item}
                  </a>
                )
            )}
            {info.hasNext
              ? (
                <a
                  class="rs-pagebtn"
                  href={href(info.page + 1)}
                  aria-current="false"
                >
                  Next →
                </a>
              )
              : <span class="rs-pagebtn" aria-disabled="true">Next →</span>}
          </div>
        </>
      )}
    </nav>
  );
}

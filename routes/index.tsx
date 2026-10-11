import { page } from "fresh";
import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import { ApiUnavailableError, listProducts } from "../lib/api.ts";
import { catalogHref, parseSort } from "../lib/links.ts";
import {
  type PageInfo,
  pageInfo,
  parsePage,
  PER_PAGE,
} from "../lib/pagination.ts";
import type { ProductListItem } from "../lib/types.ts";
import { Pagination } from "../components/Pagination.tsx";
import { ProductCard } from "../components/ProductCard.tsx";
import { SortToggle } from "../components/SortToggle.tsx";
import { StatePanel } from "../components/StatePanel.tsx";

type Data =
  | {
    kind: "ok";
    products: ProductListItem[];
    info: PageInfo;
    sort: "name" | "newest";
  }
  | { kind: "empty" }
  | { kind: "error"; href: string };

export const handler = define.handlers({
  async GET(ctx) {
    const sort = parseSort(ctx.url.searchParams.get("sort"));
    const requested = parsePage(ctx.url.searchParams.get("page"));
    try {
      const { products, total } = await listProducts({
        sort,
        limit: PER_PAGE,
        offset: (requested - 1) * PER_PAGE,
      });
      if (total === 0) return page<Data>({ kind: "empty" });

      const info = pageInfo(total, requested);
      // `?page=` além da última: leva para a última página, sem erro.
      if (info.page !== requested) {
        return ctx.redirect(catalogHref({ sort, page: info.page }));
      }
      return page<Data>({ kind: "ok", products, info, sort });
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        return page<Data>(
          { kind: "error", href: ctx.url.pathname + ctx.url.search },
          { status: 503 },
        );
      }
      throw error;
    }
  },
});

export default define.page<typeof handler>(function Catalog({ data }) {
  if (data.kind === "empty") {
    return (
      <>
        <Head>
          <title>Catalog · Rust Store</title>
        </Head>
        <StatePanel title="Nothing on the shelves yet">
          There are no active products right now. Check back soon.
        </StatePanel>
      </>
    );
  }
  if (data.kind === "error") {
    return (
      <>
        <Head>
          <title>Catalog · Rust Store</title>
        </Head>
        <StatePanel
          title="We couldn't load the catalog"
          tone="danger"
          action={{ href: data.href, label: "Try again" }}
        >
          The store didn't respond. Your cart is unaffected.
        </StatePanel>
      </>
    );
  }

  const { products, info, sort } = data;
  return (
    <main class="rs-main">
      <Head>
        <title>Catalog · Rust Store</title>
      </Head>
      <div class="rs-catalog-head">
        <div class="rs-catalog-head__title">
          <h1 class="rs-h1">Catalog</h1>
          <span class="rs-subline">Small-batch goods, priced in unidades.</span>
        </div>
        <div class="rs-catalog-head__bar">
          <span class="rs-count-short">
            {info.from}–{info.to} of {info.total}
          </span>
          <SortToggle sort={sort} />
        </div>
      </div>
      <div class="rs-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      <Pagination info={info} href={(page) => catalogHref({ sort, page })} />
    </main>
  );
});

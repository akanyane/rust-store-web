import { page } from "fresh";
import { Head } from "fresh/runtime";
import { define } from "../../../utils.ts";
import {
  ApiError,
  countAdminProducts,
  deactivateProduct,
  getAdminProduct,
  listAdminProducts,
  updateProduct,
} from "../../../lib/api.ts";
import {
  ADMIN_PAGE_SIZE,
  adminProductsHref,
  formatCreated,
  parseProductSort,
  parseShow,
  type ProductShow,
  showToActive,
  stockBreakdown,
} from "../../../lib/admin.ts";
import type { Flash } from "../../../lib/flash.ts";
import { field } from "../../../lib/form.ts";
import { adminAuthed, requireAdmin } from "../../../lib/guard.ts";
import { type PageInfo, pageInfo, parsePage } from "../../../lib/pagination.ts";
import { safeNext } from "../../../lib/redirect.ts";
import type { Product } from "../../../lib/types.ts";
import { Alert } from "../../../components/Alert.tsx";
import { FilterGroup } from "../../../components/FilterGroup.tsx";
import { Pagination } from "../../../components/Pagination.tsx";
import { ProductStatusBadge } from "../../../components/ProductStatusBadge.tsx";
import PendingButton from "../../../islands/PendingButton.tsx";

interface Data {
  products: Product[];
  info: PageInfo;
  show: ProductShow;
  sort: "name" | "newest";
  activeCount: number;
  inactiveCount: number;
  /** `?confirm=<id>`: o produto cuja desativação está pedindo confirmação. */
  confirming?: Product;
  flash?: Flash;
}

export const handler = define.handlers({
  async GET(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;
    const show = parseShow(ctx.url.searchParams.get("show"));
    const sort = parseProductSort(ctx.url.searchParams.get("sort"));
    const requested = parsePage(ctx.url.searchParams.get("page"));

    const loaded = await adminAuthed(
      ctx,
      ctx.url.pathname + ctx.url.search,
      async (token) => {
        const [list, activeCount, inactiveCount] = await Promise.all([
          listAdminProducts(token, {
            active: showToActive(show),
            sort,
            limit: ADMIN_PAGE_SIZE,
            offset: (requested - 1) * ADMIN_PAGE_SIZE,
          }),
          countAdminProducts(token, true),
          countAdminProducts(token, false),
        ]);
        return { ...list, activeCount, inactiveCount };
      },
    );
    if (!loaded.ok) return loaded.response;

    const { products, total, activeCount, inactiveCount } = loaded.value;
    const info = pageInfo(total, requested, ADMIN_PAGE_SIZE);
    if (info.page !== requested) {
      return ctx.redirect(adminProductsHref({ show, sort, page: info.page }));
    }

    const confirmId = ctx.url.searchParams.get("confirm");
    const confirming = confirmId
      ? products.find((product) => product.id === confirmId && product.active)
      : undefined;
    const flash = ctx.state.flash?.scope === "admin"
      ? ctx.state.flash
      : undefined;
    return page<Data>({
      products,
      info,
      show,
      sort,
      activeCount,
      inactiveCount,
      confirming,
      flash,
    });
  },

  /** Desativar (DELETE lógico) ou reativar (PUT com `active: true`) um produto da lista. */
  async POST(ctx) {
    const form = await ctx.req.formData();
    const intent = field(form, "intent");
    const id = field(form, "id");
    const requested = safeNext(field(form, "back"), "/admin/products");
    const back = requested.startsWith("/admin/products")
      ? requested
      : "/admin/products";

    try {
      const result = await adminAuthed(ctx, back, async (token) => {
        if (intent === "deactivate") {
          await deactivateProduct(token, id);
          return "Product deactivated. It's hidden from the catalog and from carts; nothing was deleted.";
        }
        if (intent === "reactivate") {
          const product = await getAdminProduct(token, id);
          if (!product) return null;
          await updateProduct(token, id, {
            name: product.name,
            description: product.description,
            active: true,
          });
          return "Product reactivated. It's back in the catalog.";
        }
        return null;
      });
      if (!result.ok) return result.response;
      ctx.state.pendingFlash = result.value
        ? { scope: "admin", tone: "success", message: result.value }
        : {
          scope: "admin",
          tone: "error",
          message: "Nothing changed: unknown product or action.",
        };
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      ctx.state.pendingFlash = {
        scope: "admin",
        tone: "error",
        message: `Not changed: ${error.message}`,
      };
    }
    return ctx.redirect(back, 303);
  },
});

export default define.page<typeof handler>(function AdminProducts({ data }) {
  const { products, info, show, sort, flash, confirming } = data;
  const here = adminProductsHref({ show, sort, page: info.page });
  return (
    <>
      <Head>
        <title>Products · Admin · Rust Store</title>
      </Head>
      <div class="rs-admin__head">
        <h1 class="rs-h1">Products</h1>
        <a
          href="/admin/products/new"
          class="rs-btn rs-btn--primary"
          aria-current="false"
        >
          + New product
        </a>
      </div>

      {flash && (
        <Alert
          tone={flash.tone === "success" ? "success" : "danger"}
          title={flash.message}
        />
      )}

      <div class="rs-admin__filters">
        <FilterGroup
          label="Show"
          items={(["active", "inactive", "all"] as const).map((key) => ({
            label: key === "all"
              ? "All"
              : key === "active"
              ? "Active"
              : "Inactive",
            href: adminProductsHref({ show: key, sort }),
            current: key === show,
          }))}
        />
        <FilterGroup
          label="Sort"
          items={[
            {
              label: "Name",
              href: adminProductsHref({ show, sort: "name" }),
              current: sort === "name",
            },
            {
              label: "Newest",
              href: adminProductsHref({ show, sort: "newest" }),
              current: sort === "newest",
            },
          ]}
        />
      </div>

      {products.length === 0
        ? (
          <div class="rs-empty">
            <b>No {show === "all" ? "" : `${show} `}products</b>
            <p>
              {show === "all"
                ? "Create the first product to start selling."
                : "Nothing matches this filter."}
            </p>
            {show !== "all" && (
              <a href={adminProductsHref()} class="rs-btn" aria-current="false">
                Show all products
              </a>
            )}
          </div>
        )
        : (
          <div class="rs-tablewrap">
            <table class="rs-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr
                    key={product.id}
                    class={product.active ? "" : "rs-table__row--off"}
                  >
                    <td>
                      <div class="rs-table__stack">
                        <a
                          href={`/admin/products/${
                            encodeURIComponent(product.id)
                          }`}
                          class="rs-table__name"
                          aria-current="false"
                        >
                          {product.name}
                        </a>
                        <span class="rs-table__desc">
                          {product.description}
                        </span>
                      </div>
                    </td>
                    <td class="rs-mono-cell">{product.id}</td>
                    <td>
                      <ProductStatusBadge active={product.active} />
                    </td>
                    <td>{formatCreated(product.created_at)}</td>
                    <td>
                      <div class="rs-table__actions">
                        <a
                          href={`/admin/products/${
                            encodeURIComponent(product.id)
                          }`}
                          aria-current="false"
                        >
                          Edit
                        </a>
                        {product.active
                          ? (
                            <a
                              href={adminProductsHref({
                                show,
                                sort,
                                page: info.page,
                                confirm: product.id,
                              })}
                              aria-current="false"
                            >
                              Deactivate
                            </a>
                          )
                          : (
                            <form method="post" class="rs-inline-form">
                              <input
                                type="hidden"
                                name="intent"
                                value="reactivate"
                              />
                              <input
                                type="hidden"
                                name="id"
                                value={product.id}
                              />
                              <input type="hidden" name="back" value={here} />
                              <button type="submit" class="rs-linkbtn">
                                Reactivate
                              </button>
                            </form>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {products.length > 0 && (
        <Pagination
          info={info}
          href={(p) => adminProductsHref({ show, sort, page: p })}
          extra={stockBreakdown(data.activeCount, data.inactiveCount)}
        />
      )}

      {confirming && (
        <div class="rs-modal" role="presentation">
          <div
            class="rs-modal__box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deactivate-title"
          >
            <h2 id="deactivate-title">Deactivate "{confirming.name}"?</h2>
            <p>
              It disappears from the catalog and can't be added to carts.
              Nothing is deleted, and you can reactivate it any time.
            </p>
            <div class="rs-modal__actions">
              <a href={here} class="rs-btn" autofocus aria-current="false">
                Keep active
              </a>
              <form method="post">
                <input type="hidden" name="intent" value="deactivate" />
                <input type="hidden" name="id" value={confirming.id} />
                <input type="hidden" name="back" value={here} />
                <PendingButton
                  label="Deactivate"
                  pendingLabel="Deactivating…"
                  variant="danger"
                />
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

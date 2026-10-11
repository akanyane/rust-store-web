import { HttpError, page } from "fresh";
import { Head } from "fresh/runtime";
import { define } from "../../utils.ts";
import { ApiUnavailableError, getProduct } from "../../lib/api.ts";
import { formatUnits, stockStatus, variantsSummary } from "../../lib/format.ts";
import type { ProductDetail } from "../../lib/types.ts";
import { Icon } from "../../components/Icon.tsx";
import { Placeholder } from "../../components/Placeholder.tsx";
import { StatePanel } from "../../components/StatePanel.tsx";

type Data = { kind: "ok"; product: ProductDetail } | {
  kind: "error";
  href: string;
};

export const handler = define.handlers({
  async GET(ctx) {
    try {
      const product = await getProduct(ctx.params.id);
      if (!product) throw new HttpError(404);
      return page<Data>({ kind: "ok", product });
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        return page<Data>({ kind: "error", href: ctx.url.pathname }, {
          status: 503,
        });
      }
      throw error;
    }
  },
});

export default define.page<typeof handler>(function ProductPage({ data }) {
  if (data.kind === "error") {
    return (
      <>
        <Head>
          <title>Product · Rust Store</title>
        </Head>
        <StatePanel
          title="We couldn't load this product"
          tone="danger"
          action={{ href: data.href, label: "Try again" }}
        >
          The store didn't respond. Your cart is unaffected.
        </StatePanel>
      </>
    );
  }

  const { product } = data;
  return (
    <main class="rs-main">
      <Head>
        <title>{product.name} · Rust Store</title>
      </Head>
      <a href="/" class="rs-back" aria-current="false">← Catalog</a>

      <div class="rs-product">
        <Placeholder
          id={product.id}
          name={product.name}
          class="rs-product__ph"
        />
        <div class="rs-product__info">
          <h1 class="rs-product__title">{product.name}</h1>
          <p class="rs-product__desc">{product.description}</p>
          <span class="rs-product__summary">
            {variantsSummary(product.variants)}
          </span>
        </div>
      </div>

      <section class="rs-variants" aria-labelledby="variants-title">
        <h2 id="variants-title">Choose a variant</h2>
        {product.variants.length === 0
          ? (
            <p class="rs-product__desc">
              This product has no variants available right now.
            </p>
          )
          : (
            <ul class="rs-variant-list">
              {product.variants.map((variant) => {
                const stock = stockStatus(variant.stock);
                return (
                  <li key={variant.id} class="rs-variant">
                    <div class="rs-variant__head">
                      <div class="rs-variant__id">
                        <span class="rs-variant__name">{variant.name}</span>
                        <span class="rs-sku">SKU {variant.sku}</span>
                      </div>
                      <span
                        class="rs-price"
                        aria-label={formatUnits(variant.price)}
                      >
                        <b>{variant.price.toLocaleString("en-US")}</b>
                        <span>
                          {variant.price === 1 ? "unidade" : "unidades"}
                        </span>
                      </span>
                    </div>
                    <span class={`rs-stock rs-stock--${stock.tone}`}>
                      <Icon name={stock.icon} />
                      {stock.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
      </section>
    </main>
  );
});

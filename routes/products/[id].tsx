import { HttpError, page } from "fresh";
import { Head } from "fresh/runtime";
import { define } from "../../utils.ts";
import {
  addToCart,
  ApiError,
  ApiUnavailableError,
  getProduct,
} from "../../lib/api.ts";
import { formatUnits, stockStatus, variantsSummary } from "../../lib/format.ts";
import type { Flash } from "../../lib/flash.ts";
import { field } from "../../lib/form.ts";
import { authed } from "../../lib/guard.ts";
import type { ProductDetail } from "../../lib/types.ts";
import { Alert } from "../../components/Alert.tsx";
import { Icon } from "../../components/Icon.tsx";
import { Placeholder } from "../../components/Placeholder.tsx";
import { StatePanel } from "../../components/StatePanel.tsx";
import QuantityStepper from "../../islands/QuantityStepper.tsx";

type Data =
  | { kind: "ok"; product: ProductDetail; flash?: Flash }
  | { kind: "error"; href: string };

export const handler = define.handlers({
  async GET(ctx) {
    try {
      const product = await getProduct(ctx.params.id);
      if (!product) throw new HttpError(404);
      const flash = ctx.state.flash?.scope.startsWith("add:")
        ? ctx.state.flash
        : undefined;
      return page<Data>({ kind: "ok", product, flash });
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        return page<Data>({ kind: "error", href: ctx.url.pathname }, {
          status: 503,
        });
      }
      throw error;
    }
  },

  /** "Add to cart" de uma variante. Sem login, leva ao login e volta para esta página. */
  async POST(ctx) {
    const back = `/products/${encodeURIComponent(ctx.params.id)}`;
    const form = await ctx.req.formData();
    const variantId = field(form, "variant_id");
    const quantity = Number(field(form, "quantity"));
    const scope = `add:${variantId}`;
    const anchor = `${back}#variant-${encodeURIComponent(variantId)}`;

    if (!variantId || !Number.isInteger(quantity) || quantity < 1) {
      ctx.state.pendingFlash = {
        scope,
        tone: "error",
        message: "Choose a quantity of at least 1.",
      };
      return ctx.redirect(anchor, 303);
    }
    try {
      const result = await authed(
        ctx,
        back,
        (token) => addToCart(token, variantId, quantity),
      );
      if (!result.ok) return result.response;
      ctx.state.pendingFlash = {
        scope,
        tone: "success",
        message: "Added to cart.",
        quantity,
      };
    } catch (error) {
      // 409 (estoque que acabou, variante fora de venda) e 422: a API explica o motivo.
      if (!(error instanceof ApiError)) throw error;
      ctx.state.pendingFlash = {
        scope,
        tone: "error",
        message: `Couldn't add to cart: ${error.message}`,
      };
    }
    return ctx.redirect(anchor, 303);
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

  const { product, flash } = data;
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
                const message = flash?.scope === `add:${variant.id}`
                  ? flash
                  : undefined;
                return (
                  <li
                    key={variant.id}
                    id={`variant-${variant.id}`}
                    class="rs-variant"
                  >
                    <form method="post" class="rs-variant__row">
                      <input
                        type="hidden"
                        name="variant_id"
                        value={variant.id}
                      />
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
                      {stock.available
                        ? (
                          <div class="rs-variant__buy">
                            <QuantityStepper
                              name="quantity"
                              label={variant.name}
                              max={variant.stock}
                            />
                            <button
                              type="submit"
                              class="rs-btn rs-btn--primary"
                            >
                              Add to cart
                            </button>
                          </div>
                        )
                        : (
                          <div class="rs-variant__buy">
                            <div
                              class="rs-stepper rs-stepper--off"
                              aria-hidden="true"
                            >
                              <span class="rs-stepper__btn">−</span>
                              <span class="rs-stepper__value">0</span>
                              <span class="rs-stepper__btn">+</span>
                            </div>
                            <button type="button" class="rs-btn" disabled>
                              Out of stock
                            </button>
                          </div>
                        )}
                    </form>
                    {message && message.tone === "success" && (
                      <Alert tone="success" title={message.message}>
                        {message.quantity} × {variant.name} ·{" "}
                        <a href="/cart" aria-current="false">View cart →</a>
                      </Alert>
                    )}
                    {message && message.tone === "error" && (
                      <Alert tone="warning" title="Couldn't add to cart">
                        {message.message.replace(
                          /^Couldn't add to cart:\s*/,
                          "",
                        )}
                      </Alert>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
      </section>
    </main>
  );
});

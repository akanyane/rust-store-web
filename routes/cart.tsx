import { HttpError, page } from "fresh";
import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import { ApiUnavailableError, getCart } from "../lib/api.ts";
import { cartSummaryLine, splitTotals } from "../lib/cart.ts";
import type { Flash } from "../lib/flash.ts";
import { authed, requireCustomer } from "../lib/guard.ts";
import type { Cart } from "../lib/types.ts";
import { Alert } from "../components/Alert.tsx";
import { CartLine } from "../components/CartLine.tsx";
import { CartSummary } from "../components/CartSummary.tsx";
import { StatePanel } from "../components/StatePanel.tsx";

interface Data {
  cart: Cart;
  flash?: Flash;
}

export const handler = define.handlers({
  async GET(ctx) {
    const denied = requireCustomer(ctx);
    if (denied) return denied;
    try {
      const loaded = await authed(ctx, "/cart", getCart);
      if (!loaded.ok) return loaded.response;
      const flash = ctx.state.flash?.scope === "cart"
        ? ctx.state.flash
        : undefined;
      return page<Data>({ cart: loaded.value, flash });
    } catch (error) {
      if (error instanceof ApiUnavailableError) throw new HttpError(503);
      throw error;
    }
  },
});

export default define.page<typeof handler>(function CartPage({ data }) {
  const { cart, flash } = data;
  if (cart.items.length === 0) {
    return (
      <>
        <Head>
          <title>Your cart · Rust Store</title>
        </Head>
        <StatePanel
          title="Your cart is empty"
          action={{ href: "/", label: "Browse the catalog" }}
          above={flash && (
            <Alert
              tone={flash.tone === "success" ? "success" : "danger"}
              title={flash.message}
            />
          )}
        >
          Add something from the catalog and it will show up here.
        </StatePanel>
      </>
    );
  }

  const { flagged } = splitTotals(cart);
  return (
    <main class="rs-main">
      <Head>
        <title>Your cart · Rust Store</title>
      </Head>
      <div class="rs-cart-head">
        <h1 class="rs-h1">Your cart</h1>
        <span class="rs-cart-head__count">{cartSummaryLine(cart)}</span>
      </div>

      {flash && (
        <Alert
          tone={flash.tone === "success" ? "success" : "danger"}
          title={flash.message}
        />
      )}
      {!cart.can_checkout && (
        <Alert
          tone="warning"
          title={`${flagged.lines} ${
            flagged.lines === 1 ? "line needs" : "lines need"
          } attention before you can place an order`}
        >
          We never remove items for you. Lower the quantity or remove the
          flagged lines.
        </Alert>
      )}

      <div class="rs-cart">
        <div class="rs-cart__lines">
          <div class="rs-cart__header" aria-hidden="true">
            <span>Item</span>
            <span>Unit price</span>
            <span>Quantity</span>
            <span class="rs-cart__header-right">Line total</span>
            <span />
          </div>
          <ul class="rs-cart__list">
            {cart.items.map((item) => (
              <CartLine key={item.variant_id} item={item} />
            ))}
          </ul>
        </div>
        <CartSummary cart={cart} />
      </div>
    </main>
  );
});

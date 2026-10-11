import { splitTotals } from "../lib/cart.ts";
import { formatNumber, unitLabel } from "../lib/format.ts";
import type { Cart } from "../lib/types.ts";
import PendingButton from "../islands/PendingButton.tsx";
import { Icon } from "./Icon.tsx";

/** Resumo do carrinho: linhas disponíveis, linhas sinalizadas, o total de todas e o checkout. */
export function CartSummary({ cart }: { cart: Cart }) {
  const { available, flagged } = splitTotals(cart);
  return (
    <aside class="rs-summary" aria-labelledby="summary-title">
      <h2 id="summary-title">Summary</h2>
      <dl class="rs-summary__rows">
        <div>
          <dt>Available lines ({available.lines})</dt>
          <dd class="rs-nums">{formatNumber(available.total)}</dd>
        </div>
        <div>
          <dt>
            Flagged lines ({flagged.lines})
            {flagged.lines > 0 && (
              <span class="rs-summary__warn">
                <Icon name="alert" />
              </span>
            )}
          </dt>
          <dd class="rs-nums">{formatNumber(flagged.total)}</dd>
        </div>
      </dl>
      <div class="rs-summary__total">
        <span>Total, all lines</span>
        <span>
          <b class="rs-nums">{formatNumber(cart.total)}</b>{" "}
          <span class="rs-muted-unit">{unitLabel(cart.total)}</span>
        </span>
      </div>
      {flagged.lines > 0 && (
        <p class="rs-summary__note">
          The total includes flagged lines, so it may drop once you fix them.
        </p>
      )}
      <form method="post" action="/orders" class="rs-summary__checkout">
        {cart.can_checkout
          ? (
            <PendingButton
              label="Place order"
              pendingLabel="Placing order…"
              variant="primary"
              block
            />
          )
          : (
            <>
              <button
                type="button"
                class="rs-btn rs-btn--block"
                disabled
                aria-describedby="why-disabled"
              >
                Place order
              </button>
              <p id="why-disabled" class="rs-summary__why">
                <Icon name="alert" />
                You can place your order once no lines are flagged.
              </p>
            </>
          )}
        <p class="rs-summary__note">
          Creates a pending order and reserves stock. You'll pay (simulated) on
          the next screen.
        </p>
      </form>
    </aside>
  );
}

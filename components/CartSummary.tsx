import { splitTotals } from "../lib/cart.ts";
import { formatNumber, unitLabel } from "../lib/format.ts";
import type { Cart } from "../lib/types.ts";
import { Icon } from "./Icon.tsx";

/** Resumo do carrinho: linhas disponíveis, linhas sinalizadas e o total de todas. */
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
    </aside>
  );
}

import type { Customer } from "../lib/types.ts";
import { Icon } from "./Icon.tsx";

function accountInitials(customer: Customer): string {
  return (customer.first_name.charAt(0) + customer.last_name.charAt(0))
    .toUpperCase() ||
    customer.username.charAt(0).toUpperCase();
}

/** Cabeçalho da loja: logo, Catalog, carrinho com contagem e a conta (ou "Sign in"). */
export function Header(
  { path, customer, cartCount }: {
    path: string;
    customer?: Customer;
    cartCount: number;
  },
) {
  const onCatalog = path === "/" || path.startsWith("/products");
  const onOrders = path.startsWith("/orders");
  const onCart = path.startsWith("/cart");
  const onAccount = path.startsWith("/account");
  const count = cartCount > 99 ? "99+" : String(cartCount);
  return (
    <header class="rs-header">
      <div class="rs-header__inner">
        <a href="/" class="rs-brand" aria-current="false">
          <span class="rs-brand__mark">R</span>
          <span class="rs-brand__name">Rust Store</span>
        </a>
        <nav class="rs-nav" aria-label="Main">
          <a href="/" aria-current={onCatalog ? "page" : "false"}>Catalog</a>
          {customer && (
            <a href="/orders" aria-current={onOrders ? "page" : "false"}>
              Orders
            </a>
          )}
        </nav>
        <div class="rs-header__actions">
          {customer && (
            <a
              href="/orders"
              class="rs-header__orders"
              aria-current={onOrders ? "page" : "false"}
              aria-label="Orders"
            >
              <Icon name="box" size={20} />
            </a>
          )}
          <a
            href="/cart"
            class="rs-header__cart"
            aria-current={onCart ? "page" : "false"}
            aria-label={`Cart, ${cartCount} ${
              cartCount === 1 ? "item" : "items"
            }`}
          >
            <Icon name="cart" size={20} />
            <span class="rs-header__cart-label">Cart</span>
            <span class="rs-count-pill">{count}</span>
          </a>
          {customer
            ? (
              <a
                href="/account"
                class="rs-header__account"
                aria-current={onAccount ? "page" : "false"}
                aria-label="My account"
              >
                <span class="rs-avatar">{accountInitials(customer)}</span>
                <span class="rs-header__account-label">My account</span>
              </a>
            )
            : (
              <a href="/signin" class="rs-header__signin" aria-current="false">
                Sign in
              </a>
            )}
        </div>
      </div>
    </header>
  );
}

import { Icon } from "./Icon.tsx";

const LINKS = [
  {
    href: "/admin/orders",
    label: "Orders",
    icon: "box" as const,
    match: "/admin/orders",
  },
  {
    href: "/admin/products",
    label: "Products",
    icon: "cart" as const,
    match: "/admin/products",
  },
];

/**
 * Navegação do console: barra lateral escura no desktop, barra superior com abas no
 * celular. "Sign out" é um formulário (só POST encerra a sessão).
 */
export function AdminNav(
  { path, username }: { path: string; username?: string },
) {
  const links = LINKS.map((link) => ({
    ...link,
    current: path.startsWith(link.match),
  }));
  return (
    <>
      <nav class="rs-adminnav" aria-label="Admin">
        <div class="rs-adminnav__brand">
          <span class="rs-brand__mark">R</span>
          <div class="rs-adminnav__title">
            <span>Rust Store</span>
            <span class="rs-adminnav__label">ADMIN CONSOLE</span>
          </div>
        </div>
        <div class="rs-adminnav__links">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              class="rs-adminnav__link"
              aria-current={link.current ? "page" : "false"}
            >
              <Icon name={link.icon} size={16} />
              {link.label}
            </a>
          ))}
        </div>
        <div class="rs-adminnav__foot">
          {username && (
            <span class="rs-adminnav__user">Signed in as {username}</span>
          )}
          <a href="/" class="rs-adminnav__foot-link" aria-current="false">
            View storefront ↗
          </a>
          <form method="post" action="/signout">
            <button
              type="submit"
              class="rs-adminnav__foot-link rs-adminnav__signout"
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>

      <div class="rs-admintop">
        <div class="rs-admintop__bar">
          <span class="rs-brand__mark">R</span>
          <span class="rs-admintop__title">Admin</span>
          <a href="/" class="rs-admintop__link" aria-current="false">
            Storefront ↗
          </a>
          <form method="post" action="/signout">
            <button
              type="submit"
              class="rs-admintop__link rs-adminnav__signout"
            >
              Sign out
            </button>
          </form>
        </div>
        <nav class="rs-admintop__tabs" aria-label="Admin sections">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              class="rs-admintop__tab"
              aria-current={link.current ? "page" : "false"}
            >
              <Icon name={link.icon} size={16} />
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </>
  );
}

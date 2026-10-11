/** Cabeçalho da loja. Carrinho e login entram com as próximas fases. */
export function Header({ path }: { path: string }) {
  const onCatalog = path === "/" || path.startsWith("/products");
  return (
    <header class="rs-header">
      <div class="rs-header__inner">
        <a href="/" class="rs-brand" aria-current="false">
          <span class="rs-brand__mark">R</span>
          <span class="rs-brand__name">Rust Store</span>
        </a>
        <nav class="rs-nav" aria-label="Main">
          <a href="/" aria-current={onCatalog ? "page" : "false"}>Catalog</a>
        </nav>
      </div>
    </header>
  );
}

import { define } from "../utils.ts";
import { THEME_SCRIPT } from "../lib/theme.ts";
import { Header } from "../components/Header.tsx";
import { Footer } from "../components/Footer.tsx";

export default define.page(function App({ Component, state, url }) {
  const adminChrome = state.role === "admin" &&
    url.pathname.startsWith("/admin");
  return (
    <html lang="en" data-theme={state.theme}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Rust Store</title>
        <link rel="stylesheet" href="/tokens.css" />
        {state.theme === undefined && (
          // Constante do código, sem entrada de usuário: roda antes da primeira pintura.
          // deno-lint-ignore react-no-danger
          <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        )}
      </head>
      <body>
        {
          /* O console de admin tem o próprio layout (routes/admin/_layout.tsx): sem o
              cabeçalho nem o rodapé da loja. */
        }
        {adminChrome ? <Component /> : (
          <>
            <Header
              path={url.pathname}
              customer={state.customer}
              cartCount={state.cartCount}
              admin={state.role === "admin"}
            />
            <Component />
            <Footer />
          </>
        )}
      </body>
    </html>
  );
});

import { define } from "../../utils.ts";
import { AdminNav } from "../../components/AdminNav.tsx";

/** Layout do console: barra lateral (ou abas, no celular) e a área de conteúdo. */
export default define.page(function AdminLayout({ Component, url, state }) {
  return (
    <div class="rs-admin">
      <AdminNav path={url.pathname} username={state.username} />
      <main class="rs-admin__content">
        <Component />
      </main>
    </div>
  );
});

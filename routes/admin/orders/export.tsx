import { define } from "../../../utils.ts";
import { exportOrdersCsv } from "../../../lib/api.ts";
import { parseOrderFilter, parseSearch } from "../../../lib/admin.ts";
import { adminAuthed, requireAdmin } from "../../../lib/guard.ts";

/**
 * Baixa os pedidos que casam com o filtro e a busca da lista, em CSV. O servidor busca o
 * arquivo na API com o token da sessão e o repassa: o navegador nunca fala com a API. Um
 * `status` desconhecido vale como "todos" e a busca é aparada, como na lista.
 */
export const handler = define.handlers({
  async GET(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;
    const status = parseOrderFilter(ctx.url.searchParams.get("status"));
    const q = parseSearch(ctx.url.searchParams.get("q"));

    const loaded = await adminAuthed(
      ctx,
      ctx.url.pathname + ctx.url.search,
      (token) =>
        exportOrdersCsv(token, {
          status: status === "all" ? undefined : status,
          q: q || undefined,
        }),
    );
    if (!loaded.ok) return loaded.response;

    const file = loaded.value;
    const headers = new Headers({
      "content-type": file.contentType,
      "content-disposition": file.disposition,
      "cache-control": "private, no-store",
      "x-total-count": String(file.total),
    });
    if (file.truncated) headers.set("x-export-truncated", "true");
    return new Response(file.body, { headers });
  },
});

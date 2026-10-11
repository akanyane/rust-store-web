/**
 * Destino seguro para `?next=`: só caminhos relativos do próprio site. Recusa `//host`,
 * `/\host`, URLs absolutas e qualquer caractere de controle, para o login não virar um
 * redirecionamento aberto.
 */
export function safeNext(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (!value || !value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // deno-lint-ignore no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  return value;
}

/** `/signin?next=<caminho>`, com `&expired=1` quando a sessão acabou. */
export function signInHref(next: string, expired = false): string {
  const query = new URLSearchParams({ next: safeNext(next) });
  if (expired) query.set("expired", "1");
  return `/signin?${query}`;
}

export type Theme = "light" | "dark";

/** Tema salvo no cookie `theme`, se for válido. Sem cookie, quem decide é o navegador. */
export function themeFromCookie(header: string | null): Theme | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "theme") {
      const value = rest.join("=");
      return value === "light" || value === "dark" ? value : undefined;
    }
  }
  return undefined;
}

/**
 * Sem cookie, o servidor não sabe a preferência do sistema. Este script curto no `<head>`
 * define `data-theme` antes da primeira pintura, para a página não piscar.
 */
export const THEME_SCRIPT =
  `document.documentElement.dataset.theme=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";`;

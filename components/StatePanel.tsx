import type { ComponentChildren } from "preact";
import { Icon } from "./Icon.tsx";

/** Painel de estado: catálogo vazio, falha ao carregar, página não encontrada. */
export function StatePanel(
  { title, children, tone = "neutral", code, action }: {
    title: string;
    children: ComponentChildren;
    tone?: "neutral" | "danger";
    code?: string;
    action?: { href: string; label: string };
  },
) {
  return (
    <main class="rs-main">
      <div class="rs-state" role={tone === "danger" ? "alert" : undefined}>
        <span
          class={`rs-state__icon ${
            tone === "danger" ? "rs-state__icon--danger" : ""
          }`}
        >
          {tone === "danger" && <Icon name="alert" size={22} />}
        </span>
        {code && <span class="rs-state__code">{code}</span>}
        <h1>{title}</h1>
        <p>{children}</p>
        {action && (
          <a class="rs-btn" href={action.href} aria-current="false">
            {action.label}
          </a>
        )}
      </div>
    </main>
  );
}

import type { ComponentChildren } from "preact";
import { Icon } from "./Icon.tsx";

type Tone = "danger" | "warning" | "success" | "info";

/** Faixa de aviso (erro, atenção, sucesso). Erros e avisos usam `role="alert"`. */
export function Alert(
  { tone, title, children, id, focus }: {
    tone: Tone;
    title?: string;
    children?: ComponentChildren;
    id?: string;
    /** Leva o foco para o aviso ao carregar a página (erros de formulário). */
    focus?: boolean;
  },
) {
  const urgent = tone === "danger" || tone === "warning";
  return (
    <div
      id={id}
      class={`rs-alert rs-alert--${tone}`}
      role={urgent ? "alert" : "status"}
      tabindex={focus ? -1 : undefined}
      autofocus={focus}
    >
      <span class="rs-alert__icon">
        <Icon name={tone === "success" ? "check" : "alert"} />
      </span>
      <div class="rs-alert__body">
        {title && <b>{title}</b>}
        {children && <span>{children}</span>}
      </div>
    </div>
  );
}

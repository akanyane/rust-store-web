import type { ComponentChildren } from "preact";

/** Cartão centralizado das telas de entrar e cadastrar. */
export function AuthCard(
  { title, subtitle, children }: {
    title: string;
    subtitle?: string;
    children: ComponentChildren;
  },
) {
  return (
    <main class="rs-auth">
      <div class="rs-auth__card">
        <div class="rs-auth__head">
          <h1>{title}</h1>
          {subtitle && <span>{subtitle}</span>}
        </div>
        {children}
      </div>
    </main>
  );
}

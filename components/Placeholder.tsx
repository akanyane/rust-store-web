import { initials, placeholderIndex } from "../lib/format.ts";

/** Bloco colorido com as iniciais: a API não tem imagens de produto. */
export function Placeholder(
  { id, name, class: className = "" }: {
    id: string;
    name: string;
    class?: string;
  },
) {
  return (
    <div
      class={`rs-ph rs-ph--${placeholderIndex(id)} ${className}`}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}

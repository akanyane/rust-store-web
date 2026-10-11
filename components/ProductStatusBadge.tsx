import { Icon } from "./Icon.tsx";

/** Selo "Active" / "Inactive" de produto e variante (ícone mais palavra). */
export function ProductStatusBadge({ active }: { active: boolean }) {
  return (
    <span
      class={`rs-badge ${active ? "rs-badge--success" : "rs-badge--neutral"}`}
    >
      <Icon name={active ? "check" : "pause"} size={14} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

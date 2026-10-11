import { statusInfo } from "../lib/orders.ts";
import type { OrderStatus } from "../lib/types.ts";
import { Icon } from "./Icon.tsx";

/** Selo do status do pedido: ícone mais palavra (a cor nunca é o único sinal). */
export function StatusBadge(
  { status, large }: { status: OrderStatus; large?: boolean },
) {
  const info = statusInfo(status);
  return (
    <span
      class={`rs-badge rs-badge--${info.tone} ${large ? "rs-badge--lg" : ""}`}
    >
      <Icon name={info.icon} size={large ? 15 : 14} />
      {info.label}
    </span>
  );
}

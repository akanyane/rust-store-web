import { timelineSteps } from "../lib/orders.ts";
import type { Order } from "../lib/types.ts";
import { Icon } from "./Icon.tsx";

/** Placed → Paid → Shipped → Delivered. Horizontal no desktop, vertical no celular. */
export function OrderTimeline({ order }: { order: Order }) {
  const steps = timelineSteps(order);
  if (!steps) return null;
  return (
    <ol class="rs-timeline" aria-label="Order progress">
      {steps.map((step, index) => (
        <li
          key={step.key}
          class={`rs-timeline__step rs-timeline__step--${step.state}`}
          aria-current={step.state === "current" ? "step" : undefined}
        >
          <div class="rs-timeline__track">
            <span class="rs-timeline__dot">
              {step.state === "done" && <Icon name="check" size={12} />}
              {step.state === "current" && <span class="rs-timeline__now" />}
            </span>
            {index < steps.length - 1 && <span class="rs-timeline__line" />}
          </div>
          <div class="rs-timeline__text">
            <span class="rs-timeline__label">{step.label}</span>
            {step.meta && <span class="rs-timeline__meta">{step.meta}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}

import { useSignal } from "@preact/signals";

interface Props {
  /** Nome do campo no formulário (o valor viaja num `<input type="number">`). */
  name: string;
  /** Para o leitor de tela: "Quantity for 50 g tin". */
  label: string;
  /** Estoque: a quantidade nunca passa dele. */
  max: number;
  initial?: number;
}

/**
 * Seletor de quantidade da página de produto. O valor mora num campo numérico de verdade,
 * então, sem JavaScript, ainda dá para digitar e enviar; com JavaScript, − e + ajustam
 * respeitando os limites 1 e o estoque.
 */
export default function QuantityStepper(
  { name, label, max, initial = 1 }: Props,
) {
  const value = useSignal(initial);
  const clamp = (n: number) => Math.min(Math.max(1, Math.trunc(n) || 1), max);

  return (
    <div class="rs-stepper" role="group" aria-label={`Quantity for ${label}`}>
      <button
        type="button"
        class="rs-stepper__btn"
        aria-label="Decrease"
        disabled={value.value <= 1}
        onClick={() => (value.value = clamp(value.value - 1))}
      >
        −
      </button>
      <input
        class="rs-stepper__input"
        type="number"
        name={name}
        min={1}
        max={max}
        inputMode="numeric"
        aria-label="Quantity"
        value={value}
        onInput={(
          event,
        ) => (value.value = clamp(Number(event.currentTarget.value)))}
      />
      <button
        type="button"
        class="rs-stepper__btn"
        aria-label="Increase"
        disabled={value.value >= max}
        onClick={() => (value.value = clamp(value.value + 1))}
      >
        +
      </button>
    </div>
  );
}

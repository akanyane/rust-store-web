interface Option {
  value: string;
  label: string;
}

interface Props {
  /** Texto do rótulo ("Status"). */
  label: string;
  /** Nome do parâmetro de consulta (`status`). */
  name: string;
  /** Valor atual. */
  value: string;
  options: Option[];
  /** Para onde o formulário GET vai. */
  action: string;
  /** Outros parâmetros que a troca de filtro mantém (a busca, a ordem). */
  hidden?: Record<string, string>;
}

/**
 * O filtro como `select`, para o celular. Trocar a opção envia o formulário na hora; sem
 * JavaScript sobra o botão "Apply" (o formulário é um GET comum).
 */
export default function FilterSelect(
  { label, name, value, options, action, hidden = {} }: Props,
) {
  const id = `filter-${name}`;
  return (
    <form method="get" action={action} class="rs-filterselect">
      {Object.entries(hidden).map(([key, val]) => (
        <input key={key} type="hidden" name={key} value={val} />
      ))}
      <label for={id} class="rs-filter__label">{label}</label>
      <select
        id={id}
        name={name}
        class="rs-select"
        onChange={(event) => event.currentTarget.form?.submit()}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            selected={option.value === value}
          >
            {option.label}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" class="rs-btn">Apply</button>
      </noscript>
    </form>
  );
}

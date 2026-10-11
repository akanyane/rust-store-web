import { Icon } from "./Icon.tsx";

interface FieldProps {
  label: string;
  name: string;
  type?: string;
  value?: string;
  error?: string;
  hint?: string;
  autocomplete?: string;
  placeholder?: string;
  inputMode?: "text" | "numeric";
  readOnly?: boolean;
  autofocus?: boolean;
  required?: boolean;
  /** Mostra uma área de texto de várias linhas no lugar do campo de uma linha. */
  rows?: number;
  /** Texto à direita do campo (ex.: "unidades"). */
  suffix?: string;
}

/** Campo de formulário com rótulo, dica e erro (o erro liga ao campo por `aria-describedby`). */
export function Field(props: FieldProps) {
  const { label, name, type = "text", value = "", error, hint } = props;
  const describedBy = [error ? `${name}-error` : "", hint ? `${name}-hint` : ""]
    .filter(Boolean).join(" ");
  const common = {
    id: name,
    name,
    class: `rs-input ${error ? "rs-input--error" : ""}`,
    "aria-invalid": error ? ("true" as const) : undefined,
    "aria-describedby": describedBy || undefined,
  };

  const control = props.rows
    ? (
      <textarea
        {...common}
        rows={props.rows}
        class={`${common.class} rs-textarea`}
      >
        {value}
      </textarea>
    )
    : (
      <input
        {...common}
        type={type}
        value={value}
        autocomplete={props.autocomplete}
        autofocus={props.autofocus}
        placeholder={props.placeholder}
        inputMode={props.inputMode}
        readOnly={props.readOnly}
        required={props.required}
      />
    );

  return (
    <label class="rs-field" for={name}>
      <span class="rs-field__label">{label}</span>
      {props.suffix
        ? (
          <span class="rs-suffix">
            {control}
            <span class="rs-suffix__text">{props.suffix}</span>
          </span>
        )
        : control}
      {error && (
        <span id={`${name}-error`} class="rs-field__error">
          <Icon name="alert" />
          {error}
        </span>
      )}
      {hint && <span id={`${name}-hint`} class="rs-field__hint">{hint}</span>}
    </label>
  );
}

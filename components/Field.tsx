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
  required?: boolean;
}

/** Campo de formulário com rótulo, dica e erro (o erro liga ao campo por `aria-describedby`). */
export function Field(props: FieldProps) {
  const { label, name, type = "text", value = "", error, hint } = props;
  const describedBy = [error ? `${name}-error` : "", hint ? `${name}-hint` : ""]
    .filter(Boolean).join(" ");
  return (
    <label class="rs-field" for={name}>
      <span class="rs-field__label">{label}</span>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        class={`rs-input ${error ? "rs-input--error" : ""}`}
        autocomplete={props.autocomplete}
        placeholder={props.placeholder}
        inputMode={props.inputMode}
        readOnly={props.readOnly}
        required={props.required}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy || undefined}
      />
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

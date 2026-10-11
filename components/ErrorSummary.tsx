import { Alert } from "./Alert.tsx";

/** "Please fix N fields" com um link para cada campo com erro. */
export function ErrorSummary(
  { errors, labels }: {
    errors: Record<string, string>;
    labels: Record<string, string>;
  },
) {
  const entries = Object.entries(errors);
  if (entries.length === 0) return null;
  return (
    <Alert
      tone="danger"
      focus
      id="form-errors"
      title={`Please fix ${entries.length} ${
        entries.length === 1 ? "field" : "fields"
      }`}
    >
      <ul class="rs-alert__list">
        {entries.map(([name, message]) => (
          <li key={name}>
            <a href={`#${name}`} aria-current="false">
              {labels[name] ?? name}: {message}
            </a>
          </li>
        ))}
      </ul>
    </Alert>
  );
}

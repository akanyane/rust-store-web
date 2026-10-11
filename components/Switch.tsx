/** Chave "Active": um checkbox de verdade (role=switch), então funciona sem JavaScript. */
export function Switch(
  { name, label, checked }: { name: string; label: string; checked: boolean },
) {
  return (
    <label class="rs-switch">
      <input
        type="checkbox"
        role="switch"
        name={name}
        value="on"
        checked={checked}
      />
      <span class="rs-switch__track" aria-hidden="true">
        <span class="rs-switch__thumb" />
      </span>
      {label}
    </label>
  );
}

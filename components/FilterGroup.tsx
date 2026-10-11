/** Grupo de links de filtro ("All | Pending | Paid…"): GET, funciona sem JavaScript. */
export function FilterGroup(
  { label, items }: {
    label: string;
    items: { label: string; href: string; current: boolean }[];
  },
) {
  return (
    <div class="rs-filter">
      <span class="rs-filter__label">{label}</span>
      <div role="group" aria-label={label} class="rs-segmented">
        {items.map((item) => (
          <a
            key={item.label}
            href={item.href}
            aria-current={item.current ? "true" : "false"}
          >
            {item.label}
          </a>
        ))}
      </div>
    </div>
  );
}

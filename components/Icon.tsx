// Ícones de traço simples (1,8px, pontas redondas), como no design. Quase todos têm grade
// 16×16; o do carrinho, usado no cabeçalho, vem numa grade de 20.
interface IconDef {
  grid: number;
  paths: readonly string[];
}

const ICONS = {
  check: { grid: 16, paths: ["M3.5 8.5l3 3 6-7"] },
  x: { grid: 16, paths: ["M4.5 4.5l7 7M11.5 4.5l-7 7"] },
  alert: { grid: 16, paths: ["M8 2.5l6 11H2z", "M8 7v3", "M8 12.2v.1"] },
  trash: {
    grid: 16,
    paths: [
      "M3 5h10",
      "M6.5 5V3.5h3V5",
      "M4.5 5l.6 8h5.8l.6-8",
      "M7 7.5v3.5M9 7.5v3.5",
    ],
  },
  lock: { grid: 16, paths: ["M4.5 7.5h7v5.5h-7z", "M6 7.5V6a2 2 0 014 0v1.5"] },
  cart: {
    grid: 20,
    paths: ["M2.5 3.5h2l1.8 9h9l1.7-6.5H6", "M8 16.5h.1M14.5 16.5h.1"],
  },
} as const satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 14 }: { name: IconName; size?: number }) {
  const icon: IconDef = ICONS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${icon.grid} ${icon.grid}`}
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {icon.paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

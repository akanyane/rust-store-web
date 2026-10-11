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
  dashboard: {
    grid: 16,
    paths: [
      "M2.5 2.5h4.5v4.5H2.5z",
      "M9 2.5h4.5v4.5H9z",
      "M2.5 9h4.5v4.5H2.5z",
      "M9 9h4.5v4.5H9z",
    ],
  },
  pause: { grid: 16, paths: ["M5.5 4v8M10.5 4v8"] },
  clock: {
    grid: 16,
    paths: ["M8 14A6 6 0 108 2a6 6 0 000 12z", "M8 5v3l2 1.5"],
  },
  coin: { grid: 16, paths: ["M8 14A6 6 0 108 2a6 6 0 000 12z", "M5.5 8h5"] },
  box: {
    grid: 16,
    paths: [
      "M2.5 5L8 2.5 13.5 5v6L8 13.5 2.5 11z",
      "M2.5 5L8 7.5 13.5 5",
      "M8 7.5v6",
    ],
  },
  info: {
    grid: 16,
    paths: ["M8 14A6 6 0 108 2a6 6 0 000 12z", "M8 7.5V11", "M8 5v.1"],
  },
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

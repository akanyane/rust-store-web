// Ícones de traço simples (16×16, 1,8px, pontas redondas), como no design.
const PATHS = {
  check: ["M3.5 8.5l3 3 6-7"],
  x: ["M4.5 4.5l7 7M11.5 4.5l-7 7"],
  alert: ["M8 2.5l6 11H2z", "M8 7v3", "M8 12.2v.1"],
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 14 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {PATHS[name].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

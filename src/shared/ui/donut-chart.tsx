import { Pie, PieChart } from 'recharts';
import { type Tone } from './tone';

export interface DonutSlice {
  readonly label: string;
  readonly value: number;
  readonly tone: Tone;
}

const FILL: Record<Tone, string> = {
  success: 'var(--color-success-fg)',
  info: 'var(--color-info-fg)',
  warning: 'var(--color-warning-fg)',
  danger: 'var(--color-danger-fg)',
  neutral: 'var(--color-ink-muted)',
  accent: 'var(--color-accent-fg)',
};

/** A donut with its total in the middle and a legend that carries the numbers (Recharts). */
export function DonutChart({
  title,
  slices,
  size = 180,
}: {
  title: string;
  slices: readonly DonutSlice[];
  size?: number;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const summary = `${title}: ${slices.map((s) => `${s.label} ${s.value}`).join(', ')}`;
  return (
    <figure className="flex items-center gap-6">
      <div
        className="relative"
        style={{ width: size, height: size }}
        role="img"
        aria-label={summary}
      >
        <PieChart width={size} height={size}>
          <Pie
            data={slices.filter((s) => s.value > 0).map((s) => ({ ...s, fill: FILL[s.tone] }))}
            dataKey="value"
            nameKey="label"
            innerRadius={size * 0.32}
            outerRadius={size * 0.48}
            paddingAngle={slices.length > 1 ? 2 : 0}
            isAnimationActive={false}
            stroke="none"
          />
        </PieChart>
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
          aria-hidden
        >
          <span className="text-2xl font-bold text-ink">{total}</span>
        </div>
      </div>
      <figcaption>
        <p className="mb-2 text-sm font-semibold text-ink">{title}</p>
        <ul className="space-y-1 text-sm">
          {slices.map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-ink-secondary">
              <span
                className="size-2.5 rounded-pill"
                style={{ background: FILL[s.tone] }}
                aria-hidden
              />
              {s.label}
              <span className="ml-auto pl-4 font-semibold text-ink">{s.value}</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

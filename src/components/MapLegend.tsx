import clsx from 'clsx';
import { candFill, mapFill } from '../lib/ui/color';
import { titleCase } from '../lib/ui/format';

export interface LegendItem {
  key: string;
  name: string;
  color: string;
  count: number;
}

interface Props {
  items: LegendItem[];
  unit: string;
  className?: string;
}

export function MapLegend({ items, unit, className }: Props) {
  return (
    <div className={clsx('flex flex-col gap-3', className)}>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {items.map((it) => (
          <li key={it.key} className="flex items-center gap-2 text-caption text-ink-2">
            <span className="size-2.5 rounded-[3px]" style={{ background: candFill(it.color) }} aria-hidden />
            <span className="font-medium text-ink">{titleCase(it.name)}</span>
            <span className="tnum font-mono text-micro text-ink-3">
              {it.count} {unit}
            </span>
          </li>
        ))}
        <li className="flex items-center gap-2 text-caption text-ink-3">
          <span className="size-2.5 rounded-[3px] bg-map-neutral shadow-[inset_0_0_0_1px_var(--line)]" aria-hidden />
          Sem votos ou empate
        </li>
      </ul>
      {items[0] && (
        <div className="flex items-center gap-2 font-mono text-micro text-ink-3">
          <span>vantagem</span>
          <span
            className="h-1.5 w-16 rounded-full"
            style={{
              background: `linear-gradient(90deg, ${mapFill(items[0].color, 0)}, ${mapFill(items[0].color, 1)})`,
            }}
            aria-hidden
          />
          <span>maior</span>
        </div>
      )}
    </div>
  );
}

import clsx from 'clsx';
import { candFill } from '../lib/ui/color';
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
  hasError?: boolean;
  layout?: 'stack' | 'row';
  className?: string;
}

/** Legenda: cor de cada candidato com quantas áreas lidera, mais os estados sem cor. */
export function MapLegend({ items, unit, hasError, layout = 'stack', className }: Props) {
  const row = layout === 'row';
  return (
    <div
      className={clsx(
        row ? 'flex items-center gap-x-3 gap-y-1' : 'float flex w-52 flex-col gap-1.5 rounded-xl px-3 py-2.5',
        className,
      )}
      aria-label="Legenda do mapa"
    >
      {!row && <p className="eyebrow mb-0.5">Quem lidera</p>}
      {items.map((it) => (
        <p key={it.key} className="flex items-center gap-2 whitespace-nowrap text-caption">
          <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: candFill(it.color) }} aria-hidden />
          <span className="min-w-0 flex-1 truncate font-medium text-ink">{titleCase(it.name)}</span>
          <span className="tnum font-mono text-nano text-ink-3">
            {it.count} {unit}
          </span>
        </p>
      ))}
      <p className="flex items-center gap-2 whitespace-nowrap text-caption text-ink-3">
        <span className="size-2.5 shrink-0 rounded-[3px] bg-map-neutral" aria-hidden />
        Sem votos ou empate
      </p>
      {hasError && (
        <p className="flex items-center gap-2 whitespace-nowrap text-caption text-ink-3">
          <svg width="10" height="10" className="shrink-0 rounded-[3px]" aria-hidden>
            <rect width="10" height="10" fill="url(#map-hatch)" />
          </svg>
          Sem resposta do TSE
        </p>
      )}
      {!row && items[0] && (
        <p className="mt-1 border-t border-line pt-1.5 text-nano text-ink-3">Cor mais forte, vantagem maior</p>
      )}
    </div>
  );
}

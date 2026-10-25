import type { Ref } from 'react';
import clsx from 'clsx';
import { candFill } from '../lib/ui/color';
import { fmtPct1, titleCase } from '../lib/ui/format';

export interface HoverInfo {
  kind: 'state' | 'mun';
  id: string;
  title: string;
  tag: string;
  loading: boolean;
  note?: string;
  leader?: { name: string; color: string; pct: number; margin: number };
}

interface Props {
  info: HoverInfo | null;
  awaiting: boolean;
  ref?: Ref<HTMLDivElement>;
}

/** Tooltip do mapa: segue o cursor (posição definida pelo mapa via ref). */
export function MapTooltip({ info, awaiting, ref }: Props) {
  return (
    <div
      ref={ref}
      className={clsx(
        'tooltip absolute left-0 top-0 z-30 w-56 px-3.5 py-3 transition-opacity duration-150',
        info ? 'opacity-100' : 'opacity-0',
      )}
      aria-hidden
    >
      {info && (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-small font-medium text-ink">{info.title}</p>
            <span className="shrink-0 font-mono text-micro text-ink-3">{info.tag}</span>
          </div>
          <div className="mt-2 border-t border-line pt-2">
            {info.note ? (
              <p className="text-caption text-ink-3">{info.note}</p>
            ) : info.loading ? (
              <p className="text-caption text-ink-3">Carregando…</p>
            ) : info.leader ? (
              <>
                <p className="flex items-center gap-2 text-caption text-ink-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: candFill(info.leader.color) }} />
                  <span className="min-w-0 flex-1 truncate">
                    {info.leader.name ? titleCase(info.leader.name) : 'Líder'}
                  </span>
                  <span className="tnum font-medium text-ink">{fmtPct1(info.leader.pct)}</span>
                </p>
                {info.leader.margin > 0 && (
                  <p className="tnum mt-1 pl-4 font-mono text-micro text-ink-3">
                    {fmtPct1(info.leader.margin).replace('%', '')} p.p. à frente
                  </p>
                )}
              </>
            ) : (
              <p className="text-caption text-ink-3">{awaiting ? 'Aguardando os primeiros votos' : 'Sem liderança: empate ou sem votos'}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

import type { CSSProperties, Ref } from 'react';
import clsx from 'clsx';
import { candFill } from '../lib/ui/color';
import { fmtPct1, titleCase } from '../lib/ui/format';
import type { RegionView } from '../lib/ui/regions';
import { Icon } from './ui/Icon';

export interface HoverInfo {
  kind: 'state' | 'mun';
  id: string;
  title: string;
  tag: string;
  view?: RegionView;
  note?: string;
}

interface Props {
  info: HoverInfo | null;
  awaiting: boolean;
  /** mobile: cartão fixo no topo do mapa, com botão de fechar */
  docked?: boolean;
  onClose?: () => void;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

export function MapTooltip({ info, awaiting, docked, onClose, style, ref }: Props) {
  return (
    <div
      ref={ref}
      style={style}
      role={docked ? 'status' : undefined}
      aria-hidden={docked ? undefined : true}
      className={clsx(
        'tooltip z-30 w-56 px-3 py-2.5 transition-opacity duration-150',
        docked ? 'pointer-events-auto absolute left-1/2 -translate-x-1/2' : 'absolute left-0 top-0',
        info ? 'opacity-100' : 'opacity-0',
      )}
    >
      {info && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-small font-medium text-ink">{info.title}</p>
            <span className="shrink-0 font-mono text-nano text-ink-3">{info.tag}</span>
            {docked && onClose && (
              <button type="button" onClick={onClose} className="btn btn-icon -my-2 -mr-2 shrink-0" aria-label="Fechar">
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
          <div className="mt-1.5 border-t border-line pt-1.5">
            <Body view={info.view} note={info.note} awaiting={awaiting} />
          </div>
        </>
      )}
    </div>
  );
}

function Body({ view, note, awaiting }: { view?: RegionView; note?: string; awaiting: boolean }) {
  if (note) return <p className="text-caption text-ink-3">{note}</p>;
  if (!view || view.status === 'loading') return <p className="text-caption text-ink-3">Carregando…</p>;
  if (view.status === 'off') return <p className="text-caption text-ink-3">Sem 2º turno para este cargo</p>;
  if (view.status === 'error') return <p className="text-caption text-ink-3">O TSE não respondeu para esta área.</p>;
  if (view.status === 'neutral')
    return (
      <p className="text-caption text-ink-3">
        {view.note === 'Empate' ? 'Empate entre os primeiros' : awaiting ? 'Aguardando os primeiros votos' : view.note}
      </p>
    );
  return (
    <>
      <p className="flex items-center gap-2 text-caption text-ink-2">
        <span className="size-2 shrink-0 rounded-full" style={{ background: candFill(view.color ?? '#888') }} />
        <span className="min-w-0 flex-1 truncate">{view.leaderName ? titleCase(view.leaderName) : 'Líder'}</span>
        <span className="tnum font-medium text-ink">{fmtPct1(view.pct)}</span>
      </p>
      {view.votes !== undefined && (
        <p className="mt-1 text-caption text-ink-3">
          {view.votes.toLocaleString('pt-BR')} votos · {view.rank ? `${view.rank}º lugar` : 'Sem candidatura neste local'}
        </p>
      )}
      {view.margin > 0 && (
        <p className="tnum mt-0.5 pl-4 font-mono text-nano text-ink-3">{fmtPct1(view.margin).replace('%', '')} p.p. à frente</p>
      )}
    </>
  );
}

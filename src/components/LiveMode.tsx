import clsx from 'clsx';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { CandidateRow, ParsedResult } from '../lib/tse/types';
import { candFill, candText } from '../lib/ui/color';
import { fmtUpdatedAt, titleCase } from '../lib/ui/format';
import { CandidateAvatar } from './CandidateAvatar';
import { StatusPill } from './Status';
import { Icon } from './ui/Icon';
import { Int, Pct } from './ui/Num';
import type { Insets } from './BrazilMap';

/**
 * Modo live: tela limpa para quem transmite. Mapa à esquerda, placar grande à
 * direita (ou embaixo, em tela em pé). Usa os mesmos dados e o mesmo ritmo de
 * atualização da página; não faz nenhuma consulta extra ao TSE.
 */
export function LiveMode({
  map,
  sources,
  data,
  stale,
  title,
  context,
  round,
  photoUf,
  cam,
  onCam,
  onExit,
  onInsets,
}: {
  map: ReactNode;
  sources: ReactNode;
  data: ParsedResult | null;
  stale: boolean;
  title: string;
  context: string;
  round: number;
  photoUf: string;
  cam: boolean;
  onCam: () => void;
  onExit: () => void;
  onInsets: (i: Insets) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const colRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const f = frameRef.current?.getBoundingClientRect();
      const h = headRef.current?.getBoundingClientRect();
      const c = colRef.current?.getBoundingClientRect();
      if (!f || !h || !c) return;
      const side = c.top - f.top < f.height / 3;
      onInsets(
        side
          ? { top: h.bottom - f.top + 8, right: f.right - c.left + 8, bottom: 24, left: 24 }
          : { top: h.bottom - f.top + 8, right: 0, bottom: f.bottom - c.top + 8, left: 0 },
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    for (const r of [frameRef, headRef, colRef]) if (r.current) ro.observe(r.current);
    return () => ro.disconnect();
  }, [onInsets, cam]);

  const list = data?.candidates.slice(0, data.candidates.length <= 2 ? 2 : 4) ?? [];
  const duel = list.length === 2;

  return (
    <div ref={frameRef} className="live-mode relative h-dvh overflow-hidden bg-bg" data-live data-cam={cam || undefined}>
      {sources}
      {map}

      <div ref={headRef} className="pointer-events-none absolute left-6 top-6 z-20 flex max-w-[55%] flex-col gap-2 max-[899px]:left-4 max-[899px]:top-4 max-[899px]:max-w-[calc(100%-4.5rem)]">
        <span className="flex items-center gap-2.5 font-mono text-[clamp(0.75rem,0.95vw,1rem)] uppercase tracking-wider text-ink-3">
          Apuração 2026 · {round}º turno
          <StatusPill data={data} />
        </span>
        <h1 className="text-[clamp(1.75rem,3.4vw,3.25rem)] font-semibold leading-[1.05] text-ink">
          {context.split(' · ')[0]} · {title}
        </h1>
      </div>

      <div className="live-ctl absolute right-4 top-4 z-40 flex items-center gap-1">
        <button
          type="button"
          className={clsx('btn gap-1.5 px-2.5 max-[899px]:hidden', cam && 'bg-hover text-ink')}
          aria-pressed={cam}
          onClick={onCam}
          title="Reserva um canto vazio para a sua câmera"
        >
          <Icon name="camera" size={15} /> Câmera
        </button>
        <button type="button" className="btn btn-icon" onClick={onExit} aria-label="Sair do modo live (Esc)" title="Sair (Esc)">
          <Icon name="close" size={16} />
        </button>
      </div>

      <div
        ref={colRef}
        className={clsx(
          'absolute z-30 flex flex-col gap-4',
          'min-[900px]:bottom-6 min-[900px]:right-6 min-[900px]:top-20 min-[900px]:w-[clamp(400px,34vw,620px)]',
          'max-[899px]:inset-x-3 max-[899px]:bottom-3',
        )}
      >
        <section
          className={clsx(
            'flex shrink-0 flex-col rounded-[24px] bg-raised/95 shadow-2xl backdrop-blur',
            cam ? 'gap-3 p-5' : 'gap-6 p-7 min-[900px]:my-auto',
            'max-[899px]:gap-3 max-[899px]:p-4',
          )}
          aria-live="polite"
        >
          {!data ? (
            <p className="text-body text-ink-3">Carregando os números do TSE…</p>
          ) : duel ? (
            <Duel a={list[0]} b={list[1]} data={data} photoUf={photoUf} compact={cam} />
          ) : (
            <ul className="flex flex-col gap-3">
              {list.map((c) => (
                <li key={c.sqcand} className="flex items-center gap-4">
                  <CandidateAvatar candidate={c} electionId={data.electionId} photoUf={photoUf} size={cam ? 44 : 56} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[1.375rem] font-medium text-ink">{titleCase(c.shortName)}</p>
                    <p className="font-mono text-small text-ink-3">
                      {c.party} · <Int value={c.votes} /> votos
                    </p>
                  </div>
                  <span className="shrink-0" style={{ color: c.percent > 0 ? candText(c.color) : undefined }}>
                    <Pct value={c.percent} className="text-[2.5rem] font-medium tracking-[-0.03em]" />
                  </span>
                </li>
              ))}
            </ul>
          )}

          {data && (
            <div className={clsx('grid grid-cols-2 gap-4 border-t border-line', cam ? 'pt-3' : 'pt-6', 'max-[899px]:pt-3')}>
              <div>
                <p className="font-mono text-[clamp(0.75rem,0.9vw,0.95rem)] uppercase tracking-wider text-ink-3">Apurado</p>
                <p className="mt-1 text-[clamp(1.5rem,2.4vw,2.25rem)] font-medium leading-tight text-ink">
                  <Pct value={data.turnout.sectionsPct} />
                </p>
                <p className="font-mono text-[clamp(0.7rem,0.8vw,0.85rem)] text-ink-3">das seções</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[clamp(0.75rem,0.9vw,0.95rem)] uppercase tracking-wider text-ink-3">{stale ? 'Atualizando' : 'Atualizado às'}</p>
                <p className="mt-1 text-[clamp(1.5rem,2.4vw,2.25rem)] font-medium leading-tight text-ink tnum">
                  {fmtUpdatedAt(data.updatedAt).split(' às ')[1] ?? fmtUpdatedAt(data.updatedAt)}
                </p>
                <p className="font-mono text-[clamp(0.7rem,0.8vw,0.85rem)] text-ink-3">horário de Brasília</p>
              </div>
            </div>
          )}
          {!cam && <p className="font-mono text-[clamp(0.8rem,0.95vw,1rem)] text-ink-3 max-[899px]:hidden">apuracao.lenderson.com.br</p>}
        </section>

        {cam && (
          <div
            className="cam-slot relative min-h-[22vh] w-full flex-1 max-[899px]:hidden"
            aria-label="Espaço reservado para a câmera"
            data-cam-slot
          />
        )}
      </div>
    </div>
  );
}

function Duel({ a, b, data, photoUf, compact }: { a: CandidateRow; b: CandidateRow; data: ParsedResult; photoUf: string; compact: boolean }) {
  const total = a.percent + b.percent || 1;
  const started = a.votes + b.votes > 0;
  const lead = a.votes >= b.votes ? a : b;
  const diff = Math.abs(a.votes - b.votes);
  const big = compact ? 'text-[clamp(2.5rem,min(4.4vw,7.5vh),4.25rem)]' : 'text-[clamp(3rem,min(5.6vw,10vh),5.75rem)]';
  return (
    <>
      {[a, b].map((c) => (
        <div key={c.sqcand} className="flex items-center gap-5 max-[899px]:gap-3">
          <CandidateAvatar candidate={c} electionId={data.electionId} photoUf={photoUf} size={compact ? 56 : 84} className="max-[899px]:size-12!" />
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-baseline gap-2.5">
              <span className="truncate text-[clamp(1.25rem,1.9vw,1.75rem)] font-medium text-ink">{titleCase(c.shortName)}</span>
              <span className="shrink-0 font-mono text-[clamp(0.8rem,1vw,1.0625rem)] text-ink-3">
                {c.party} {c.number}
              </span>
            </p>
            <span className="block" style={{ color: c.percent > 0 ? candText(c.color) : undefined }}>
              <Pct value={c.percent} className={clsx(big, 'font-medium leading-none tracking-[-0.035em] max-[899px]:text-[2.5rem]!')} />
            </span>
            <p className={clsx(compact ? 'mt-1' : 'mt-2', 'font-mono text-[clamp(0.9rem,1.2vw,1.3rem)] text-ink-2 tnum')}>
              <Int value={c.votes} /> votos
            </p>
          </div>
        </div>
      ))}
      <div>
        <div className="flex h-3 overflow-hidden rounded-full bg-hover">
          <span style={{ width: `${started ? (a.percent / total) * 100 : 50}%`, background: started ? candFill(a.color) : undefined }} />
          <span className="flex-1" style={{ background: started ? candFill(b.color) : undefined }} />
        </div>
        <p className="mt-3 text-[clamp(1rem,1.4vw,1.375rem)] text-ink-2">
          {!started ? (
            'A apuração ainda não começou'
          ) : diff === 0 ? (
            'Empate'
          ) : (
            <>
              <span className="font-medium" style={{ color: candText(lead.color) }}>
                {titleCase(lead.shortName)}
              </span>{' '}
              tem <Int value={diff} className="font-medium text-ink" /> votos de vantagem
            </>
          )}
        </p>
      </div>
    </>
  );
}

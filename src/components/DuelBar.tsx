import { useLayoutEffect, useRef } from 'react';
import clsx from 'clsx';
import gsap from 'gsap';
import type { CandidateRow } from '../lib/tse/types';
import { candFill } from '../lib/ui/color';
import { fmtPct } from '../lib/ui/format';
import { dur } from '../lib/ui/motion';
import { Tooltip } from './ui/Tooltip';

interface Props {
  candidates: CandidateRow[];
  /** mostra a marca de 50% dos votos válidos */
  majority?: boolean;
  majorityHint?: string;
  size?: 'lg' | 'sm';
  /** até quantos candidatos ganham segmento próprio; o resto vira "outros" */
  maxSegments?: number;
}

interface Segment {
  key: string;
  label: string;
  pct: number;
  color: string;
}

/**
 * Barra de disputa. Com 2 candidatos, cada um cresce de uma ponta (estilo
 * cabo de guerra). Com mais, vira barra empilhada em ordem de votos.
 */
export function DuelBar({ candidates, majority, majorityHint, size = 'lg', maxSegments = 4 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const total = candidates.reduce((s, c) => s + c.percent, 0);
  const started = total > 0;
  const duel = candidates.length === 2;

  const segments: Segment[] = [];
  if (started) {
    const named = candidates.slice(0, maxSegments);
    for (const c of named) {
      segments.push({ key: c.sqcand, label: c.shortName, pct: c.percent, color: candFill(c.color) });
    }
    const rest = candidates.slice(maxSegments).reduce((s, c) => s + c.percent, 0);
    if (rest > 0) segments.push({ key: 'outros', label: 'Outros', pct: rest, color: 'var(--text-4)' });
  }

  const sig = segments.map((s) => `${s.key}:${s.pct}`).join('|');

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const nodes = el.querySelectorAll<HTMLElement>('[data-seg]');
    nodes.forEach((n) => {
      gsap.to(n, {
        width: `${n.dataset.seg}%`,
        duration: dur(1.1),
        ease: 'power3.out',
        overwrite: true,
      });
    });
  }, [sig]);

  const h = size === 'lg' ? 'h-3.5' : 'h-2';

  return (
    <div className="relative">
      <div ref={ref} className={clsx('track flex', h, !started && 'track-hatch')} role="img" aria-label={describe(candidates, started)}>
        {started &&
          (duel ? (
            <>
              <span data-seg={segments[0].pct} className="h-full" style={{ width: 0, background: segments[0].color }} />
              <span className="flex-1" />
              <span data-seg={segments[1].pct} className="h-full" style={{ width: 0, background: segments[1].color }} />
            </>
          ) : (
            segments.map((s, i) => (
              <span
                key={s.key}
                data-seg={s.pct}
                className={clsx('h-full', i > 0 && 'border-l border-surface')}
                style={{ width: 0, background: s.color }}
              />
            ))
          ))}
      </div>
      {majority && (
        <div className="pointer-events-none absolute inset-y-[-6px] left-1/2 w-px -translate-x-1/2 bg-ink/70" aria-hidden />
      )}
      {majority && size === 'lg' && (
        <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2">
          <Tooltip content={majorityHint ?? 'Metade dos votos válidos'} side="bottom">
            <span tabIndex={0} className="eyebrow cursor-help rounded-xs px-1 tracking-[0.04em] normal-case">
              50%
            </span>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

function describe(candidates: CandidateRow[], started: boolean) {
  if (!started) return 'Nenhum voto apurado ainda';
  return candidates
    .slice(0, 4)
    .map((c) => `${c.shortName} ${fmtPct(c.percent)}`)
    .join(', ');
}

import { useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import gsap from 'gsap';
import type { CandidateRow } from '../lib/tse/types';
import { candFill } from '../lib/ui/color';
import { fmtInt, fmtPct, titleCase } from '../lib/ui/format';
import { dur } from '../lib/ui/motion';
import { AnimatedNumber } from './AnimatedNumber';
import { CandidateAvatar } from './CandidateAvatar';
import { Badge } from './ui/Badge';
import { Icon } from './ui/Icon';

interface Props {
  candidates: CandidateRow[];
  electionId: string;
  photoUf: string;
  /** começa a contagem do ranking (ex.: 3 quando os 2 primeiros já estão no hero) */
  startRank?: number;
  pageSize?: number;
  dense?: boolean;
}

export function CandidateList({ candidates, electionId, photoUf, startRank = 1, pageSize = 8, dense }: Props) {
  const [limit, setLimit] = useState(pageSize);
  const [open, setOpen] = useState<string | null>(null);
  const max = Math.max(...candidates.map((c) => c.percent), 0.0001);
  const shown = candidates.slice(0, limit);
  const remaining = candidates.length - shown.length;

  return (
    <div>
      <ol className="flex flex-col">
        {shown.map((c, i) => (
          <CandidateItem
            key={c.sqcand}
            candidate={c}
            rank={startRank + i}
            electionId={electionId}
            photoUf={photoUf}
            barPct={(c.percent / max) * 100}
            open={open === c.sqcand}
            onToggle={() => setOpen((o) => (o === c.sqcand ? null : c.sqcand))}
            dense={dense}
          />
        ))}
      </ol>
      {remaining > 0 && (
        <button
          type="button"
          className="btn btn-ghost btn-sm mt-2 w-full"
          onClick={() => setLimit((l) => l + pageSize * 2)}
        >
          Mostrar mais {Math.min(remaining, pageSize * 2)} de {remaining}
          <Icon name="chevron-down" size={14} />
        </button>
      )}
    </div>
  );
}

function CandidateItem({
  candidate: c,
  rank,
  electionId,
  photoUf,
  barPct,
  open,
  onToggle,
  dense,
}: {
  candidate: CandidateRow;
  rank: number;
  electionId: string;
  photoUf: string;
  barPct: number;
  open: boolean;
  onToggle: () => void;
  dense?: boolean;
}) {
  const detailRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const id = `cand-${c.sqcand}`;

  useLayoutEffect(() => {
    const el = detailRef.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      gsap.set(el, { height: open ? 'auto' : 0, opacity: open ? 1 : 0 });
      return;
    }
    gsap.to(el, {
      height: open ? 'auto' : 0,
      opacity: open ? 1 : 0,
      duration: dur(0.36),
      ease: open ? 'power3.out' : 'power2.inOut',
      overwrite: true,
    });
  }, [open]);

  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={id}
        className={clsx(
          'group grid w-full grid-cols-[1.25rem_auto_minmax(0,1fr)_auto] items-center gap-x-3 text-left',
          dense ? 'py-2.5' : 'py-3',
        )}
      >
        <span className="tnum font-mono text-micro text-ink-3">{String(rank).padStart(2, '0')}</span>
        <CandidateAvatar candidate={c} electionId={electionId} photoUf={photoUf} size={dense ? 30 : 36} ring={false} />
        <span className="min-w-0">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-small font-medium text-ink">{titleCase(c.shortName)}</span>
            <span className="shrink-0 font-mono text-micro text-ink-3">{c.party}</span>
          </span>
          <span className="track mt-1.5 block h-1">
            <span
              className="block h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${barPct}%`, background: candFill(c.color) }}
            />
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="tnum text-small font-medium text-ink">
            <AnimatedNumber value={c.percent} format={fmtPct} />
          </span>
          <Icon
            name="chevron-down"
            size={14}
            className={clsx(
              'text-ink-3 transition-transform duration-300 ease-out group-hover:text-ink',
              open && 'rotate-180',
            )}
          />
        </span>
      </button>
      <div ref={detailRef} id={id} className="overflow-hidden" style={{ height: 0, opacity: 0 }}>
        <dl className="card-sunken mb-3 grid grid-cols-2 gap-x-4 gap-y-3 p-3 text-small">
          <div className="col-span-2 min-w-0">
            <dt className="eyebrow">Nome na urna</dt>
            <dd className="mt-0.5 truncate text-ink">{titleCase(c.name)}</dd>
          </div>
          <div>
            <dt className="eyebrow">Votos</dt>
            <dd className="tnum mt-0.5 text-ink">
              <AnimatedNumber value={c.votes} format={fmtInt} />
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Número</dt>
            <dd className="tnum mt-0.5 text-ink">{c.number}</dd>
          </div>
          {c.status && (
            <div className="col-span-2">
              <dt className="sr-only">Situação</dt>
              <dd>
                <Badge tone={/^eleit/i.test(c.status) ? 'done' : c.status.includes('2º') ? 'live' : 'muted'}>
                  {c.status}
                </Badge>
              </dd>
            </div>
          )}
        </dl>
      </div>
    </li>
  );
}

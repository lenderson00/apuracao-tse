import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { photoUrl } from '../lib/tse/client';
import type { CandidateRow } from '../lib/tse/types';
import { AnimatedNumber } from './AnimatedNumber';

function fmtVotes(n: number) {
  return n.toLocaleString('pt-BR');
}

function fmtPct(n: number) {
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

interface Props {
  candidate: CandidateRow;
  electionId: string;
  photoUf: string;
  maxVotes: number;
  index: number;
  defaultOpen?: boolean;
}

export function CandidateCard({
  candidate,
  electionId,
  photoUf,
  maxVotes,
  index,
  defaultOpen = false,
}: Props) {
  const bar = maxVotes > 0 ? (candidate.votes / maxVotes) * 100 : 0;
  const img = photoUrl(electionId, photoUf, candidate.sqcand);
  const [open, setOpen] = useState(defaultOpen);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!detailRef.current) return;
    if (open) {
      gsap.fromTo(
        detailRef.current,
        { height: 0, opacity: 0 },
        { height: 'auto', opacity: 1, duration: 0.35, ease: 'power2.out' },
      );
    }
  }, [open]);

  const rank = index + 1;

  return (
    <details
      className="candidate-row"
      data-expanded={open}
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex items-center gap-3 p-3 sm:p-4">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] font-mono text-xs font-medium text-[var(--color-muted)]"
          aria-hidden
        >
          {String(rank).padStart(2, '0')}
        </span>
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)]">
          <img
            src={img}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <span
            className="absolute bottom-0 left-0 rounded-tr px-1 py-0.5 font-mono text-[9px] font-semibold text-white"
            style={{ background: candidate.color }}
          >
            {candidate.number}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-semibold sm:text-base">{candidate.shortName}</h3>
            <p className="shrink-0 text-lg font-semibold tabular-nums tracking-tight sm:text-xl">
              <AnimatedNumber value={candidate.percent} format={fmtPct} />
            </p>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--color-border-subtle)]">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${bar}%`, background: candidate.color }}
            />
          </div>
        </div>
        <span
          className="shrink-0 font-mono text-[10px] text-[var(--color-muted)] transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-hidden
        >
          ▾
        </span>
      </summary>
      <div ref={detailRef} className="overflow-hidden border-t border-[var(--color-border-subtle)] px-4 pb-4 pt-3">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <p className="label-mono">Partido</p>
            <p className="mt-0.5 text-[var(--color-ink-secondary)]">{candidate.party}</p>
          </div>
          <div>
            <p className="label-mono">Votos</p>
            <p className="mt-0.5 tabular-nums font-medium">
              <AnimatedNumber value={candidate.votes} format={fmtVotes} />
            </p>
          </div>
          {candidate.status && (
            <div>
              <p className="label-mono">Situação</p>
              <p className="mt-0.5 text-[var(--color-ink-secondary)]">{candidate.status}</p>
            </div>
          )}
        </div>
        <p className="mt-2 font-mono text-[10px] text-[var(--color-muted)]">
          sqcand:{candidate.sqcand}
        </p>
      </div>
    </details>
  );
}

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
}

export function CandidateCard({ candidate, electionId, photoUf, maxVotes, index }: Props) {
  const bar = maxVotes > 0 ? (candidate.votes / maxVotes) * 100 : 0;
  const img = photoUrl(electionId, photoUf, candidate.sqcand);

  return (
    <article
      className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 shadow-sm transition hover:shadow-md"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--color-border)]">
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
            className="absolute bottom-0 left-0 rounded-tr-md px-1.5 py-0.5 text-[10px] font-bold text-white"
            style={{ background: candidate.color }}
          >
            {candidate.number}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="truncate text-base font-semibold">{candidate.shortName}</h3>
            {candidate.status && (
              <span className="rounded-full bg-[var(--color-border)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                {candidate.status}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-muted)]">{candidate.party}</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="text-2xl font-semibold tabular-nums tracking-tight">
              <AnimatedNumber value={candidate.percent} format={fmtPct} />
            </p>
            <p className="text-sm tabular-nums text-[var(--color-muted)]">
              <AnimatedNumber value={candidate.votes} format={fmtVotes} /> votos
            </p>
          </div>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${bar}%`, background: candidate.color }}
        />
      </div>
    </article>
  );
}

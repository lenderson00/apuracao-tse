import clsx from 'clsx';
import { GOV_RUNOFF_UFS, OFFICES, ROUND_OPTIONS } from '../lib/tse/config';
import type { OfficeId, Round } from '../lib/tse/types';

interface Props {
  round: Round;
  officeId: OfficeId;
  onRound: (r: Round) => void;
  onOffice: (id: OfficeId) => void;
}

export function OfficeTabs({ round, officeId, onRound, onOffice }: Props) {
  const offices = OFFICES.filter((o) => {
    if (round === 2) return o.id === '1' || o.id === '3';
    return true;
  });

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-1 rounded-xl border border-[var(--color-border)] p-1">
        {ROUND_OPTIONS.map((r) => (
          <button
            key={r.round}
            type="button"
            onClick={() => onRound(r.round)}
            className={clsx(
              'rounded-lg px-4 py-2 text-sm font-medium transition',
              round === r.round
                ? 'bg-[var(--color-ink)] text-[var(--color-surface)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]',
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {offices.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onOffice(o.id)}
            className={clsx(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition',
              officeId === o.id
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-ink)]'
                : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-muted)]',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {round === 2 && officeId === '3' && (
        <p className="text-xs text-[var(--color-muted)] sm:max-w-xs">
          2º turno de governador apenas em:{' '}
          {[...GOV_RUNOFF_UFS].map((u) => u.toUpperCase()).join(', ')}.
        </p>
      )}
    </div>
  );
}

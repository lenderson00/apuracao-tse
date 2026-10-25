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
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="tab-segment w-fit">
          {ROUND_OPTIONS.map((r) => (
            <button
              key={r.round}
              type="button"
              data-active={round === r.round}
              onClick={() => onRound(r.round)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {offices.map((o) => (
            <button
              key={o.id}
              type="button"
              className="chip"
              data-active={officeId === o.id}
              onClick={() => onOffice(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {round === 2 && officeId === '3' && (
        <p className="label-mono max-w-2xl leading-relaxed normal-case tracking-normal text-[var(--color-muted)]">
          2º turno de governador:{' '}
          {[...GOV_RUNOFF_UFS].map((u) => u.toUpperCase()).join(' · ')}
        </p>
      )}
    </div>
  );
}

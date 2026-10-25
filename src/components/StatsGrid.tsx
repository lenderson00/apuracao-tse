import { useState } from 'react';
import type { TurnoutStats } from '../lib/tse/types';
import { AnimatedNumber } from './AnimatedNumber';

function pct(n: number) {
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function int(n: number) {
  return n.toLocaleString('pt-BR');
}

const PRIMARY = [
  { key: 'sections', label: 'Urnas apuradas', format: pct, nullable: false },
  { key: 'turnout', label: 'Comparecimento', format: pct, nullable: true },
  { key: 'abstention', label: 'Abstenção', format: pct, nullable: true },
] as const;

const SECONDARY = [
  { key: 'blank', label: 'Brancos', format: pct, nullable: true },
  { key: 'null', label: 'Nulos', format: pct, nullable: true },
  { key: 'electorate', label: 'Eleitorado', format: int, nullable: false },
] as const;

function StatValue({
  value,
  format,
  showPlaceholder,
}: {
  value: number;
  format: (n: number) => string;
  showPlaceholder: boolean;
}) {
  if (showPlaceholder) {
    return <span className="text-[var(--color-muted)]">—</span>;
  }
  return <AnimatedNumber value={value} format={format} />;
}

export function StatsGrid({ turnout }: { turnout: TurnoutStats }) {
  const [showMore, setShowMore] = useState(false);

  const valueMap: Record<string, number | null> = {
    sections: turnout.sectionsPct,
    turnout: turnout.turnoutPct,
    abstention: turnout.abstentionPct,
    blank: turnout.blankPct,
    null: turnout.nullPct,
    electorate: turnout.electorate,
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="label-mono">Participação</p>
        <button
          type="button"
          className="btn-ghost py-1"
          onClick={() => setShowMore((s) => !s)}
          aria-expanded={showMore}
        >
          {showMore ? 'Menos' : 'Detalhes'}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {PRIMARY.map((item) => {
          const raw = valueMap[item.key];
          const showPlaceholder = item.nullable && (raw === null || !turnout.apurationStarted);
          return (
            <div key={item.key} className="panel-muted px-3 py-2.5">
              <p className="text-[10px] font-medium text-[var(--color-muted)]">{item.label}</p>
              <p className="mt-1 text-base font-semibold tabular-nums sm:text-lg">
                <StatValue
                  value={raw ?? 0}
                  format={item.format}
                  showPlaceholder={showPlaceholder}
                />
              </p>
            </div>
          );
        })}
      </div>
      {showMore && (
        <div className="grid grid-cols-3 gap-2">
          {SECONDARY.map((item) => {
            const raw = valueMap[item.key];
            const showPlaceholder = item.nullable && (raw === null || !turnout.apurationStarted);
            return (
              <div key={item.key} className="panel-muted px-3 py-2.5">
                <p className="text-[10px] font-medium text-[var(--color-muted)]">{item.label}</p>
                <p className="mt-1 text-base font-semibold tabular-nums">
                  <StatValue
                    value={raw ?? 0}
                    format={item.format}
                    showPlaceholder={showPlaceholder}
                  />
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

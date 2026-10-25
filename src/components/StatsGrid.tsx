import type { TurnoutStats } from '../lib/tse/types';
import { AnimatedNumber } from './AnimatedNumber';

function pct(n: number) {
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function int(n: number) {
  return n.toLocaleString('pt-BR');
}

export function StatsGrid({ turnout }: { turnout: TurnoutStats }) {
  const items = [
    { label: 'Urnas apuradas', value: turnout.sectionsPct, format: pct },
    { label: 'Comparecimento', value: turnout.turnoutPct, format: pct },
    { label: 'Abstenção', value: turnout.abstentionPct, format: pct },
    { label: 'Votos brancos', value: turnout.blankPct, format: pct },
    { label: 'Votos nulos', value: turnout.nullPct, format: pct },
    { label: 'Eleitorado', value: turnout.electorate, format: int },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-3"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
            {item.label}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            <AnimatedNumber value={item.value} format={item.format} />
          </p>
        </div>
      ))}
    </div>
  );
}

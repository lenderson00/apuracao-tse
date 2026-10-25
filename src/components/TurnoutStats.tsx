import clsx from 'clsx';
import type { TurnoutStats as Turnout } from '../lib/tse/types';
import { fmtInt, fmtPct } from '../lib/ui/format';
import { Stat } from './ui/Stat';

interface Props {
  turnout: Turnout | null;
  loading?: boolean;
  columns?: 2 | 3 | 6;
  className?: string;
}

/** Comparecimento, abstenção etc. ficam "—" até o TSE começar a apurar. */
export function TurnoutStats({ turnout, loading, columns = 6, className }: Props) {
  const started = turnout?.apurationStarted ?? false;
  const nullable = (v: number | null | undefined) => (started && v !== null && v !== undefined ? v : null);

  const items = [
    {
      label: 'Urnas apuradas',
      value: turnout ? turnout.sectionsPct : null,
      format: fmtPct,
      progress: turnout?.sectionsPct ?? 0,
    },
    { label: 'Comparecimento', value: nullable(turnout?.turnoutPct), format: fmtPct },
    { label: 'Abstenção', value: nullable(turnout?.abstentionPct), format: fmtPct },
    { label: 'Brancos', value: nullable(turnout?.blankPct), format: fmtPct },
    { label: 'Nulos', value: nullable(turnout?.nullPct), format: fmtPct },
    { label: 'Eleitorado', value: turnout ? turnout.electorate : null, format: fmtInt },
  ];

  return (
    <dl
      className={clsx(
        'grid gap-x-6 gap-y-6',
        columns === 6 && 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
        columns === 3 && 'grid-cols-3',
        columns === 2 && 'grid-cols-2',
        className,
      )}
    >
      {items.map((item) => (
        <Stat
          key={item.label}
          label={item.label}
          value={item.value}
          format={item.format}
          loading={loading}
          progress={'progress' in item ? item.progress : undefined}
        />
      ))}
    </dl>
  );
}

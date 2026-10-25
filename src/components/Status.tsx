import clsx from 'clsx';
import type { ParsedResult } from '../lib/tse/types';
import { hasStarted } from '../lib/ui/turnout';

type StatusKind = 'live' | 'waiting' | 'done';

function statusOf(data: ParsedResult | null): StatusKind | null {
  if (!data) return null;
  if (data.finished) return 'done';
  return hasStarted(data.turnout) ? 'live' : 'waiting';
}

const LABEL: Record<StatusKind, string> = { live: 'Ao vivo', waiting: 'Aguardando', done: 'Encerrada' };
const TITLE: Record<StatusKind, string> = {
  live: 'Apuração em andamento',
  waiting: 'Apuração ainda não começou',
  done: 'Apuração encerrada',
};

/** Pill pequena de status, no vocabulário de ferramenta (verde ao vivo, âmbar aguardando). */
export function StatusPill({ data, className }: { data: ParsedResult | null; className?: string }) {
  const kind = statusOf(data);
  if (!kind) return <span className={clsx('skeleton h-5 w-20 rounded-pill', className)} aria-hidden />;
  return (
    <span className={clsx('pill', `pill-${kind}`, className)} title={TITLE[kind]}>
      <span className={clsx('size-1.5 rounded-full bg-current', kind === 'live' && 'live-dot')} aria-hidden />
      {LABEL[kind]}
    </span>
  );
}

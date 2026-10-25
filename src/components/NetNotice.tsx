import clsx from 'clsx';
import { useSyncExternalStore } from 'react';
import { getNetStatus, subscribeNet } from '../lib/tse/net';

/** Aviso discreto quando o TSE está segurando os acessos ou a última atualização falhou. */
export function NetNotice({ outdated, className }: { outdated?: boolean; className?: string }) {
  const { throttled } = useSyncExternalStore(subscribeNet, getNetStatus, getNetStatus);
  if (!throttled && !outdated) return null;
  const label = throttled ? 'TSE limitando acessos, tentando de novo' : 'Não deu para atualizar agora, números da última consulta';
  return (
    <span className={clsx('inline-flex items-center gap-1.5 font-mono text-nano text-ink-2', className)} role="status">
      <span className="size-1.5 animate-pulse rounded-full bg-accent" aria-hidden /> {label}
    </span>
  );
}

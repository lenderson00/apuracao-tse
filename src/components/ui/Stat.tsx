import clsx from 'clsx';
import type { ReactNode } from 'react';
import { AnimatedNumber } from '../AnimatedNumber';
import { Skeleton } from './Skeleton';

interface Props {
  label: string;
  /** null = ainda não publicado pelo TSE (mostra "—") */
  value: number | null;
  format: (n: number) => string;
  loading?: boolean;
  /** 0–100: desenha uma barra fina de progresso abaixo do número */
  progress?: number;
  hint?: ReactNode;
  size?: 'md' | 'lg';
  className?: string;
}

export function Stat({ label, value, format, loading, progress, hint, size = 'md', className }: Props) {
  return (
    <div className={clsx('flex min-w-0 flex-col gap-1.5', className)}>
      <dt className="eyebrow truncate">{label}</dt>
      <dd
        className={clsx(
          'tnum font-medium text-ink',
          size === 'lg' ? 'text-headline' : 'text-title',
        )}
      >
        {loading ? (
          <Skeleton className={size === 'lg' ? 'h-8 w-24' : 'h-6 w-20'} />
        ) : value === null ? (
          <span className="text-ink-3" aria-label="ainda não disponível">
            —
          </span>
        ) : (
          <AnimatedNumber value={value} format={format} />
        )}
      </dd>
      {progress !== undefined && (
        <div className="track mt-1 h-1" aria-hidden>
          <div
            className="h-full rounded-full bg-ink transition-[width] duration-700 ease-out"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
      {hint && <p className="text-caption text-ink-3">{hint}</p>}
    </div>
  );
}

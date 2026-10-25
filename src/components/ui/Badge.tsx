import clsx from 'clsx';
import type { ReactNode } from 'react';

interface Props {
  tone?: 'default' | 'live' | 'muted' | 'done';
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = 'default', dot, className, children }: Props) {
  return (
    <span className={clsx('badge', tone !== 'default' && `badge-${tone}`, className)}>
      {dot && <span className={clsx(tone === 'live' ? 'live-dot' : 'size-1.5 rounded-full bg-current')} aria-hidden />}
      {children}
    </span>
  );
}

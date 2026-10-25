import clsx from 'clsx';
import type { CSSProperties } from 'react';

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span className={clsx('skeleton block', className)} style={style} aria-hidden />;
}

import { useId, useState, type ReactNode } from 'react';
import clsx from 'clsx';

interface Props {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
}

/** Dica curta em hover/foco. Para o mapa, ver MapTooltip (segue o cursor). */
export function Tooltip({ content, children, side = 'top', className }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className={clsx('relative inline-flex', className)}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      <span
        id={id}
        role="tooltip"
        className={clsx(
          'tooltip absolute left-1/2 z-40 w-max max-w-60 -translate-x-1/2 px-3 py-2 text-caption text-ink-2',
          'transition-[opacity,transform] duration-200 ease-out',
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
          open ? 'translate-y-0 opacity-100' : side === 'top' ? 'translate-y-1 opacity-0' : '-translate-y-1 opacity-0',
        )}
      >
        {content}
      </span>
    </span>
  );
}

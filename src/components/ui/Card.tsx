import clsx from 'clsx';
import type { HTMLAttributes, Ref } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  variant?: 'raised' | 'flat' | 'sunken';
  ref?: Ref<HTMLDivElement>;
}

export function Card({ variant = 'raised', className, ...rest }: Props) {
  return (
    <div
      className={clsx(variant === 'raised' ? 'card' : variant === 'flat' ? 'card-flat' : 'card-sunken', className)}
      {...rest}
    />
  );
}

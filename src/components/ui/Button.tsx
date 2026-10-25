import clsx from 'clsx';
import type { ButtonHTMLAttributes, Ref } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'solid' | 'outline';
  icon?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({ variant = 'ghost', icon, className, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={clsx('btn', variant !== 'ghost' && `btn-${variant}`, icon && 'btn-icon', className)}
      {...rest}
    />
  );
}

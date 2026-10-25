import clsx from 'clsx';
import type { ButtonHTMLAttributes, Ref } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
  icon?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({ variant = 'secondary', size = 'md', icon, className, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={clsx('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', icon && 'btn-icon', className)}
      {...rest}
    />
  );
}

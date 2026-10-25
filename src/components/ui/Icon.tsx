import type { SVGProps } from 'react';

type IconName =
  | 'search'
  | 'sun'
  | 'moon'
  | 'close'
  | 'chevron-right'
  | 'chevron-down'
  | 'arrow-left'
  | 'zoom-out'
  | 'expand'
  | 'collapse'
  | 'info';

const PATHS: Record<IconName, string> = {
  search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41',
  moon: 'M20.35 14.35A8 8 0 0 1 9.65 3.65a8 8 0 1 0 10.7 10.7Z',
  close: 'M18 6 6 18M6 6l12 12',
  'chevron-right': 'm9 6 6 6-6 6',
  'chevron-down': 'm6 9 6 6 6-6',
  'arrow-left': 'M19 12H5m6-6-6 6 6 6',
  'zoom-out': 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35M8 11h6',
  expand: 'm18 15-6-6-6 6',
  collapse: 'm6 9 6 6 6-6',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-6v-4m0-4h.01',
};

export function Icon({ name, size = 16, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

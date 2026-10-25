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
  | 'info'
  | 'map'
  | 'layers'
  | 'keyboard'
  | 'external'
  | 'plus'
  | 'minus'
  | 'target'
  | 'ballot'
  | 'users'
  | 'user-minus'
  | 'square'
  | 'x-square'
  | 'id'
  | 'menu'
  | 'clock'
  | 'megaphone'
  | 'devices'
  | 'arrow-right'
  | 'activity'
  | 'mail';

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
  map: 'm9 4-6 2.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4Zm0 0v13.5m6-11V20',
  layers: 'm12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',
  keyboard: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm4 2h.01M11 9h.01M15 9h.01M7 13h.01M17 13h.01M9 16h6',
  external: 'M14 4h6v6m0-6L10 14M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  ballot: 'M4 10h16v10H4V10Zm4 0V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v5M9 7h6M8 15h8',
  users: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm10 9v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7',
  'user-minus': 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7 0h5',
  square: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z',
  'x-square': 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm4.5 5.5 5 5m0-5-5 5',
  id: 'M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm4.5 7.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 16a3 3 0 0 1 5 0m3-6h4m-4 3h3',
  menu: 'M4 7h16M4 12h16M4 17h16',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4l2.5 2.5',
  megaphone: 'm3 11 18-5v12L3 14v-3Zm8.6 5.8a3 3 0 1 1-5.8-1.6',
  devices: 'M14 17H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1v2M7 20h7m4-10h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z',
  'arrow-right': 'M5 12h14m-6-6 6 6-6 6',
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  mail: 'M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm-1 1 9 6 9-6',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-13v3m0 12v3M3 12h3m12 0h3',
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

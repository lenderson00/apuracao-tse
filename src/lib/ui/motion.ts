/** Durações e curvas espelham os tokens de motion do CSS. */
export const DUR = { fast: 0.12, base: 0.22, slow: 0.48, zoom: 0.9 } as const;
export const EASE = {
  out: 'power4.out',
  inOut: 'power3.inOut',
  standard: 'power2.out',
} as const;

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Duração já ajustada para quem pede menos movimento. */
export function dur(seconds: number): number {
  return prefersReducedMotion() ? 0 : seconds;
}

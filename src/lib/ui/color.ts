/**
 * Cores de candidato vêm do TSE/config como hex de marca. Aqui viram tons
 * ajustados ao tema: preenchimento (mapa, barras) e texto com contraste AA.
 */

/** Cor de dado: no escuro ganha um pouco de luz para não afundar no fundo. */
export function candFill(color: string): string {
  return `color-mix(in oklab, ${color}, white var(--cand-lift))`;
}

/** Cor para texto: puxa para a cor da tinta do tema até passar AA. */
export function candText(color: string): string {
  return `color-mix(in oklab, ${color} 68%, var(--text))`;
}

/** Preenchimento do mapa: força proporcional à margem (0–1), base neutra. */
export function mapFill(color: string, strength: number): string {
  const s = Math.max(0, Math.min(1, strength));
  const pct = Math.round(42 + s * 58);
  return `color-mix(in oklab, ${candFill(color)} ${pct}%, var(--map-neutral))`;
}

export const MAP_NEUTRAL = 'var(--map-neutral)';

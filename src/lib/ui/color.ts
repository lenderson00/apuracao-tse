/**
 * Cores de candidato vêm do config como hex de marca. Aqui viram tons
 * ajustados ao fundo escuro: preenchimento (mapa, barras) e texto AA.
 */

/** Cor de dado: ganha um pouco de luz para não afundar no fundo escuro. */
export function candFill(color: string): string {
  return `color-mix(in oklab, ${color}, white var(--cand-lift))`;
}

/** Cor para texto: puxa para a tinta clara até passar AA sobre as superfícies. */
export function candText(color: string): string {
  return `color-mix(in oklab, ${color} 62%, var(--text))`;
}

/** Preenchimento do mapa: força proporcional à margem (0–1), sobre base escura. */
export function mapFill(color: string, strength: number): string {
  const s = Number.isFinite(strength) ? Math.max(0, Math.min(1, strength)) : 0;
  const pct = Math.round(48 + s * 52);
  return `color-mix(in oklab, ${candFill(color)} ${pct}%, #17171b)`;
}

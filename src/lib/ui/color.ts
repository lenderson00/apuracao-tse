import { hcl } from 'd3';

/**
 * Cores de candidato vêm do config como hex de marca. Aqui viram tons do MESMO
 * matiz ajustados ao fundo escuro, variando só a luminosidade (HCL). Nada de
 * misturar com preto ou cinza, que puxa o vermelho para o marrom.
 */

const cache = new Map<string, string>();

function tone(color: string, l: number, chroma = 1): string {
  const key = `${color}|${l}|${chroma}`;
  let out = cache.get(key);
  if (!out) {
    const c = hcl(color);
    if (Number.isNaN(c.h)) c.h = 0;
    c.l = l;
    c.c = (Number.isNaN(c.c) ? 0 : c.c) * chroma;
    out = c.rgb().clamp().formatHex();
    cache.set(key, out);
  }
  return out;
}

/**
 * Degraus de vantagem (em pontos percentuais). Quanto maior a vantagem, mais
 * forte a cor: vantagem pequena fica apagada, perto do cinza neutro; vantagem
 * grande fica viva, com saturação cheia.
 */
export const MARGIN_STEPS = [0, 5, 12, 25] as const;
const STEP_L = [36, 43, 50, 58];
const STEP_C = [0.38, 0.62, 0.86, 1.1];
export const STEP_LABELS = ['até 5 p.p.', '5 a 12 p.p.', '12 a 25 p.p.', 'mais de 25 p.p.'];

export function marginStep(margin: number): number {
  const m = Number.isFinite(margin) ? margin : 0;
  let s = 0;
  for (let i = 0; i < MARGIN_STEPS.length; i++) if (m >= MARGIN_STEPS[i]) s = i;
  return s;
}

export function stepFill(color: string, step: number): string {
  const i = Math.max(0, Math.min(3, step));
  return tone(color, STEP_L[i], STEP_C[i]);
}

/** Preenchimento do mapa pela vantagem do líder (p.p.). */
export function mapFill(color: string, margin: number): string {
  return stepFill(color, marginStep(margin));
}

/** Cor de dado (barras, bolinhas, anéis). */
export function candFill(color: string): string {
  return tone(color, 62);
}

/** Cor para texto sobre as superfícies escuras (AA folgado). */
export function candText(color: string): string {
  return tone(color, 76, 0.85);
}

/**
 * Imagem de placar para compartilhar (1080×1350, retrato: ocupa bem a tela no
 * WhatsApp e no X pelo celular). Desenhada direto num canvas, só com dados do
 * arquivo do TSE já carregado na página.
 */
import { photoUrl } from './tse/client';
import { OFFICES } from './tse/config';
import type { CandidateRow, ParsedResult } from './tse/types';
import { candFill, candText } from './ui/color';
import { fmtInt, fmtPct, initials, parseTseDate, titleCase } from './ui/format';

export const SITE_URL = 'https://apuracao.lenderson.com.br';
const W = 1080;
const H = 1350;
const PAD = 80;
const C = {
  bg: '#0a0a0b',
  raised: '#151518',
  line: 'rgba(255,255,255,0.08)',
  text: '#f4f4f5',
  text2: '#c9c9ce',
  text3: '#8f8f98',
  accent: '#43d1b5',
};
const SANS = "Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
const MONO = "'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace";

export interface ShareInput {
  data: ParsedResult;
  /** "Brasil", "São Paulo" ou "Campinas, SP" */
  title: string;
  photoUf: string;
}

function officeLabel(d: ParsedResult) {
  return OFFICES.find((o) => o.id === d.officeId)?.label ?? 'Eleição';
}

/** "20:32" e "25/10" no horário de Brasília, a partir da totalização do TSE */
function tseTime(d: ParsedResult) {
  const dt = parseTseDate(d.updatedAt);
  if (!dt) return null;
  const tz = { timeZone: 'America/Sao_Paulo' } as const;
  return {
    hhmm: dt.toLocaleTimeString('pt-BR', { ...tz, hour: '2-digit', minute: '2-digit' }),
    ddmm: dt.toLocaleDateString('pt-BR', { ...tz, day: '2-digit', month: '2-digit' }),
  };
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export function shareFileName({ data, title }: ShareInput): string {
  const t = tseTime(data);
  const parts = ['apuracao', slug(officeLabel(data)), `${data.round}turno`];
  if (data.scope !== 'br') parts.push(slug(title));
  if (t) parts.push(t.hhmm.replace(':', 'h'));
  return `${parts.join('-')}.png`;
}

export function shareText({ data, title }: ShareInput): string {
  const top = data.candidates.slice(0, 2).filter((c) => c.votes > 0);
  const where = data.scope === 'br' ? 'no Brasil' : `em ${title}`;
  const head = `${officeLabel(data)}, ${data.round}º turno ${where}`;
  if (!top.length) return `${head}: a apuração ainda não começou. Acompanhe ao vivo`;
  const list = top.map((c) => `${titleCase(c.shortName)} ${fmtPct(c.percent)}`).join(', ');
  return `${head}: ${list}, com ${fmtPct(data.turnout.sectionsPct)} das seções apuradas. Acompanhe ao vivo`;
}

/**
 * Foto com CORS para poder exportar o canvas. Se a cópia em cache do navegador
 * veio sem cabeçalho CORS, busca de novo a mesma URL (sem cache-buster).
 */
async function loadPhoto(src: string): Promise<HTMLImageElement | null> {
  const img = await loadImage(src);
  if (img) return img;
  try {
    const r = await fetch(src, { mode: 'cors', cache: 'reload' });
    if (!r.ok) return null;
    const url = URL.createObjectURL(await r.blob());
    const out = await loadImage(url);
    URL.revokeObjectURL(url);
    return out;
  } catch {
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const t = window.setTimeout(() => resolve(null), 4000);
    img.onload = () => {
      window.clearTimeout(t);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(t);
      resolve(null);
    };
    img.src = src;
  });
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, family: string, maxW: number) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > 18 && ctx.measureText(text).width > maxW) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

function avatar(ctx: CanvasRenderingContext2D, c: CandidateRow, img: HTMLImageElement | null, x: number, y: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r + 7, 0, Math.PI * 2);
  ctx.fillStyle = candFill(c.color);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r + 3, 0, Math.PI * 2);
  ctx.fillStyle = C.bg;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = C.raised;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  if (img) {
    // recorte quadrado central (as fotos do TSE são 3×4)
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - s) / 2;
    const sy = Math.max(0, (img.naturalHeight - s) * 0.2);
    ctx.drawImage(img, sx, sy, s, s, x - r, y - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = candText(c.color);
    ctx.font = `500 ${Math.round(r * 0.7)}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials(c.shortName).toUpperCase(), x, y + 2);
  }
  ctx.restore();
}

export async function renderShareImage(input: ShareInput): Promise<Blob> {
  const { data, title, photoUf } = input;
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.textBaseline = 'alphabetic';

  // fundo
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.85, -100, 50, W * 0.85, -100, 900);
  glow.addColorStop(0, 'rgba(67,209,181,0.10)');
  glow.addColorStop(1, 'rgba(67,209,181,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // cabeçalho
  const t = tseTime(data);
  ctx.textAlign = 'left';
  ctx.fillStyle = C.accent;
  ctx.beginPath();
  ctx.arc(PAD + 8, PAD + 14, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.text3;
  ctx.font = `500 26px ${MONO}`;
  ctx.fillText(`APURAÇÃO 2026 · ${data.round}º TURNO`, PAD + 30, PAD + 23);
  ctx.fillStyle = C.text;
  const titleText = `${officeLabel(data)} · ${title}`;
  fitFont(ctx, titleText, 600, 68, SANS, W - PAD * 2);
  ctx.fillText(titleText, PAD, PAD + 110);

  const list = data.candidates.slice(0, data.candidates.length <= 2 ? 2 : 5);
  const imgs = await Promise.all(list.map((c) => loadPhoto(photoUrl(data.electionId, photoUf, c.sqcand))));
  const started = list.some((c) => c.votes > 0);
  let y = PAD + 190;

  if (list.length === 2) {
    // duelo: um bloco por candidato
    for (let i = 0; i < 2; i++) {
      const c = list[i];
      const top = y + i * 330;
      avatar(ctx, c, imgs[i], PAD + 110, top + 125, 100);
      const x = PAD + 260;
      ctx.textAlign = 'left';
      ctx.fillStyle = C.text;
      fitFont(ctx, titleCase(c.shortName), 500, 46, SANS, W - x - PAD);
      ctx.fillText(titleCase(c.shortName), x, top + 50);
      ctx.fillStyle = C.text3;
      ctx.font = `500 26px ${MONO}`;
      ctx.fillText(`${c.party} ${c.number}`, x, top + 92);
      ctx.fillStyle = c.percent > 0 ? candText(c.color) : C.text3;
      ctx.font = `500 132px ${SANS}`;
      ctx.fillText(fmtPct(c.percent), x - 6, top + 222);
      ctx.fillStyle = C.text2;
      ctx.font = `400 30px ${MONO}`;
      ctx.fillText(`${fmtInt(c.votes)} votos`, x, top + 272);
    }
    y += 680;
    // barra
    const total = list[0].percent + list[1].percent || 1;
    const bw = W - PAD * 2;
    const aW = started ? (bw * list[0].percent) / total : bw / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(PAD, y, bw, 22, 11);
    ctx.clip();
    ctx.fillStyle = started ? candFill(list[0].color) : C.raised;
    ctx.fillRect(PAD, y, aW, 22);
    ctx.fillStyle = started ? candFill(list[1].color) : C.raised;
    ctx.fillRect(PAD + aW, y, bw - aW, 22);
    ctx.restore();
    ctx.fillStyle = C.text;
    ctx.fillRect(PAD + bw / 2 - 1.5, y - 8, 3, 38);
    y += 82;
    const [a, b] = list;
    const diff = Math.abs(a.votes - b.votes);
    ctx.textAlign = 'left';
    ctx.font = `400 34px ${SANS}`;
    ctx.fillStyle = C.text2;
    if (started && diff > 0) {
      const lead = a.votes > b.votes ? a : b;
      ctx.fillText(`${titleCase(lead.shortName)} tem ${fmtInt(diff)} votos de vantagem`, PAD, y);
    } else ctx.fillText(started ? 'Empate' : 'Apuração ainda não começou', PAD, y);
  } else {
    // vários candidatos: lista
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const top = y + i * 150;
      avatar(ctx, c, imgs[i], PAD + 52, top + 60, 48);
      const x = PAD + 140;
      ctx.textAlign = 'left';
      ctx.fillStyle = C.text;
      fitFont(ctx, titleCase(c.shortName), 500, 38, SANS, 470);
      ctx.fillText(titleCase(c.shortName), x, top + 50);
      ctx.fillStyle = C.text3;
      ctx.font = `400 24px ${MONO}`;
      ctx.fillText(`${c.party} ${c.number} · ${fmtInt(c.votes)} votos`, x, top + 92);
      ctx.textAlign = 'right';
      ctx.fillStyle = c.percent > 0 ? candText(c.color) : C.text3;
      ctx.font = `500 64px ${SANS}`;
      ctx.fillText(fmtPct(c.percent), W - PAD, top + 82);
      if (i < list.length - 1) {
        ctx.fillStyle = C.line;
        ctx.fillRect(x, top + 128, W - PAD - x, 2);
      }
    }
    y += list.length * 150 + 40;
  }

  // apuração e horário
  const fy = H - PAD - 150;
  ctx.textAlign = 'left';
  ctx.fillStyle = C.text;
  ctx.font = `500 40px ${SANS}`;
  ctx.fillText(`Apurado: ${fmtPct(data.turnout.sectionsPct)} das seções`, PAD, fy);
  ctx.fillStyle = C.text3;
  const when = t ? `Totalização do TSE às ${t.hhmm} de ${t.ddmm}, horário de Brasília` : 'Totalização do TSE';
  fitFont(ctx, when, 400, 26, MONO, W - PAD * 2);
  ctx.fillText(when, PAD, fy + 52);
  // rodapé
  ctx.fillStyle = C.line;
  ctx.fillRect(PAD, H - PAD - 54, W - PAD * 2, 2);
  ctx.fillStyle = C.text;
  ctx.font = `500 30px ${SANS}`;
  ctx.fillText('apuracao.lenderson.com.br', PAD, H - PAD);
  ctx.textAlign = 'right';
  ctx.fillStyle = C.text3;
  ctx.font = `400 26px ${MONO}`;
  ctx.fillText('Dados públicos do TSE', W - PAD, H - PAD);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas vazio'))), 'image/png'),
  );
}

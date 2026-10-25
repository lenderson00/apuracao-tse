import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import clsx from 'clsx';
import gsap from 'gsap';
import type { ParsedResult } from '../lib/tse/types';
import { candFill, candText } from '../lib/ui/color';
import { titleCase } from '../lib/ui/format';
import { dur } from '../lib/ui/motion';
import { useHistory, type HistoryPoint } from '../hooks/useHistory';
import { Int, Pct } from './ui/Num';
import { Skeleton } from './ui/Skeleton';

interface Props {
  mode: 'desktop' | 'mobile';
  data: ParsedResult | null;
  /** 'br' ou sigla da UF em minúsculas */
  historyKey: string;
  placeLabel: string;
}

const TZ = 'America/Sao_Paulo';
const hm = (d: Date) => {
  const s = d.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  const [h, m] = s.split(':');
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
};

interface Series {
  n: string;
  name: string;
  color: string;
}

export function Evolution({ mode, data, historyKey, placeLabel }: Props) {
  const { file, points, loading, error } = useHistory(historyKey);
  const [hover, setHover] = useState<number | null>(null);
  const desktop = mode === 'desktop';

  const series: Series[] = useMemo(() => {
    const last = points[points.length - 1];
    if (!last) return [];
    return [...last.candidates]
      .sort((a, b) => b.pvap - a.pvap)
      .map((c) => {
        const row = data?.candidates.find((r) => r.number === c.n);
        return { n: c.n, name: titleCase(row?.shortName ?? c.nm), color: row?.color ?? '#64748b' };
      });
  }, [points, data]);

  const idx = hover ?? points.length - 1;
  const p = points[idx];
  const since = file?.inicioColeta ? hm(new Date(file.inicioColeta)) : null;
  const note = (
    <p className="text-nano leading-[0.875rem] text-ink-3">
      {since ? `Coleta a cada 10 min desde ${since}.` : 'Coleta a cada 10 min.'} O TSE não guarda o histórico, então a linha começa quando começamos a coletar.
    </p>
  );

  if (loading && !file)
    return (
      <div className={clsx('flex flex-col gap-2', desktop ? 'h-[9.5rem]' : 'h-56')} aria-hidden>
        <Skeleton className="h-full w-full rounded-md" />
      </div>
    );

  if (error || points.length === 0)
    return (
      <div className={clsx('flex flex-col justify-center gap-1.5', desktop ? 'h-[9.5rem]' : 'py-6')}>
        <p className="text-small font-medium text-ink">
          {error ? 'Não deu para carregar a evolução agora.' : `Ainda não há pontos com votos para ${placeLabel}.`}
        </p>
        <p className="text-caption text-ink-3">
          {error ? 'A página tenta de novo em 2 minutos.' : 'Assim que as primeiras urnas forem totalizadas, a linha aparece aqui.'}
        </p>
        {note}
      </div>
    );

  const readout = (
    <div className={clsx('flex flex-col', desktop ? 'justify-between' : '')}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="eyebrow">{hover === null ? 'Último ponto' : 'Nesse horário'}</span>
        <span className="tnum font-mono text-nano text-ink-2">{hm(new Date(p.t))} (Brasília)</span>
      </div>
      <ul className={clsx(desktop ? 'mt-1' : 'mt-1.5 grid grid-cols-2 gap-x-4')}>
        {series.map((s) => {
          const c = p.candidates.find((x) => x.n === s.n);
          return (
            <li
              key={s.n}
              className={clsx(
                'flex items-center gap-2',
                desktop ? 'h-[1.875rem] border-b border-line' : 'flex-wrap py-0.5',
              )}
            >
              <span className="size-2 shrink-0 rounded-full" style={{ background: candFill(s.color) }} />
              <span className="min-w-0 flex-1 truncate text-caption text-ink-2">{s.name}</span>
              <span className="text-small font-medium" style={{ color: candText(s.color) }}>
                <Pct value={c?.pvap ?? 0} />
              </span>
              {desktop && (
                <span className="w-[4.5rem] text-right font-mono text-nano text-ink-3">
                  <Int value={c?.vap ?? 0} />
                </span>
              )}
            </li>
          );
        })}
        <li className={clsx('flex items-center gap-2', desktop ? 'h-[1.875rem]' : 'col-span-2 py-0.5')}>
          <span className="h-px w-2 shrink-0 bg-ink-3" />
          <span className="min-w-0 flex-1 truncate text-caption text-ink-2">Urnas apuradas</span>
          <span className="text-small font-medium text-ink">
            <Pct value={p.pctSecoesTotalizadas} />
          </span>
          {desktop && <span className="w-[4.5rem]" />}
        </li>
      </ul>
    </div>
  );

  return desktop ? (
    <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(20rem,25rem)] gap-4 xl:gap-5">
      <div className="flex min-w-0 flex-col gap-1">
        <Chart points={points} series={series} height={128} hover={hover} onHover={setHover} drawKey={historyKey} />
        {note}
      </div>
      <div className="border-l border-line pl-4 xl:pl-5">{readout}</div>
    </div>
  ) : (
    <div className="flex flex-col gap-2">
      {readout}
      <Chart points={points} series={series} height={176} hover={hover} onHover={setHover} drawKey={historyKey} />
      {note}
    </div>
  );
}

/* ----------------------------------------------------------------- gráfico */

const PAD = { top: 10, right: 40, bottom: 18, left: 30 };

function niceTicks(lo: number, hi: number): number[] {
  const span = hi - lo;
  const step = span <= 4 ? 1 : span <= 10 ? 2 : span <= 25 ? 5 : 10;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v);
  return out;
}

function timeTicks(t0: number, t1: number, width: number): number[] {
  const span = t1 - t0;
  const maxTicks = Math.max(2, Math.floor(width / 64));
  const steps = [10, 20, 30, 60, 120, 180].map((m) => m * 60_000);
  const step = steps.find((s) => span / s <= maxTicks) ?? 360 * 60_000;
  const out: number[] = [];
  for (let v = Math.ceil(t0 / step) * step; v <= t1; v += step) out.push(v);
  return out;
}

function Chart({
  points,
  series,
  height,
  hover,
  onHover,
  drawKey,
}: {
  points: HistoryPoint[];
  series: Series[];
  height: number;
  hover: number | null;
  onHover: (i: number | null) => void;
  drawKey: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.floor(el.getBoundingClientRect().width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const times = points.map((p) => new Date(p.t).getTime());
  const single = points.length === 1;
  const t0 = single ? times[0] - 15 * 60_000 : times[0];
  const t1 = single ? times[0] + 15 * 60_000 : times[times.length - 1];
  const all = points.flatMap((p) => p.candidates.map((c) => c.pvap));
  const lo = Math.max(0, Math.floor(Math.min(...all) - 2));
  const hi = Math.min(100, Math.ceil(Math.max(...all) + 2));
  const iw = Math.max(1, width - PAD.left - PAD.right);
  const ih = height - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0 || 1)) * iw;
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo || 1)) * ih;
  const yU = (v: number) => PAD.top + (1 - v / 100) * ih;

  const path = (get: (p: HistoryPoint) => number, scale: (v: number) => number) =>
    points.map((p, i) => `${i ? 'L' : 'M'}${x(times[i]).toFixed(1)},${scale(get(p)).toFixed(1)}`).join('');

  const shape = `${drawKey}|${width > 0}|${points.length}`;
  const drawn = useRef<string>('');
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg || width === 0) return;
    const first = drawn.current === '' || drawn.current.split('|')[0] !== drawKey;
    drawn.current = shape;
    const lines = svg.querySelectorAll<SVGPathElement>('[data-line]');
    lines.forEach((el) => {
      const len = el.getTotalLength();
      if (!len) return;
      if (first) {
        gsap.fromTo(
          el,
          { strokeDasharray: len, strokeDashoffset: len },
          { strokeDashoffset: 0, duration: dur(1.2), ease: 'power2.inOut', clearProps: 'strokeDasharray,strokeDashoffset' },
        );
      }
    });
    if (first)
      gsap.fromTo(svg.querySelectorAll('[data-end]'), { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: dur(0.35), delay: dur(1), transformOrigin: 'center', stagger: 0.05 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape]);

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = 0;
    let bd = Infinity;
    times.forEach((t, i) => {
      const d = Math.abs(x(t) - px);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    onHover(best);
  };

  const yTicks = niceTicks(lo, hi);
  const xTicks = width ? timeTicks(t0, t1, iw) : [];
  const hi_ = hover ?? points.length - 1;
  const last = points[points.length - 1];

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="block touch-pan-y select-none"
          role="img"
          aria-label={`Evolução do percentual de votos válidos: ${series
            .map((s) => `${s.name} ${last.candidates.find((c) => c.n === s.n)?.pvap.toFixed(2).replace('.', ',')}%`)
            .join(', ')}`}
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={(e) => e.pointerType === 'mouse' && onHover(null)}
        >
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--line)" />
              <text x={PAD.left - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-ink-3 font-mono text-[9px]">
                {v}%
              </text>
            </g>
          ))}
          {lo < 50 && hi > 50 && (
            <line x1={PAD.left} x2={width - PAD.right} y1={y(50)} y2={y(50)} stroke="var(--line-loud)" strokeDasharray="2 3" />
          )}
          {xTicks.map((t) => (
            <text key={t} x={x(t)} y={height - 4} textAnchor="middle" className="fill-ink-3 font-mono text-[9px]">
              {hm(new Date(t))}
            </text>
          ))}

          {/* urnas apuradas: escala própria de 0 a 100%, só como referência */}
          <path data-line d={path((p) => p.pctSecoesTotalizadas, yU)} fill="none" stroke="var(--text-3)" strokeOpacity={0.45} strokeWidth={1} strokeDasharray="3 3" />

          {series.map((s) => (
            <path
              key={s.n}
              data-line
              d={path((p) => p.candidates.find((c) => c.n === s.n)?.pvap ?? 0, y)}
              fill="none"
              stroke={candFill(s.color)}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {hover !== null && (
            <line x1={x(times[hi_])} x2={x(times[hi_])} y1={PAD.top} y2={PAD.top + ih} stroke="var(--line-loud)" />
          )}

          {series.map((s) => {
            const v = points[hi_].candidates.find((c) => c.n === s.n)?.pvap ?? 0;
            const lv = last.candidates.find((c) => c.n === s.n)?.pvap ?? 0;
            return (
              <g key={s.n}>
                {(single || hover !== null) && <circle cx={x(times[hi_])} cy={y(v)} r={3.5} fill={candFill(s.color)} stroke="var(--raised)" strokeWidth={1.5} />}
                <circle data-end cx={x(times[times.length - 1])} cy={y(lv)} r={2.5} fill={candFill(s.color)} />
                <text x={width - PAD.right + 6} y={y(lv)} dy="0.32em" className="font-mono text-[9px]" fill={candText(s.color)}>
                  {lv.toFixed(1).replace('.', ',')}
                </text>
              </g>
            );
          })}
          {series.every((s) => Math.abs(y(last.candidates.find((c) => c.n === s.n)?.pvap ?? 0) - yU(last.pctSecoesTotalizadas)) > 15) && (
            <text x={width - PAD.right + 6} y={yU(last.pctSecoesTotalizadas)} dy="0.32em" className="fill-ink-3 font-mono text-[9px]" data-end>
              urnas
            </text>
          )}
        </svg>
      )}
    </div>
  );
}

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import clsx from 'clsx';
import { candFill, STEP_LABELS, stepFill } from '../lib/ui/color';
import { titleCase } from '../lib/ui/format';
import { Icon } from './ui/Icon';

export const TSE_URL = 'https://resultados.tse.jus.br';

/* ------------------------------------------------------------------ marca */

export function Mark({ size = 28, ring = true }: { size?: number; ring?: boolean }) {
  return (
    <span
      className={clsx(
        'grid shrink-0 place-items-center rounded-(--r-inner) bg-overlay',
        ring && 'shadow-[inset_0_0_0_1px_var(--line-strong)]',
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 16 16">
        <rect x="2" y="7" width="3" height="7" rx="0.75" fill="var(--text)" />
        <rect x="6.5" y="2" width="3" height="12" rx="0.75" fill="var(--text)" />
        <rect x="11" y="5" width="3" height="9" rx="0.75" fill="var(--accent)" />
      </svg>
    </span>
  );
}

/** Marca + aviso de independência (sempre visível no topo). */
export function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className={clsx('flex min-w-0 items-center', compact ? 'gap-2' : 'gap-2.5')}>
      <Mark size={compact ? 28 : 32} ring={false} />
      <div className="min-w-0 leading-none">
        <p className={clsx('truncate font-semibold tracking-[-0.01em] text-ink', compact ? 'text-[0.78rem]' : 'text-small')}>
          Apuração 2026
          <span className="font-normal text-ink-3"> · </span>
          <a
            href={TSE_URL}
            target="_blank"
            rel="noreferrer"
            className="font-normal text-ink-2 underline decoration-line-loud underline-offset-2 hover:text-ink hover:decoration-ink-3"
          >
            Dados públicos do TSE
          </a>
        </p>
        <p className={clsx('mt-1 truncate text-ink-3', compact ? 'text-[0.66rem]' : 'font-mono text-nano')}>
          Site independente, sem vínculo com o TSE
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- breadcrumb */

export interface Crumb {
  label: string;
  onClick?: () => void;
}

export function Breadcrumb({
  items,
  status,
  className,
  bare,
}: {
  items: Crumb[];
  status?: ReactNode;
  className?: string;
  /** sem moldura (dentro do sheet no mobile) */
  bare?: boolean;
}) {
  return (
    <nav
      aria-label="Você está em"
      className={clsx(
        'flex min-w-0 items-center gap-0.5',
        bare ? '-ml-2' : 'float h-(--h-2) p-1 pr-2',
        className,
      )}
    >
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex min-w-0 items-center gap-0.5">
            {i > 0 && <span className="shrink-0 text-ink-4" aria-hidden>/</span>}
            <button
              type="button"
              onClick={c.onClick}
              disabled={last}
              aria-current={last ? 'location' : undefined}
              className={clsx(
                'flex h-7 max-w-44 items-center truncate rounded-(--r-inner) px-2.5 text-caption font-medium transition-colors pointer-coarse:min-w-11',
                'pointer-coarse:flex pointer-coarse:h-11 pointer-coarse:items-center pointer-coarse:px-2.5 pointer-coarse:text-small',
                last ? 'text-ink' : 'text-ink-3 hover:bg-hover hover:text-ink',
              )}
            >
              {c.label}
            </button>
          </span>
        );
      })}
      {status && <span className="ml-1.5 shrink-0">{status}</span>}
    </nav>
  );
}

/* ---------------------------------------------------------------- zoom */

/** "− 100% +" agrupados, mais recentralizar. O percentual vem do mapa por assinatura. */
export function ZoomControls({
  onIn,
  onOut,
  onRecenter,
  subscribe,
  className,
}: {
  onIn: () => void;
  onOut: () => void;
  onRecenter: () => void;
  subscribe: (cb: (pct: number) => void) => () => void;
  className?: string;
}) {
  const [pct, setPct] = useState(100);
  useEffect(() => subscribe((p) => setPct(Math.round(p))), [subscribe]);
  return (
    <div className={clsx('float flex h-(--h-2) items-center gap-0.5 p-1', className)} role="group" aria-label="Zoom do mapa">
      <button type="button" className="btn btn-icon size-7" onClick={onOut} aria-label="Afastar" title="Afastar (−)">
        <Icon name="minus" size={14} />
      </button>
      <span className="tnum w-12 text-center font-mono text-micro text-ink-2" aria-label="Nível de zoom">
        {pct}%
      </span>
      <button type="button" className="btn btn-icon size-7" onClick={onIn} aria-label="Aproximar" title="Aproximar (+)">
        <Icon name="plus" size={14} />
      </button>
      <span className="seg-divider mx-1" aria-hidden />
      <button type="button" className="btn btn-icon size-7" onClick={onRecenter} aria-label="Recentralizar" title="Recentralizar (0)">
        <Icon name="target" size={14} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------- painel do mapa */

export interface LegendItem {
  key: string;
  name: string;
  color: string;
  count: number;
}

export interface MapSummary {
  items: LegendItem[];
  neutral: number;
  errors: number;
  /** áreas sem disputa neste recorte (sem 2º turno) */
  off: number;
  loading: number;
  total: number;
  unit: 'UF' | 'municípios';
  updatedAt: Date | null;
  progress: number | null;
}

const hhmm = (d: Date) =>
  d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

/** Legenda em linhas densas: cor, nome, contagem à direita; escala de vantagem; hora do mapa. */
export function MapPanel({ s, title, bare, className }: { s: MapSummary; title: string; bare?: boolean; className?: string }) {
  const done = s.total - s.loading;
  return (
    <div className={clsx(bare ? '' : 'panel w-60 px-3 pb-2.5 pt-2.5', className)} aria-label="Legenda do mapa">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">{title}</p>
        <span className="tnum font-mono text-nano text-ink-3">
          {done}/{s.total} {s.unit}
        </span>
      </div>
      <dl className="mt-1.5">
        {s.items.map((it) => (
          <Line key={it.key} swatch={candFill(it.color)} label={titleCase(it.name)} value={it.count} strong />
        ))}
        <Line swatch="var(--map-neutral)" label="Sem votos ou empate" value={s.neutral} />
        {s.off > 0 && <Line swatch="transparent" outline label="Sem 2º turno" value={s.off} />}
        {s.errors > 0 && <Line swatch="url(#legend-hatch)" label="Sem resposta do TSE" value={s.errors} />}
      </dl>
      {s.items.length > 0 && (
        <div className="mt-2 border-t border-line pt-2">
          <p className="mb-1.5 flex justify-between text-nano text-ink-3">
            <span>Vantagem</span>
            <span>pequena → grande</span>
          </p>
          <div className="flex flex-col gap-1">
            {s.items.slice(0, 2).map((it) => (
              <div key={it.key} className="flex gap-0.5" title={`Vantagem de ${titleCase(it.name)}`}>
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="h-2 flex-1 first:rounded-l-[3px] last:rounded-r-[3px]" style={{ background: stepFill(it.color, i) }} title={STEP_LABELS[i]} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2 font-mono text-nano text-ink-3">
        <span className="flex items-center gap-1.5">
          <Icon name="clock" size={11} />
          {s.updatedAt ? `Mapa às ${hhmm(s.updatedAt)}` : 'Mapa carregando'}
        </span>
        {s.progress !== null && s.progress < 100 ? (
          <span className="flex items-center gap-1.5" aria-label={`Municípios carregados: ${s.progress}%`}>
            <span className="track h-1 w-10">
              <span className="block h-full bg-ink transition-[width] duration-300" style={{ width: `${s.progress}%` }} />
            </span>
            <span className="tnum">{s.progress}%</span>
          </span>
        ) : (
          <span>a cada 2 min</span>
        )}
      </div>
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <pattern id="legend-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="4" height="4" style={{ fill: 'var(--map-error)' }} />
            <line x1="0" y1="0" x2="0" y2="4" style={{ stroke: 'rgb(255 255 255 / 0.14)' }} strokeWidth="1" />
          </pattern>
        </defs>
      </svg>
    </div>
  );
}

function Line({ swatch, label, value, strong, outline }: { swatch: string; label: string; value: number; strong?: boolean; outline?: boolean }) {
  return (
    <div className="grid h-6 grid-cols-[0.625rem_minmax(0,1fr)_auto] items-center gap-x-2">
      <svg width="10" height="10" className="rounded-[3px]" aria-hidden>
        <rect width="10" height="10" fill={swatch} />
        {outline && <rect x="0.5" y="0.5" width="9" height="9" rx="2.5" fill="none" style={{ stroke: 'var(--line-loud)' }} />}
      </svg>
      <dt className={clsx('truncate text-caption', strong ? 'font-medium text-ink' : 'text-ink-2')}>{label}</dt>
      <dd className="tnum text-right font-mono text-micro text-ink-2">{value}</dd>
    </div>
  );
}

/* --------------------------------------------------------------- popover */

export function Popover({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const id = window.setTimeout(() => window.addEventListener('pointerdown', onDown), 0);
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={ref} role="dialog" className={clsx('tooltip pointer-events-auto absolute z-50 p-4 text-caption text-ink-2', className)}>
      {children}
    </div>
  );
}

export function AboutContent() {
  return (
    <div className="flex flex-col gap-2.5 leading-relaxed">
      <p className="text-small font-medium text-ink">Sobre este site</p>
      <p>
        Projeto independente, sem vínculo com o TSE. Os números vêm dos arquivos públicos de{' '}
        <a href={TSE_URL} target="_blank" rel="noreferrer" className="text-ink underline underline-offset-2">
          resultados.tse.jus.br
        </a>
        . O painel atualiza a cada minuto e as cores do mapa, a cada 2 minutos.
      </p>
      <p>Para o resultado oficial, consulte o TSE. Antes das 17h de Brasília, todos os candidatos aparecem com 0%.</p>
    </div>
  );
}

export function ShortcutsContent() {
  const rows: Array<[string, string]> = [
    ['Arrastar', 'mover o mapa'],
    ['Roda ou pinça', 'zoom'],
    ['Enter', 'abrir estado ou município'],
    ['Esc', 'voltar um nível'],
    ['+  −', 'zoom'],
    ['0', 'recentralizar'],
    ['/', 'buscar município'],
  ];
  return (
    <div>
      <p className="mb-2.5 text-small font-medium text-ink">Atalhos</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-mono text-nano text-ink">{k}</dt>
            <dd className="text-ink-3">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------- rail */

export interface RailAction {
  id: string;
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
  onClick: () => void;
  active?: boolean;
}

export function Rail({ top, bottom }: { top: RailAction[]; bottom: RailAction[] }) {
  const [tip, setTip] = useState<string | null>(null);
  const btn = (a: RailAction) => (
    <li key={a.id} className="relative">
      <button
        type="button"
        onClick={a.onClick}
        aria-label={a.label}
        aria-pressed={a.active}
        onPointerEnter={() => setTip(a.id)}
        onPointerLeave={() => setTip(null)}
        onFocus={() => setTip(a.id)}
        onBlur={() => setTip(null)}
        className={clsx(
          'grid size-9 place-items-center rounded-(--r-inner) transition-colors duration-150',
          a.active ? 'bg-hover text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]' : 'text-ink-3 hover:bg-hover hover:text-ink',
        )}
      >
        <Icon name={a.icon} size={17} />
      </button>
      {tip === a.id && (
        <span className="tooltip absolute left-full top-1/2 z-50 ml-2.5 -translate-y-1/2 whitespace-nowrap px-2 py-1 text-caption">
          {a.label}
        </span>
      )}
    </li>
  );
  return (
    <aside className="flex w-12 shrink-0 flex-col items-center py-2" aria-label="Atalhos">
      <Mark size={32} />
      <span className="my-3 h-px w-6 bg-line" aria-hidden />
      <ul className="flex flex-col gap-1.5">{top.map(btn)}</ul>
      <ul className="mt-auto flex flex-col gap-1.5">{bottom.map(btn)}</ul>
      <span className="my-3 h-px w-6 bg-line" aria-hidden />
      <Credit variant="rail" />
    </aside>
  );
}

/* ---------------------------------------------------------------- crédito */

export const CREDIT_URL = 'https://x.com/lendersonmacedo';

function XLogo({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className="shrink-0">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

/**
 * "Feito por Lenderson" com link para o X.
 * rail: texto na vertical, no pé do rail (desktop). chip: pill pequena e discreta (mobile).
 */
export function Credit({ variant, className, style }: { variant: 'rail' | 'chip'; className?: string; style?: CSSProperties }) {
  const label = 'Feito por Lenderson';
  return (
    <a
      href={CREDIT_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} (abre o perfil no X em nova aba)`}
      title="@lendersonmacedo no X"
      style={style}
      className={clsx(
        'group flex items-center whitespace-nowrap text-ink-3 transition-colors duration-150 hover:text-ink',
        variant === 'rail'
          ? 'gap-2 rounded-(--r-inner) px-1.5 py-2 text-micro [writing-mode:vertical-rl] rotate-180 hover:bg-hover'
          : 'float h-8 gap-1.5 rounded-full px-3 text-micro',
        className,
      )}
    >
      <span className={variant === 'rail' ? 'rotate-180' : undefined}>
        <XLogo size={variant === 'rail' ? 11 : 10} />
      </span>
      <span>
        Feito por <span className="text-ink-2 transition-colors group-hover:text-ink">Lenderson</span>
      </span>
    </a>
  );
}

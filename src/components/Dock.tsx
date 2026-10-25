import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import gsap from 'gsap';
import type { CandidateRow, ParsedResult } from '../lib/tse/types';
import { candFill, candText } from '../lib/ui/color';
import { fmtInt, fmtPct, fmtUpdatedAt, titleCase } from '../lib/ui/format';
import { dur, prefersReducedMotion } from '../lib/ui/motion';
import { hasStarted } from '../lib/ui/turnout';
import { CandidateAvatar } from './CandidateAvatar';
import { StatusPill } from './Status';
import { Icon } from './ui/Icon';
import { Int, Pct } from './ui/Num';
import { Skeleton } from './ui/Skeleton';
import { Tabs } from './ui/Tabs';

interface Props {
  mode: 'desktop' | 'mobile';
  kindLabel: string;
  title: string;
  context: string;
  data: ParsedResult | null;
  /** os números mostrados são do recorte anterior enquanto o novo carrega */
  stale: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  photoUf: string;
  majority: boolean;
  /** conteúdo alternativo quando não há resultado para o recorte (ex.: cargo estadual no Brasil) */
  empty?: ReactNode;
  /** mobile: breadcrumb no topo do sheet */
  crumbs?: ReactNode;
  /** mobile: aba "Mapa" (legenda, hora do mapa) */
  mapPanel?: ReactNode;
  /** mobile: altura do sheet recolhido, para o mapa caber acima dele */
  onPeekHeight?: (h: number) => void;
}

const ANIMATED_ROWS = 20;
const PAGE = 50;

export function Dock(props: Props) {
  const { mode, data, error, empty } = props;
  const rootRef = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);
  const dataKey = data ? `${data.officeId}-${data.round}-${data.scope}-${data.scopeCode}` : 'none';

  /* entrada do dock */
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || prefersReducedMotion()) return;
    gsap.fromTo(el, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', delay: 0.25, clearProps: 'transform,opacity' });
  }, []);

  /* troca de recorte: as linhas entram em stagger curto (os números morfam sozinhos) */
  const firstKey = useRef(true);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (firstKey.current) {
      firstKey.current = false;
      return;
    }
    if (prefersReducedMotion()) return;
    gsap.fromTo(
      el.querySelectorAll('[data-dock-anim]'),
      { opacity: 0.35, y: 3 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', stagger: 0.025, overwrite: true, clearProps: 'transform,opacity' },
    );
  }, [dataKey]);

  const alt = error ? (
    <ErrorState title={props.title} onRetry={props.onRetry} compact={mode === 'desktop'} />
  ) : empty && !data ? (
    empty
  ) : null;

  if (mode === 'mobile') return <MobileSheet {...props} rootRef={rootRef} alt={alt} expanded={expanded} setExpanded={setExpanded} />;

  return (
    <section
      ref={rootRef}
      aria-label={`Resultado: ${props.title}`}
      data-expanded={expanded}
      className="panel pointer-events-auto flex max-h-[min(64dvh,580px)] flex-col px-4 pb-3.5 pt-3"
    >
      <Header {...props} />
      {alt ? (
        <div className="pt-3">{alt}</div>
      ) : (
        <div className="mt-2.5 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(20rem,25rem)] gap-4 xl:gap-5">
          <div className="flex min-h-0 flex-col">
            <Candidates {...props} expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
          </div>
          <div className="border-l border-line pl-4 xl:pl-5">
            <StatRows data={data} columns={2} />
          </div>
        </div>
      )}
    </section>
  );
}

/* --------------------------------------------------------------- mobile */

function MobileSheet({
  rootRef,
  alt,
  expanded,
  setExpanded,
  ...props
}: Props & {
  rootRef: React.RefObject<HTMLElement | null>;
  alt: ReactNode;
  expanded: boolean;
  setExpanded: (v: boolean | ((p: boolean) => boolean)) => void;
}) {
  const { data, crumbs, mapPanel, onPeekHeight } = props;
  const list = data?.candidates ?? [];
  const duel = list.length === 2;
  const [tab, setTab] = useState<'cand' | 'part' | 'map'>(duel ? 'part' : 'cand');
  const activeTab = duel && tab === 'cand' ? 'part' : tab;
  const peekRef = useRef<HTMLDivElement>(null);
  const [peekH, setPeekH] = useState(260);

  /* altura do sheet recolhido = cabeçalho + resumo; o mapa se encaixa acima */
  useLayoutEffect(() => {
    const el = peekRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      setPeekH(h);
      onPeekHeight?.(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [onPeekHeight]);

  const tabs = [
    ...(duel ? [] : [{ value: 'cand' as const, label: 'Candidatos' }]),
    { value: 'part' as const, label: 'Participação' },
    { value: 'map' as const, label: 'Mapa' },
  ];

  return (
    <section
      ref={rootRef}
      aria-label={`Resultado: ${props.title}`}
      className={clsx(
        'panel pointer-events-auto flex flex-col overflow-hidden rounded-b-none border-b-0',
        'transition-[max-height] duration-500 ease-out',
      )}
      style={{ maxHeight: expanded ? '76dvh' : peekH }}
    >
      <div ref={peekRef} className="shrink-0 px-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="-mx-4 -mb-3 flex h-8 w-[calc(100%+2rem)] items-start justify-center pt-2"
          aria-label={expanded ? 'Recolher painel' : 'Expandir painel'}
          aria-expanded={expanded}
        >
          <span className="h-1 w-9 rounded-full bg-line-loud" />
        </button>
        <div className="flex min-h-11 items-center justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-2.5">
            {crumbs ?? (
              <>
                <h2 className="truncate text-title font-medium text-ink">{props.title}</h2>
                {data && <span className="shrink-0 font-mono text-nano text-ink-3">{fmtUpdatedAt(data.updatedAt)}</span>}
              </>
            )}
          </div>
          <StatusPill data={data} className="shrink-0" />
        </div>
        {crumbs && (
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="truncate text-title font-medium text-ink">{props.title}</h2>
            {data && <span className="shrink-0 font-mono text-nano text-ink-3">{fmtUpdatedAt(data.updatedAt)}</span>}
          </div>
        )}
        <div className="mt-2.5">
          {alt ?? (!data ? <RowsSkeleton /> : duel ? <Duel a={list[0]} b={list[1]} data={data} photoUf={props.photoUf} majority={props.majority} mobile /> : <Summary {...props} />)}
        </div>
        {!alt && !expanded && (
          <button type="button" className="btn -mx-1 mt-1 h-11 w-[calc(100%+0.5rem)] justify-between px-1 text-caption text-ink-3" onClick={() => setExpanded(true)}>
            <span>{duel ? 'Participação e legenda do mapa' : 'Todos os candidatos, participação e mapa'}</span>
            <Icon name="expand" size={14} />
          </button>
        )}
        {expanded && <div className="h-2" />}
      </div>
      {!alt && (
        <>
          <div className="shrink-0 px-4">
            <Tabs
              variant="line"
              label="Detalhes"
              value={activeTab}
              onChange={(v) => {
                setTab(v);
                setExpanded(true);
              }}
              items={tabs}
            />
          </div>
          <div className="scroll-y min-h-0 flex-1 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            {activeTab === 'cand' ? (
              <Candidates {...props} expanded onToggle={() => undefined} listOnly />
            ) : activeTab === 'part' ? (
              <StatRows data={data} />
            ) : (
              mapPanel
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** Resumo do 1º turno no sheet recolhido: barra + os dois primeiros. */
function Summary(props: Props) {
  const d = props.data!;
  return (
    <div>
      <StackBar candidates={d.candidates} majority={props.majority} />
      <ol className="mt-1.5">
        {d.candidates.slice(0, 2).map((c, i) => (
          <Row key={c.sqcand} c={c} rank={i + 1} electionId={d.electionId} photoUf={props.photoUf} max={d.candidates[0].percent} animate />
        ))}
      </ol>
    </div>
  );
}

/* -------------------------------------------------------------- cabeçalho */

function Header({ kindLabel, title, context, data, loading, stale }: Props) {
  return (
    <header className="flex min-w-0 items-center gap-3">
      <span className="eyebrow shrink-0">{kindLabel}</span>
      <h2 className="truncate text-title font-medium text-ink" data-dock-anim>
        {title}
      </h2>
      {data || loading ? <StatusPill data={data} /> : null}
      <span className="ml-auto flex shrink-0 items-center gap-2 font-mono text-nano text-ink-3">
        {stale && (
          <span className="inline-flex items-center gap-1.5 text-ink-2">
            <span className="size-1.5 animate-pulse rounded-full bg-accent" /> atualizando
          </span>
        )}
        <span>{context}</span>
        {data && (
          <>
            <span className="text-ink-4" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="clock" size={11} />
              {fmtUpdatedAt(data.updatedAt)}
            </span>
          </>
        )}
      </span>
    </header>
  );
}

function ErrorState({ title, onRetry, compact }: { title: string; onRetry: () => void; compact?: boolean }) {
  return (
    <div className={clsx('flex gap-3', compact ? 'items-center py-1' : 'flex-col items-start py-1')}>
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-danger-soft text-danger">
        <Icon name="info" size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-small font-medium text-ink">Não deu para buscar os números de {title} agora.</p>
        <p className="text-caption text-ink-3">
          O TSE pode estar lento. Escondemos os números antigos para não confundir. A página tenta de novo sozinha a cada minuto.
        </p>
      </div>
      <button type="button" className="btn btn-solid shrink-0" onClick={onRetry}>
        Tentar de novo
      </button>
    </div>
  );
}

/* -------------------------------------------------------------- candidatos */

function Candidates({
  data,
  photoUf,
  majority,
  stale,
  expanded,
  onToggle,
  listOnly,
}: Props & { expanded: boolean; onToggle: () => void; listOnly?: boolean }) {
  const [limit, setLimit] = useState(PAGE);
  if (!data) return <RowsSkeleton />;
  const list = data.candidates;
  if (list.length === 0) return <p className="text-small text-ink-3">O TSE ainda não publicou candidatos para este recorte.</p>;

  if (list.length === 2 && !listOnly)
    return (
      <div className={clsx('transition-opacity duration-300', stale && 'opacity-60')}>
        <Duel a={list[0]} b={list[1]} data={data} photoUf={photoUf} majority={majority} />
      </div>
    );

  const shown = expanded ? list.slice(0, limit) : list.slice(0, 4);
  return (
    <div className={clsx('flex min-h-0 flex-1 flex-col transition-opacity duration-300', stale && 'opacity-60')}>
      {!listOnly && <StackBar candidates={list} majority={majority} />}
      <ol className={clsx('min-h-0', !listOnly && 'mt-1.5', expanded && !listOnly && 'scroll-y -mr-2 max-h-[38dvh] flex-1 pr-2')}>
        {shown.map((c, i) => (
          <Row
            key={c.sqcand}
            c={c}
            rank={i + 1}
            electionId={data.electionId}
            photoUf={photoUf}
            max={list[0].percent}
            animate={i < ANIMATED_ROWS}
          />
        ))}
      </ol>
      {expanded && list.length > limit && (
        <button type="button" className="btn -ml-2 mt-1 self-start text-caption text-ink-3" onClick={() => setLimit((l) => l + PAGE)}>
          Mostrar mais {Math.min(PAGE, list.length - limit)}
        </button>
      )}
      {!listOnly && list.length > 4 && (
        <button
          type="button"
          onClick={() => {
            onToggle();
            setLimit(PAGE);
          }}
          className="btn -ml-2 mt-1 h-7 self-start text-caption text-ink-3"
          aria-expanded={expanded}
        >
          {expanded ? 'Mostrar menos' : `Ver todos os ${list.length}`}
          <Icon name="chevron-down" size={13} className={clsx('transition-transform', expanded && 'rotate-180')} />
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- duelo */

function Duel({
  a,
  b,
  data,
  photoUf,
  majority,
  mobile,
}: {
  a: CandidateRow;
  b: CandidateRow;
  data: ParsedResult;
  photoUf: string;
  majority: boolean;
  mobile?: boolean;
}) {
  const started = a.votes + b.votes > 0;
  const lead = a.votes === b.votes ? null : a.votes > b.votes ? a : b;
  const diff = Math.abs(a.votes - b.votes);

  return (
    <div data-dock-anim>
      <div className={clsx('grid items-center', mobile ? 'grid-cols-2 gap-3' : 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-4')}>
        <Side c={a} data={data} photoUf={photoUf} mobile={mobile} />
        {!mobile && <Center started={started} lead={lead} diff={diff} />}
        <Side c={b} data={data} photoUf={photoUf} mobile={mobile} right />
      </div>
      <DuelBar a={a} b={b} majority={majority} mobile={mobile} />
      {mobile && started && lead && (
        <p className="mt-1.5 text-center text-caption text-ink-2">
          {titleCase(lead.shortName)} tem <Int value={diff} className="font-medium text-ink" /> votos de vantagem
        </p>
      )}
    </div>
  );
}

function Side({
  c,
  data,
  photoUf,
  right,
  mobile,
}: {
  c: CandidateRow;
  data: ParsedResult;
  photoUf: string;
  right?: boolean;
  mobile?: boolean;
}) {
  const color = c.percent > 0 ? candText(c.color) : 'var(--text-3)';
  if (mobile)
    return (
      <div className={clsx('flex min-w-0 flex-col gap-1', right && 'items-end text-right')}>
        <div className={clsx('flex max-w-full items-center gap-2', right && 'flex-row-reverse')}>
          <CandidateAvatar candidate={c} electionId={data.electionId} photoUf={photoUf} size={26} />
          <p className="min-w-0 truncate text-small font-medium text-ink">{titleCase(c.shortName)}</p>
        </div>
        <span style={{ color }}>
          <Pct value={c.percent} className="text-[1.625rem] font-medium leading-7 tracking-[-0.03em]" />
        </span>
        <p className="tnum truncate font-mono text-nano text-ink-3">
          {c.party} · <Int value={c.votes} /> votos
        </p>
      </div>
    );
  return (
    <div className={clsx('flex min-w-0 items-center gap-3', right && 'flex-row-reverse text-right')}>
      <CandidateAvatar candidate={c} electionId={data.electionId} photoUf={photoUf} size={48} />
      <div className={clsx('flex min-w-0 flex-1 flex-col', right && 'items-end')}>
        <p className={clsx('flex max-w-full items-center gap-1.5', right && 'flex-row-reverse')}>
          <span className="truncate text-body font-medium text-ink">{titleCase(c.shortName)}</span>
          <span className="pill pill-muted shrink-0">
            {c.party} {c.number}
          </span>
        </p>
        <div className={clsx('mt-0.5 flex items-baseline gap-2.5', right && 'flex-row-reverse')}>
          <span style={{ color }} className="shrink-0">
            <Pct value={c.percent} className="nf-big text-[2.25rem] font-medium leading-[2.5rem] tracking-[-0.035em] xl:text-[2.5rem]" />
          </span>
          <span className="tnum truncate font-mono text-micro text-ink-2">
            <Int value={c.votes} /> votos
          </span>
        </div>
      </div>
    </div>
  );
}

function Center({ started, lead, diff }: { started: boolean; lead: CandidateRow | null; diff: number }) {
  return (
    <div className="flex w-28 flex-col items-center gap-1 text-center xl:w-32">
      {started ? (
        lead ? (
          <>
            <span className="eyebrow">Vantagem</span>
            <span className="tnum text-small font-medium text-ink">
              <Int value={diff} /> votos
            </span>
            <span className="pill" style={{ color: candText(lead.color) }}>
              {titleCase(lead.shortName.split(' ')[0])}
            </span>
          </>
        ) : (
          <span className="pill pill-muted">Empate</span>
        )
      ) : (
        <>
          <span className="eyebrow">Vantagem</span>
          <span className="text-small text-ink-3">sem votos ainda</span>
        </>
      )}
    </div>
  );
}

function DuelBar({ a, b, majority, mobile }: { a: CandidateRow; b: CandidateRow; majority: boolean; mobile?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const started = a.percent + b.percent > 0;
  useLayoutEffect(() => {
    ref.current?.querySelectorAll<HTMLElement>('[data-seg]').forEach((n) =>
      gsap.to(n, { width: `${n.dataset.seg}%`, duration: dur(1.1), ease: 'power3.out', overwrite: true }),
    );
  }, [a.percent, b.percent]);
  return (
    <div className="mt-3">
      <div className="relative">
        <div
          ref={ref}
          className={clsx('track flex', mobile ? 'h-3' : 'h-4', !started && 'track-hatch')}
          role="img"
          aria-label={
            started
              ? `${titleCase(a.shortName)} ${fmtPct(a.percent)}, ${titleCase(b.shortName)} ${fmtPct(b.percent)}`
              : 'Nenhum voto apurado ainda'
          }
        >
          <span data-seg={started ? a.percent : 0} className="h-full" style={{ width: 0, background: candFill(a.color) }} />
          <span className="flex-1" />
          <span data-seg={started ? b.percent : 0} className="h-full" style={{ width: 0, background: candFill(b.color) }} />
        </div>
        {majority && <span className="absolute -inset-y-1 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-ink" aria-hidden />}
      </div>
      <div className="mt-1.5 flex items-start justify-between gap-3 font-mono text-nano text-ink-3">
        <span className="min-w-0 truncate">{!started && (mobile ? 'Votos a partir das 17h (Brasília)' : 'Os votos aparecem depois das 17h (Brasília)')}</span>
        {majority && <span className="shrink-0 text-ink-2">50% dos válidos</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ 1º turno */

function StackBar({ candidates, majority }: { candidates: CandidateRow[]; majority: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const top = candidates.slice(0, 5);
  const rest = candidates.slice(5).reduce((s, c) => s + c.percent, 0);
  const started = candidates.some((c) => c.percent > 0);
  const sig = top.map((c) => c.percent).join('|') + rest;
  useLayoutEffect(() => {
    ref.current?.querySelectorAll<HTMLElement>('[data-seg]').forEach((n) =>
      gsap.to(n, { width: `${n.dataset.seg}%`, duration: dur(1.1), ease: 'power3.out', overwrite: true }),
    );
  }, [sig]);
  return (
    <div className="relative" data-dock-anim>
      <div ref={ref} className={clsx('track flex h-2.5', !started && 'track-hatch')} aria-hidden>
        {started &&
          top.map((c, i) => (
            <span
              key={c.sqcand}
              data-seg={c.percent}
              className={clsx('h-full', i > 0 && 'border-l border-raised')}
              style={{ width: 0, background: candFill(c.color) }}
            />
          ))}
        {started && rest > 0 && <span data-seg={rest} className="h-full border-l border-raised bg-ink-4" style={{ width: 0 }} />}
      </div>
      {majority && <span className="absolute -inset-y-1 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-ink" aria-hidden />}
    </div>
  );
}

function Row({
  c,
  rank,
  electionId,
  photoUf,
  max,
  animate,
}: {
  c: CandidateRow;
  rank: number;
  electionId: string;
  photoUf: string;
  max: number;
  animate: boolean;
}) {
  const w = max > 0 ? (c.percent / max) * 100 : 0;
  // só destaca o que importa: eleito ou indo ao 2º turno ("Não eleito" vira ruído)
  const status = c.status && !/^n[aã]o/i.test(c.status) && /eleit|2º/i.test(c.status) ? c.status : null;
  return (
    <li
      data-dock-anim
      className="grid h-8 grid-cols-[1.25rem_auto_minmax(0,1fr)_3rem_3.75rem_minmax(4rem,auto)] items-center gap-x-2.5 border-b border-line last:border-b-0 sm:grid-cols-[1.25rem_auto_minmax(0,1fr)_4.5rem_4rem_5.5rem]"
    >
      <span className="tnum font-mono text-nano text-ink-3">{String(rank).padStart(2, '0')}</span>
      <CandidateAvatar candidate={c} electionId={electionId} photoUf={photoUf} size={22} ring={false} />
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-small font-medium text-ink">{titleCase(c.shortName)}</span>
        <span className="hidden shrink-0 font-mono text-nano text-ink-3 sm:inline">{c.party}</span>
        {status && (
          <span className={clsx('pill hidden shrink-0 sm:inline-flex', /^eleit/i.test(status) ? 'pill-live' : 'pill-waiting')}>{status}</span>
        )}
      </span>
      <span className="track h-1" aria-hidden>
        <span
          className="block h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${w}%`, background: candFill(c.color) }}
        />
      </span>
      <span className="text-right text-small font-medium text-ink">
        {animate ? <Pct value={c.percent} /> : <span className="tnum">{fmtPct(c.percent)}</span>}
      </span>
      <span className="text-right font-mono text-nano text-ink-3">
        {animate ? <Int value={c.votes} /> : <span className="tnum">{fmtInt(c.votes)}</span>}
      </span>
    </li>
  );
}

function RowsSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 py-1" aria-hidden>
      <Skeleton className="h-2.5 w-full rounded-full" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2.5" style={{ opacity: 1 - i * 0.25 }}>
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------- participação: linhas densas */

function StatRows({ data, columns = 1 }: { data: ParsedResult | null; columns?: 1 | 2 }) {
  const t = data?.turnout;
  const started = hasStarted(t);
  const after = (v: number | undefined) => (started && v !== undefined ? v : null);
  const items: Array<{
    icon: Parameters<typeof Icon>[0]['name'];
    label: string;
    value: number | null;
    kind: 'pct' | 'int';
    bar?: number;
  }> = [
    { icon: 'ballot', label: 'Urnas apuradas', value: t ? t.sectionsPct : null, kind: 'pct', bar: t?.sectionsPct ?? 0 },
    { icon: 'users', label: 'Comparecimento', value: after(t?.turnoutPct), kind: 'pct' },
    { icon: 'user-minus', label: 'Abstenção', value: after(t?.abstentionPct), kind: 'pct' },
    { icon: 'square', label: 'Brancos', value: after(t?.blankPct), kind: 'pct' },
    { icon: 'x-square', label: 'Nulos', value: after(t?.nullPct), kind: 'pct' },
    { icon: 'id', label: 'Eleitorado', value: t ? t.electorate : null, kind: 'int' },
  ];
  return (
    <dl className={clsx(columns === 2 ? 'grid grid-flow-col grid-cols-2 grid-rows-3 gap-x-5' : 'flex flex-col')}>
      {items.map((it) => (
        <div
          key={it.label}
          className={clsx(
            'relative grid h-[1.875rem] grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-x-2 border-b border-line',
            columns === 2 ? '[&:nth-child(3n)]:border-b-0' : 'last:border-b-0',
          )}
          data-dock-anim
        >
          <Icon name={it.icon} size={13} className="text-ink-3" />
          <dt className="flex min-w-0 items-center gap-2.5 text-caption text-ink-2">
            <span className="truncate">{it.label}</span>
          </dt>
          {it.bar !== undefined && (
            <span className="absolute inset-x-0 -bottom-px h-[2px] overflow-hidden" aria-hidden>
              <span className="block h-full bg-ink/80 transition-[width] duration-700 ease-out" style={{ width: `${Math.min(100, it.bar)}%` }} />
            </span>
          )}
          <dd className="text-right text-small font-medium text-ink">
            {!data ? (
              <Skeleton className="h-3.5 w-14" />
            ) : it.value === null ? (
              <span className="text-ink-3" title="Aparece quando a apuração começar">
                —
              </span>
            ) : it.kind === 'pct' ? (
              <Pct value={it.value} />
            ) : (
              <Int value={it.value} />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

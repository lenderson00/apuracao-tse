import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import gsap from 'gsap';
import type { CandidateRow, ParsedResult } from '../lib/tse/types';
import { hasStarted } from '../lib/ui/turnout';
import { candFill, candText } from '../lib/ui/color';
import { fmtInt, fmtPct, fmtPctNumber, fmtUpdatedAt, titleCase } from '../lib/ui/format';
import { dur, prefersReducedMotion } from '../lib/ui/motion';
import { AnimatedNumber } from './AnimatedNumber';
import { CandidateAvatar } from './CandidateAvatar';
import { TextScramble } from './TextScramble';
import { Badge } from './ui/Badge';
import { Icon } from './ui/Icon';
import { Skeleton } from './ui/Skeleton';
import { Tabs } from './ui/Tabs';


export function StatusBadge({ data, loading }: { data: ParsedResult | null; loading?: boolean }) {
  if (!data) return loading ? <Skeleton className="h-5 w-28 rounded-full" /> : null;
  if (data.finished) return <Badge tone="done">Apuração encerrada</Badge>;
  if (hasStarted(data.turnout))
    return (
      <Badge tone="live" dot>
        Em apuração
      </Badge>
    );
  return (
    <Badge tone="muted" dot>
      Aguardando apuração
    </Badge>
  );
}

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
}

export function Dock(props: Props) {
  const { mode, data, error, empty } = props;
  const rootRef = useRef<HTMLElement>(null);
  const [tab, setTab] = useState<'cand' | 'part'>('cand');
  const [expanded, setExpanded] = useState(false);
  const dataKey = data ? `${data.officeId}-${data.round}-${data.scope}-${data.scopeCode}` : 'none';

  /* entrada do dock */
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || prefersReducedMotion()) return;
    gsap.fromTo(el, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', delay: 0.25 });
  }, []);

  /* cross-fade quando o recorte muda: linhas entram em stagger curto */
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
      { opacity: 0.2, y: 4 },
      { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', stagger: 0.03, overwrite: true },
    );
  }, [dataKey]);

  const content = error ? (
    <ErrorState title={props.title} onRetry={props.onRetry} compact={mode === 'desktop'} />
  ) : empty && !data ? (
    empty
  ) : null;

  if (mode === 'mobile') {
    return (
      <section
        ref={rootRef}
        aria-label={`Resultado: ${props.title}`}
        className={clsx(
          'float pointer-events-auto flex flex-col rounded-b-none rounded-t-2xl border-b-0 transition-[max-height] duration-500 ease-out',
          'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
          expanded ? 'max-h-[74dvh]' : 'max-h-[min(44dvh,330px)]',
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="-mb-3 flex h-11 w-full shrink-0 items-start justify-center pt-2"
          aria-label={expanded ? 'Recolher painel' : 'Expandir painel'}
          aria-expanded={expanded}
        >
          <span className="h-1 w-9 rounded-full bg-line-loud" />
        </button>
        <div className="px-4">
          <Header {...props} />
        </div>
        {content ? (
          <div className="px-4 pt-3">{content}</div>
        ) : (
          <>
            <div className="mt-2 px-4">
              <Tabs
                variant="line"
                label="Detalhes"
                value={tab}
                onChange={setTab}
                items={[
                  { value: 'cand', label: 'Candidatos' },
                  { value: 'part', label: 'Participação' },
                ]}
              />
            </div>
            <div className="scroll-y min-h-0 flex-1 px-4 pt-3">
              {tab === 'cand' ? (
                <Candidates {...props} limit={expanded ? 999 : 3} onMore={() => setExpanded(true)} />
              ) : (
                <Stats data={props.data} loading={!data} columns={3} />
              )}
            </div>
          </>
        )}
      </section>
    );
  }

  return (
    <section
      ref={rootRef}
      aria-label={`Resultado: ${props.title}`}
      className="float pointer-events-auto flex max-h-[min(62dvh,560px)] flex-col rounded-2xl px-4 pb-3.5 pt-3"
    >
      <Header {...props} />
      {content ? (
        <div className="pt-3">{content}</div>
      ) : (
        <div className="mt-3 grid min-h-0 grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 xl:gap-5">
          <div className="flex min-h-0 flex-col">
            <Candidates {...props} limit={expanded ? 999 : 4} onMore={() => setExpanded((v) => !v)} expanded={expanded} />
          </div>
          <div className="border-l border-line pl-4 xl:pl-5">
            <Stats data={props.data} loading={!data} columns={3} />
          </div>
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function Header({ kindLabel, title, context, data, loading, stale }: Props) {
  return (
    <header className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      <div className="flex min-w-0 items-baseline gap-2.5">
        <TextScramble text={kindLabel} className="eyebrow shrink-0" />
        <h2 className="truncate text-title font-medium text-ink" data-dock-anim>
          {title}
        </h2>
      </div>
      <StatusBadge data={data} loading={loading} />
      <span className="flex items-center gap-2 font-mono text-nano text-ink-3 sm:ml-auto">
        {stale && (
          <span className="inline-flex items-center gap-1.5 text-ink-2">
            <span className="size-1.5 animate-pulse rounded-full bg-accent" /> atualizando
          </span>
        )}
        <span className="hidden sm:inline">{context}</span>
        {data && (
          <>
            <span className="hidden text-ink-4 sm:inline">·</span>
            <span>Atualizado {fmtUpdatedAt(data.updatedAt)}</span>
          </>
        )}
      </span>
    </header>
  );
}

function ErrorState({ title, onRetry, compact }: { title: string; onRetry: () => void; compact?: boolean }) {
  return (
    <div className={clsx('flex items-center gap-3', compact ? 'py-1' : 'flex-col items-start py-2')}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-danger-soft text-danger">
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
  limit,
  onMore,
  expanded,
  mode,
}: Props & { limit: number; onMore: () => void; expanded?: boolean }) {
  if (!data) return <RowsSkeleton />;
  const list = data.candidates;
  if (list.length === 0)
    return <p className="text-small text-ink-3">O TSE ainda não publicou candidatos para este recorte.</p>;

  const duel = list.length === 2;
  return (
    <div className={clsx('flex min-h-0 flex-col transition-opacity duration-300', stale && 'opacity-60')}>
      {duel ? (
        <Duel a={list[0]} b={list[1]} electionId={data.electionId} photoUf={photoUf} majority={majority} mobile={mode === 'mobile'} />
      ) : (
        <>
          <StackBar candidates={list} majority={majority} />
          <ol className={clsx('mt-2 min-h-0', expanded && 'scroll-y -mr-2 pr-2')}>
            {list.slice(0, limit).map((c, i) => (
              <Row key={c.sqcand} c={c} rank={i + 1} electionId={data.electionId} photoUf={photoUf} max={list[0].percent} />
            ))}
          </ol>
          {list.length > 4 && (
            <button
              type="button"
              onClick={onMore}
              className="btn -ml-2 mt-1 self-start text-caption text-ink-3"
              aria-expanded={!!expanded}
            >
              {expanded ? 'Mostrar menos' : `Ver todos os ${list.length}`}
              <Icon name="chevron-down" size={13} className={clsx('transition-transform', expanded && 'rotate-180')} />
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Duel({
  a,
  b,
  electionId,
  photoUf,
  majority,
  mobile,
}: {
  a: CandidateRow;
  b: CandidateRow;
  electionId: string;
  photoUf: string;
  majority: boolean;
  mobile?: boolean;
}) {
  return (
    <div data-dock-anim>
      <div className="grid grid-cols-2 gap-3">
        {[a, b].map((c, i) => {
          const right = i === 1;
          if (mobile)
            return (
              <div key={c.sqcand} className={clsx('flex min-w-0 flex-col gap-1', right && 'items-end text-right')}>
                <div className={clsx('flex min-w-0 max-w-full items-center gap-2', right && 'flex-row-reverse')}>
                  <CandidateAvatar candidate={c} electionId={electionId} photoUf={photoUf} size={24} />
                  <p className="truncate text-small font-medium text-ink">{titleCase(c.shortName)}</p>
                </div>
                <div className={clsx('flex items-baseline gap-2', right && 'flex-row-reverse')}>
                  <p className="tnum text-figure font-medium" style={{ color: c.percent > 0 ? candText(c.color) : 'var(--text-3)' }}>
                    <AnimatedNumber value={c.percent} format={fmtPctNumber} from={0} duration={1.2} />
                    <span className="ml-px align-top text-[0.5em] tracking-normal">%</span>
                  </p>
                  <p className="tnum truncate font-mono text-nano text-ink-3">
                    {c.party} · <AnimatedNumber value={c.votes} format={fmtInt} />
                  </p>
                </div>
              </div>
            );
          return (
            <div key={c.sqcand} className={clsx('flex min-w-0 items-center gap-3', right && 'flex-row-reverse text-right')}>
              <p
                className={clsx('tnum shrink-0 font-medium', mobile ? 'text-figure' : 'text-display')}
                style={{ color: c.percent > 0 ? candText(c.color) : 'var(--text-3)' }}
              >
                <AnimatedNumber value={c.percent} format={fmtPctNumber} from={0} duration={1.2} />
                <span className="ml-px align-top text-[0.45em] tracking-normal">%</span>
              </p>
              <CandidateAvatar candidate={c} electionId={electionId} photoUf={photoUf} size={mobile ? 28 : 34} />
              <div className={clsx('min-w-0 flex-1', right && 'flex flex-col items-end')}>
                <p className="truncate text-small font-medium text-ink">{titleCase(c.shortName)}</p>
                <p className="tnum truncate font-mono text-nano text-ink-3">
                  {c.party} {c.number} · <AnimatedNumber value={c.votes} format={fmtInt} />{mobile ? '' : ' votos'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <DuelBar a={a} b={b} majority={majority} />
    </div>
  );
}

function DuelBar({ a, b, majority }: { a: CandidateRow; b: CandidateRow; majority: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const started = a.percent + b.percent > 0;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.querySelectorAll<HTMLElement>('[data-seg]').forEach((n) =>
      gsap.to(n, { width: `${n.dataset.seg}%`, duration: dur(1.1), ease: 'power3.out', overwrite: true }),
    );
  }, [a.percent, b.percent]);
  return (
    <div className="mt-2.5">
      <div className="relative">
      <div ref={ref} className={clsx('track flex h-2.5', !started && 'track-hatch')} role="img" aria-label={started ? `${titleCase(a.shortName)} ${fmtPct(a.percent)}, ${titleCase(b.shortName)} ${fmtPct(b.percent)}` : 'Nenhum voto apurado ainda'}>
        <span data-seg={started ? a.percent : 0} className="h-full" style={{ width: 0, background: candFill(a.color) }} />
        <span className="flex-1" />
        <span data-seg={started ? b.percent : 0} className="h-full" style={{ width: 0, background: candFill(b.color) }} />
      </div>
      {majority && <span className="absolute -inset-y-1 left-1/2 w-px -translate-x-1/2 bg-ink/80" aria-hidden />}
      </div>
      {!started && (
        <p className="mt-1.5 text-center font-mono text-nano text-ink-3">
          Os votos aparecem depois que as urnas fecham, às 17h de Brasília
        </p>
      )}
    </div>
  );
}

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
      <div ref={ref} className={clsx('track flex h-2', !started && 'track-hatch')} aria-hidden>
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
      {majority && <span className="absolute -inset-y-1 left-1/2 w-px -translate-x-1/2 bg-ink/80" aria-hidden />}
    </div>
  );
}

function Row({
  c,
  rank,
  electionId,
  photoUf,
  max,
}: {
  c: CandidateRow;
  rank: number;
  electionId: string;
  photoUf: string;
  max: number;
}) {
  const w = max > 0 ? (c.percent / max) * 100 : 0;
  return (
    <li
      data-dock-anim
      className="grid h-8 grid-cols-[1.1rem_auto_minmax(0,1fr)_3.5rem_3.6rem_minmax(4.5rem,auto)] items-center gap-x-2.5 border-b border-line last:border-b-0 sm:grid-cols-[1.1rem_auto_minmax(0,1fr)_4.5rem_3.8rem_5.5rem]"
    >
      <span className="tnum font-mono text-nano text-ink-4">{String(rank).padStart(2, '0')}</span>
      <CandidateAvatar candidate={c} electionId={electionId} photoUf={photoUf} size={22} ring={false} />
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className="truncate text-small font-medium text-ink">{titleCase(c.shortName)}</span>
        <span className="shrink-0 font-mono text-nano text-ink-3">{c.party}</span>
      </span>
      <span className="track h-1" aria-hidden>
        <span
          className="block h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${w}%`, background: candFill(c.color) }}
        />
      </span>
      <span className="tnum text-right text-small font-medium text-ink">
        <AnimatedNumber value={c.percent} format={fmtPct} />
      </span>
      <span className="tnum text-right font-mono text-nano text-ink-3">
        <AnimatedNumber value={c.votes} format={fmtInt} />
      </span>
    </li>
  );
}

function RowsSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 py-1" aria-hidden>
      <Skeleton className="h-2 w-full rounded-full" />
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

/* ------------------------------------------------------------ participação */

function Stats({ data, loading, columns }: { data: ParsedResult | null; loading: boolean; columns: 2 | 3 }) {
  const t = data?.turnout;
  const started = hasStarted(t);
  const after = (v: number | undefined) => (started && v !== undefined ? v : null);
  const items: Array<{ label: string; value: number | null; format: (n: number) => string; progress?: number }> = [
    { label: 'Urnas apuradas', value: t ? t.sectionsPct : null, format: fmtPct, progress: t?.sectionsPct ?? 0 },
    { label: 'Comparecimento', value: after(t?.turnoutPct), format: fmtPct },
    { label: 'Abstenção', value: after(t?.abstentionPct), format: fmtPct },
    { label: 'Brancos', value: after(t?.blankPct), format: fmtPct },
    { label: 'Nulos', value: after(t?.nullPct), format: fmtPct },
    { label: 'Eleitorado', value: t ? t.electorate : null, format: fmtInt },
  ];
  return (
    <dl className={clsx('grid gap-1.5', columns === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
      {items.map((it) => (
        <div key={it.label} className="cell flex min-w-0 flex-col gap-0.5 px-2.5 py-1.5" data-dock-anim>
          <dt className="eyebrow truncate !text-[0.5625rem] sm:!text-nano">{it.label}</dt>
          <dd className="tnum truncate text-[0.875rem] font-medium leading-5 text-ink xl:text-[0.9375rem]">
            {loading ? (
              <Skeleton className="mt-0.5 h-4 w-14" />
            ) : it.value === null ? (
              <span className="text-ink-3" title="Disponível quando a apuração começar">
                —
              </span>
            ) : (
              <AnimatedNumber value={it.value} format={it.format} />
            )}
          </dd>
          {it.progress !== undefined && (
            <span className="track mt-0.5 h-[3px]" aria-hidden>
              <span
                className="block h-full rounded-full bg-ink transition-[width] duration-700 ease-out"
                style={{ width: `${Math.min(100, it.progress)}%` }}
              />
            </span>
          )}
        </div>
      ))}
    </dl>
  );
}

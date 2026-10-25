import { useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import gsap from 'gsap';
import type { StateLeader } from '../hooks/useStateLeaders';
import { GOV_RUNOFF_UFS, UF_LIST } from '../lib/tse/config';
import type { CandidateRow, OfficeId, ParsedResult, Round } from '../lib/tse/types';
import { candFill, candText } from '../lib/ui/color';
import { fmtInt, fmtPct, fmtPct1, fmtPctNumber, fmtUpdatedAt, titleCase } from '../lib/ui/format';
import { DUR, EASE, dur } from '../lib/ui/motion';
import { useMediaQuery } from '../lib/ui/useMediaQuery';
import { AnimatedNumber } from './AnimatedNumber';
import { CandidateAvatar } from './CandidateAvatar';
import { CandidateList } from './CandidateList';
import { DuelBar } from './DuelBar';
import { TurnoutStats } from './TurnoutStats';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { Skeleton } from './ui/Skeleton';

interface Props {
  round: Round;
  officeId: OfficeId;
  officeLabel: string;
  /** resultado nacional; null quando o cargo não tem consolidado nacional */
  national: { data: ParsedResult | null; loading: boolean; error: string | null } | null;
  stateLeaders: Record<string, StateLeader>;
  onPickState: (slug: string) => void;
}

export function ResultStatus({ data }: { data: ParsedResult | null }) {
  if (!data) return <Skeleton className="h-6 w-36 rounded-full" />;
  const t = data.turnout;
  if (data.finished) return <Badge tone="done">Apuração encerrada</Badge>;
  if (t.apurationStarted)
    return (
      <Badge tone="live" dot>
        Em apuração · {fmtPct(t.sectionsPct)}
      </Badge>
    );
  return (
    <Badge tone="muted" dot>
      Aguardando apuração
    </Badge>
  );
}

export function Hero({ round, officeId, officeLabel, national, stateLeaders, onPickState }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-reveal]', {
        y: 14,
        opacity: 0,
        duration: dur(DUR.slow + 0.3),
        ease: EASE.out,
        stagger: 0.07,
        clearProps: 'transform,opacity',
      });
    }, el);
    return () => ctx.revert();
  }, [round, officeId]);

  return (
    <div ref={ref}>
      {national ? (
        <NationalResult round={round} officeLabel={officeLabel} {...national} />
      ) : (
        <StateBoard
          round={round}
          officeId={officeId}
          officeLabel={officeLabel}
          stateLeaders={stateLeaders}
          onPickState={onPickState}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function NationalResult({
  round,
  officeLabel,
  data,
  loading,
  error,
}: {
  round: Round;
  officeLabel: string;
  data: ParsedResult | null;
  loading: boolean;
  error: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const othersRef = useRef<HTMLDivElement>(null);
  const candidates = data?.candidates ?? [];
  const [a, b] = candidates;
  const others = candidates.slice(2);
  const started = data?.turnout.apurationStarted ?? false;
  const leaderId = started && a && b && a.votes !== b.votes ? a.sqcand : null;
  const skeleton = !data && (loading || !error);

  useLayoutEffect(() => {
    const el = othersRef.current;
    if (!el) return;
    gsap.to(el, {
      height: showAll ? 'auto' : 0,
      opacity: showAll ? 1 : 0,
      duration: dur(0.45),
      ease: showAll ? EASE.out : 'power2.inOut',
    });
  }, [showAll]);

  return (
    <>
      <div data-reveal className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <ResultStatus data={data} />
        <span className="font-mono text-caption text-ink-3">
          {data ? `Atualizado em ${fmtUpdatedAt(data.updatedAt)}` : 'Buscando dados no TSE…'}
        </span>
      </div>

      <h1 data-reveal className="mt-5 text-headline font-medium text-ink sm:text-[2.5rem] sm:leading-[1.05] sm:tracking-[-0.03em]">
        {officeLabel}, {round}º turno
      </h1>
      <p data-reveal className="mt-2 max-w-xl text-body text-ink-3">
        Percentual de votos válidos no Brasil, com números publicados pelo TSE.
      </p>

      {error && !data && (
        <Card variant="flat" className="mt-8 flex items-start gap-3 p-5 text-small text-ink-2">
          <Icon name="info" className="mt-0.5 shrink-0 text-danger" />
          <div>
            <p className="font-medium text-ink">Não deu para falar com o TSE agora.</p>
            <p className="mt-1 text-ink-3">A página tenta de novo sozinha a cada minuto.</p>
          </div>
        </Card>
      )}

      <div data-reveal className="mt-10 grid grid-cols-2 gap-x-4 sm:gap-x-10">
        {skeleton ? (
          <>
            <FaceSkeleton />
            <FaceSkeleton align="right" />
          </>
        ) : (
          <>
            {a && data && (
              <Face candidate={a} data={data} leading={leaderId === a.sqcand} rank={1} />
            )}
            {b && data && (
              <Face candidate={b} data={data} leading={leaderId === b.sqcand} rank={2} align="right" />
            )}
          </>
        )}
      </div>

      <div data-reveal className="mt-8 sm:mt-10">
        {skeleton ? (
          <Skeleton className="h-3.5 w-full rounded-full" />
        ) : (
          <DuelBar
            candidates={round === 2 ? candidates.slice(0, 2) : candidates}
            majority
            majorityHint={
              round === 1
                ? 'Para vencer no 1º turno, é preciso mais da metade dos votos válidos.'
                : 'Metade dos votos válidos. Quem passar dela vence.'
            }
          />
        )}
        <div className="mt-9 flex min-h-5 items-start justify-between gap-4 text-caption text-ink-3">
          {data && !started && !data.finished ? (
            <p className="flex max-w-md items-start gap-2">
              <Icon name="info" size={14} className="mt-0.5 shrink-0" />
              <span>
                Os votos começam a aparecer depois que as urnas fecham, às 17h de Brasília. Até lá, todos
                ficam com 0%.
              </span>
            </p>
          ) : (
            <span />
          )}
        </div>
      </div>

      {others.length > 0 && data && (
        <div data-reveal className="mt-6">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowAll((s) => !s)}
            aria-expanded={showAll}
            aria-controls="outros-candidatos"
          >
            {showAll ? 'Esconder' : `Outros ${others.length} candidatos`}
            <Icon name="chevron-down" size={14} className={clsx('transition-transform duration-300', showAll && 'rotate-180')} />
          </Button>
          <div ref={othersRef} id="outros-candidatos" className="overflow-hidden" style={{ height: 0, opacity: 0 }}>
            <Card variant="flat" className="mt-4 px-4 sm:px-5">
              <CandidateList
                candidates={others}
                electionId={data.electionId}
                photoUf="br"
                startRank={3}
                pageSize={10}
                dense
              />
            </Card>
          </div>
        </div>
      )}

      <div data-reveal className="mt-12 border-t border-line pt-8">
        <TurnoutStats turnout={data?.turnout ?? null} loading={skeleton} />
      </div>
    </>
  );
}

function Face({
  candidate: c,
  data,
  leading,
  rank,
  align = 'left',
}: {
  candidate: CandidateRow;
  data: ParsedResult;
  leading: boolean;
  rank: number;
  align?: 'left' | 'right';
}) {
  const right = align === 'right';
  const status = c.status;
  const wide = useMediaQuery('(min-width: 640px)');
  return (
    <div className={clsx('flex min-w-0 flex-col', right ? 'items-end text-right' : 'items-start')}>
      <div className={clsx('flex items-center gap-3 sm:gap-4', right && 'flex-row-reverse')}>
        <CandidateAvatar
          candidate={c}
          electionId={data.electionId}
          photoUf="br"
          size={wide ? 80 : 60}
        />
        <div className={clsx('flex min-w-0 flex-col gap-1.5', right && 'items-end')}>
          <span className="font-mono text-micro text-ink-3">
            {String(rank).padStart(2, '0')} · {c.party} {c.number}
          </span>
          {(leading || status) && (
            <span className="hidden sm:block">
              {status ? (
                <Badge tone={/^eleit/i.test(status) ? 'done' : 'muted'}>{status}</Badge>
              ) : (
                <Badge tone="live">À frente</Badge>
              )}
            </span>
          )}
        </div>
      </div>
      <h2 className="mt-4 max-w-full truncate text-lead font-medium text-ink sm:text-headline">
        {titleCase(c.shortName)}
      </h2>
      <p
        className="tnum mt-2 text-display font-medium sm:mt-3"
        style={{ color: c.percent > 0 ? candText(c.color) : 'var(--text-3)' }}
      >
        <AnimatedNumber value={c.percent} format={fmtPctNumber} from={0} duration={1.4} />
        <span className="ml-0.5 align-top text-[0.42em] tracking-normal">%</span>
      </p>
      <p className="tnum mt-3 font-mono text-caption text-ink-3">
        <AnimatedNumber value={c.votes} format={fmtInt} from={0} duration={1.4} /> votos
      </p>
    </div>
  );
}

function FaceSkeleton({ align = 'left' }: { align?: 'left' | 'right' }) {
  const right = align === 'right';
  return (
    <div className={clsx('flex flex-col gap-4', right && 'items-end')}>
      <div className={clsx('flex items-center gap-4', right && 'flex-row-reverse')}>
        <Skeleton className="size-16 rounded-full sm:size-20" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-6 w-32 sm:w-44" />
      <Skeleton className="h-12 w-36 sm:h-20 sm:w-64" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** Cargos estaduais: sem consolidado nacional, mostra quem lidera em cada UF. */
function StateBoard({
  round,
  officeId,
  officeLabel,
  stateLeaders,
  onPickState,
}: {
  round: Round;
  officeId: OfficeId;
  officeLabel: string;
  stateLeaders: Record<string, StateLeader>;
  onPickState: (slug: string) => void;
}) {
  const runoff = officeId === '3' && round === 2;
  const ufs = UF_LIST.filter((u) => !runoff || GOV_RUNOFF_UFS.has(u.slug));
  const anyLoaded = Object.values(stateLeaders).some((s) => !s.loading);

  return (
    <>
      <div data-reveal className="flex flex-wrap items-center gap-3">
        <Badge tone="muted">Disputa estadual</Badge>
        {runoff && <span className="font-mono text-caption text-ink-3">{ufs.length} estados com 2º turno</span>}
      </div>
      <h1 data-reveal className="mt-5 text-headline font-medium text-ink sm:text-[2.5rem] sm:leading-[1.05] sm:tracking-[-0.03em]">
        {officeLabel}, {round}º turno
      </h1>
      <p data-reveal className="mt-2 max-w-xl text-body text-ink-3">
        {runoff
          ? 'Só alguns estados voltaram às urnas para governador. Escolha um para ver a disputa.'
          : 'Este cargo é decidido estado por estado. Escolha um para abrir o resultado.'}
      </p>

      <ul
        data-reveal
        className={clsx(
          'mt-10 grid gap-2',
          runoff ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-9',
        )}
      >
        {ufs.map((uf) => {
          const lead = stateLeaders[uf.slug];
          const has = lead?.hasLeader;
          return (
            <li key={uf.slug}>
              <button
                type="button"
                onClick={() => onPickState(uf.slug)}
                className="card-flat group flex w-full flex-col gap-2 px-3 py-3 text-left transition-shadow duration-200 hover:shadow-md"
                title={uf.name}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-mono text-small font-medium text-ink">{uf.sigla}</span>
                  <span
                    className="size-2 rounded-full"
                    style={{ background: has ? candFill(lead.leaderColor) : 'var(--map-neutral)' }}
                    aria-hidden
                  />
                </span>
                <span className="truncate text-caption text-ink-3">
                  {!anyLoaded || lead?.loading ? (
                    <Skeleton className="h-3 w-14" />
                  ) : has && lead.leaderName ? (
                    <>
                      {titleCase(lead.leaderName)} · {fmtPct1(lead.leaderPct)}
                    </>
                  ) : (
                    runoff ? uf.name : 'Sem votos'
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

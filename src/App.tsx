import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { BrazilMap } from './components/BrazilMap';
import { CandidateCard } from './components/CandidateCard';
import { DonutChart } from './components/DonutChart';
import { LoadingScreen } from './components/LoadingScreen';
import { MunicipalitySearch } from './components/MunicipalitySearch';
import { OfficeTabs } from './components/OfficeTabs';
import { StatsGrid } from './components/StatsGrid';
import { TextScramble } from './components/TextScramble';
import { ThemeToggle } from './components/ThemeToggle';
import { GOV_RUNOFF_UFS, UF_LIST } from './lib/tse/config';
import { buildResultPath } from './lib/tse/client';
import { useElectionResult } from './hooks/useElectionResult';
import { municipalitiesForUf, useMunicipalityIndex } from './hooks/useMunicipalityIndex';
import { useMunicipalityResults } from './hooks/useMunicipalityResults';
import { useStateLeaders } from './hooks/useStateLeaders';
import type { MunicipalityRef, OfficeId, Round } from './lib/tse/types';

type ViewLevel = 'country' | 'state' | 'municipality';

function formatBrasilia(isoLike: string): string {
  if (!isoLike) return '—';
  const [d, t] = isoLike.split(' ');
  if (!d || !t) return isoLike;
  const [dd, mm, yyyy] = d.split('/');
  const dt = new Date(`${yyyy}-${mm}-${dd}T${t}-03:00`);
  return dt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export default function App() {
  const [round, setRound] = useState<Round>(2);
  const [officeId, setOfficeId] = useState<OfficeId>('1');
  const [level, setLevel] = useState<ViewLevel>('country');
  const [ufSlug, setUfSlug] = useState<string | null>(null);
  const [mun, setMun] = useState<{ tse: string; name: string; uf: string } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  const ufMeta = UF_LIST.find((u) => u.slug === ufSlug);
  const scope: 'br' | 'uf' | 'mu' =
    level === 'municipality' && mun && ufSlug
      ? 'mu'
      : level === 'state' && ufSlug
        ? 'uf'
        : 'br';

  const scopeCode =
    scope === 'mu' && mun && ufSlug
      ? `${ufSlug}${mun.tse}`
      : scope === 'uf' && ufSlug
        ? ufSlug
        : 'br';

  const scopeLabel =
    scope === 'mu' && mun
      ? `${mun.name} — ${mun.uf}`
      : scope === 'uf' && ufMeta
        ? ufMeta.name
        : 'Brasil';

  const summaryEnabled =
    officeId === '1' ||
    (officeId === '3' && scope !== 'br') ||
    (officeId !== '3' && round === 1);

  const { data, error, loading } = useElectionResult(
    round,
    officeId,
    scope,
    scopeCode,
    scopeLabel,
    summaryEnabled,
  );

  const { map: stateLeaders } = useStateLeaders(round, officeId, true);
  const { items: munIndex } = useMunicipalityIndex(round);
  const munInUf = useMemo(
    () => (ufSlug ? municipalitiesForUf(munIndex, ufSlug) : []),
    [munIndex, ufSlug],
  );
  const { leaders: munLeaders, progress: munProgress } = useMunicipalityResults(
    round,
    officeId,
    ufSlug ?? '',
    munInUf,
    level === 'state' && !!ufSlug,
  );

  const pathMeta = buildResultPath(round, officeId, scope, scopeCode);
  const photoUf = pathMeta?.photoUf ?? 'br';

  const initialLoad = loading && !data;

  useEffect(() => {
    if (!headerRef.current) return;
    gsap.fromTo(
      headerRef.current,
      { y: -8, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out', delay: 0.15 },
    );
  }, []);

  useEffect(() => {
    if (!panelRef.current) return;
    gsap.fromTo(
      panelRef.current,
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out' },
    );
  }, [level, scopeCode, officeId]);

  const goCountry = () => {
    setLevel('country');
    setUfSlug(null);
    setMun(null);
  };

  const goState = (slug: string) => {
    if (officeId === '3' && round === 2 && !GOV_RUNOFF_UFS.has(slug)) return;
    setUfSlug(slug);
    setLevel('state');
    setMun(null);
  };

  const goMunicipality = (tseCode: string, name: string) => {
    if (!ufSlug) return;
    setMun({ tse: tseCode, name, uf: ufMeta?.sigla ?? ufSlug.toUpperCase() });
    setLevel('municipality');
  };

  const onSearchPick = (m: MunicipalityRef) => {
    setUfSlug(m.uf.toLowerCase());
    setMun({ tse: m.tseCode, name: m.name, uf: m.uf });
    setLevel('municipality');
  };

  const maxVotes = data?.candidates[0]?.votes ?? 1;

  return (
    <div className="app-shell min-h-screen">
      <LoadingScreen visible={initialLoad} />
      <header
        ref={headerRef}
        className="border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/85 backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-[var(--spacing-page-x)] py-6 sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div className="space-y-2">
            <div className="label-mono label-accent flex items-center gap-2">
              <span className="live-dot" aria-hidden />
              Apuração oficial · TSE
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-[1.75rem]">
              <TextScramble text="Eleições 2026" playOnMount={!initialLoad} />
            </h1>
            <p className="max-w-md text-sm text-[var(--color-muted)]">
              Mapa interativo e números em tempo real, direto do CDN do tribunal.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <MunicipalitySearch items={munIndex} onPick={onSearchPick} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-[var(--spacing-page-x)] py-8 sm:px-8">
        <OfficeTabs
          round={round}
          officeId={officeId}
          onRound={setRound}
          onOffice={(id) => {
            setOfficeId(id);
            if (id === '3' && round === 2 && ufSlug && !GOV_RUNOFF_UFS.has(ufSlug)) {
              goCountry();
            }
          }}
        />

        <nav
          className="mt-6 flex flex-wrap items-center gap-1.5 font-mono text-xs text-[var(--color-muted)]"
          aria-label="Navegação"
        >
          <button type="button" onClick={goCountry} className="transition hover:text-[var(--color-accent)]">
            brasil
          </button>
          {ufSlug && (
            <>
              <span className="opacity-40">/</span>
              <button
                type="button"
                onClick={() => goState(ufSlug)}
                className="transition hover:text-[var(--color-accent)]"
              >
                {ufMeta?.sigla.toLowerCase() ?? ufSlug}
              </button>
            </>
          )}
          {mun && (
            <>
              <span className="opacity-40">/</span>
              <span className="text-[var(--color-ink)]">{mun.name.toLowerCase()}</span>
            </>
          )}
        </nav>

        {officeId === '3' && scope === 'br' && round === 2 && (
          <div className="mt-6 panel-muted border-[var(--color-accent)]/25 px-4 py-3 text-sm text-[var(--color-ink-secondary)]">
            Governador não tem resultado nacional no 2º turno. Selecione um estado com segundo turno no mapa ou use a busca.
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/35 bg-red-500/8 px-4 py-3 text-sm text-red-800 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <section className="space-y-3">
            <BrazilMap
              level={level === 'country' ? 'country' : 'state'}
              ufSlug={ufSlug ?? undefined}
              stateLeaders={stateLeaders}
              munLeaders={level !== 'country' ? munLeaders : undefined}
              munProgress={munProgress}
              onSelectState={goState}
              onSelectMunicipality={goMunicipality}
            />
            <p className="label-mono px-1 normal-case tracking-normal text-[var(--color-muted)]">
              Cores = líder · intensidade = margem · fonte resultados.tse.jus.br
            </p>
          </section>

          <aside ref={panelRef}>
            <div className="panel p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-4">
                <div className="min-w-0">
                  <p className="label-mono">recorte</p>
                  <h2 className="mt-1 truncate text-xl font-semibold tracking-tight">{scopeLabel}</h2>
                  <p className="mt-1 font-mono text-[11px] text-[var(--color-muted)]">
                    atualizado{' '}
                    {data ? formatBrasilia(data.updatedAt) : loading ? '…' : '—'} · Brasília
                  </p>
                  {data?.finished && (
                    <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                      totalização final
                    </span>
                  )}
                </div>
                {data && data.candidates.length > 0 && (
                  <DonutChart candidates={data.candidates} />
                )}
              </div>

              {!summaryEnabled && (
                <p className="mt-5 text-sm text-[var(--color-muted)]">
                  Selecione um estado no mapa para abrir o painel deste cargo.
                </p>
              )}

              {summaryEnabled && loading && !data && (
                <div className="mt-5 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-[72px] skeleton" />
                  ))}
                </div>
              )}

              {data && (
                <>
                  <p className="label-mono mt-5">candidatos · clique para detalhes</p>
                  <div className="mt-3 space-y-2">
                    {data.candidates.map((c, i) => (
                      <CandidateCard
                        key={c.sqcand}
                        candidate={c}
                        electionId={data.electionId}
                        photoUf={photoUf}
                        maxVotes={maxVotes}
                        index={i}
                        defaultOpen={i === 0}
                      />
                    ))}
                  </div>
                  {data.candidates.every((c) => c.votes === 0) && (
                    <p className="mt-4 text-sm text-[var(--color-muted)]">
                      Apuração ainda não iniciada neste recorte. Os números aparecem conforme o TSE publica.
                    </p>
                  )}
                  <div className="mt-6 border-t border-[var(--color-border-subtle)] pt-5">
                    <StatsGrid turnout={data.turnout} />
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </main>

      <footer className="mx-auto max-w-6xl px-[var(--spacing-page-x)] pb-12 pt-6 text-center sm:px-8">
        <p className="font-mono text-[11px] text-[var(--color-muted)]">
          Dados públicos do TSE · projeto independente, sem vínculo institucional
        </p>
      </footer>
    </div>
  );
}

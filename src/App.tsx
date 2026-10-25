import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { BrazilMap } from './components/BrazilMap';
import { CandidateCard } from './components/CandidateCard';
import { DonutChart } from './components/DonutChart';
import { LoadingScreen } from './components/LoadingScreen';
import { MunicipalitySearch } from './components/MunicipalitySearch';
import { OfficeTabs } from './components/OfficeTabs';
import { StatsGrid } from './components/StatsGrid';
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

  // Só Presidente tem arquivo nacional. Os outros cargos precisam de um estado.
  const noNationalResult = officeId !== '1' && scope === 'br';
  const summaryEnabled =
    officeId === '1' ||
    (officeId === '3' && scope !== 'br') ||
    (officeId !== '3' && round === 1 && scope !== 'br');

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
    if (!panelRef.current) return;
    gsap.fromTo(panelRef.current, { x: 24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'power2.out' });
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
    <div className="min-h-screen bg-[var(--color-surface)]">
      <LoadingScreen visible={initialLoad} />
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-muted)]">
              Dados públicos do TSE
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Eleições 2026
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <MunicipalitySearch items={munIndex} onPick={onSearchPick} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <p className="mb-4 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)]">
          Este site é independente e não é do TSE. Os números vêm dos arquivos públicos de{' '}
          <a
            href="https://resultados.tse.jus.br"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-[var(--color-ink)]"
          >
            resultados.tse.jus.br
          </a>
          . Para o resultado oficial, consulte o TSE.
        </p>
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

        <nav className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[var(--color-muted)]" aria-label="Navegação">
          <button type="button" onClick={goCountry} className="hover:text-[var(--color-ink)]">
            Brasil
          </button>
          {ufSlug && (
            <>
              <span>/</span>
              <button type="button" onClick={() => goState(ufSlug)} className="hover:text-[var(--color-ink)]">
                {ufMeta?.name ?? ufSlug.toUpperCase()}
              </button>
            </>
          )}
          {mun && (
            <>
              <span>/</span>
              <span className="text-[var(--color-ink)]">{mun.name}</span>
            </>
          )}
        </nav>

        {noNationalResult && (
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
            {officeId === '3' && round === 2
              ? 'Governador não tem resultado nacional. Escolha no mapa um estado com 2º turno ou use a busca.'
              : 'Este cargo não tem resultado nacional. Escolha um estado no mapa ou use a busca.'}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section>
            <BrazilMap
              level={level === 'country' ? 'country' : 'state'}
              ufSlug={ufSlug ?? undefined}
              stateLeaders={stateLeaders}
              munLeaders={level !== 'country' ? munLeaders : undefined}
              munProgress={munProgress}
              onSelectState={goState}
              onSelectMunicipality={goMunicipality}
            />
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              Cor do candidato que lidera em cada área. Cinza: sem votos apurados ou empate. Dados: resultados.tse.jus.br.
            </p>
          </section>

          <aside ref={panelRef} className="space-y-4">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{scopeLabel}</h2>
                  <p className="text-xs text-[var(--color-muted)]">
                    Atualizado{' '}
                    {data ? formatBrasilia(data.updatedAt) : loading ? '…' : '—'}{' '}
                    (Horário de Brasília)
                  </p>
                  {data?.finished && (
                    <span className="mt-1 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Totalização final
                    </span>
                  )}
                </div>
                {summaryEnabled && data && data.candidates.length > 0 && (
                  <DonutChart candidates={data.candidates} />
                )}
              </div>

              {!summaryEnabled && (
                <p className="mt-4 text-sm text-[var(--color-muted)]">Escolha um estado para ver o painel.</p>
              )}

              {summaryEnabled && error && !data && (
                <p className="mt-4 text-sm text-[var(--color-muted)]">Sem dados para mostrar neste recorte no momento.</p>
              )}

              {summaryEnabled && loading && !data && (
                <div className="mt-4 space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-24 rounded-xl skeleton" />
                  ))}
                </div>
              )}

              {summaryEnabled && data && (
                <>
                  <div className="mt-4 space-y-3">
                    {data.candidates.map((c, i) => (
                      <CandidateCard
                        key={c.sqcand}
                        candidate={c}
                        electionId={data.electionId}
                        photoUf={photoUf}
                        maxVotes={maxVotes}
                        index={i}
                      />
                    ))}
                  </div>
                  {data.candidates.every((c) => c.votes === 0) && (
                    <p className="mt-3 text-sm text-[var(--color-muted)]">
                      A apuração ainda não começou neste recorte. Os números aparecem aqui assim que o TSE publicar.
                    </p>
                  )}
                  <div className="mt-6">
                    <StatsGrid turnout={data.turnout} />
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-10 pt-4 text-center text-xs text-[var(--color-muted)] sm:px-6">
        Fonte: Tribunal Superior Eleitoral (dados públicos). Projeto independente, sem vínculo com o TSE.
      </footer>
    </div>
  );
}

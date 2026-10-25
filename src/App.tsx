import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrazilMap } from './components/BrazilMap';
import { DetailBody, DetailHeader } from './components/DetailPanel';
import { Hero } from './components/Hero';
import { MapLegend, type LegendItem } from './components/MapLegend';
import { TextScramble } from './components/TextScramble';
import { TopBar } from './components/TopBar';
import { TopProgress } from './components/TopProgress';
import { Button } from './components/ui/Button';
import { Icon } from './components/ui/Icon';
import { Panel } from './components/ui/Panel';
import { Tabs } from './components/ui/Tabs';
import { useElectionResult } from './hooks/useElectionResult';
import { municipalitiesForUf, useMunicipalityIndex } from './hooks/useMunicipalityIndex';
import { useMunicipalityResults } from './hooks/useMunicipalityResults';
import { useStateLeaders } from './hooks/useStateLeaders';
import { GOV_RUNOFF_UFS, OFFICES, ROUND_OPTIONS, UF_LIST } from './lib/tse/config';
import { buildResultPath } from './lib/tse/client';
import type { MunicipalityRef, OfficeId, ParsedResult, Round } from './lib/tse/types';
import { titleCase } from './lib/ui/format';
import { prefersReducedMotion } from './lib/ui/motion';
import { useMediaQuery } from './lib/ui/useMediaQuery';

type Scope = 'br' | 'uf' | 'mu';

interface MunSel {
  tse: string;
  ibge?: string;
  name: string;
  uf: string;
}

/** Descarta resultado de um recorte anterior enquanto o novo ainda carrega. */
function fresh(data: ParsedResult | null, round: Round, officeId: OfficeId, scope: Scope, code: string) {
  if (!data || !code) return null;
  if (data.round !== round || data.officeId !== officeId || data.scope !== scope) return null;
  return code.toLowerCase().endsWith(data.scopeCode.toLowerCase()) ? data : null;
}

const PANEL_INSET = 424;

export default function App() {
  const [round, setRound] = useState<Round>(2);
  const [officeId, setOfficeId] = useState<OfficeId>('1');
  const [ufSlug, setUfSlug] = useState<string | null>(null);
  const [mun, setMun] = useState<MunSel | null>(null);
  const desktop = useMediaQuery('(min-width: 1024px)');
  const mapCardRef = useRef<HTMLDivElement>(null);

  const office = OFFICES.find((o) => o.id === officeId)!;
  const ufMeta = UF_LIST.find((u) => u.slug === ufSlug);
  const hasNational = officeId === '1';
  const runoffGov = officeId === '3' && round === 2;

  /* ---- dados ---- */
  const nationalQ = useElectionResult(round, officeId, 'br', 'br', 'Brasil', hasNational);
  const stateQ = useElectionResult(round, officeId, 'uf', ufSlug ?? '', ufMeta?.name ?? '', !!ufSlug);
  const munCode = mun && ufSlug ? `${ufSlug}${mun.tse}` : '';
  const munQ = useElectionResult(round, officeId, 'mu', munCode, mun ? `${mun.name} — ${mun.uf}` : '', !!munCode);

  const national = hasNational ? fresh(nationalQ.data, round, officeId, 'br', 'br') : null;
  const stateData = fresh(stateQ.data, round, officeId, 'uf', ufSlug ?? '');
  const munData = fresh(munQ.data, round, officeId, 'mu', munCode);

  const { map: stateLeaders, loading: statesLoading } = useStateLeaders(round, officeId, true);
  const { items: munIndex } = useMunicipalityIndex(round);
  const munInUf = useMemo(() => (ufSlug ? municipalitiesForUf(munIndex, ufSlug) : []), [munIndex, ufSlug]);
  const { leaders: munLeaders, progress: munProgress } = useMunicipalityResults(
    round,
    officeId,
    ufSlug ?? '',
    munInUf,
    !!ufSlug,
  );

  /* ---- navegação ---- */
  const scrollToMap = useCallback(() => {
    if (desktop) return;
    const el = mapCardRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 76;
    window.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [desktop]);

  const goCountry = useCallback(() => {
    setUfSlug(null);
    setMun(null);
  }, []);

  const goState = useCallback(
    (slug: string) => {
      if (officeId === '3' && round === 2 && !GOV_RUNOFF_UFS.has(slug)) return;
      setUfSlug(slug);
      setMun(null);
      scrollToMap();
    },
    [officeId, round, scrollToMap],
  );

  const goStateFromHero = useCallback(
    (slug: string) => {
      goState(slug);
      const el = mapCardRef.current;
      if (desktop && el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 88;
        window.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }
    },
    [goState, desktop],
  );

  const goMunicipality = useCallback(
    (tseCode: string, name: string) => {
      if (!ufSlug) return;
      const ibge = Object.values(munLeaders).find((m) => m.tseCode === tseCode)?.ibgeCode;
      setMun({ tse: tseCode, ibge, name: titleCase(name), uf: ufMeta?.sigla ?? ufSlug.toUpperCase() });
    },
    [ufSlug, ufMeta, munLeaders],
  );

  const onSearchPick = useCallback(
    (m: MunicipalityRef) => {
      const slug = m.uf.toLowerCase();
      if (officeId === '3' && round === 2 && !GOV_RUNOFF_UFS.has(slug)) setOfficeId('1');
      setUfSlug(slug);
      setMun({ tse: m.tseCode, ibge: m.ibgeCode, name: titleCase(m.name), uf: m.uf });
      const el = mapCardRef.current;
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - (desktop ? 88 : 76);
        window.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }
    },
    [officeId, round, desktop],
  );

  const changeRound = (r: Round) => {
    setRound(r);
    if (r === 2 && officeId !== '1' && officeId !== '3') setOfficeId('1');
    const nextOffice = r === 2 && officeId !== '1' && officeId !== '3' ? '1' : officeId;
    if (nextOffice === '3' && r === 2 && ufSlug && !GOV_RUNOFF_UFS.has(ufSlug)) goCountry();
  };

  const changeOffice = (id: OfficeId) => {
    setOfficeId(id);
    if (id === '3' && round === 2 && ufSlug && !GOV_RUNOFF_UFS.has(ufSlug)) goCountry();
  };

  const closePanel = useCallback(() => {
    if (mun) setMun(null);
    else goCountry();
  }, [mun, goCountry]);

  /* ---- derivados para o mapa ---- */
  const candidateNames = useMemo(() => {
    const out: Record<string, { name: string; color: string }> = {};
    for (const c of [...(national?.candidates ?? []), ...(stateData?.candidates ?? [])]) {
      out[c.sqcand] = { name: c.shortName, color: c.color };
    }
    return out;
  }, [national, stateData]);

  const legend = useMemo<{ items: LegendItem[]; unit: string }>(() => {
    const counts = new Map<string, LegendItem>();
    const base = (ufSlug ? stateData?.candidates : national?.candidates) ?? [];
    for (const c of base.slice(0, 2)) {
      counts.set(c.shortName, { key: c.sqcand, name: c.shortName, color: c.color, count: 0 });
    }
    if (ufSlug) {
      for (const m of Object.values(munLeaders)) {
        if (!m.hasLeader || !m.leaderId) continue;
        const name = candidateNames[m.leaderId]?.name ?? m.leaderId;
        const it = counts.get(name) ?? { key: m.leaderId, name, color: m.leaderColor, count: 0 };
        it.count += 1;
        counts.set(name, it);
      }
    } else {
      for (const s of Object.values(stateLeaders)) {
        if (!s.hasLeader || !s.leaderName) continue;
        const it = counts.get(s.leaderName) ?? { key: s.slug, name: s.leaderName, color: s.leaderColor, count: 0 };
        it.count += 1;
        counts.set(s.leaderName, it);
      }
    }
    const items = [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 4);
    return { items, unit: ufSlug ? 'mun.' : items.some((i) => i.count === 1) ? 'UF' : 'UFs' };
  }, [ufSlug, stateData, national, munLeaders, stateLeaders, candidateNames]);

  const runoffDisabled = useMemo(
    () => (runoffGov ? new Set(UF_LIST.map((u) => u.slug).filter((s) => !GOV_RUNOFF_UFS.has(s))) : undefined),
    [runoffGov],
  );

  const awaiting = (national ?? stateData)?.turnout.apurationStarted === false;

  const loadingAny =
    (hasNational && nationalQ.loading && !national) ||
    statesLoading ||
    (!!ufSlug && munInUf.length > 0 && munProgress < 100);

  /* ---- painel ---- */
  const panelOpen = !!ufSlug;
  const detailData = mun ? munData : stateData;
  const detailQ = mun ? munQ : stateQ;
  const photoUf = officeId === '1' ? 'br' : buildResultPath(round, officeId, mun ? 'mu' : 'uf', mun ? munCode : (ufSlug ?? 'br'))?.photoUf ?? 'br';
  const contextLabel = `${office.label} · ${round}º turno`;
  const panelHeader = (
    <DetailHeader
      context={contextLabel}
      title={mun ? mun.name : (ufMeta?.name ?? '')}
      data={detailData}
      back={mun && ufMeta ? { label: ufMeta.name, onClick: () => setMun(null) } : undefined}
    />
  );
  const panelBody = (
    <DetailBody
      key={`${officeId}-${round}`}
      data={detailData}
      loading={detailQ.loading}
      error={detailQ.error}
      photoUf={photoUf}
      majority={officeId === '1' || officeId === '3'}
    />
  );

  useEffect(() => {
    document.title = mun
      ? `${mun.name} (${mun.uf}) · Apuração 2026`
      : ufMeta
        ? `${ufMeta.name} · Apuração 2026`
        : 'Apuração 2026 · Eleições gerais';
  }, [mun, ufMeta]);

  const roundItems = ROUND_OPTIONS.map((r) => ({ value: r.round, label: r.label }));
  const officeItems = OFFICES.filter((o) => round === 1 || o.id === '1' || o.id === '3').map((o) => ({
    value: o.id,
    label: o.label,
  }));

  const mapTitle = mun
    ? `${mun.name}, ${mun.uf}`
    : ufMeta
      ? `Municípios de ${ufMeta.name}`
      : 'Quem lidera em cada estado';

  return (
    <div className="min-h-dvh">
      <TopProgress active={loadingAny} />
      <TopBar munIndex={munIndex} onPick={onSearchPick} onHome={goCountry} />

      <main className="frame">
        {/* ------------------------------------------------ 01 · resultado */}
        <section className="relative overflow-hidden px-page pb-section pt-10 sm:pt-14" aria-labelledby="resultado">
          <div className="hero-glow" aria-hidden />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <SectionLabel n={1} text={hasNational ? `${office.label} · Brasil` : office.label} id="resultado" />
            <div className="flex flex-wrap items-center gap-2">
              <Tabs<Round> label="Turno" value={round} onChange={changeRound} items={roundItems} />
              <div className="-mx-page max-w-[100vw] px-page scroll-x sm:mx-0 sm:px-0">
                <Tabs<OfficeId> label="Cargo" value={officeId} onChange={changeOffice} items={officeItems} />
              </div>
            </div>
          </div>
          <div className="relative mt-10 sm:mt-14">
            <Hero
              round={round}
              officeId={officeId}
              officeLabel={office.label}
              national={hasNational ? { data: national, loading: nationalQ.loading, error: nationalQ.error } : null}
              stateLeaders={stateLeaders}
              onPickState={goStateFromHero}
            />
          </div>
        </section>

        <div className="rule" />

        {/* ------------------------------------------------ 02 · mapa */}
        <section className="px-page py-section" aria-labelledby="mapa">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <SectionLabel n={2} text={ufMeta ? `Mapa · ${ufMeta.sigla}` : 'Mapa · Brasil'} id="mapa" />
              <h2 className="mt-4 text-title font-medium text-ink sm:text-headline">{mapTitle}</h2>
            </div>
            <p className="max-w-sm text-small text-ink-3 sm:text-right">
              {ufSlug
                ? 'Toque em um município para ver o resultado dele.'
                : runoffGov
                  ? 'Só os estados em destaque têm 2º turno para governador.'
                  : 'A cor mostra quem está à frente. Toque em um estado para abrir os municípios.'}
            </p>
          </div>

          <div
            ref={mapCardRef}
            className="card dot-grid relative mt-8 aspect-square overflow-hidden sm:aspect-[4/3] lg:aspect-auto lg:h-[min(80vh,760px)] lg:min-h-[580px]"
          >
            <BrazilMap
              ufSlug={ufSlug ?? undefined}
              selectedIbge={mun?.ibge}
              stateLeaders={stateLeaders}
              munLeaders={ufSlug ? munLeaders : undefined}
              candidateNames={candidateNames}
              insetRight={desktop && panelOpen ? PANEL_INSET : 0}
              insetTop={desktop ? 64 : 52}
              awaiting={awaiting}
              disabledStates={runoffDisabled}
              onSelectState={goState}
              onSelectMunicipality={goMunicipality}
            />

            {/* barra do mapa */}
            <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start gap-2">
              <div className="pointer-events-auto flex h-9 items-center gap-0.5 rounded-pill bg-(--glass) px-1 shadow-sm backdrop-blur-md">
                {ufSlug && (
                  <Button variant="ghost" size="sm" icon onClick={goCountry} aria-label="Voltar para o Brasil">
                    <Icon name="arrow-left" size={14} />
                  </Button>
                )}
                <Crumb onClick={goCountry} current={!ufSlug}>
                  Brasil
                </Crumb>
                {ufMeta && (
                  <>
                    <Icon name="chevron-right" size={12} className="text-ink-4" />
                    <Crumb onClick={() => setMun(null)} current={!mun}>
                      {desktop ? ufMeta.name : ufMeta.sigla}
                    </Crumb>
                  </>
                )}
                {mun && (
                  <>
                    <Icon name="chevron-right" size={12} className="text-ink-4" />
                    <Crumb current>{mun.name}</Crumb>
                  </>
                )}
              </div>
              {ufSlug && munInUf.length > 0 && munProgress < 100 && (
                <div className="flex h-9 items-center gap-2 rounded-pill bg-(--glass) px-3 shadow-sm backdrop-blur-md">
                  <span className="track h-1 w-14">
                    <span
                      className="block h-full bg-ink transition-[width] duration-300"
                      style={{ width: `${munProgress}%` }}
                    />
                  </span>
                  <span className="tnum font-mono text-micro text-ink-3">{munProgress}%</span>
                </div>
              )}
            </div>

            {desktop && (
              <div className="tooltip pointer-events-auto absolute bottom-3 left-3 z-10 max-w-[calc(100%-450px)] px-4 py-3">
                <MapLegend items={legend.items} unit={legend.unit} />
              </div>
            )}

            {desktop && (
              <Panel
                open={panelOpen}
                mode="side"
                onClose={closePanel}
                header={panelHeader}
                contentKey={mun?.tse ?? ufSlug ?? ''}
                label="Detalhes do recorte"
              >
                {panelBody}
              </Panel>
            )}
          </div>

          {!desktop && <MapLegend items={legend.items} unit={legend.unit} className="mt-5" />}
        </section>

        <div className="rule" />

        <footer className="flex flex-col gap-3 px-page py-10 text-caption text-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Fonte: <span className="font-mono text-ink-2">resultados.tse.jus.br</span>. Atualiza sozinho a cada minuto.
          </p>
          <p>Projeto independente, sem ligação com o TSE.</p>
        </footer>
      </main>

      {!desktop && panelOpen && <div className="h-[46dvh]" aria-hidden />}
      {!desktop && (
        <Panel
          open={panelOpen}
          mode="sheet"
          onClose={closePanel}
          header={panelHeader}
          contentKey={mun?.tse ?? ufSlug ?? ''}
          label="Detalhes do recorte"
        >
          {panelBody}
        </Panel>
      )}
    </div>
  );
}

function SectionLabel({ n, text, id }: { n: number; text: string; id?: string }) {
  return (
    <p id={id} className="eyebrow flex items-center gap-2">
      <span className="text-ink-4">[</span>
      <span className="text-ink">{String(n).padStart(2, '0')}</span>
      <span className="text-ink-4">]</span>
      <TextScramble text={text} />
    </p>
  );
}

function Crumb({ children, onClick, current }: { children: string; onClick?: () => void; current?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-current={current ? 'page' : undefined}
      className={
        'max-w-40 truncate rounded-pill px-2.5 py-1 text-caption font-medium transition-colors ' +
        (current ? 'text-ink' : 'text-ink-3 hover:bg-hover hover:text-ink')
      }
    >
      {children}
    </button>
  );
}

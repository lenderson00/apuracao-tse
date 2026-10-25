import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BrazilMap, type Camera, type CameraTarget, type Insets, type MapApi, type MapLevel } from './components/BrazilMap';
import {
  AboutContent,
  Brand,
  Credit,
  Breadcrumb,
  Popover,
  Rail,
  ShortcutsContent,
  TSE_URL,
  ZoomControls,
  MapPanel,
  type Crumb,
  type LegendItem,
  type MapSummary,
} from './components/Chrome';
import { Dock } from './components/Dock';
import { hasStarted } from './lib/ui/turnout';
import { StatusPill } from './components/Status';
import { MunicipalitySearch } from './components/MunicipalitySearch';
import { Icon } from './components/ui/Icon';
import { Tabs } from './components/ui/Tabs';
import { useElectionResult } from './hooks/useElectionResult';
import { municipalitiesForUf, useMunicipalityIndex } from './hooks/useMunicipalityIndex';
import { useMunicipalityResults, type MunLeader } from './hooks/useMunicipalityResults';
import { useStateLeaders, type StateLeader } from './hooks/useStateLeaders';
import { GOV_RUNOFF_UFS, OFFICES, ROUND_OPTIONS, UF_LIST } from './lib/tse/config';
import type { MunicipalityRef, OfficeId, ParsedResult, Round } from './lib/tse/types';
import { candFill } from './lib/ui/color';
import { fmtPct, titleCase } from './lib/ui/format';
import { munView, stateView, type RegionView } from './lib/ui/regions';
import { useMediaQuery } from './lib/ui/useMediaQuery';

const isRunoffUf = (uf: string) => (GOV_RUNOFF_UFS as ReadonlySet<string>).has(uf);

const STATE_POLL_MS = 120_000;
const MUN_POLL_MS = 180_000;

type Names = Record<string, { name: string; color: string }>;

export default function App() {
  const desktop = useMediaQuery('(min-width: 1024px)');
  const touch = useMediaQuery('(pointer: coarse)');

  const [round, setRound] = useState<Round>(2);
  const [officeId, setOfficeId] = useState<OfficeId>('1');
  const [focusUf, setFocusUf] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [zoomMun, setZoomMun] = useState<string | null>(null);
  const [hoverMun, setHoverMun] = useState<string | null>(null);
  const [level, setLevel] = useState<MapLevel>('country');
  const [camera, setCamera] = useState<Camera>({ target: { kind: 'country' }, seq: 0 });
  const [legendOn, setLegendOn] = useState(true);
  const [pop, setPop] = useState<'about' | 'keys' | null>(null);
  const [searching, setSearching] = useState(false);
  const mapApi = useRef<MapApi>(null);

  const office = OFFICES.find((o) => o.id === officeId)!;
  const ufMeta = UF_LIST.find((u) => u.slug === focusUf);
  const hasNational = officeId === '1';
  const runoffGov = officeId === '3' && round === 2;
  const disabledStates = useMemo<Set<string> | undefined>(
    () => (runoffGov ? new Set(UF_LIST.map((u) => u.slug).filter((s) => !isRunoffUf(s))) : undefined),
    [runoffGov],
  );

  /* ----------------------------------------------------------- mapa: dados */
  /* Cada fonte vive num componente com key por recorte: ao trocar turno, cargo
     ou estado, a anterior desmonta e respostas atrasadas dela não pintam o mapa. */
  const [statesSrc, setStatesSrc] = useState<StatesSrc>(EMPTY_STATES);
  const [munSrc, setMunSrc] = useState<MunSrc>(EMPTY_MUNS);
  const stateLeaders = statesSrc.key === `${round}|${officeId}` ? statesSrc.map : EMPTY_STATES.map;
  const reloadStates = statesSrc.reload;
  const { items: munIndex } = useMunicipalityIndex(round);
  const munInUf = useMemo(() => (focusUf ? municipalitiesForUf(munIndex, focusUf) : []), [munIndex, focusUf]);
  const munByIbge = useMemo(() => new Map(munInUf.map((m) => [m.ibgeCode, m])), [munInUf]);
  const munSrcKey = `${round}|${officeId}|${focusUf}`;
  const munOk = !!focusUf && munSrc.key === munSrcKey;
  const munLeaders = munOk ? munSrc.leaders : EMPTY_MUNS.leaders;
  const munProgress = munOk ? munSrc.progress : 0;
  const reloadMuns = munSrc.reload;

  /* polling das cores (sem recriar paths: o mapa só troca o fill) */
  const reloadStatesRef = useRef(reloadStates);
  const reloadMunsRef = useRef(reloadMuns);
  useEffect(() => {
    reloadStatesRef.current = reloadStates;
    reloadMunsRef.current = reloadMuns;
  }, [reloadStates, reloadMuns]);
  useEffect(() => {
    const id = window.setInterval(() => void reloadStatesRef.current(), STATE_POLL_MS);
    return () => window.clearInterval(id);
  }, [round, officeId]);
  useEffect(() => {
    if (!focusUf) return;
    const id = window.setInterval(() => void reloadMunsRef.current(), MUN_POLL_MS);
    return () => window.clearInterval(id);
  }, [focusUf, round, officeId]);

  /* ------------------------------------------------- recorte mostrado no dock */
  const activeMun = pinned ?? (focusUf && level === 'mun' ? (hoverMun ?? zoomMun) : null);
  const munRef = activeMun ? munByIbge.get(activeMun) : undefined;
  const scope: 'br' | 'uf' | 'mu' = munRef && focusUf ? 'mu' : focusUf ? 'uf' : 'br';
  const code = scope === 'mu' ? `${focusUf}${munRef!.tseCode}` : scope === 'uf' ? focusUf! : 'br';
  const title =
    scope === 'mu' ? `${titleCase(munRef!.name)}, ${ufMeta?.sigla ?? ''}` : scope === 'uf' ? (ufMeta?.name ?? '') : 'Brasil';
  const dockEnabled = scope !== 'br' || hasNational;
  const q = useElectionResult(round, officeId, scope, code, title, dockEnabled);

  /* mantém os números anteriores (esmaecidos) enquanto o novo recorte chega,
     para que eles possam "contar" de um valor para o outro */
  const [prev, setPrev] = useState<ParsedResult | null>(null);
  useEffect(() => {
    if (q.data) setPrev(q.data);
  }, [q.data]);
  const fallback =
    !q.data && dockEnabled && q.loading && !q.error && prev && prev.officeId === officeId && prev.round === round ? prev : null;
  const shown = q.data ?? fallback;
  const stale = !q.data && !!fallback;

  /* nomes dos candidatos (para tooltip e legenda dos municípios) */
  const [names, setNames] = useState<Names>({});
  useEffect(() => {
    if (!q.data) return;
    setNames((n) => {
      let changed = false;
      const next = { ...n };
      for (const c of q.data!.candidates) {
        if (!next[c.sqcand]) {
          next[c.sqcand] = { name: c.shortName, color: c.color };
          changed = true;
        }
      }
      return changed ? next : n;
    });
  }, [q.data]);

  /* visões do mapa com "última cor conhecida" durante o recarregamento */
  const selKey = `${round}|${officeId}`;
  const [knownStates, setKnownStates] = useState<{ key: string; map: Record<string, StateLeader> }>({ key: selKey, map: {} });
  useEffect(() => {
    setKnownStates((p) => {
      const map = p.key === selKey ? { ...p.map } : {};
      for (const [k, v] of Object.entries(stateLeaders)) if (!v.loading) map[k] = v;
      return { key: selKey, map };
    });
  }, [stateLeaders, selKey]);
  const stateViews = useMemo(() => {
    const known = knownStates.key === selKey ? knownStates.map : {};
    const out: Record<string, RegionView> = {};
    for (const uf of UF_LIST) {
      const cur = stateLeaders[uf.slug];
      out[uf.slug] = stateView(cur?.loading && known[uf.slug] ? known[uf.slug] : cur);
    }
    return out;
  }, [stateLeaders, knownStates, selKey]);

  const munKey = `${selKey}|${focusUf}`;
  const [knownMuns, setKnownMuns] = useState<{ key: string; map: Record<string, MunLeader> }>({ key: munKey, map: {} });
  useEffect(() => {
    setKnownMuns((p) => {
      const map = p.key === munKey ? { ...p.map } : {};
      for (const [k, v] of Object.entries(munLeaders)) if (!v.loading) map[k] = v;
      return { key: munKey, map };
    });
  }, [munLeaders, munKey]);
  const munViews = useMemo(() => {
    const known = knownMuns.key === munKey ? knownMuns.map : {};
    const out: Record<string, RegionView> = {};
    for (const [ibge, cur] of Object.entries(munLeaders)) {
      out[ibge] = munView(cur.loading && known[ibge] ? known[ibge] : cur, names);
    }
    return out;
  }, [munLeaders, knownMuns, munKey, names]);

  /* ------------------------------------------------------------- navegação */
  const fly = useCallback((target: CameraTarget) => setCamera((c) => ({ target, seq: c.seq + 1 })), []);
  const setTargetQuiet = useCallback((target: CameraTarget) => setCamera((c) => ({ target, seq: c.seq })), []);

  const goCountry = useCallback(() => {
    setFocusUf(null);
    setPinned(null);
    setZoomMun(null);
    setHoverMun(null);
    fly({ kind: 'country' });
  }, [fly]);

  const goState = useCallback(
    (uf: string) => {
      if (disabledStates?.has(uf)) return;
      setFocusUf(uf);
      setPinned(null);
      setZoomMun(null);
      fly({ kind: 'state', uf });
    },
    [disabledStates, fly],
  );

  const onActivate = useCallback(
    (kind: 'state' | 'mun', id: string) => {
      if (kind === 'state') goState(id);
      else if (focusUf) {
        setPinned(id);
        fly({ kind: 'mun', uf: focusUf, ibge: id });
      }
    },
    [goState, focusUf, fly],
  );

  const onZoomFocus = useCallback(
    (uf: string | null) => {
      setFocusUf(uf);
      setPinned(null);
      setZoomMun(null);
      setTargetQuiet(uf ? { kind: 'state', uf } : { kind: 'country' });
    },
    [setTargetQuiet],
  );

  const onZoomMun = useCallback(
    (ibge: string | null) => {
      setZoomMun(ibge);
      setPinned((p) => (p && p !== ibge ? null : p));
    },
    [],
  );

  /* hover só troca o dock depois de uma pausa, para não piscar */
  const hoverTimer = useRef(0);
  const onHoverMun = useCallback((ibge: string | null) => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHoverMun(ibge), ibge ? 260 : 450);
  }, []);

  const onSearchPick = useCallback(
    (m: MunicipalityRef) => {
      const uf = m.uf.toLowerCase();
      if (runoffGov && !isRunoffUf(uf)) setOfficeId('1');
      setFocusUf(uf);
      setPinned(m.ibgeCode);
      setZoomMun(null);
      setSearching(false);
      fly({ kind: 'mun', uf, ibge: m.ibgeCode });
    },
    [runoffGov, fly],
  );

  const back = useCallback(() => {
    if (pinned || zoomMun) {
      setPinned(null);
      setZoomMun(null);
      setHoverMun(null);
      if (focusUf) fly({ kind: 'state', uf: focusUf });
    } else if (focusUf) goCountry();
  }, [pinned, zoomMun, focusUf, fly, goCountry]);

  const changeRound = (r: Round) => {
    setRound(r);
    const nextOffice = r === 2 && officeId !== '1' && officeId !== '3' ? '1' : officeId;
    if (nextOffice !== officeId) setOfficeId(nextOffice);
    if (nextOffice === '3' && r === 2 && focusUf && !isRunoffUf(focusUf)) goCountry();
  };
  const changeOffice = (id: OfficeId) => {
    setOfficeId(id);
    if (id === '3' && round === 2 && focusUf && !isRunoffUf(focusUf)) goCountry();
  };

  /* teclado: Esc volta, + − aproximam, 0 recentraliza */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape' && !pop) back();
      else if (e.key === '+' || e.key === '=') mapApi.current?.zoomBy(1.6);
      else if (e.key === '-' || e.key === '_') mapApi.current?.zoomBy(1 / 1.6);
      else if (e.key === '0') mapApi.current?.recenter();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [back, pop]);

  useEffect(() => {
    document.title = scope === 'br' ? 'Apuração das Eleições 2026' : `${title} · Apuração 2026`;
  }, [scope, title]);

  /* ------------------------------------------------------- legenda do mapa */
  const [mapUpdatedAt, setMapUpdatedAt] = useState<Date | null>(null);
  useEffect(() => {
    const all = Object.values(stateLeaders);
    if (all.length === UF_LIST.length && all.every((v) => !v.loading)) setMapUpdatedAt(new Date());
  }, [stateLeaders]);

  const summary = useMemo<MapSummary>(() => {
    const counts = new Map<string, LegendItem>();
    const base = shown?.candidates ?? [];
    for (const c of base.slice(0, 2)) counts.set(c.shortName, { key: c.sqcand, name: c.shortName, color: c.color, count: 0 });
    const views = focusUf ? munInUf.map((m) => munViews[m.ibgeCode]) : UF_LIST.map((u) => stateViews[u.slug]);
    let neutral = 0;
    let errors = 0;
    let off = 0;
    let loading = 0;
    for (const v of views) {
      if (!v || v.status === 'loading') loading += 1;
      else if (v.status === 'error') errors += 1;
      else if (v.status === 'off') off += 1;
      else if (v.status === 'neutral') neutral += 1;
      else if (v.leaderName && v.color) {
        const it = counts.get(v.leaderName) ?? { key: v.leaderName, name: v.leaderName, color: v.color, count: 0 };
        it.count += 1;
        counts.set(v.leaderName, it);
      }
    }
    const items = [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 4);
    return {
      items,
      neutral,
      errors,
      off,
      loading,
      total: views.length,
      unit: focusUf ? 'municípios' : 'UF',
      updatedAt: mapUpdatedAt,
      progress: focusUf && munInUf.length ? munProgress : null,
    };
  }, [shown, focusUf, munInUf, munViews, stateViews, mapUpdatedAt, munProgress]);

  /* ---------------------------------------------------------------- layout */
  const toolbarRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const [peek, setPeek] = useState(240);
  const [insets, setInsets] = useState<Insets>({ top: 64, right: 0, bottom: 200, left: 0 });
  useLayoutEffect(() => {
    const measure = () => {
      const tb = toolbarRef.current?.getBoundingClientRect();
      const dk = dockRef.current?.getBoundingClientRect();
      const frame = toolbarRef.current?.offsetParent?.getBoundingClientRect();
      if (!tb || !dk || !frame) return;
      // "Ver todos" aberto não deve encolher o mapa
      if (dockRef.current?.querySelector('[data-expanded="true"]')) return;
      // área livre real: entre a 1ª linha de controles e o topo do dock (ou do sheet recolhido)
      const next: Insets = desktop
        ? { top: tb.bottom - frame.top + 4, right: 0, bottom: frame.bottom - dk.top + 4, left: 0 }
        : { top: tb.bottom - frame.top + 4, right: 0, bottom: peek + 8, left: 0 };
      setInsets((p) =>
        Math.abs(p.top - next.top) < 2 && Math.abs(p.bottom - next.bottom) < 2 && p.right === next.right ? p : next,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (toolbarRef.current) ro.observe(toolbarRef.current);
    if (dockRef.current) ro.observe(dockRef.current);
    return () => ro.disconnect();
  }, [desktop, peek]);

  const crumbs: Crumb[] = [{ label: 'Brasil', onClick: goCountry }];
  if (ufMeta) crumbs.push({ label: desktop ? ufMeta.name : ufMeta.sigla, onClick: () => goState(ufMeta.slug) });
  if (munRef) crumbs.push({ label: titleCase(munRef.name) });

  const roundItems = ROUND_OPTIONS.map((r) => ({ value: r.round, label: r.label }));
  const officeItems = OFFICES.filter((o) => round === 1 || o.id === '1' || o.id === '3').map((o) => ({
    value: o.id,
    label: o.label,
  }));

  const photoUf = officeId === '1' ? 'br' : (focusUf ?? 'br');
  const kindLabel = scope === 'mu' ? 'Município' : scope === 'uf' ? 'Estado' : 'País';
  const context = `${office.label} · ${round}º turno`;

  const awaiting = !hasStarted(shown?.turnout);
  const liveSummary = shown && !stale ? summarize(title, shown) : '';

  const emptyDock = !dockEnabled ? (
    <StateChooser
      runoff={runoffGov}
      officeLabel={office.label}
      stateViews={stateViews}
      onPick={goState}
      mobile={!desktop}
    />
  ) : undefined;

  const statusPill = <StatusPill data={shown} />;
  const mobileCrumbs = crumbs.length > 1 ? <Breadcrumb items={crumbs} bare /> : undefined;

  const dock = (
    <Dock
      mode={desktop ? 'desktop' : 'mobile'}
      kindLabel={kindLabel}
      title={title}
      context={context}
      data={shown}
      stale={stale}
      loading={q.loading}
      error={q.error}
      onRetry={() => void q.refresh()}
      photoUf={photoUf}
      majority={officeId === '1' || officeId === '3'}
      empty={emptyDock}
      crumbs={mobileCrumbs}
      mapPanel={<MapPanel s={summary} title="Quem lidera" bare />}
      onPeekHeight={desktop ? undefined : setPeek}
    />
  );

  const subscribeZoom = useCallback((cb: (pct: number) => void) => mapApi.current?.subscribeZoom(cb) ?? (() => undefined), []);

  const map = (
    <BrazilMap
      camera={camera}
      focusUf={focusUf}
      highlightIbge={activeMun}
      stateViews={stateViews}
      munViews={munViews}
      disabledStates={disabledStates}
      awaiting={awaiting}
      insets={insets}
      touch={touch}
      onActivate={onActivate}
      onZoomFocus={onZoomFocus}
      onZoomMun={onZoomMun}
      onHoverMun={onHoverMun}
      onLevel={setLevel}
      dismissKey={shown && !stale ? `${shown.scope}-${shown.scopeCode}` : undefined}
      apiRef={mapApi}
    />
  );

  const liveRegion = (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {liveSummary}
    </p>
  );

  const sources = (
    <>
      <StatesSource key={`${round}|${officeId}`} round={round} officeId={officeId} onData={setStatesSrc} />
      {focusUf && (
        <MunSource
          key={munSrcKey}
          srcKey={munSrcKey}
          round={round}
          officeId={officeId}
          uf={focusUf}
          municipalities={munInUf}
          onData={setMunSrc}
        />
      )}
    </>
  );

  const tabsBar = (
    <>
      <Tabs<Round> label="Turno" value={round} onChange={changeRound} items={roundItems} />
      <span className="seg-divider mx-1" aria-hidden />
      <Tabs<OfficeId> label="Cargo" value={officeId} onChange={changeOffice} items={officeItems} />
    </>
  );

  /* ---------------------------------------------------------------- desktop */
  if (desktop) {
    return (
      <div className="flex h-dvh gap-2 bg-void p-2">
        {sources}
        <Rail
          top={[
            { id: 'home', label: 'Mapa do Brasil', icon: 'map', onClick: goCountry, active: !focusUf },
            {
              id: 'search',
              label: 'Buscar município  /',
              icon: 'search',
              onClick: () => document.querySelector<HTMLInputElement>('#busca input')?.focus(),
            },
            { id: 'legend', label: legendOn ? 'Esconder legenda' : 'Mostrar legenda', icon: 'layers', onClick: () => setLegendOn((v) => !v), active: legendOn },
            { id: 'keys', label: 'Atalhos de teclado', icon: 'keyboard', onClick: () => setPop((p) => (p === 'keys' ? null : 'keys')), active: pop === 'keys' },
          ]}
          bottom={[
            { id: 'about', label: 'Sobre este site', icon: 'info', onClick: () => setPop((p) => (p === 'about' ? null : 'about')), active: pop === 'about' },
            { id: 'tse', label: 'Abrir resultados.tse.jus.br', icon: 'external', onClick: () => window.open(TSE_URL, '_blank', 'noopener') },
          ]}
        />
        <Popover open={pop === 'keys'} onClose={() => setPop(null)} className="left-16 top-40 w-64">
          <ShortcutsContent />
        </Popover>
        <Popover open={pop === 'about'} onClose={() => setPop(null)} className="bottom-4 left-16 w-72">
          <AboutContent />
        </Popover>

        <main className="relative min-w-0 flex-1 overflow-hidden rounded-[20px] border border-line bg-bg">
          {map}

          {/* 1ª linha: marca · abas · busca (todas com a mesma altura) */}
          <div
            ref={toolbarRef}
            className="pointer-events-none absolute inset-x-(--edge) top-(--edge) z-30 grid grid-cols-[1fr_auto_1fr] items-center gap-3"
          >
            <div className="float pointer-events-auto flex h-(--h-1) w-fit items-center p-1 pr-3.5">
              <Brand />
            </div>
            <div className="float pointer-events-auto flex h-(--h-1) items-center p-1">{tabsBar}</div>
            <div id="busca" className="float pointer-events-auto flex h-(--h-1) w-56 items-center justify-self-end p-1 min-[1500px]:w-72">
              <MunicipalitySearch items={munIndex} onPick={onSearchPick} className="w-full" />
            </div>
          </div>

          {/* 2ª linha: breadcrumb + status à esquerda, zoom à direita; legenda abaixo */}
          <div className="pointer-events-none absolute left-(--edge) top-[calc(var(--edge)+var(--h-1)+8px)] z-20 flex flex-col items-start gap-2">
            <Breadcrumb items={crumbs} status={statusPill} className="pointer-events-auto" />
            {legendOn && <MapPanel s={summary} title="Quem lidera" className="pointer-events-auto" />}
          </div>
          <ZoomControls
            className="absolute right-(--edge) top-[calc(var(--edge)+var(--h-1)+8px)] z-20"
            onIn={() => mapApi.current?.zoomBy(1.6)}
            onOut={() => mapApi.current?.zoomBy(1 / 1.6)}
            onRecenter={() => mapApi.current?.recenter()}
            subscribe={subscribeZoom}
          />

          <div className="pointer-events-none absolute inset-x-(--edge) bottom-(--edge) z-20 flex justify-center">
            <div ref={dockRef} className="w-full max-w-[1100px]">
              {dock}
            </div>
          </div>
          {liveRegion}
        </main>
      </div>
    );
  }

  /* ----------------------------------------------------------------- mobile */
  return (
    <main className="relative h-dvh overflow-hidden bg-bg">
      {sources}
      {map}

      {/* topo em 2 linhas: marca + busca + menu; turno e cargo */}
      <div
        ref={toolbarRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-1.5 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]"
      >
        {searching ? (
          <div className="float pointer-events-auto flex h-14 items-center gap-1 px-2">
            <MunicipalitySearch items={munIndex} onPick={onSearchPick} className="flex-1" autoFocus onDone={() => setSearching(false)} />
            <button type="button" className="btn shrink-0" onClick={() => setSearching(false)}>
              Cancelar
            </button>
          </div>
        ) : (
          <div className="float pointer-events-auto relative flex h-14 items-center gap-0.5 pl-2.5 pr-1">
            <div className="min-w-0 flex-1">
              <Brand compact />
            </div>
            <button type="button" className="btn btn-icon shrink-0" aria-label="Buscar município" onClick={() => setSearching(true)}>
              <Icon name="search" size={18} />
            </button>
            <button
              type="button"
              className="btn btn-icon shrink-0"
              aria-label="Menu"
              aria-expanded={pop === 'about'}
              onClick={() => setPop((p) => (p === 'about' ? null : 'about'))}
            >
              <Icon name="menu" size={18} />
            </button>
            <Popover open={pop === 'about'} onClose={() => setPop(null)} className="right-0 top-full mt-2 w-[min(20rem,calc(100vw-1rem))]">
              <AboutContent />
              <div className="mt-3 flex gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  className="btn btn-outline flex-1"
                  onClick={() => {
                    setPop(null);
                    goCountry();
                  }}
                >
                  <Icon name="map" size={15} /> Ver o Brasil
                </button>
                <button type="button" className="btn btn-outline flex-1" onClick={() => window.open(TSE_URL, '_blank', 'noopener')}>
                  <Icon name="external" size={15} /> Site do TSE
                </button>
              </div>
            </Popover>
          </div>
        )}
        <div className="float pointer-events-auto flex items-center self-start overflow-x-auto p-1 scroll-x max-w-full">
          {tabsBar}
        </div>
      </div>

      <button
        type="button"
        className="float btn btn-icon pointer-events-auto absolute right-2 z-20"
        style={{ bottom: peek + 10 }}
        onClick={() => mapApi.current?.recenter()}
        aria-label="Recentralizar mapa"
      >
        <Icon name="target" size={17} />
      </button>

      <Credit variant="chip" className="pointer-events-auto absolute left-2 z-20" style={{ bottom: peek + 16 }} />

      <div ref={dockRef} className="pointer-events-none absolute inset-x-0 bottom-0 z-30">
        {dock}
      </div>
      {liveRegion}
    </main>
  );
}

/* -------------------------------------------------------------------------- */

interface StatesSrc {
  key: string;
  map: Record<string, StateLeader>;
  reload: () => Promise<void> | void;
}
interface MunSrc {
  key: string;
  leaders: Record<string, MunLeader>;
  progress: number;
  reload: () => Promise<void> | void;
}
const EMPTY_STATES: StatesSrc = { key: '', map: {}, reload: () => undefined };
const EMPTY_MUNS: MunSrc = { key: '', leaders: {}, progress: 0, reload: () => undefined };

function StatesSource({ round, officeId, onData }: { round: Round; officeId: OfficeId; onData: (s: StatesSrc) => void }) {
  const { map, reload } = useStateLeaders(round, officeId, true);
  useEffect(() => {
    onData({ key: `${round}|${officeId}`, map, reload });
  }, [map, reload, round, officeId, onData]);
  return null;
}

function MunSource({
  srcKey,
  round,
  officeId,
  uf,
  municipalities,
  onData,
}: {
  srcKey: string;
  round: Round;
  officeId: OfficeId;
  uf: string;
  municipalities: MunicipalityRef[];
  onData: (s: MunSrc) => void;
}) {
  const { leaders, progress, reload } = useMunicipalityResults(round, officeId, uf, municipalities, true);
  useEffect(() => {
    onData({ key: srcKey, leaders, progress, reload });
  }, [leaders, progress, reload, srcKey, onData]);
  return null;
}

function summarize(title: string, d: ParsedResult): string {
  const top = d.candidates
    .slice(0, 2)
    .map((c) => `${titleCase(c.shortName)} ${fmtPct(c.percent)}`)
    .join(', ');
  return `${title}: ${top}. ${fmtPct(d.turnout.sectionsPct)} das urnas apuradas.`;
}

function StateChooser({
  runoff,
  officeLabel,
  stateViews,
  onPick,
  mobile,
}: {
  runoff: boolean;
  officeLabel: string;
  stateViews: Record<string, RegionView>;
  onPick: (uf: string) => void;
  mobile: boolean;
}) {
  const ufs = UF_LIST.filter((u) => !runoff || isRunoffUf(u.slug));
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-small text-ink-2">
        {runoff
          ? `Só ${ufs.length} estados têm 2º turno para ${officeLabel.toLowerCase()}. Escolha um no mapa ou aqui.`
          : `${officeLabel} não tem resultado nacional: cada estado tem a sua disputa. Escolha um no mapa ou aqui.`}
      </p>
      <ul className={mobile ? '-mx-4 flex gap-1.5 px-4 scroll-x' : 'flex flex-wrap gap-1.5'}>
        {ufs.map((u) => {
          const v = stateViews[u.slug];
          return (
            <li key={u.slug} className="shrink-0">
              <button
                type="button"
                onClick={() => onPick(u.slug)}
                title={u.name}
                className="cell flex h-8 items-center gap-1.5 px-2.5 font-mono text-caption text-ink transition-colors hover:bg-hover pointer-coarse:h-11"
              >
                <span
                  className="size-2 rounded-full"
                  style={{
                    background:
                      v?.status === 'leader' && v.color ? candFill(v.color) : v?.status === 'neutral' ? 'var(--map-neutral)' : 'var(--map-loading)',
                  }}
                  aria-hidden
                />
                {runoff ? u.name : u.sigla}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

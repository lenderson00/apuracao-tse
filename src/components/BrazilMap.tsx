import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import clsx from 'clsx';
import { geoMercator, geoPath, type GeoPath, type GeoProjection } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import gsap from 'gsap';
import type { MunLeader } from '../hooks/useMunicipalityResults';
import type { StateLeader } from '../hooks/useStateLeaders';
import { MAP_NEUTRAL, mapFill } from '../lib/ui/color';
import { titleCase } from '../lib/ui/format';
import { DUR, dur, prefersReducedMotion } from '../lib/ui/motion';
import { MapTooltip, type HoverInfo } from './MapTooltip';
import { Skeleton } from './ui/Skeleton';

interface Props {
  ufSlug?: string;
  selectedIbge?: string;
  stateLeaders: Record<string, StateLeader>;
  munLeaders?: Record<string, MunLeader>;
  /** sqcand → nome/cor, para o tooltip dos municípios */
  candidateNames: Record<string, { name: string; color: string }>;
  /** área coberta por painéis (px) que o zoom deve evitar */
  insetRight?: number;
  insetTop?: number;
  awaiting: boolean;
  /** estados sem disputa neste cargo/turno (ex.: governador no 2º turno) */
  disabledStates?: Set<string>;
  onSelectState: (slug: string) => void;
  onSelectMunicipality: (tseCode: string, name: string) => void;
}

type GeoFC = FeatureCollection<Geometry, Record<string, string>>;

const geoCache = new Map<string, Promise<GeoFC>>();
function loadGeo(url: string): Promise<GeoFC> {
  let p = geoCache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`geo ${r.status}`);
      return r.json() as Promise<GeoFC>;
    });
    p.catch(() => geoCache.delete(url));
    geoCache.set(url, p);
  }
  return p;
}

function regionFill(lead: { leaderColor: string; margin: number; hasLeader: boolean } | undefined, scale: number) {
  if (!lead?.hasLeader) return MAP_NEUTRAL;
  return mapFill(lead.leaderColor, lead.margin / scale);
}

const PAD = 20;

export function BrazilMap({
  ufSlug,
  selectedIbge,
  stateLeaders,
  munLeaders,
  candidateNames,
  insetRight = 0,
  insetTop = 56,
  awaiting,
  disabledStates,
  onSelectState,
  onSelectMunicipality,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<SVGGElement>(null);
  const statesRef = useRef<SVGGElement>(null);
  const munRef = useRef<SVGGElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const view = useRef({ x: 0, y: 0, k: 1 });
  const introDone = useRef(false);

  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [states, setStates] = useState<GeoFC | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [mun, setMun] = useState<{ uf: string; fc: GeoFC } | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  /* tamanho do contêiner */
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((s) => (s && Math.abs(s.w - width) < 1 && Math.abs(s.h - height) < 1 ? s : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* geometria dos estados */
  useEffect(() => {
    let alive = true;
    loadGeo('/geo/br-states.json')
      .then((d) => alive && setStates(d))
      .catch(() => alive && setGeoError(true));
    return () => {
      alive = false;
    };
  }, []);

  /* geometria dos municípios do estado escolhido */
  useEffect(() => {
    if (!ufSlug) return;
    let alive = true;
    loadGeo(`/geo/mun/${ufSlug}.json`)
      .then((fc) => alive && setMun({ uf: ufSlug, fc }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [ufSlug]);

  const projection = useMemo<GeoProjection | null>(() => {
    if (!states || !size) return null;
    return geoMercator().fitExtent(
      [
        [PAD, PAD + insetTop],
        [Math.max(PAD + 10, size.w - PAD), Math.max(PAD + insetTop + 10, size.h - PAD)],
      ],
      states,
    );
    // insetTop só muda com o layout (mobile/desktop), junto com size
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states, size]);

  const path = useMemo<GeoPath | null>(() => (projection ? geoPath(projection) : null), [projection]);

  const statePaths = useMemo(() => {
    if (!states || !path) return [];
    return states.features.map((f) => {
      const p = f.properties ?? {};
      const slug = (p.sigla ?? '').toLowerCase();
      return { slug, name: p.name ?? p.sigla ?? slug, d: path(f) ?? '', feature: f };
    });
  }, [states, path]);

  const munPaths = useMemo(() => {
    if (!mun || !path || mun.uf !== ufSlug) return [];
    return mun.fc.features.map((f) => {
      const p = f.properties ?? {};
      return { ibge: String(p.id ?? ''), name: p.name ?? '', d: path(f) ?? '' };
    });
  }, [mun, path, ufSlug]);

  /* animação de entrada: estados surgem do centro em onda curta */
  useLayoutEffect(() => {
    const g = statesRef.current;
    if (!g || statePaths.length === 0 || introDone.current) return;
    introDone.current = true;
    if (prefersReducedMotion()) return;
    gsap.fromTo(
      g.querySelectorAll('path'),
      { opacity: 0, scale: 0.94, transformOrigin: '50% 50%' },
      {
        opacity: 1,
        scale: 1,
        duration: 0.9,
        ease: 'power3.out',
        stagger: { each: 0.022, from: 'center' },
        clearProps: 'opacity,transform',
      },
    );
  }, [statePaths]);

  /* zoom suave para o estado (e de volta para o país) */
  useLayoutEffect(() => {
    const g = zoomRef.current;
    if (!g || !path || !size) return;
    let target = { x: 0, y: 0, k: 1 };
    const feat = ufSlug ? statePaths.find((s) => s.slug === ufSlug)?.feature : undefined;
    if (feat) {
      const [[x0, y0], [x1, y1]] = path.bounds(feat as Feature);
      const ax0 = PAD + 8;
      const ay0 = PAD + insetTop;
      const ax1 = size.w - insetRight - PAD - 8;
      const ay1 = size.h - PAD - 8;
      const k = Math.min(16, 0.92 * Math.min((ax1 - ax0) / (x1 - x0 || 1), (ay1 - ay0) / (y1 - y0 || 1)));
      target = {
        k,
        x: (ax0 + ax1) / 2 - k * ((x0 + x1) / 2),
        y: (ay0 + ay1) / 2 - k * ((y0 + y1) / 2),
      };
    }
    const apply = () => {
      const v = view.current;
      g.setAttribute('transform', `translate(${v.x},${v.y}) scale(${v.k})`);
    };
    gsap.to(view.current, {
      ...target,
      duration: dur(DUR.zoom),
      ease: 'power3.inOut',
      overwrite: true,
      onUpdate: apply,
      onComplete: apply,
    });
  }, [ufSlug, path, size, statePaths, insetRight, insetTop]);

  /* camada de municípios aparece quando o zoom está quase no fim */
  useLayoutEffect(() => {
    const g = munRef.current;
    if (!g || munPaths.length === 0) return;
    gsap.fromTo(g, { opacity: 0 }, { opacity: 1, duration: dur(0.5), delay: dur(0.35), ease: 'power1.out' });
  }, [munPaths]);

  const stateFills = useMemo(() => {
    const out: Record<string, string> = {};
    for (const s of statePaths) out[s.slug] = regionFill(stateLeaders[s.slug], 18);
    return out;
  }, [statePaths, stateLeaders]);

  /* ---- interação ---- */
  const hoverKey = useRef<string>('');

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== 'mouse') return;
    const t = (e.target as Element).closest<SVGPathElement>('[data-kind]');
    const wrap = wrapRef.current;
    const tip = tipRef.current;
    if (!t || !wrap) {
      if (hoverKey.current) {
        hoverKey.current = '';
        setHover(null);
      }
      return;
    }
    const rect = wrap.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (tip) {
      const tw = tip.offsetWidth || 220;
      const th = tip.offsetHeight || 80;
      const left = x + 16 + tw > rect.width - insetRight ? x - 16 - tw : x + 16;
      const top = Math.min(Math.max(8, y - th - 12), rect.height - th - 8);
      tip.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    }
    const key = `${t.dataset.kind}:${t.dataset.id}`;
    if (key === hoverKey.current) return;
    hoverKey.current = key;
    setHover(buildHover(t.dataset.kind!, t.dataset.id!, t.dataset.name ?? ''));
  };

  const buildHover = (kind: string, id: string, name: string): HoverInfo => {
    if (kind === 'state') {
      const lead = stateLeaders[id];
      return {
        kind: 'state',
        id,
        title: lead?.name ?? name,
        tag: id.toUpperCase(),
        note: disabledStates?.has(id) ? 'Sem 2º turno para este cargo' : undefined,
        loading: !lead || lead.loading,
        leader: lead?.hasLeader
          ? { name: lead.leaderName ?? '', color: lead.leaderColor, pct: lead.leaderPct, margin: lead.margin }
          : undefined,
      };
    }
    const lead = munLeaders?.[id];
    const cand = lead?.leaderId ? candidateNames[lead.leaderId] : undefined;
    return {
      kind: 'mun',
      id,
      title: titleCase(lead?.name ?? name),
      tag: ufSlug?.toUpperCase() ?? '',
      loading: !lead || lead.loading,
      leader: lead?.hasLeader
        ? { name: cand?.name ?? '', color: lead.leaderColor, pct: lead.leaderPct, margin: lead.margin }
        : undefined,
    };
  };

  /* mantém o tooltip atualizado enquanto os dados chegam */
  const liveHover = hover ? buildHover(hover.kind, hover.id, hover.title) : null;

  const activate = (el: SVGPathElement | null) => {
    if (!el) return;
    const { kind, id } = el.dataset;
    hoverKey.current = '';
    setHover(null);
    if (kind === 'state' && id) {
      if (disabledStates?.has(id)) return;
      if (id !== ufSlug) onSelectState(id);
    } else if (kind === 'mun' && id) {
      const lead = munLeaders?.[id];
      if (lead) onSelectMunicipality(lead.tseCode, lead.name);
    }
  };

  const hovered =
    hover?.kind === 'state'
      ? statePaths.find((s) => s.slug === hover.id)?.d
      : hover?.kind === 'mun'
        ? munPaths.find((m) => m.ibge === hover.id)?.d
        : undefined;
  const selectedState = ufSlug ? statePaths.find((s) => s.slug === ufSlug)?.d : undefined;
  const selectedMun = selectedIbge ? munPaths.find((m) => m.ibge === selectedIbge)?.d : undefined;

  return (
    <div ref={wrapRef} className="absolute inset-0">
      {size && statePaths.length > 0 && (
        <svg
          width={size.w}
          height={size.h}
          className="map-canvas block"
          onPointerMove={onMove}
          onPointerLeave={() => {
            hoverKey.current = '';
            setHover(null);
          }}
          onClick={(e) => activate((e.target as Element).closest<SVGPathElement>('[data-kind]'))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              const el = (e.target as Element).closest<SVGPathElement>('[data-kind]');
              if (el) {
                e.preventDefault();
                activate(el);
              }
            }
          }}
          role="group"
          aria-label={ufSlug ? `Mapa dos municípios de ${ufSlug.toUpperCase()}` : 'Mapa do Brasil por estado'}
        >
          <g ref={zoomRef}>
            <g ref={statesRef} className="map-states" data-focus={ufSlug ? 'true' : 'false'}>
              {statePaths.map((s) => (
                <RegionPath
                  key={s.slug}
                  kind="state"
                  id={s.slug}
                  name={s.name}
                  d={s.d}
                  fill={stateFills[s.slug]}
                  loading={stateLeaders[s.slug]?.loading ?? true}
                  active={s.slug === ufSlug}
                  disabled={disabledStates?.has(s.slug)}
                  strokeWidth={1}
                  focusable={!disabledStates?.has(s.slug)}
                />
              ))}
            </g>
            {munPaths.length > 0 && (
              <g ref={munRef} key={ufSlug}>
                {munPaths.map((m) => {
                  const lead = munLeaders?.[m.ibge];
                  return (
                    <RegionPath
                      key={m.ibge}
                      kind="mun"
                      id={m.ibge}
                      name={m.name}
                      d={m.d}
                      fill={regionFill(lead, 14)}
                      loading={lead?.loading ?? true}
                      active={m.ibge === selectedIbge}
                      strokeWidth={0.5}
                    />
                  );
                })}
              </g>
            )}
            <g pointerEvents="none" fill="none" vectorEffect="non-scaling-stroke">
              {selectedState && (
                <path d={selectedState} stroke="var(--text)" strokeOpacity={0.55} strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
              )}
              {hovered && (
                <path d={hovered} stroke="var(--text)" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
              )}
              {selectedMun && (
                <path d={selectedMun} stroke="var(--text)" strokeWidth={2.25} vectorEffect="non-scaling-stroke" />
              )}
            </g>
          </g>
        </svg>
      )}

      {statePaths.length === 0 && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="size-40 rounded-[40%] sm:size-64" />
            <p className="eyebrow">{geoError ? 'Não foi possível carregar o mapa' : 'Desenhando o mapa'}</p>
          </div>
        </div>
      )}

      <MapTooltip ref={tipRef} info={liveHover} awaiting={awaiting} />
    </div>
  );
}

const RegionPath = memo(function RegionPath({
  kind,
  id,
  name,
  d,
  fill,
  loading,
  active,
  strokeWidth,
  focusable,
  disabled,
}: {
  kind: 'state' | 'mun';
  id: string;
  name: string;
  d: string;
  fill: string;
  loading: boolean;
  active: boolean;
  strokeWidth: number;
  focusable?: boolean;
  disabled?: boolean;
}) {
  return (
    <path
      className={clsx('map-region')}
      data-kind={kind}
      data-id={id}
      data-uf={kind === 'state' ? id : undefined}
      data-name={name}
      data-active={active}
      data-loading={loading && !disabled}
      data-disabled={disabled || undefined}
      d={d}
      style={{ fill }}
      strokeWidth={strokeWidth}
      vectorEffect="non-scaling-stroke"
      tabIndex={focusable ? 0 : undefined}
      role={focusable ? 'button' : undefined}
      aria-label={focusable ? name : undefined}
    />
  );
});

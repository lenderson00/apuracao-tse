import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import * as d3 from 'd3';
import { geoContains, geoMercator, geoPath, type GeoPath, type GeoProjection } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import gsap from 'gsap';
import { candFill } from '../lib/ui/color';
import { titleCase } from '../lib/ui/format';
import { prefersReducedMotion } from '../lib/ui/motion';
import type { RegionView } from '../lib/ui/regions';
import { MapTooltip, type HoverInfo } from './MapTooltip';

/* -------------------------------------------------------------------------- */
/* tipos públicos                                                              */

export type CameraTarget = { kind: 'country' } | { kind: 'state'; uf: string } | { kind: 'mun'; uf: string; ibge: string };

export interface Camera {
  target: CameraTarget;
  /** muda a cada pedido de voo, mesmo para o mesmo alvo */
  seq: number;
}

export type MapLevel = 'country' | 'state' | 'mun';

export interface MapApi {
  zoomBy: (factor: number) => void;
  recenter: () => void;
  /** assina o percentual de zoom (100% = Brasil inteiro) */
  subscribeZoom: (cb: (pct: number) => void) => () => void;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface Props {
  camera: Camera;
  /** estado em foco (por clique ou por zoom) — define a camada de municípios */
  focusUf: string | null;
  /** município destacado (fixado, em foco ou sob o cursor) */
  highlightIbge: string | null;
  stateViews: Record<string, RegionView>;
  munViews: Record<string, RegionView>;
  disabledStates?: Set<string>;
  awaiting: boolean;
  insets: Insets;
  touch: boolean;
  onActivate: (kind: 'state' | 'mun', id: string) => void;
  onZoomFocus: (uf: string | null) => void;
  onZoomMun: (ibge: string | null) => void;
  onHoverMun: (ibge: string | null) => void;
  onLevel: (level: MapLevel) => void;
  /** muda quando o dock troca de recorte: some o tooltip de toque */
  dismissKey?: string;
  apiRef?: Ref<MapApi>;
}

/* -------------------------------------------------------------------------- */
/* geometria                                                                   */

type Props_ = Record<string, string>;
type GeoFC = FeatureCollection<Geometry, Props_>;
type GeoF = Feature<Geometry, Props_>;

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

/** Mundo fixo: a projeção é calculada uma vez; o zoom cuida da tela. */
const WORLD = 1000;
const MAX_K_FACTOR = 90;

interface MunLayer {
  uf: string;
  features: GeoF[];
  g: SVGGElement;
}

/* -------------------------------------------------------------------------- */

export function BrazilMap(props: Props) {
  const { camera, focusUf, highlightIbge, stateViews, munViews, disabledStates, awaiting, touch, apiRef } = props;

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const rootRef = useRef<SVGGElement>(null);
  const statesRef = useRef<SVGGElement>(null);
  const stateLabelsRef = useRef<SVGGElement>(null);
  const liftRef = useRef<SVGGElement>(null);
  const munsRef = useRef<SVGGElement>(null);
  const overlayRef = useRef<SVGGElement>(null);
  const munLabelsRef = useRef<SVGGElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [states, setStates] = useState<GeoFC | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [munLayerUf, setMunLayerUf] = useState<string | null>(null);
  const [hover, setHover] = useState<{ kind: 'state' | 'mun'; id: string } | null>(null);
  const [tap, setTap] = useState<{ kind: 'state' | 'mun'; id: string } | null>(null);
  const [reduced] = useState(prefersReducedMotion);

  const proj = useRef<{ projection: GeoProjection; path: GeoPath } | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const tRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const countryK = useRef(1);
  const munLayer = useRef<MunLayer | null>(null);
  const stateFeatures = useRef<Map<string, GeoF>>(new Map());
  const levelRef = useRef<MapLevel>('country');
  const samples = useRef<Array<{ t: number; x: number; y: number }>>([]);
  const inertiaRaf = useRef(0);
  const semanticTimer = useRef(0);
  const introDone = useRef(false);
  const hatchRef = useRef<SVGPatternElement>(null);
  const zoomSubs = useRef(new Set<(pct: number) => void>());
  const zoomRaf = useRef(0);
  const notifyZoom = useCallback(() => {
    cancelAnimationFrame(zoomRaf.current);
    zoomRaf.current = requestAnimationFrame(() => {
      const pct = (tRef.current.k / countryK.current) * 100;
      zoomSubs.current.forEach((cb) => cb(pct));
    });
  }, []);
  /** o gesto atual (arrasto/roda/pinça) moveu a câmera? */
  const gestureMoved = useRef(false);
  /** o usuário mexeu na câmera desde o último voo? (aí não reenquadramos sozinhos) */
  const userMoved = useRef(false);

  /* refs "vivas" para handlers do D3, sem recriar comportamentos */
  const live = useRef(props);
  live.current = props;
  const sizeRef = useRef(size);
  sizeRef.current = size;

  /* ---------------------------------------------------------------- tamanho */
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setSize((s) => (s && Math.abs(s.w - width) < 1 && Math.abs(s.h - height) < 1 ? s : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* --------------------------------------------------------- geo dos estados */
  useEffect(() => {
    let alive = true;
    loadGeo('/geo/br-states.json')
      .then((d) => alive && setStates(d))
      .catch(() => alive && setGeoError(true));
    return () => {
      alive = false;
    };
  }, []);

  /* ----------------------------------------------------------- enquadramento */
  const fitTransform = useCallback((bounds: [[number, number], [number, number]], fill = 0.9, maxK?: number) => {
    const s = sizeRef.current;
    if (!s) return d3.zoomIdentity;
    const ins = live.current.insets;
    const ax0 = ins.left + 8;
    const ay0 = ins.top + 6;
    const ax1 = s.w - ins.right - 8;
    const ay1 = s.h - ins.bottom - 6;
    const aw = Math.max(40, ax1 - ax0);
    const ah = Math.max(40, ay1 - ay0);
    const [[x0, y0], [x1, y1]] = bounds;
    let k = fill * Math.min(aw / Math.max(1e-6, x1 - x0), ah / Math.max(1e-6, y1 - y0));
    if (maxK) k = Math.min(k, maxK);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    return d3.zoomIdentity.translate(ax0 + aw / 2 - k * cx, ay0 + ah / 2 - k * cy).scale(k);
  }, []);

  const countryBounds = useCallback((): [[number, number], [number, number]] => {
    const p = proj.current;
    if (!p || !states)
      return [
        [0, 0],
        [WORLD, WORLD],
      ];
    return p.path.bounds(states) as [[number, number], [number, number]];
  }, [states]);

  const stateFitK = useCallback(
    (uf: string) => {
      const f = stateFeatures.current.get(uf);
      const p = proj.current;
      if (!f || !p) return countryK.current * 3;
      return fitTransform(p.path.bounds(f) as [[number, number], [number, number]], 0.94).k;
    },
    [fitTransform],
  );

  /* ---------------------------------------------- semântica do zoom manual */
  const evaluateSemantic = useCallback(() => {
    const s = sizeRef.current;
    const p = proj.current;
    if (!s || !p) return;
    const { insets: ins, focusUf: fu, disabledStates: dis } = live.current;
    const t = tRef.current;
    const cx = ins.left + (s.w - ins.left - ins.right) / 2;
    const cy = ins.top + (s.h - ins.top - ins.bottom) / 2;
    const world = t.invert([cx, cy]);
    const lonlat = p.projection.invert?.(world as [number, number]);
    if (!lonlat) return;
    const rel = t.k / countryK.current;

    if (rel < 1.45) {
      if (fu) live.current.onZoomFocus(null);
      return;
    }
    if (rel >= 2) {
      for (const [uf, f] of stateFeatures.current) {
        if (geoContains(f, lonlat)) {
          if (uf !== fu && !dis?.has(uf)) live.current.onZoomFocus(uf);
          break;
        }
      }
    }
    const layer = munLayer.current;
    if (fu && layer && layer.uf === fu) {
      const kState = stateFitK(fu);
      if (t.k >= kState * 2.4) {
        const hit = layer.features.find((f) => geoContains(f, lonlat));
        live.current.onZoomMun(hit ? String(hit.properties.id) : null);
      } else if (t.k < kState * 1.8) {
        live.current.onZoomMun(null);
      }
    }
  }, [stateFitK]);

  const scheduleSemantic = useCallback(
    (delay = 220) => {
      window.clearTimeout(semanticTimer.current);
      semanticTimer.current = window.setTimeout(evaluateSemantic, delay);
    },
    [evaluateSemantic],
  );

  /* ------------------------------------------------ rótulos e nível de zoom */
  const labelRaf = useRef(0);
  const updateLabels = useCallback(() => {
    cancelAnimationFrame(labelRaf.current);
    labelRaf.current = requestAnimationFrame(() => {
      const k = tRef.current.k;
      const rel = k / countryK.current;
      d3.select(stateLabelsRef.current).style('opacity', live.current.focusUf || rel > 3.2 ? 0 : 1);
      d3.select(munLabelsRef.current)
        .selectAll<SVGTextElement, { area: number }>('text')
        .style('opacity', (d) => (d.area * k * k > 5200 ? 1 : 0));
    });
  }, []);

  const computeLevel = useCallback(() => {
    const fu = live.current.focusUf;
    let level: MapLevel = 'country';
    if (fu) level = tRef.current.k >= stateFitK(fu) * 2.4 ? 'mun' : 'state';
    if (level !== levelRef.current) {
      levelRef.current = level;
      live.current.onLevel(level);
    }
  }, [stateFitK]);

  /* -------------------------------------------- cria estados e zoom (1 vez) */
  useLayoutEffect(() => {
    const svgEl = svgRef.current;
    if (!states || !svgEl || !size || proj.current) return;

    const projection = geoMercator().fitSize([WORLD, WORLD], states);
    const path = geoPath(projection);
    proj.current = { projection, path };

    const feats = states.features as GeoF[];
    stateFeatures.current = new Map(feats.map((f) => [(f.properties.sigla ?? '').toLowerCase(), f]));

    d3.select(statesRef.current)
      .selectAll<SVGPathElement, GeoF>('path')
      .data(feats, (d) => d.properties.sigla)
      .join('path')
      .attr('class', 'map-region')
      .attr('d', (d) => path(d) ?? '')
      .attr('data-kind', 'state')
      .attr('data-id', (d) => d.properties.sigla.toLowerCase())
      .attr('data-uf', (d) => d.properties.sigla.toLowerCase())
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('stroke-width', 1)
      .style('fill', 'url(#map-shimmer)');

    d3.select(stateLabelsRef.current)
      .selectAll<SVGTextElement, GeoF>('text')
      .data(feats, (d) => d.properties.sigla)
      .join('text')
      .attr('class', 'map-label map-label-uf')
      .attr('transform', (d) => {
        const [x, y] = path.centroid(d);
        return `translate(${x},${y})`;
      })
      .text((d) => d.properties.sigla);

    const svg = d3.select(svgEl);
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .on('start', (ev: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        if (ev.sourceEvent) {
          cancelAnimationFrame(inertiaRaf.current);
          samples.current = [];
          gestureMoved.current = false;
        }
      })
      .on('zoom', (ev: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        const t = ev.transform;
        if (ev.sourceEvent) {
          if (!gestureMoved.current) setTap(null);
          gestureMoved.current = true;
          userMoved.current = true;
        }
        tRef.current = t;
        rootRef.current?.setAttribute('transform', t.toString());
        rootRef.current?.style.setProperty('--k', String(t.k));
        // hachurado em pixels de tela, não em unidades do mapa
        hatchRef.current?.setAttribute('patternTransform', `rotate(45) scale(${1 / t.k})`);
        svgEl.querySelector('#candidate-missing')?.setAttribute('patternTransform', `scale(${1 / t.k})`);
        notifyZoom();
        // grade de pontos acompanha a câmera, repetindo a cada oitava de zoom
        const wrap = wrapRef.current;
        if (wrap) {
          const rel = t.k / countryK.current;
          const gs = 22 * Math.pow(2, ((Math.log2(rel) % 1) + 1) % 1);
          wrap.style.setProperty('--gs', `${gs}px`);
          wrap.style.setProperty('--gx', `${t.x % gs}px`);
          wrap.style.setProperty('--gy', `${t.y % gs}px`);
        }
        const se = ev.sourceEvent as (Event & { clientX?: number; clientY?: number }) | null;
        if (se && (se.type === 'mousemove' || se.type === 'touchmove' || se.type === 'pointermove')) {
          const now = performance.now();
          samples.current.push({ t: now, x: t.x, y: t.y });
          if (samples.current.length > 6) samples.current.shift();
          if (tipRef.current) tipRef.current.style.opacity = '0';
        }
        updateLabels();
        computeLevel();
      })
      .on('end', (ev: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        if (!ev.sourceEvent || !gestureMoved.current) return;
        gestureMoved.current = false;
        if (tipRef.current) tipRef.current.style.opacity = '';
        // inércia: continua o arrasto com a velocidade do fim do gesto
        const sm = samples.current.filter((s) => performance.now() - s.t < 90);
        samples.current = [];
        if (!prefersReducedMotion() && sm.length >= 2) {
          const a = sm[0];
          const b = sm[sm.length - 1];
          const dt = Math.max(1, b.t - a.t);
          let vx = ((b.x - a.x) / dt) * 16;
          let vy = ((b.y - a.y) / dt) * 16;
          if (Math.hypot(vx, vy) > 2) {
            const step = () => {
              vx *= 0.9;
              vy *= 0.9;
              const k = tRef.current.k;
              svg.call(zoom.translateBy, vx / k, vy / k);
              if (Math.hypot(vx, vy) > 0.4) inertiaRaf.current = requestAnimationFrame(step);
              else scheduleSemantic(60);
            };
            inertiaRaf.current = requestAnimationFrame(step);
            return;
          }
        }
        scheduleSemantic();
      });
    zoom.filter((ev: Event & { button?: number; ctrlKey?: boolean }) => (!ev.ctrlKey || ev.type === 'wheel') && !ev.button);
    svg.call(zoom).on('dblclick.zoom', null);
    zoomRef.current = zoom;

    // enquadra o país (com uma entrada discreta)
    const fit = fitTransform(path.bounds(states) as [[number, number], [number, number]], 0.97);
    countryK.current = fit.k;
    zoom.scaleExtent([fit.k * 0.6, fit.k * MAX_K_FACTOR]);
    if (prefersReducedMotion()) {
      svg.call(zoom.transform, fit);
    } else {
      svg.call(zoom.transform, fitTransform(path.bounds(states) as [[number, number], [number, number]], 0.8));
      svg.transition().duration(1100).ease(d3.easeCubicOut).call(zoom.transform, fit);
      gsap.fromTo(statesRef.current, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'power2.out', clearProps: 'opacity' });
    }
    introDone.current = true;
  }, [states, size, fitTransform, updateLabels, computeLevel, scheduleSemantic, notifyZoom]);

  /* --------------------------------------------------------- voo da câmera */
  const flyTo = useCallback(
    (target: CameraTarget, animate = true) => {
      const svgEl = svgRef.current;
      const zoom = zoomRef.current;
      const p = proj.current;
      if (!svgEl || !zoom || !p || !states) return false;
      let t: d3.ZoomTransform | null = null;
      if (target.kind === 'country') {
        t = fitTransform(countryBounds(), 0.97);
      } else if (target.kind === 'state') {
        const f = stateFeatures.current.get(target.uf);
        if (f) t = fitTransform(p.path.bounds(f) as [[number, number], [number, number]], 0.94);
      } else {
        const layer = munLayer.current;
        const f = layer?.uf === target.uf ? layer.features.find((x) => String(x.properties.id) === target.ibge) : undefined;
        if (!f) return false;
        t = fitTransform(p.path.bounds(f) as [[number, number], [number, number]], 0.32, stateFitK(target.uf) * 7);
      }
      if (!t) return false;
      userMoved.current = false;
      cancelAnimationFrame(inertiaRaf.current);
      const svg = d3.select(svgEl);
      svg.interrupt();
      if (!animate || prefersReducedMotion()) {
        svg.call(zoom.transform, t);
      } else {
        const s = sizeRef.current!;
        const cur = tRef.current;
        const p0: [number, number, number] = [(s.w / 2 - cur.x) / cur.k, (s.h / 2 - cur.y) / cur.k, s.w / cur.k];
        const p1: [number, number, number] = [(s.w / 2 - t.x) / t.k, (s.h / 2 - t.y) / t.k, s.w / t.k];
        const dur = Math.max(650, Math.min(1500, d3.interpolateZoom(p0, p1).duration * 0.85));
        svg.transition().duration(dur).ease(d3.easeCubicInOut).call(zoom.transform, t);
      }
      return true;
    },
    [states, fitTransform, countryBounds, stateFitK],
  );

  const pendingCamera = useRef<Camera | null>(null);
  const flyAt = useRef(0);
  useEffect(() => {
    if (!proj.current) {
      pendingCamera.current = camera;
      return;
    }
    // clique em estado: a região levanta primeiro (~220ms), depois a câmera voa
    const lift = camera.target.kind === 'state' && !prefersReducedMotion() ? 220 : 0;
    flyAt.current = performance.now();
    const go = () => {
      if (!flyTo(camera.target)) pendingCamera.current = camera;
      else pendingCamera.current = null;
    };
    if (!lift) {
      go();
      return;
    }
    const id = window.setTimeout(go, lift);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.seq, flyTo]);

  /* reenquadra sem animação quando o tamanho muda */
  const lastSize = useRef<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!size || !proj.current || !states) return;
    const prev = lastSize.current;
    lastSize.current = size;
    countryK.current = fitTransform(countryBounds(), 0.97).k;
    zoomRef.current?.scaleExtent([countryK.current * 0.6, countryK.current * MAX_K_FACTOR]);
    if (prev && (prev.w !== size.w || prev.h !== size.h)) flyTo(live.current.camera.target, false);
  }, [size, states, fitTransform, countryBounds, flyTo]);

  /* dock ou toolbar mudaram de altura: reenquadra se o usuário não mexeu */
  const insetsKey = `${props.insets.top}|${props.insets.bottom}|${props.insets.right}`;
  const firstInsets = useRef(true);
  useEffect(() => {
    if (firstInsets.current) {
      firstInsets.current = false;
      return;
    }
    if (!proj.current) return;
    countryK.current = fitTransform(countryBounds(), 0.97).k;
    zoomRef.current?.scaleExtent([countryK.current * 0.6, countryK.current * MAX_K_FACTOR]);
    notifyZoom();
    if (userMoved.current) return;
    const id = window.setTimeout(() => {
      if (!userMoved.current) flyTo(live.current.camera.target);
    }, 120);
    return () => window.clearTimeout(id);
  }, [insetsKey, flyTo, fitTransform, countryBounds, notifyZoom]);

  useImperativeHandle(
    apiRef,
    () => ({
      zoomBy: (factor: number) => {
        const svgEl = svgRef.current;
        const zoom = zoomRef.current;
        const s = sizeRef.current;
        if (!svgEl || !zoom || !s) return;
        const ins = live.current.insets;
        const c: [number, number] = [ins.left + (s.w - ins.left - ins.right) / 2, ins.top + (s.h - ins.top - ins.bottom) / 2];
        const sel = d3.select(svgEl);
        if (prefersReducedMotion()) sel.call(zoom.scaleBy, factor, c);
        else sel.transition().duration(320).ease(d3.easeCubicOut).call(zoom.scaleBy, factor, c);
        scheduleSemantic(380);
      },
      recenter: () => flyTo(live.current.camera.target),
      subscribeZoom: (cb) => {
        zoomSubs.current.add(cb);
        cb((tRef.current.k / countryK.current) * 100);
        return () => zoomSubs.current.delete(cb);
      },
    }),
    [flyTo, scheduleSemantic],
  );

  /* ------------------------------------------------- camada de municípios */
  useEffect(() => {
    const host = munsRef.current;
    if (!host || !states) return;
    const old = munLayer.current;
    if (old && old.uf !== focusUf) {
      munLayer.current = null;
      setMunLayerUf(null);
      d3.select(munLabelsRef.current).selectAll('*').remove();
      gsap.to(old.g, { opacity: 0, duration: 0.2, onComplete: () => old.g.remove() });
    }
    if (!focusUf || munLayer.current?.uf === focusUf) return;
    let alive = true;
    loadGeo(`/geo/mun/${focusUf}.json`)
      .then((fc) => {
        const p = proj.current;
        if (!alive || !p || live.current.focusUf !== focusUf) return;
        const feats = fc.features as GeoF[];
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('data-uf-layer', focusUf);
        host.appendChild(g);
        const sel = d3
          .select(g)
          .selectAll<SVGPathElement, GeoF>('path')
          .data(feats, (d) => String(d.properties.id))
          .join('path')
          .attr('class', 'map-region')
          .attr('d', (d) => p.path(d) ?? '')
          .attr('data-kind', 'mun')
          .attr('data-id', (d) => String(d.properties.id))
          .attr('data-name', (d) => d.properties.name ?? '')
          .attr('tabindex', 0)
          .attr('role', 'button')
          .attr('stroke-width', 0.5)
          .style('fill', 'url(#map-shimmer)');
        munLayer.current = { uf: focusUf, features: feats, g };
        setMunLayerUf(focusUf);

        // rótulos dos maiores municípios (aparecem com o zoom)
        const ranked = feats
          .map((f) => ({ f, area: p.path.area(f), c: p.path.centroid(f) }))
          .sort((a, b) => b.area - a.area)
          .slice(0, 36);
        d3.select(munLabelsRef.current)
          .selectAll<SVGTextElement, (typeof ranked)[number]>('text')
          .data(ranked, (d) => String(d.f.properties.id))
          .join('text')
          .attr('class', 'map-label')
          .attr('transform', (d) => `translate(${d.c[0]},${d.c[1]})`)
          .style('opacity', 0)
          .text((d) => titleCase(d.f.properties.name ?? ''));
        updateLabels();

        // entrada em onda curta a partir do centro do estado
        if (!prefersReducedMotion()) {
          const sf = stateFeatures.current.get(focusUf);
          const [ox, oy] = sf ? p.path.centroid(sf) : [0, 0];
          const nodes = sel.nodes();
          const dists = feats.map((f) => {
            const [x, y] = p.path.centroid(f);
            return Math.hypot(x - ox, y - oy);
          });
          const maxD = Math.max(...dists, 1);
          // espera o voo da câmera (o estado levanta, voa, e aí os municípios entram)
          const waveStart = performance.now() - flyAt.current < 500 ? 1.05 : 0.15;
          gsap.fromTo(
            nodes,
            { opacity: 0 },
            {
              opacity: 1,
              duration: 0.4,
              ease: 'power1.out',
              delay: (i: number) => waveStart + (dists[i] / maxD) * 0.45,
              clearProps: 'opacity',
            },
          );
        }

        const pc = pendingCamera.current;
        if (pc && pc.target.kind === 'mun' && pc.target.uf === focusUf) {
          if (flyTo(pc.target)) pendingCamera.current = null;
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [focusUf, states, flyTo, updateLabels]);

  /* ----------------------------------------- cores: só atualiza o fill */
  useEffect(() => {
    d3.select(statesRef.current)
      .selectAll<SVGPathElement, GeoF>('path')
      .each(function (d) {
        const uf = d.properties.sigla.toLowerCase();
        const v = stateViews[uf];
        const disabled = disabledStates?.has(uf);
        const el = d3.select(this);
        el.style('fill', v?.fill ?? 'url(#map-shimmer)')
          .attr('data-state', v?.status ?? 'loading')
          .attr('data-disabled', disabled ? '' : null)
          .attr('data-active', uf === focusUf ? 'true' : null)
          .attr('tabindex', disabled ? -1 : 0)
          .attr('aria-label', regionLabel(d.properties.name ?? uf.toUpperCase(), v, disabled));
      });
  }, [stateViews, disabledStates, focusUf, states]);

  useEffect(() => {
    const layer = munLayer.current;
    if (!layer) return;
    d3.select(layer.g)
      .selectAll<SVGPathElement, GeoF>('path')
      .each(function (d) {
        const id = String(d.properties.id);
        const v = munViews[id];
        d3.select(this)
          .style('fill', v?.fill ?? 'url(#map-shimmer)')
          .attr('data-state', v?.status ?? 'loading')
          .attr('aria-label', regionLabel(titleCase(d.properties.name ?? ''), v));
      });
  }, [munViews, munLayerUf]);

  /* ---------------------------- estado em foco: o resto recua, ele levanta */
  useEffect(() => {
    d3.select(statesRef.current).attr('data-focus', focusUf ? 'true' : 'false');
    updateLabels();
    computeLevel();
    const lift = liftRef.current;
    const p = proj.current;
    if (!lift || !p) return;
    const f = focusUf ? stateFeatures.current.get(focusUf) : undefined;
    const sel = d3
      .select(lift)
      .selectAll<SVGPathElement, GeoF>('path')
      .data(f ? [f] : [], (d) => d.properties.sigla);
    sel.exit().each(function () {
      gsap.to(this as Element, { opacity: 0, duration: 0.25, onComplete: () => (this as Element).remove() });
    });
    const entered = sel
      .enter()
      .append('path')
      .attr('class', 'map-lift')
      .attr('d', (d) => p.path(d) ?? '');
    entered.each(function (d) {
      if (prefersReducedMotion()) return;
      const [cx, cy] = p.path.centroid(d);
      gsap
        .timeline()
        .fromTo(
          this,
          { scale: 1, opacity: 0.6, svgOrigin: `${cx} ${cy}` },
          { scale: 1.045, opacity: 1, duration: 0.26, ease: 'back.out(2)', svgOrigin: `${cx} ${cy}` },
        )
        .to(this, { scale: 1, duration: 0.7, ease: 'power3.inOut', svgOrigin: `${cx} ${cy}` }, '+=0.75');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusUf, states]);

  /* cor do brilho acompanha o líder do estado em foco */
  useEffect(() => {
    const v = focusUf ? stateViews[focusUf] : undefined;
    const color = v?.status === 'leader' && v.color ? candFill(v.color) : 'var(--line-loud)';
    d3.select(liftRef.current)
      .selectAll('path')
      .style('fill', v?.fill ?? 'var(--map-loading)')
      .style('stroke', color)
      .style('stroke-width', '2px')
      .style(
        'filter',
        `drop-shadow(0 0 calc(22px / var(--k, 1)) color-mix(in oklab, ${color} 75%, transparent)) drop-shadow(0 calc(8px / var(--k, 1)) calc(14px / var(--k, 1)) rgb(0 0 0 / 0.7))`,
      );
  }, [focusUf, stateViews]);

  /* ------------------------------------------- contornos: hover e destaque */
  useEffect(() => {
    const ov = overlayRef.current;
    const p = proj.current;
    if (!ov || !p) return;
    const shapes: Array<{ key: string; d: string; kind: 'hover' | 'pick'; color: string }> = [];
    const layer = munLayer.current;
    const findMun = (id: string) => layer?.features.find((f) => String(f.properties.id) === id);
    if (highlightIbge) {
      const f = findMun(highlightIbge);
      const v = munViews[highlightIbge];
      if (f)
        shapes.push({
          key: `pick-${highlightIbge}`,
          d: p.path(f) ?? '',
          kind: 'pick',
          color: v?.color ? candFill(v.color) : 'var(--text)',
        });
    }
    if (hover && !touch) {
      const f = hover.kind === 'state' ? stateFeatures.current.get(hover.id) : findMun(hover.id);
      if (f && !(hover.kind === 'mun' && hover.id === highlightIbge))
        shapes.push({ key: `hover-${hover.kind}-${hover.id}`, d: p.path(f) ?? '', kind: 'hover', color: 'var(--text)' });
    }
    const sel = d3
      .select(ov)
      .selectAll<SVGPathElement, (typeof shapes)[number]>('path')
      .data(shapes, (d) => d.key);
    sel.exit().remove();
    const entered = sel
      .enter()
      .append('path')
      .attr('class', 'map-lift')
      .attr('fill', 'none')
      .attr('d', (d) => d.d);
    entered
      .filter((d) => d.kind === 'pick')
      .each(function () {
        if (prefersReducedMotion()) return;
        gsap.fromTo(this, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out' });
      });
    entered
      .merge(sel)
      .style('stroke', (d) => (d.kind === 'pick' ? 'var(--text)' : 'rgb(255 255 255 / 0.85)'))
      .style('stroke-width', (d) => (d.kind === 'pick' ? '2px' : '1.25px'))
      .style('filter', (d) =>
        d.kind === 'pick' ? `drop-shadow(0 0 calc(9px / var(--k, 1)) color-mix(in oklab, ${d.color} 85%, transparent))` : null,
      );
  }, [hover, highlightIbge, munViews, munLayerUf, touch]);

  /* ------------------------------------------------------------- interação */
  const hoverKey = useRef('');
  const placeTip = (x: number, y: number) => {
    const tip = tipRef.current;
    const wrap = wrapRef.current;
    if (!tip || !wrap) return;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    const tw = tip.offsetWidth || 224;
    const th = tip.offsetHeight || 80;
    const left = x + 18 + tw > w - 8 ? x - 18 - tw : x + 18;
    const top = Math.min(Math.max(8, y - th - 14), h - th - 8);
    tip.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  };

  const setHoverTarget = (el: Element | null) => {
    const kind = el?.getAttribute('data-kind') as 'state' | 'mun' | null;
    const id = el?.getAttribute('data-id') ?? '';
    const key = kind ? `${kind}:${id}` : '';
    if (key === hoverKey.current) return;
    hoverKey.current = key;
    setHover(kind ? { kind, id } : null);
    props.onHoverMun(kind === 'mun' ? id : null);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    if (tipRef.current) tipRef.current.style.opacity = '';
    const wrap = wrapRef.current!.getBoundingClientRect();
    placeTip(e.clientX - wrap.left, e.clientY - wrap.top);
    setHoverTarget((e.target as Element).closest('[data-kind]'));
  };

  const activate = (el: Element | null) => {
    if (!el) return;
    const kind = el.getAttribute('data-kind') as 'state' | 'mun' | null;
    const id = el.getAttribute('data-id');
    if (!kind || !id) return;
    if (kind === 'state' && disabledStates?.has(id)) return;
    if (touch) setTap({ kind, id });
    else if (tipRef.current) tipRef.current.style.opacity = '0';
    props.onActivate(kind, id);
  };

  const onFocusIn = (e: React.FocusEvent<SVGSVGElement>) => {
    const el = (e.target as Element).closest('[data-kind]');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const wrap = wrapRef.current!.getBoundingClientRect();
    placeTip(r.left + r.width / 2 - wrap.left, r.top + r.height / 2 - wrap.top);
    setHoverTarget(el);
  };

  /* toque: o cartão some quando o dock troca para o recorte tocado */
  const dismissKey = props.dismissKey;
  useEffect(() => {
    setTap(null);
  }, [dismissKey]);

  /* conteúdo do tooltip (hover no desktop, toque no mobile) */
  const info = buildInfo(touch ? tap : hover, stateViews, munViews, munLayer.current, stateFeatures.current, disabledStates);

  return (
    <div ref={wrapRef} className="canvas absolute inset-0 overflow-hidden">
      <svg
        ref={svgRef}
        width={size?.w ?? 0}
        height={size?.h ?? 0}
        className="block select-none"
        role="group"
        aria-label={focusUf ? `Mapa dos municípios de ${focusUf.toUpperCase()}` : 'Mapa do Brasil por estado'}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHoverTarget(null)}
        onClick={(e) => activate((e.target as Element).closest('[data-kind]'))}
        onFocus={onFocusIn}
        onBlur={() => setHoverTarget(null)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            const el = (e.target as Element).closest('[data-kind]');
            if (el) {
              e.preventDefault();
              activate(el);
            }
          }
        }}
      >
        <defs>
          <pattern id="candidate-missing" width="7" height="7" patternUnits="userSpaceOnUse">
            <rect width="7" height="7" fill="#55565e" />
            <path d="M-1,1L1,-1M0,7L7,0M6,8L8,6" stroke="#a1a1aa" strokeOpacity=".55" strokeWidth="1" />
          </pattern>
          <pattern ref={hatchRef} id="map-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" style={{ fill: 'var(--map-error)' }} />
            <line x1="0" y1="0" x2="0" y2="6" style={{ stroke: 'rgb(255 255 255 / 0.07)' }} strokeWidth="1.2" />
          </pattern>
          {/* carregando: um único brilho em todo o mapa, em vez de cada área piscar sozinha */}
          <linearGradient id="map-shimmer" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="420" y2="160" spreadMethod="reflect">
            <stop offset="0" style={{ stopColor: 'var(--map-loading)' }} />
            <stop offset="0.7" style={{ stopColor: 'var(--map-loading)' }} />
            <stop offset="1" style={{ stopColor: 'var(--map-loading-hi)' }} />
            {!reduced && (
              <animateTransform
                attributeName="gradientTransform"
                type="translate"
                from="0 0"
                to="840 320"
                dur="3.2s"
                repeatCount="indefinite"
              />
            )}
          </linearGradient>
        </defs>
        <g ref={rootRef}>
          <g ref={statesRef} className="map-states" />
          <g ref={liftRef} />
          <g ref={munsRef} />
          <g ref={overlayRef} pointerEvents="none" />
          <g ref={stateLabelsRef} pointerEvents="none" />
          <g ref={munLabelsRef} pointerEvents="none" />
        </g>
      </svg>

      {!states && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-3">
            <div className="skeleton size-48 rounded-[38%] sm:size-72" />
            <p className="eyebrow">{geoError ? 'Não deu para carregar o mapa. Recarregue a página.' : 'Desenhando o mapa'}</p>
          </div>
        </div>
      )}

      {touch ? (
        tap &&
        info && <MapTooltip info={info} awaiting={awaiting} onClose={() => setTap(null)} docked style={{ top: props.insets.top + 4 }} />
      ) : (
        <MapTooltip ref={tipRef} info={info} awaiting={awaiting} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function regionLabel(name: string, v: RegionView | undefined, disabled?: boolean) {
  if (disabled) return `${name}: sem 2º turno para este cargo`;
  if (!v || v.status === 'loading') return `${name}: carregando`;
  if (v.status === 'leader')
    return `${name}: ${v.leaderName ? titleCase(v.leaderName) : 'líder'} à frente com ${v.pct.toFixed(1).replace('.', ',')}%`;
  return `${name}: ${v.note ?? 'sem dados'}`;
}

function buildInfo(
  target: { kind: 'state' | 'mun'; id: string } | null,
  stateViews: Record<string, RegionView>,
  munViews: Record<string, RegionView>,
  layer: MunLayer | null,
  stateFeatures: Map<string, GeoF>,
  disabled?: Set<string>,
): HoverInfo | null {
  if (!target) return null;
  if (target.kind === 'state') {
    const f = stateFeatures.get(target.id);
    return {
      kind: 'state',
      id: target.id,
      title: f?.properties.name ?? target.id.toUpperCase(),
      tag: target.id.toUpperCase(),
      view: stateViews[target.id],
      note: disabled?.has(target.id) ? 'Sem 2º turno para este cargo' : undefined,
    };
  }
  const f = layer?.features.find((x) => String(x.properties.id) === target.id);
  return {
    kind: 'mun',
    id: target.id,
    title: titleCase(f?.properties.name ?? ''),
    tag: layer?.uf.toUpperCase() ?? '',
    view: munViews[target.id],
  };
}

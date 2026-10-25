import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { geoMercator, geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import gsap from 'gsap';
import type { StateLeader } from '../hooks/useStateLeaders';
import type { MunLeader } from '../hooks/useMunicipalityResults';

type MapLevel = 'country' | 'state';

interface Props {
  level: MapLevel;
  ufSlug?: string;
  stateLeaders: Record<string, StateLeader>;
  munLeaders?: Record<string, MunLeader>;
  munProgress?: number;
  onSelectState: (slug: string) => void;
  onSelectMunicipality: (tseCode: string, name: string) => void;
}

const MAP_NEUTRAL = 'var(--color-map-neutral)';

function mixColor(hex: string, amount: number): string {
  const c = d3.color(hex);
  if (!c) return hex;
  const darker = d3.color(hex)?.darker(0.35);
  if (!amount || !darker) return c.formatHex();
  return d3.interpolateRgb(darker, c)(Math.min(1, amount / 1.4)).toString();
}

function regionFill(
  lead: { leaderColor: string; margin: number; hasLeader: boolean } | undefined,
  marginScale: number,
): string {
  if (!lead?.hasLeader) return MAP_NEUTRAL;
  return mixColor(lead.leaderColor, lead.margin ? Math.min(1, lead.margin / marginScale) : 0);
}

export function BrazilMap({
  level,
  ufSlug,
  stateLeaders,
  munLeaders,
  munProgress = 0,
  onSelectState,
  onSelectMunicipality,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const [geo, setGeo] = useState<FeatureCollection | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; title: string; sub: string } | null>(
    null,
  );
  const [size, setSize] = useState({ w: 800, h: 520 });

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width } = entry.contentRect;
      const aspect = width >= 900 ? 0.82 : 0.68;
      setSize({ w: Math.max(320, width), h: Math.max(280, width * aspect) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const url =
      level === 'country'
        ? '/geo/br-states.json'
        : ufSlug
          ? `/geo/mun/${ufSlug}.json`
          : null;
    if (!url) return;
    setGeo(null);
    fetch(url)
      .then((r) => r.json())
      .then((d) => setGeo(d as FeatureCollection))
      .catch(() => setGeo(null));
  }, [level, ufSlug]);

  const projection = useMemo(() => {
    if (!geo) return null;
    const p = geoMercator().fitSize([size.w - 24, size.h - 24], geo as GeoJSON.FeatureCollection);
    return p;
  }, [geo, size]);

  const pathGen = useMemo(() => {
    if (!projection) return null;
    return geoPath(projection);
  }, [projection]);

  useEffect(() => {
    if (!gRef.current || !geo || !pathGen) return;
    const g = d3.select(gRef.current);
    g.selectAll('*').remove();

    const features = geo.features;
    const paths = g
      .selectAll('path')
      .data(features)
      .enter()
      .append('path')
      .attr('class', 'map-region')
      .attr('data-uf', (d) => {
        const p = d.properties as { sigla?: string; id?: string };
        return p.sigla?.toLowerCase() ?? p.id ?? '';
      })
      .attr('d', (d) => pathGen(d as GeoJSON.Feature<Geometry>) ?? '')
      .attr('fill', (_, i) => {
        if (level === 'country') {
          const sigla = (features[i].properties as { sigla?: string })?.sigla?.toLowerCase();
          const lead = sigla ? stateLeaders[sigla] : undefined;
          return regionFill(lead, 18);
        }
        const ibge = String((features[i].properties as { id?: string })?.id ?? '');
        const lead = munLeaders?.[ibge];
        return regionFill(lead, 14);
      })
      .attr('stroke', 'var(--color-border)')
      .attr('stroke-width', level === 'country' ? 0.75 : 0.4)
      .attr('opacity', 0)
      .on('mousemove', (event, d) => {
        const props = d.properties as Record<string, string>;
        let title = props.name ?? props.sigla ?? '';
        let sub = '';
        if (level === 'country') {
          const slug = props.sigla?.toLowerCase();
          const lead = slug ? stateLeaders[slug] : undefined;
          if (lead && !lead.loading) {
            sub = lead.hasLeader && lead.leaderName
              ? `${lead.leaderName} · ${lead.leaderPct.toFixed(1)}%`
              : 'aguardando apuração';
          }
        } else {
          const ibge = String(props.id ?? '');
          const lead = munLeaders?.[ibge];
          if (lead && !lead.loading) {
            sub = lead.hasLeader
              ? `${lead.leaderPct.toFixed(1)}% · margem ${lead.margin.toFixed(1)} pp`
              : 'aguardando apuração';
          }
        }
        setTooltip({ x: event.offsetX, y: event.offsetY, title, sub });
      })
      .on('mouseleave', () => setTooltip(null))
      .on('click', (_, d) => {
        const props = d.properties as Record<string, string>;
        if (level === 'country' && props.sigla) {
          onSelectState(props.sigla.toLowerCase());
        } else if (level === 'state' && munLeaders) {
          const ibge = String(props.id ?? '');
          const lead = munLeaders[ibge];
          if (lead) onSelectMunicipality(lead.tseCode, lead.name);
        }
      });

    gsap.to(paths.nodes(), {
      opacity: 1,
      duration: 0.55,
      stagger: 0.012,
      ease: 'power2.out',
    });
  }, [geo, pathGen, level, stateLeaders, munLeaders, onSelectState, onSelectMunicipality]);

  useEffect(() => {
    if (!gRef.current) return;
    gsap.fromTo(
      gRef.current,
      { scale: 0.96, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.65, ease: 'power3.out' },
    );
  }, [level, ufSlug]);

  return (
    <div className="panel relative w-full overflow-hidden lg:min-h-0">
      <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-4 py-3">
        <p className="label-mono">
          {level === 'country' ? 'mapa · brasil' : `mapa · ${ufSlug?.toUpperCase() ?? 'UF'}`}
        </p>
        {level === 'state' && munProgress < 100 && (
          <p className="font-mono text-[10px] text-[var(--color-muted)]">
            {munProgress}% municípios
          </p>
        )}
      </div>
      {level === 'state' && munProgress < 100 && (
        <div className="absolute left-4 right-4 top-12 z-10">
          <div className="h-px overflow-hidden rounded-full bg-[var(--color-border)]">
            <div
              className="h-full bg-[var(--color-accent)] transition-all duration-300"
              style={{ width: `${munProgress}%` }}
            />
          </div>
        </div>
      )}
      <svg ref={svgRef} width={size.w} height={size.h} className="mx-auto block max-w-full">
        <g ref={gRef} transform="translate(12,12)" />
      </svg>
      {!geo && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-surface-elevated)]/80">
          <div className="h-40 w-3/4 max-w-md skeleton" />
        </div>
      )}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 max-w-[220px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-xs shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          <p className="font-semibold">{tooltip.title}</p>
          {tooltip.sub && <p className="mt-0.5 font-mono text-[10px] text-[var(--color-muted)]">{tooltip.sub}</p>}
        </div>
      )}
    </div>
  );
}

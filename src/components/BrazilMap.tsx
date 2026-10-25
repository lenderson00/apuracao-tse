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

function mixColor(hex: string, amount: number): string {
  const c = d3.color(hex);
  if (!c) return hex;
  return c.brighter(amount).formatHex();
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
      setSize({ w: Math.max(320, width), h: Math.max(280, width * 0.65) });
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
          return mixColor(lead?.leaderColor ?? '#52525b', lead?.margin ? Math.min(1.2, lead.margin / 15) : 0);
        }
        const ibge = String((features[i].properties as { id?: string })?.id ?? '');
        const lead = munLeaders?.[ibge];
        return mixColor(lead?.leaderColor ?? '#3f3f46', lead?.margin ? Math.min(1.4, lead.margin / 12) : 0);
      })
      .attr('stroke', 'var(--color-border)')
      .attr('stroke-width', level === 'country' ? 0.8 : 0.35)
      .attr('opacity', 0)
      .on('mousemove', (event, d) => {
        const props = d.properties as Record<string, string>;
        let title = props.name ?? props.sigla ?? '';
        let sub = '';
        if (level === 'country') {
          const slug = props.sigla?.toLowerCase();
          const lead = slug ? stateLeaders[slug] : undefined;
          if (lead?.leaderName) sub = `${lead.leaderName} · ${lead.leaderPct.toFixed(1)}%`;
        } else {
          const ibge = String(props.id ?? '');
          const lead = munLeaders?.[ibge];
          if (lead && !lead.loading) sub = `${lead.leaderPct.toFixed(1)}% · margem ${lead.margin.toFixed(1)} pp`;
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
      duration: 0.6,
      stagger: 0.015,
      ease: 'power2.out',
    });
  }, [geo, pathGen, level, stateLeaders, munLeaders, onSelectState, onSelectMunicipality]);

  useEffect(() => {
    if (!gRef.current) return;
    gsap.fromTo(
      gRef.current,
      { scale: 0.92, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.7, ease: 'power3.out' },
    );
  }, [level, ufSlug]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
      {level === 'state' && munProgress < 100 && (
        <div className="absolute left-4 right-4 top-3 z-10">
          <div className="h-1 overflow-hidden rounded-full bg-[var(--color-border)]">
            <div
              className="h-full bg-[var(--color-accent)] transition-all duration-300"
              style={{ width: `${munProgress}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-[var(--color-muted)]">
            Carregando municípios… {munProgress}%
          </p>
        </div>
      )}
      <svg ref={svgRef} width={size.w} height={size.h} className="mx-auto block max-w-full">
        <g ref={gRef} transform="translate(12,12)" />
      </svg>
      {!geo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-32 w-full max-w-md skeleton rounded-xl" />
        </div>
      )}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 max-w-[200px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-xs shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          <p className="font-semibold">{tooltip.title}</p>
          {tooltip.sub && <p className="text-[var(--color-muted)]">{tooltip.sub}</p>}
        </div>
      )}
    </div>
  );
}

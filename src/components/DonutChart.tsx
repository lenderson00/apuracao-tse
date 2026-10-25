import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { CandidateRow } from '../lib/tse/types';

export function DonutChart({ candidates }: { candidates: CandidateRow[] }) {
  const ref = useRef<SVGSVGElement>(null);
  const top = candidates.slice(0, 2);
  const rest = candidates.slice(2).reduce((s, c) => s + c.votes, 0);
  type Slice = { label: string; value: number; color: string };
  const data: Slice[] = [...top.map((c) => ({ label: c.shortName, value: c.votes, color: c.color }))];
  if (rest > 0) data.push({ label: 'Outros', value: rest, color: '#94a3b8' });

  useEffect(() => {
    if (!ref.current || data.every((d) => d.value === 0)) return;
    const svg = d3.select(ref.current);
    svg.selectAll('*').remove();
    const w = 160;
    const h = 160;
    const r = Math.min(w, h) / 2;
    const arc = d3.arc<d3.PieArcDatum<Slice>>().innerRadius(r * 0.55).outerRadius(r - 4);
    const pie = d3.pie<Slice>().value((d) => d.value).sort(null);
    const g = svg.attr('viewBox', `0 0 ${w} ${h}`).append('g').attr('transform', `translate(${w / 2},${h / 2})`);
    g.selectAll('path')
      .data(pie(data))
      .enter()
      .append('path')
      .attr('fill', (d) => d.data.color)
      .attr('d', arc)
      .attr('opacity', 0)
      .transition()
      .duration(600)
      .attr('opacity', 1);
  }, [candidates]);

  if (data.every((d) => d.value === 0)) {
    return (
      <div className="flex h-40 w-40 items-center justify-center rounded-full border border-dashed border-[var(--color-border)] text-xs text-[var(--color-muted)]">
        Sem votos ainda
      </div>
    );
  }

  return <svg ref={ref} className="h-40 w-40 shrink-0" aria-hidden />;
}

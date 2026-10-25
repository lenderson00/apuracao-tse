import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { CandidateRow } from '../lib/tse/types';

export function DonutChart({ candidates }: { candidates: CandidateRow[] }) {
  const ref = useRef<SVGSVGElement>(null);
  const top = candidates.slice(0, 2);
  const rest = candidates.slice(2).reduce((s, c) => s + c.votes, 0);
  type Slice = { label: string; value: number; color: string };
  const data: Slice[] = [...top.map((c) => ({ label: c.shortName, value: c.votes, color: c.color }))];
  if (rest > 0) data.push({ label: 'Outros', value: rest, color: '#8a847c' });

  useEffect(() => {
    if (!ref.current || data.every((d) => d.value === 0)) return;
    const svg = d3.select(ref.current);
    svg.selectAll('*').remove();
    const w = 140;
    const h = 140;
    const r = Math.min(w, h) / 2;
    const arc = d3.arc<d3.PieArcDatum<Slice>>().innerRadius(r * 0.58).outerRadius(r - 6);
    const pie = d3.pie<Slice>().value((d) => d.value).sort(null);
    const g = svg.attr('viewBox', `0 0 ${w} ${h}`).append('g').attr('transform', `translate(${w / 2},${h / 2})`);
    g.selectAll('path')
      .data(pie(data))
      .enter()
      .append('path')
      .attr('fill', (d) => d.data.color)
      .attr('stroke', 'var(--color-surface-elevated)')
      .attr('stroke-width', 1.5)
      .attr('d', arc)
      .attr('opacity', 0)
      .transition()
      .duration(500)
      .attr('opacity', 1);
  }, [candidates]);

  if (data.every((d) => d.value === 0)) {
    return (
      <div className="flex h-[140px] w-[140px] items-center justify-center rounded-full border border-dashed border-[var(--color-border)] font-mono text-[10px] text-[var(--color-muted)]">
        aguardando
      </div>
    );
  }

  return <svg ref={ref} className="h-[140px] w-[140px] shrink-0" aria-hidden />;
}

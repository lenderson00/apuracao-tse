import { CandidateAvatar } from './CandidateAvatar';
import type { CandidateRow, ParsedResult } from '../lib/tse/types';
import { heatColor } from '../lib/ui/candidate';
import { titleCase, fmtPct } from '../lib/ui/format';
import { Int, Pct } from './ui/Num';
export interface CandidatePick {
  candidate: CandidateRow;
  uf: string;
  electionId: string;
}
export function HeatLegend({ candidate: c, onClose }: { candidate: CandidateRow; onClose: () => void }) {
  return (
    <div className="float pointer-events-auto p-3">
      <button className="text-small font-medium" onClick={onClose} aria-label="Sair do modo candidato">
        {titleCase(c.shortName)} {c.number} ×
      </button>
      <div className="mt-2 flex gap-1">
        {['0–20', '20–35', '35–50', '50–65', '65%+'].map((label, i) => (
          <div key={label} className="text-nano text-ink-2">
            <div className="h-2 w-12" style={{ background: heatColor(c.color, [0, 20, 35, 50, 65][i]) }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
export function CandidatePanel({
  pick,
  data,
  regions,
  onFly,
  total,
  unit,
}: {
  pick: CandidatePick;
  data: ParsedResult | null;
  regions: { id: string; name: string; candidates?: CandidateRow[] }[];
  total: number;
  unit: 'UFs' | 'municípios';
  onFly: (id: string) => void;
}) {
  const c = pick.candidate;
  const current = data?.candidates.find((r) => r.sqcand === c.sqcand);
  const rows = regions
    .flatMap((r) => {
      const row = r.candidates?.find((x) => x.sqcand === c.sqcand);
      return row && r.candidates?.some((x) => x.votes > 0)
        ? [
            {
              ...r,
              row,
              rank: r.candidates.filter((x) => x.votes > row.votes).length + 1,
            },
          ]
        : [];
    })
    .sort((a, b) => b.row.percent - a.row.percent);
  return (
    <div className="space-y-3 text-small">
      <div className="flex flex-wrap items-center gap-3">
        <CandidateAvatar candidate={c} electionId={pick.electionId} photoUf={pick.uf} size={36} />
        <strong>
          {titleCase(c.shortName)} · {c.party} {c.number}
        </strong>
        {current && data?.candidates.some((r) => r.votes > 0) ? (
          <>
            <Pct value={current.percent} />
            <span>
              <Int value={current.votes} /> votos
            </span>
            <span>{data!.candidates.filter((r) => r.votes > current.votes).length + 1}º lugar</span>
          </>
        ) : (
          <span className="text-ink-3">{current ? 'Sem votos apurados' : 'Sem resultado neste recorte'}</span>
        )}
      </div>
      <p className="text-caption text-ink-3">
        Lidera em {rows.filter((r) => r.rank === 1 && r.candidates?.filter((x) => x.votes === r.row.votes).length === 1).length} de {total}{' '}
        {unit}
        {regions.filter((r) => r.candidates).length < total && ` (${regions.filter((r) => r.candidates).length} de ${total} carregados)`}
      </p>
      <div className="grid grid-cols-2 gap-4">
        {[
          ['Melhores resultados', rows.slice(0, 5)],
          ['Menores percentuais', [...rows].reverse().slice(0, 5)],
        ].map(([label, list]) => (
          <div key={label as string}>
            <p className="eyebrow mb-1">{label as string}</p>
            {(list as typeof rows).map((r) => (
              <button
                key={r.id}
                className="flex w-full justify-between gap-2 py-1 text-left text-caption hover:bg-hover"
                onClick={() => onFly(r.id)}
              >
                <span className="truncate">{titleCase(r.name)}</span>
                <span>{fmtPct(r.row.percent)}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
      {!rows.length && <p className="text-ink-3">Aguardando resultados das regiões.</p>}
    </div>
  );
}

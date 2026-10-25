import { useEffect, useState } from 'react';
import { fetchZoneResult } from '../lib/tse/client';
import { parseResult } from '../lib/tse/parse';
import { fetchSectionIndex, fetchSectionFiles, fetchBoletim, type SectionRef } from '../lib/tse/urna';
import { fmtBuDate, type BoletimUrna } from '../lib/tse/bu';
import { OFFICES } from '../lib/tse/config';
import type { CandidateRow, MunicipalityRef, OfficeId, ParsedResult, Round } from '../lib/tse/types';
import { fmtPct, titleCase } from '../lib/ui/format';
import { Int, Pct } from './ui/Num';
import { Skeleton } from './ui/Skeleton';
import { Tabs } from './ui/Tabs';
// Compartilhado entre montagens, inclusive a repetição de efeitos do Strict Mode.
let activeZones = 0;
const zoneWaiters: (() => void)[] = [];
async function withZoneSlot<T>(load: () => Promise<T>): Promise<T> {
  if (activeZones >= 6) await new Promise<void>((resolve) => zoneWaiters.push(resolve));
  else activeZones++;
  try {
    return await load();
  } finally {
    const next = zoneWaiters.shift();
    if (next) next();
    else activeZones--;
  }
}
export function Zones({
  municipality: m,
  round,
  officeId,
  candidates,
  selected,
}: {
  municipality: MunicipalityRef;
  round: Round;
  officeId: OfficeId;
  candidates: CandidateRow[];
  selected?: CandidateRow;
}) {
  const [results, setResults] = useState<Record<string, ParsedResult | null>>({});
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [zone, setZone] = useState<string | null>(m.zones.length === 1 ? m.zones[0] : null);
  useEffect(() => {
    let alive = true;
    let next = 0;
    async function worker() {
      while (alive && next < m.zones.length) {
        const z = m.zones[next++];
        try {
          const raw = await withZoneSlot(() =>
            alive ? fetchZoneResult(round, officeId, m.uf.toLowerCase(), m.tseCode, z) : Promise.resolve(null),
          );
          if (!raw || !alive) continue;
          const d = parseResult(raw, {
            round,
            officeId,
            scopeLabel: `Zona ${z}`,
          });
          if (alive) setResults((p) => ({ ...p, [z]: d }));
        } catch {
          if (alive) setResults((p) => ({ ...p, [z]: null }));
        }
      }
    }
    void Promise.all(Array.from({ length: Math.min(6, m.zones.length) }, worker));
    return () => {
      alive = false;
    };
  }, [m, round, officeId]);
  const d = zone ? results[zone] : undefined;
  return (
    <div className="space-y-3">
      {zone ? (
        <>
          <button
            className="btn text-caption"
            onClick={() => {
              setZone(null);
              setSectionsOpen(false);
            }}
          >
            Todas as zonas
          </button>
          <h3 className="text-title">Zona {zone}</h3>
          {d === undefined ? (
            <Skeleton className="h-20 w-full" />
          ) : d === null ? (
            <p>Não foi possível obter o resultado desta zona no TSE.</p>
          ) : (
            <>
              <p className="text-caption text-ink-3">{fmtPct(d.turnout.sectionsPct)} apurado</p>
              {!sectionsOpen && <CandidateRows rows={d.candidates} />}
            </>
          )}
          <Sections
            key={zone}
            onToggle={setSectionsOpen}
            {...{ round, officeId, zone }}
            municipality={m}
            candidates={d?.candidates ?? candidates}
          />
        </>
      ) : m.zones.length ? (
        <div>
          {[...m.zones].sort().map((z) => {
            const r = results[z];
            const c = selected ? r?.candidates.find((c) => c.sqcand === selected.sqcand) : r?.candidates[0];
            return (
              <button
                key={z}
                className="block w-full border-b border-line py-3 text-left hover:bg-hover"
                onClick={() => {
                  setZone(z);
                  setSectionsOpen(false);
                }}
              >
                <div className="flex justify-between text-small">
                  <strong>Zona {z}</strong>
                  <span>{r ? `${fmtPct(r.turnout.sectionsPct)} apurado` : r === null ? 'Indisponível' : 'Carregando…'}</span>
                </div>
                {r === undefined ? (
                  <Skeleton className="mt-2 h-4 w-full" />
                ) : (
                  r && (
                    <>
                      <p className="mt-1 text-caption text-ink-2">
                        {c ? `${titleCase(c.shortName)} · ${fmtPct(c.percent)}` : 'Sem votos apurados'}
                      </p>
                      <div className="mt-2 flex h-1 overflow-hidden rounded-full bg-hover">
                        {r.candidates.slice(0, 2).map((c) => (
                          <span
                            key={c.sqcand}
                            style={{
                              width: `${c.percent}%`,
                              background: c.color,
                            }}
                          />
                        ))}
                      </div>
                    </>
                  )
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <p>O TSE não informou as zonas deste município.</p>
      )}
    </div>
  );
}
function CandidateRows({ rows }: { rows: CandidateRow[] }) {
  return (
    <ol>
      {rows.map((c, i) => (
        <li key={c.sqcand} className="flex items-center justify-between gap-3 py-1.5 text-small">
          <span className="min-w-0 truncate">
            {i + 1}º · {titleCase(c.shortName)}{' '}
            <small className="text-ink-3">
              {c.number} · {c.party}
            </small>
          </span>
          <span className="shrink-0">
            <Int value={c.votes} /> · <Pct value={c.percent} />
          </span>
        </li>
      ))}
    </ol>
  );
}
function Sections({
  onToggle,
  municipality: m,
  round,
  officeId,
  zone,
  candidates,
}: {
  onToggle: (open: boolean) => void;
  municipality: MunicipalityRef;
  round: Round;
  officeId: OfficeId;
  zone: string;
  candidates: CandidateRow[];
}) {
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState<SectionRef[] | null>(null);
  const [error, setError] = useState('');
  const [section, setSection] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetchSectionIndex(round, m.uf.toLowerCase())
      .then((idx) => {
        if (alive) setSections(idx.get(m.tseCode)?.get(zone) ?? []);
      })
      .catch(() => {
        if (alive) setError('Não foi possível carregar o índice de seções.');
      });
    return () => {
      alive = false;
    };
  }, [open, round, m, zone]);
  return (
    <div className="border-t border-line pt-3">
      <button
        className="btn btn-solid"
        onClick={() => {
          setOpen(!open);
          onToggle(!open);
        }}
      >
        Seções
      </button>
      {!open && ['SP', 'MG', 'RJ'].includes(m.uf.toUpperCase()) && (
        <p className="mt-1 text-nano text-ink-3">
          Carrega o índice da UF inteira
          {m.uf.toUpperCase() === 'SP' ? ' (cerca de 460 KB compactados)' : ''}.
        </p>
      )}
      {open && (
        <div className="mt-3">
          {error ? (
            <p>{error}</p>
          ) : sections === null ? (
            <Skeleton className="h-16 w-full" />
          ) : section ? (
            <>
              <button className="btn text-caption" onClick={() => setSection(null)}>
                Todas as seções
              </button>
              <Boletim key={section} {...{ round, officeId, zone, section, candidates }} municipality={m} />
            </>
          ) : (
            <>
              <p className="mb-2 text-caption text-ink-3">{sections.length} seções · esmaecidas: ainda não recebidas</p>
              <div className="flex flex-wrap gap-1">
                {sections.map((s) => (
                  <button
                    key={s.ns}
                    className={`cell px-2 py-1.5 font-mono text-caption ${s.receivedAt ? '' : 'opacity-40'}`}
                    onClick={() => setSection(s.ns)}
                  >
                    Seção {s.ns}
                  </button>
                ))}
              </div>
              {!sections.length && <p>O TSE ainda não publicou seções para esta zona.</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
function Boletim({
  municipality: m,
  round,
  officeId,
  zone,
  section,
  candidates,
}: {
  municipality: MunicipalityRef;
  round: Round;
  officeId: OfficeId;
  zone: string;
  section: string;
  candidates: CandidateRow[];
}) {
  const [bu, setBu] = useState<BoletimUrna | null>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const files = await fetchSectionFiles(round, m.uf.toLowerCase(), m.tseCode, zone, section);
        if (!alive) return;
        if (!files?.bu) {
          setError('O TSE ainda não publicou o boletim desta seção.');
          return;
        }
        setUrl(files.bu);
        try {
          const decoded = await fetchBoletim(files.bu);
          if (alive) setBu(decoded);
        } catch {
          if (alive) setError('Não foi possível decodificar o boletim publicado pelo TSE.');
        }
      } catch {
        if (alive) setError('Não foi possível buscar o boletim no TSE.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [m, round, officeId, zone, section]);
  const election = bu?.elections.find((e) => e.electionId === Number(OFFICES.find((o) => o.id === officeId)!.electionCode(round)));
  const office = election?.offices.find((o) => o.officeCode === Number(officeId));
  return (
    <div className="space-y-3">
      <h3 className="text-title">Boletim · Seção {section}</h3>
      {error ? (
        <p className="text-small text-ink-2">{error}</p>
      ) : !bu ? (
        <Skeleton className="h-24 w-full" />
      ) : !office || !election ? (
        <p>Este boletim não contém o cargo e turno selecionados.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-4 text-caption">
            <span>
              Aptos <Int value={election.electorate} />
            </span>
            <span>
              Comparecimento <Int value={office.turnout} />
            </span>
            <span>
              Abstenção <Int value={election.electorate - office.turnout} />
            </span>
          </div>
          <ol>
            {office.votes.map((v, i) => {
              const c = v.kind === 'nominal' ? candidates.find((c) => Number(c.number) === v.number) : undefined;
              const label = c
                ? `${titleCase(c.shortName)} · ${c.number} · ${c.party}`
                : v.kind === 'nominal'
                  ? `Número ${v.number}`
                  : {
                      branco: 'Brancos',
                      nulo: 'Nulos',
                      legenda: `Legenda ${v.number ?? v.party ?? ''}`,
                      semCandidato: 'Sem candidato',
                    }[v.kind];
              return (
                <li key={i} className="flex justify-between gap-2 py-1 text-small">
                  <span>{label}</span>
                  <Int value={v.votes} />
                </li>
              );
            })}
          </ol>
          {bu.emittedAt && <p className="text-nano text-ink-3">Emitido em {fmtBuDate(bu.emittedAt)}</p>}
        </>
      )}
      {url && (
        <a
          className="text-caption text-accent"
          target="_blank"
          rel="noreferrer"
          href={url.replace('/api/tse', 'https://resultados.tse.jus.br')}
        >
          Arquivo original no TSE ↗
        </a>
      )}
    </div>
  );
}
export function DetailTabs({
  result,
  candidate,
  zones,
}: {
  result: React.ReactNode;
  candidate?: React.ReactNode;
  zones?: React.ReactNode;
}) {
  const [tab, setTab] = useState(candidate ? 'candidate' : 'result');
  return (
    <>
      <Tabs
        variant="line"
        label="Dados do recorte"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'result', label: 'Resultado' },
          ...(candidate ? [{ value: 'candidate', label: 'Candidato' }] : []),
          ...(zones ? [{ value: 'zones', label: 'Zonas' }] : []),
        ]}
      />
      <div className="scroll-y min-h-0 max-h-[42dvh] py-3" data-dock-anim>
        {tab === 'zones' && zones ? zones : tab === 'candidate' && candidate ? candidate : result}
      </div>
    </>
  );
}
